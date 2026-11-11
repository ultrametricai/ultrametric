#!/usr/bin/env python3
# Generic fail-closed evidence verifier for the scheduled api-quality gap-repair workflow
# (.github/workflows/api-gap-repair.yml). This is the reusable core of the dated local
# wave scripts (append-api-quality-gap-evidence-*.py), driven by a wave manifest instead
# of hardcoded ITEMS: marker verification against the live page, NEGATIVE_CHECKS with
# exact expected statuses (the #502 convention), recorded POST_CHECKS, TLS_MISMATCH_CHECKS,
# and per-host courtesy pacing.
#
# The one behavioral difference from the local scripts: a verification failure WITHHOLDS
# that item (ledger disposition `withheld-verification-failed`) instead of aborting the
# run, so a single changed page cannot strand the rest of a CI wave. Nothing unverified is
# ever appended, and withheld rows stay out of the ledger's `cells`, so the staleness
# signature keeps flagging them (rankings-engine/scripts/staleness-scan.ts reads only
# `cells` for gap suppression).
#
#   python3 rankings-engine/scripts/api-gap-verify.py \
#     --manifest <wave-manifest.json> --ledger <out.json> --ledger-md <out.md> \
#     [--root <repo root>] [--fixture <url->response json>]
#
# --fixture replaces the network with a committed map (tests only): each key is a URL
# ("POST <url>" for POST checks, "TLS <host>" for TLS checks) mapping to
# {"status": int, "body": str, "exit": int} ({"exit": int, "cert": str} for TLS).
import argparse
import datetime
import json
import os
import re
import subprocess
import sys
import time
from urllib.parse import urlparse

# Recorded probe-evidence convention (immutable identifier — see AGENTS.md): the UA suffix
# matches the one the dated wave scripts and runtime probes recorded.
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 productarena-probe'


class Verifier:
    def __init__(self, host_delays=None, fixture=None):
        self._cache = {}
        self._host_delays = host_delays or {}
        self._fixture = fixture

    def fetch(self, url):
        if url in self._cache:
            return self._cache[url]
        if self._fixture is not None:
            hit = self._fixture.get(url, {'status': 0, 'body': '', 'exit': 0})
            status = 0 if hit.get('exit', 0) != 0 else int(hit.get('status', 0))
            self._cache[url] = (status, hit.get('body', ''))
            return self._cache[url]
        delay = self._host_delays.get(urlparse(url).netloc)
        if delay:
            time.sleep(delay)
        # --http1.1: some hosts fail HTTP/2 negotiation but serve HTTP/1.1 fine (the
        # tech.sevdesk.com lesson from wave 10). Bytes are decoded with errors='replace'
        # (matching discovery's fetch), so undecodable vendor bytes become a marker
        # mismatch for that item instead of an exception that stops the wave.
        r = subprocess.run(
            ['curl', '-sL', '--http1.1', '--max-time', '60', '-A', UA, '-w', '\n---META %{http_code}', url],
            capture_output=True, timeout=120)
        stdout = r.stdout.decode('utf-8', 'replace')
        body, _, meta = stdout.rpartition('\n---META ')
        status = int(meta.strip() or 0)
        # Non-zero curl exits (partial transfer, timeout) must not pass as clean reads.
        if r.returncode != 0:
            status = 0
        self._cache[url] = (status, body)
        return self._cache[url]

    def verify(self, url, markers):
        """Fail-closed marker check: HTTP 200 and every marker present, or a reason string."""
        status, body = self.fetch(url)
        if status != 200:
            return f'{url} returned {status}; refusing to append unverified evidence'
        text = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', body))
        for marker in markers:
            if marker not in text and marker not in body:
                return f'{url} does not contain {marker!r}; the page changed — re-derive the excerpt'
        return None

    def verify_absent(self, checks):
        """Replay asserted negatives with EXACT expected statuses (default {404})."""
        for entry in checks:
            url, expected = (entry, {404}) if isinstance(entry, str) else (entry[0], set(entry[1]))
            status, _ = self.fetch(url)
            if status not in expected:
                return f'{url} answered {status}, expected one of {sorted(expected)}; inconclusive'
        return None

    def verify_post(self, url, payload, expected_status, markers):
        """Replay a recorded POST probe: exact status and every response marker."""
        if self._fixture is not None:
            hit = self._fixture.get(f'POST {url}', {'status': 0, 'body': '', 'exit': 0})
            if hit.get('exit', 0) != 0:
                return f'POST {url}: curl exit {hit["exit"]} (incomplete transfer) — inconclusive'
            status, body = int(hit.get('status', 0)), hit.get('body', '')
        else:
            r = subprocess.run(
                ['curl', '-s', '--http1.1', '--max-time', '45', '-A', UA, '-X', 'POST',
                 '-H', 'Content-Type: application/json', '-d', payload,
                 '-w', '\n---META %{http_code}', url],
                capture_output=True, timeout=90)
            stdout = r.stdout.decode('utf-8', 'replace')
            body, _, meta = stdout.rpartition('\n---META ')
            status = int(meta.strip() or 0)
            if r.returncode != 0:
                return f'POST {url}: curl exit {r.returncode} (incomplete transfer) — inconclusive'
        if status != expected_status:
            return f'POST {url} answered {status}, expected {expected_status} — inconclusive'
        for marker in markers:
            if marker not in body:
                return f'POST {url} response does not contain {marker!r}; re-derive the probe'
        return None

    def verify_tls_mismatch(self, host, url, recorded_wrong_name):
        """Replay a recorded TLS-mismatch counter-check (curl exit 51/60 + wrong cert name)."""
        if self._fixture is not None:
            hit = self._fixture.get(f'TLS {host}', {'exit': 0, 'cert': ''})
            exit_code, cert = hit.get('exit', 0), hit.get('cert', '')
        else:
            r = subprocess.run(['curl', '-s', '--max-time', '30', '-A', UA, url, '-o', '/dev/null'],
                               capture_output=True, timeout=60)
            exit_code = r.returncode
            s = subprocess.run(f'echo | openssl s_client -connect {host}:443 -servername {host} 2>/dev/null '
                               '| openssl x509 -noout -subject -ext subjectAltName 2>/dev/null',
                               shell=True, capture_output=True, timeout=60)
            cert = s.stdout.decode('utf-8', 'replace')
        if exit_code not in (51, 60):
            return f'{url}: curl exit {exit_code}, expected a TLS verification failure — inconclusive'
        if not cert.strip() or host in cert or recorded_wrong_name not in cert:
            return f'{host}: certificate state drifted — re-derive the counter-check'
        return None


def verify_item(item, manifest, verifier):
    """Run every fail-closed check an item declares; None = verified, else the reason."""
    iid = item['id']
    checked = False
    for family, fn in (
        ('negativeChecks', lambda spec: verifier.verify_absent(spec)),
        ('postChecks', lambda spec: verifier.verify_post(spec['url'], spec['payload'], spec['expectedStatus'], spec['markers'])),
        ('tlsMismatchChecks', lambda spec: verifier.verify_tls_mismatch(spec['host'], spec['url'], spec['recordedWrongName'])),
    ):
        spec = manifest.get(family, {}).get(iid)
        if spec is not None:
            checked = True
            reason = fn(spec)
            if reason:
                return reason
    if item.get('markers'):
        return verifier.verify(item['url'], item['markers'])
    if not checked:
        return 'item declares no live verification (no markers, no checks); refusing to append'
    return None


def append_evidence(root, item, now):
    """Append a verified row to the product's evidence pack; returns the disposition note."""
    ef = os.path.join(root, 'open-rankings', item['arena'], 'evidence', f"{item['product']}.json")
    with open(ef) as f:
        ev = json.load(f)
    if any(e['id'] == item['id'] for e in ev):
        return 'already present'
    row = {'id': item['id'], 'tier': item['tier'], 'url': item['url'],
           'excerpt': item['excerpt'], 'fetchedAt': now}
    if item.get('preserve'):
        row['preserve'] = True
    ev.append(row)
    with open(ef, 'w') as f:
        f.write(json.dumps(ev, indent=2, ensure_ascii=False) + '\n')
    return 'appended'


def build_ledger(manifest, results, now):
    """Ledger: `cells` holds ONLY verified appends (staleness-scan reads cells for gap
    suppression); everything unverified or unresearched lands in `withheld`."""
    cells, withheld = [], list(manifest.get('withheld', []))
    for item, (verified, note) in results:
        base = {'arena': item['arena'], 'product': item['product'], 'storyId': item['storyId']}
        if verified:
            cells.append({**base, 'disposition': 'evidence-appended', 'evidenceId': item['id'],
                          'url': item['url'], 'note': note})
        else:
            withheld.append({**base, 'disposition': 'withheld-verification-failed',
                             'url': item['url'], 'reason': note})
    return {
        'wave': manifest['wave'],
        'date': manifest['date'],
        'scan': manifest['scan'],
        'generatedAt': now,
        'generator': '.github/workflows/api-gap-repair.yml via rankings-engine/scripts/api-gap-verify.py',
        'deferred': manifest.get('deferred', []),
        'needsHuman': manifest.get('needsHuman', []),
        'cells': cells,
        'withheld': withheld,
    }


def build_ledger_md(ledger):
    by_product = {}
    for cell in ledger['cells']:
        by_product.setdefault((cell['arena'], cell['product']), {'appended': 0, 'withheld': 0})['appended'] += 1
    for row in ledger['withheld']:
        by_product.setdefault((row['arena'], row['product']), {'appended': 0, 'withheld': 0})['withheld'] += 1
    lines = [f"# API-quality gap repairs, scheduled wave ({ledger['date']})", '']
    lines.append(f"{ledger['scan']}. {len(ledger['cells'])} evidence rows appended after fail-closed live "
                 f"verification; {len(ledger['withheld'])} cells withheld (never guessed) and still flagged "
                 'for a research wave.')
    lines.append('')
    lines.append('| product | arena | evidence rows appended | withheld |')
    lines.append('|---------|-------|-----------------------:|---------:|')
    for (arena, product), counts in sorted(by_product.items()):
        lines.append(f"| {product} | {arena} | {counts['appended']} | {counts['withheld']} |")
    if ledger['needsHuman']:
        lines.append('')
        lines.append('Routed to the needs-human issue instead of this wave:')
        lines.append('')
        for row in ledger['needsHuman']:
            lines.append(f"- **{row['arena']}/{row['product']}** — {row['reason']}")
    if ledger['deferred']:
        lines.append('')
        lines.append('Deferred:')
        lines.append('')
        for row in ledger['deferred']:
            lines.append(f"- **{row['arena']}/{row['product']}** — {row['reason']}")
    return '\n'.join(lines) + '\n'


_verdicts_cache = {}


def _verdict_cites_evidence(root, arena, product, story_id):
    f = os.path.join(root, 'open-rankings', arena, 'verdicts.json')
    if f not in _verdicts_cache:
        try:
            with open(f) as fh:
                _verdicts_cache[f] = json.load(fh)
        except (OSError, json.JSONDecodeError):
            _verdicts_cache[f] = []
    for v in _verdicts_cache[f]:
        if v.get('productId') == product and v.get('storyId') == story_id:
            return bool(v.get('evidenceIds'))
    return False


def load_prior_outstanding(root, exclude_file=None):
    """Withheld rows from earlier committed wave ledgers that nothing has resolved yet.

    A product drops out of the gap scan as soon as ONE api-quality cell gains a citation,
    and the needs-human issue supersession closes the previous issue — so a withheld cell
    recorded by an earlier wave would silently leave the queue. Carry it forward until a
    ledger cell covers it or its current verdict cites evidence."""
    reports_dir = os.path.join(root, 'reports', 'evidence-parity')
    if not os.path.isdir(reports_dir):
        return []
    covered, withheld = set(), {}
    for name in sorted(os.listdir(reports_dir)):
        if not re.search(r'api-quality.*\.json$', name):
            continue
        path = os.path.join(reports_dir, name)
        if exclude_file and os.path.abspath(path) == os.path.abspath(exclude_file):
            continue
        try:
            with open(path) as fh:
                data = json.load(fh)
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(data, dict):
            continue
        for c in data.get('cells') or []:
            if isinstance(c, dict) and c.get('arena') and c.get('product') and c.get('storyId'):
                covered.add((c['arena'], c['product'], c['storyId']))
        for w in data.get('withheld') or []:
            if isinstance(w, dict) and w.get('arena') and w.get('product') and w.get('storyId'):
                withheld[(w['arena'], w['product'], w['storyId'])] = {**w, 'carriedFrom': name}
    return [row for key, row in withheld.items()
            if key not in covered and not _verdict_cites_evidence(root, *key)]


def build_issue_md(ledger, carried=None, assume_published=True):
    """The needs-human issue body: routed rows PLUS every withheld cell — this run's and
    the still-outstanding rows carried from earlier committed ledgers — so unfinished
    research stays in the human queue even on a zero-append run (where no ledger is
    committed) and after the gap signature clears. Returns None when there is nothing
    for a human to act on."""
    # A carried row is superseded by anything THIS run recorded for the same cell: a
    # fresh withheld row (newer reason wins) or a verified append (the research is done;
    # load_prior_outstanding read the verdicts before this run judged, so it cannot see
    # the repair itself). Appends supersede ONLY under assume_published: when judging or
    # a later gate fails, the appended evidence never reaches main, so the workflow files
    # the assume_published=False body instead and the carried row stays in the queue.
    superseding = ledger['withheld'] + (ledger['cells'] if assume_published else [])
    current_keys = {(r['arena'], r['product'], r['storyId']) for r in superseding}
    carried = [row for row in (carried or [])
               if (row['arena'], row['product'], row['storyId']) not in current_keys]
    ledger = {**ledger, 'withheld': ledger['withheld'] + [
        {**row, 'reason': f"{row.get('reason', '')} (carried forward from {row['carriedFrom']})".strip()}
        for row in carried
    ]}
    if not ledger['needsHuman'] and not ledger['withheld']:
        return None
    lines = [f"## api-gap-repair: rows needing a human — {ledger['date']}", '']
    lines.append('These rows are outside the autonomous workflow: affiliated/disclosed products need '
                 'disclosure review and a bias audit, excluded rows carry a standing reason, and '
                 'withheld cells were checked but not verifiable mechanically. A coordinator agent '
                 'repairs them through the dated local wave template (`reports/evidence-parity/`).')
    if ledger['needsHuman']:
        lines.append('')
        lines.append('| product | arena | reason |')
        lines.append('|---------|-------|--------|')
        for row in ledger['needsHuman']:
            lines.append(f"| {row['product']} | {row['arena']} | {row['reason']} |")
    if ledger['withheld']:
        lines.append('')
        lines.append('### Withheld cells (the research queue)')
        lines.append('')
        lines.append('Nothing was appended for these cells. The gap signature stops flagging a product '
                     'once any of its api-quality cells gains cited evidence, so the remainder is '
                     'tracked here, not by the scan.')
        lines.append('')
        lines.append('| product | arena | story | disposition | reason |')
        lines.append('|---------|-------|-------|-------------|--------|')
        for row in ledger['withheld']:
            lines.append(f"| {row['product']} | {row['arena']} | {row['storyId']} | {row['disposition']} | {row.get('reason', '')} |")
    if ledger['deferred']:
        lines.append('')
        lines.append('Deferred this run (no action needed yet):')
        lines.append('')
        for row in ledger['deferred']:
            lines.append(f"- **{row['arena']}/{row['product']}** — {row['reason']}")
    lines.append('')
    lines.append('_Generated by api-gap-repair.yml. Close after the listed rows have been repaired or ruled on._')
    return '\n'.join(lines) + '\n'


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--ledger', required=True)
    parser.add_argument('--ledger-md', required=True)
    parser.add_argument('--issue-body')
    parser.add_argument('--issue-body-unpublished')
    parser.add_argument('--root', default=os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
    parser.add_argument('--fixture')
    args = parser.parse_args(argv)

    with open(args.manifest) as f:
        manifest = json.load(f)
    fixture = None
    if args.fixture:
        with open(args.fixture) as f:
            fixture = json.load(f)

    now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
    verifier = Verifier(host_delays=manifest.get('hostDelays'), fixture=fixture)

    results = []
    for item in manifest.get('items', []):
        # Per-item containment: any check that raises (curl timeout, connection teardown)
        # withholds THIS item instead of stopping the wave before the ledger exists.
        try:
            reason = verify_item(item, manifest, verifier)
        except Exception as exc:  # noqa: BLE001 — withheld-with-reason is the fail-closed path
            reason = f'verification raised {type(exc).__name__}: {exc}'
        if reason is None:
            note = append_evidence(args.root, item, now)
            results.append((item, (True, note)))
            print(f"verified + {note}: {item['id']} -> {item['arena']}/{item['product']}")
        else:
            results.append((item, (False, reason)))
            print(f"withheld {item['id']}: {reason}")

    ledger = build_ledger(manifest, results, now)
    outputs = [(args.ledger, json.dumps(ledger, indent=2, ensure_ascii=False) + '\n'),
               (args.ledger_md, build_ledger_md(ledger))]
    if args.issue_body or args.issue_body_unpublished:
        carried = load_prior_outstanding(args.root, exclude_file=args.ledger)
        bodies = [(args.issue_body, True), (args.issue_body_unpublished, False)]
        for path_, assume_published in bodies:
            if not path_:
                continue
            issue_md = build_issue_md(ledger, carried, assume_published=assume_published)
            if issue_md is not None:
                outputs.append((path_, issue_md))
            elif os.path.exists(path_):
                # Nothing for a human in this variant: drop a stale body so the workflow
                # files no issue from it.
                os.remove(path_)
    for out, content in outputs:
        os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
        with open(out, 'w') as f:
            f.write(content)
    appended = sum(1 for _, (ok, _note) in results if ok)
    print(f'api-gap-verify: {appended} appended, {len(results) - appended} withheld, '
          f"{len(ledger['withheld'])} total withheld rows -> {args.ledger}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
