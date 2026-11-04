#!/usr/bin/env python3
"""Repair evidence omitted from the #489/#490 vendor bring-up packs.

The original extraction quoted Zoom Scribe's batch size and storage behavior but
missed the same official page's API schema, job lifecycle, failure, and signed-
webhook sections. It also missed Zoom's live machine-readable AI Services spec.
The turbopuffer pack retained honest 404 probes for conventional spec paths while
omitting the official docs' link to its public OpenAPI repository.

Every row is verified against its live first-party source before any file is
written. Existing rows keep their original fetchedAt value and must still match
the canonical row. The negative probe evidence remains in each pack.

After running, re-run the scoped judges for speech-to-text/zoom-scribe and
vector-databases/turbopuffer, then derive and regenerate canonical projections.
"""

import datetime
import json
import re
import subprocess
from pathlib import Path


NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')


ITEMS = [
    {
        'category': 'speech-to-text',
        'product': 'zoom-scribe',
        'id': 'zoom-scribe-supp-openapi-docs',
        'tier': 'claimed-docs',
        'url': 'https://developers.zoom.us/docs/api/ai-services.md',
        'markers': [
            'OpenAPI Version:',
            '/aiservices/scribe/jobs',
            '/aiservices/scribe/jobs/{jobId}',
            '/aiservices/scribe/jobs/{jobId}/files/{fileId}',
        ],
        'excerpt': (
            "Zoom's AI Services API reference identifies OpenAPI 3.1.1 and API version 2, then "
            'documents the Scribe operation catalog: submit and list batch jobs, get or cancel a '
            'job, list job files, retrieve an individual file, transcribe synchronously, and open '
            'the Live Scribe WebSocket.'
        ),
    },
    {
        'category': 'speech-to-text',
        'product': 'zoom-scribe',
        'id': 'zoom-scribe-supp-openapi-probe',
        'tier': 'probe',
        'url': 'https://developers.zoom.us/api/zoap/ai-services/methods/',
        'markers': [
            '"openapi":"3.0.0"',
            '"version":"2"',
            '"/aiservices/scribe/jobs/{jobId}/files/{fileId}"',
        ],
        'excerpt': (
            'PROBE openapi: HTTP 200 application/json at '
            'https://developers.zoom.us/api/zoap/ai-services/methods/; the payload declares '
            'OpenAPI 3.0.0, AI Services API version 2, and six Scribe paths covering synchronous, '
            'live, batch-job, status, and per-file operations.'
        ),
        'preserve': True,
    },
    {
        'category': 'speech-to-text',
        'product': 'zoom-scribe',
        'id': 'zoom-scribe-supp-sync-api-schema',
        'tier': 'claimed-docs',
        'url': 'https://developers.zoom.us/docs/api/ai-services.md',
        'markers': [
            '/aiservices/scribe/transcribe',
            'Maximum file size: 100MB',
            'Maximum duration: 2 hours',
            'word_time_offsets',
            "The speaker tag (e.g., 'speaker",
        ],
        'excerpt': (
            'POST /aiservices/scribe/transcribe accepts a single local audio or video file up to '
            '100 MB and two hours, with documented format, diarization, channel-separation, word '
            'timestamp, language, vocabulary, and polishing controls. Its JSON response includes '
            'transcript segments, speaker or channel labels, and timing fields.'
        ),
    },
    {
        'category': 'speech-to-text',
        'product': 'zoom-scribe',
        'id': 'zoom-scribe-supp-batch-input-metadata',
        'tier': 'claimed-docs',
        'url': 'https://developers.zoom.us/docs/api/ai-services.md',
        'markers': [
            'reference_id',
            'pre-signed',
            'manifest',
            'input_uri',
            'output_uri',
        ],
        'excerpt': (
            'Batch jobs accept cloud URI, prefix, or manifest inputs, including pre-signed object '
            'URLs, and return output locations per file. A caller-supplied reference_id is '
            'preserved for tracking and correlation across the job and status schemas.'
        ),
    },
    {
        'category': 'speech-to-text',
        'product': 'zoom-scribe',
        'id': 'zoom-scribe-supp-batch-lifecycle',
        'tier': 'claimed-docs',
        'url': 'https://developers.zoom.us/docs/ai-services/scribe/batch-mode.md',
        'markers': [
            'Get batch job status',
            '/aiservices/scribe/jobs/{jobId}',
            'QUEUED',
            'PROCESSING',
            'SUCCEEDED',
            'PARTIAL',
            'FAILED',
            'CANCELED',
        ],
        'excerpt': (
            'Batch mode documents POST /aiservices/scribe/jobs plus get-status, list-jobs, '
            'cancel-job, list-files, and get-file endpoints. Jobs expose QUEUED, PROCESSING, '
            'SUCCEEDED, PARTIAL, FAILED, and CANCELED states, while status responses include '
            'per-state file counts and result locations.'
        ),
    },
    {
        'category': 'speech-to-text',
        'product': 'zoom-scribe',
        'id': 'zoom-scribe-supp-batch-webhooks',
        'tier': 'claimed-docs',
        'url': 'https://developers.zoom.us/docs/ai-services/scribe/batch-mode.md',
        'markers': [
            'webhook notifications when a job finishes',
            'webhook_url',
            'x-zm-signature',
            'HMAC-SHA256',
            'timing-safe comparison',
        ],
        'excerpt': (
            'A batch submission can register notifications.webhook_url and a secret to receive '
            'an outbound POST when the job finishes. Zoom signs each request with an '
            'x-zm-signature HMAC-SHA256 value and timestamp; the docs give the exact verification '
            'string, require timing-safe comparison, and require rejection of stale timestamps.'
        ),
    },
    {
        'category': 'speech-to-text',
        'product': 'zoom-scribe',
        'id': 'zoom-scribe-supp-batch-failures',
        'tier': 'claimed-docs',
        'url': 'https://developers.zoom.us/docs/ai-services/scribe/batch-mode.md',
        'markers': [
            'If any file fails or is skipped while others succeed, the job ends in `PARTIAL`',
            'FILE_FAILED',
            'FILE_SKIPPED',
            'UNSUPPORTED_MEDIA',
        ],
        'excerpt': (
            'Files are processed independently: mixed success and failure yields a PARTIAL job '
            'with succeeded, failed, skipped, and canceled counts. Per-file states include '
            'FILE_FAILED and FILE_SKIPPED; unsupported extensions are skipped with the '
            'UNSUPPORTED_MEDIA error code.'
        ),
    },
    {
        'category': 'vector-databases',
        'product': 'turbopuffer',
        'id': 'turbopuffer-supp-openapi-docs',
        'tier': 'claimed-docs',
        'url': 'https://turbopuffer.com/docs/api-overview.md',
        'markers': [
            'The API has a public OpenAPI specification available at:',
            'https://github.com/turbopuffer/turbopuffer-openapi',
        ],
        'excerpt': (
            'The API overview states that turbopuffer has a public OpenAPI specification and '
            'links the official turbopuffer/turbopuffer-openapi repository.'
        ),
    },
    {
        'category': 'vector-databases',
        'product': 'turbopuffer',
        'id': 'turbopuffer-supp-openapi-repo',
        'tier': 'github',
        'url': 'https://github.com/turbopuffer/turbopuffer-openapi',
        'fetch_url': 'https://raw.githubusercontent.com/turbopuffer/turbopuffer-openapi/main/README.md',
        'markers': [
            'turbopuffer OpenAPI specification',
            'View the spec',
            "primarily intended for turbopuffer's internal use",
            'Breaking changes may be made at any time',
            'Our official clients are generated from this spec',
        ],
        'excerpt': (
            'The official turbopuffer OpenAPI repository publishes openapi.yml and says its '
            'official TypeScript, Python, Go, Java, C#, and Rust clients are generated from the '
            'spec. Its README cautions that the spec is primarily for internal use, may contain '
            'nonstandard features, and may make breaking changes at any time.'
        ),
    },
]


def fetch(url: str) -> tuple[int, str]:
    result = subprocess.run(
        ['curl', '-sS', '-L', '--max-time', '30', '-w', '\n---META %{http_code}', url],
        capture_output=True,
        text=True,
        timeout=40,
        check=False,
    )
    body, separator, meta = result.stdout.rpartition('\n---META ')
    if not separator:
        raise SystemExit(f'{url}: curl did not return an HTTP status')
    return int(meta.strip() or 0), body


def verify(item: dict) -> None:
    fetch_url = item.get('fetch_url', item['url'])
    status, body = fetch(fetch_url)
    if status != 200:
        raise SystemExit(f'{fetch_url} returned HTTP {status}; refusing to append evidence')
    normalized = re.sub(r'\s+', ' ', body)
    for marker in item['markers']:
        marker_normalized = re.sub(r'\s+', ' ', marker)
        if marker_normalized not in normalized:
            raise SystemExit(
                f'{fetch_url} no longer contains {marker!r}; refusing to append stale evidence'
            )


def canonical_row(item: dict) -> dict:
    row = {
        'id': item['id'],
        'tier': item['tier'],
        'url': item['url'],
        'excerpt': item['excerpt'],
        'fetchedAt': NOW,
    }
    if item.get('preserve'):
        row['preserve'] = True
    return row


def main() -> None:
    for item in ITEMS:
        verify(item)

    grouped: dict[tuple[str, str], list[dict]] = {}
    for item in ITEMS:
        grouped.setdefault((item['category'], item['product']), []).append(item)

    for (category, product), items in grouped.items():
        path = Path(f'open-rankings/{category}/evidence/{product}.json')
        pack = json.loads(path.read_text())
        by_id = {row['id']: row for row in pack}
        added = 0

        for item in items:
            row = canonical_row(item)
            prior = by_id.get(item['id'])
            if prior is not None:
                comparable_prior = {key: prior.get(key) for key in row if key != 'fetchedAt'}
                comparable_row = {key: value for key, value in row.items() if key != 'fetchedAt'}
                if comparable_prior != comparable_row:
                    raise SystemExit(
                        f'{path}: existing {item["id"]} differs from the verified canonical row'
                    )
                print(f'{path}: {item["id"]} already present and live-verified')
                continue
            pack.append(row)
            by_id[row['id']] = row
            added += 1
            print(f'{path}: appended {item["id"]}')

        # Preserve each pack's existing serialization style to keep the repair diff scoped.
        ensure_ascii = category == 'vector-databases'
        path.write_text(json.dumps(pack, indent=2, ensure_ascii=ensure_ascii) + '\n')
        print(f'{path}: +{added} rows, {len(pack)} total')


if __name__ == '__main__':
    main()
