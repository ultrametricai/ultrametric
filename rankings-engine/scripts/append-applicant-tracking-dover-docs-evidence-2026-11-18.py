#!/usr/bin/env python3
# applicant-tracking / dover bring-up, 2026-11-18: supplemental claimed-docs rows.
#
# Dover's docs corpus is 32 crawled sources, so the extract stage's fair per-source budget
# (60,000 characters split evenly) offered the model under 2,000 characters of each page.
# The passages below sit past that cut on their pages (or on two Dover docs pages outside
# the crawl list) and bear on the two cells the PR #714 review contested, `bias-controls`
# and `interviewer-prep`: EEO survey collection and its aggregate reporting tab, the
# permissions group that hides other interviewers' feedback, what the interview page and
# the calendar invite give an interviewer, and the interview reminder and feedback prompts.
#
# Each excerpt is one verbatim passage. The script fetches the cited page's Markdown copy
# and requires the excerpt to appear on it (whitespace-normalized) before anything is
# written; a miss aborts the run with no writes. Rows already present are re-verified and
# keep their original fetchedAt. Scores are not touched here: run
# `pnpm engine judge --category applicant-tracking --product dover` and
# `pnpm engine derive --category applicant-tracking` afterwards.
#
# Usage: python3 rankings-engine/scripts/append-applicant-tracking-dover-docs-evidence-2026-11-18.py
import datetime
import json
import os
import re
import urllib.error
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
EVIDENCE = os.path.join(ROOT, 'open-rankings', 'applicant-tracking', 'evidence', 'dover.json')
NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
UA = 'Mozilla/5.0 (compatible; Ultrametric/1.0; +https://ultrametric.ai)'
DOCS = 'https://docs.dover.com'

# (id, url, verbatim excerpt)
NEW_ITEMS = [
    ('dover-supp-eeo-survey', f'{DOCS}/getting-applicants/job-postings.md',
     'Applicants see an optional survey at the end of the application. You only see aggregate results, never individual answers.'),
    ('dover-supp-eeo-reporting', f'{DOCS}/getting-started/reporting-analytics.md',
     'If you collect the voluntary EEO survey from applicants, the **Diversity (EEO)** tab shows the combined answers for all jobs or for one job, and the number of responses.'),
    ('dover-supp-feedback-visibility', f'{DOCS}/settings/job-settings.md',
     "A member with **Job Basic** can submit feedback, but can't see other interviewers' feedback, the job's compensation, or candidates in the offer and hire stages."),
    ('dover-supp-interview-page', f'{DOCS}/scheduling-interviewing/interviewing-candidates.md',
     "It shows the candidate's details, their resume, and the feedback form assigned to the interview stage."),
    ('dover-supp-invite-link', f'{DOCS}/scheduling-interviewing/interviewing-candidates.md',
     "Click **Add feedback** on the candidate's profile. The **View in Dover** link in the calendar invite opens the profile."),
    ('dover-supp-interview-reminders', f'{DOCS}/settings/notifications.md',
     'Interview emails go out when the event happens, and reminders go 24 hours and 1 hour before.'),
    ('dover-supp-calendly-feedback-prompt', f'{DOCS}/integrations/calendly-integration.md',
     'It uses the booking to move the candidate along, prompt interviewers for feedback, and send reminders.'),
]

_PAGES: dict = {}


def norm(s: str) -> str:
    return re.sub(r'\s+', ' ', s).strip()


def page(url: str) -> str:
    if url not in _PAGES:
        req = urllib.request.Request(url, headers={'User-Agent': UA})
        try:
            with urllib.request.urlopen(req, timeout=25) as res:
                if res.status != 200:
                    raise SystemExit(f'abort, nothing written: {url} answered HTTP {res.status}, expected 200')
                _PAGES[url] = norm(res.read().decode('utf-8', errors='replace'))
        except (urllib.error.HTTPError, OSError) as e:
            raise SystemExit(f'abort, nothing written: {url} unreachable ({e})')
    return _PAGES[url]


def main() -> None:
    for iid, url, excerpt in NEW_ITEMS:
        if norm(excerpt) not in page(url):
            raise SystemExit(f'abort, nothing written: {iid} excerpt not found live on {url}')
    print(f'live verification passed: {len(NEW_ITEMS)} rows')

    text = open(EVIDENCE).read()
    rows = json.loads(text)
    ascii_style = json.dumps(rows, indent=2, ensure_ascii=True) + '\n' == text
    present = {r['id'] for r in rows}
    new = [{'id': iid, 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW}
           for iid, url, excerpt in NEW_ITEMS if iid not in present]
    if not new:
        print('all rows already present; nothing written')
        return
    # Keep claimed-docs rows together, ahead of the community and probe tiers.
    last_docs = max((i for i, r in enumerate(rows) if r['tier'] in ('claimed-docs', 'github')), default=-1)
    rows[last_docs + 1:last_docs + 1] = new
    with open(EVIDENCE, 'w') as f:
        f.write(json.dumps(rows, indent=2, ensure_ascii=ascii_style) + '\n')
    print(f'appended {len(new)} rows')


if __name__ == '__main__':
    main()
