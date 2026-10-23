#!/usr/bin/env python3
# Scope the Gusto debut evidence packs to the announced offerings (PR #449 review, greptile P1
# "Payroll features inflate scoped scores", 2026-10-23).
#
# The two debut entries are arena-scoped — legal-ops judges only formation/EIN/Business
# Compliance, startup-banking judges only the bank account and Money Dashboard — but the crawled
# source is Gusto's full Fall Showcase release, so extract also minted claimed-docs rows about
# payroll automations, benefits, HR, and the payroll MCP/AI connectors. The judge scopes by the
# evidence pack, not by the `affiliation` disclosure, so those rows earned the scoped entries
# credit for payroll capabilities (e.g. startup-banking agentic-nl-commands full/q7 from payroll
# queries). This script drops the off-scope rows; the scoped re-judge that follows re-rolls only
# the gusto cells (evidence is in the cellHash) and derive recomputes both arenas.
#
# Keep policy, per arena:
#   legal-ops       — formation, EIN registration, Business Compliance (state tax registration,
#                     registered agent, annual/initial reports, foreign qualification, government
#                     mail, pricing, scope disclaimer), the launch sentence, the wall probe, the
#                     community row.
#   startup-banking — the bank account, Money Dashboard, Increase Bank/FDIC disclosure, early-
#                     beta status, the launch sentence, the wall probe, the community row.
#
# Idempotent: dropping an already-dropped id is a no-op. Keyed by (id, excerpt prefix) so a
# re-numbered pack is never pruned blind — an id whose excerpt does not match aborts. A future
# `pnpm engine extract` on these entries UNIONS the full release back in; re-run this script
# after any extract refresh of the gusto entries (the same class of gotcha as the probe-stage
# replacement, documented there).
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(os.path.dirname(ROOT), 'open-rankings')

# (arena, id, excerpt prefix) — every row dropped, with the prefix as the safety check.
DROPS = [
    ('legal-ops', 'gusto-docs-1', "Developers and power users can also connect through Gusto's MCP server"),
    ('legal-ops', 'gusto-docs-2', 'so an agent can prepare what it can before each payroll'),
    ('legal-ops', 'gusto-docs-3', 'Owners can now connect Gusto to Claude, ChatGPT'),
    ('legal-ops', 'gusto-docs-4', 'Owners have full transparency and control over the output'),
    ('legal-ops', 'gusto-docs-5', 'A Multi-Client MCP that lets firms work across selected clients'),
    ('legal-ops', 'gusto-docs-7', 'Gusto 401(k), built into Gusto'),
    ('legal-ops', 'gusto-docs-8', 'small businesses can get more comprehensive benefits and compliance help'),
    ('legal-ops', 'gusto-docs-9', 'Multi-location payroll runs one payroll'),
    ('legal-ops', 'gusto-docs-10', 'Intelligent payroll automations gather hours'),
    ('legal-ops', 'gusto-docs-11', 'same-day pay for off-cycle bonuses and corrections'),
    ('legal-ops', 'gusto-docs-12', 'With invoice ingestion, Gusto reads an uploaded invoice'),
    ('legal-ops', 'gusto-docs-13', 'Contractor tools that let owners hire and pay'),
    ('legal-ops', 'gusto-docs-14', 'Project tracking lets owners tag hours'),
    ('legal-ops', 'gusto-docs-15', 'Gus, the AI Benefits Assistant'),
    ('legal-ops', 'gusto-docs-16', 'employers maintain complete control over costs by setting a monthly allowance'),
    ('legal-ops', 'gusto-docs-17', 'Guided benefits renewal provides cost-optimized options'),
    ('legal-ops', 'gusto-docs-18', 'New HR resources let owners build an employee handbook'),
    ('legal-ops', 'gusto-docs-23', 'Gusto HR Partners gives business owners direct access'),
    ('legal-ops', 'gusto-docs-24', 'Solo Advisory Tools, helping firms advise solopreneur clients'),
    ('startup-banking', 'gusto-docs-2', 'Gusto Business Compliance handles obligations'),
    ('startup-banking', 'gusto-docs-3', 'Multi-location payroll runs one payroll'),
    ('startup-banking', 'gusto-docs-4', 'Intelligent payroll automations gather hours'),
    ('startup-banking', 'gusto-docs-5', 'same-day pay for off-cycle bonuses and corrections'),
    ('startup-banking', 'gusto-docs-6', 'printed, mailed paychecks with delivery tracking'),
    ('startup-banking', 'gusto-docs-7', 'Contractor tools that let owners hire and pay'),
    ('startup-banking', 'gusto-docs-8', 'With invoice ingestion, Gusto reads an uploaded invoice'),
    ('startup-banking', 'gusto-docs-9', 'Project tracking lets owners tag hours'),
    ('startup-banking', 'gusto-docs-10', 'Owners can now connect Gusto to Claude, ChatGPT'),
    ('startup-banking', 'gusto-docs-11', 'Owners have full transparency and control over the output'),
    ('startup-banking', 'gusto-docs-12', "Developers and power users can also connect through Gusto's MCP server"),
    ('startup-banking', 'gusto-docs-13', 'so an agent can prepare what it can before each payroll'),
    ('startup-banking', 'gusto-docs-14', 'Gus, the AI Benefits Assistant'),
    ('startup-banking', 'gusto-docs-15', 'Gusto 401(k), built into Gusto'),
    ('startup-banking', 'gusto-docs-16', 'employers maintain complete control over costs by setting a monthly allowance'),
    ('startup-banking', 'gusto-docs-17', 'Voluntary Life & Disability benefits'),
    ('startup-banking', 'gusto-docs-18', 'Guided benefits renewal provides cost-optimized options'),
    ('startup-banking', 'gusto-docs-19', 'New HR resources let owners build an employee handbook'),
    ('startup-banking', 'gusto-docs-20', 'Owners also get proactive alerts when employment laws change'),
    ('startup-banking', 'gusto-docs-21', 'Gusto HR Partners gives you access to an experienced, fractional HR professional'),
    ('startup-banking', 'gusto-docs-22', 'A Multi-Client MCP that lets firms work across selected clients'),
    ('startup-banking', 'gusto-docs-23', 'Solo Advisory Tools, helping firms advise solopreneur clients'),
    ('startup-banking', 'gusto-docs-29', 'The moment a business owner hires their first employee, payroll runs'),
]


def run():
    for arena in ('legal-ops', 'startup-banking'):
        path = os.path.join(DATA, arena, 'evidence', 'gusto.json')
        ev = json.load(open(path))
        by_id = {e['id']: e for e in ev}
        drop_ids = set()
        for a, eid, prefix in DROPS:
            if a != arena:
                continue
            row = by_id.get(eid)
            if row is None:
                print(f'{arena}: {eid} already dropped, skipping')
                continue
            if not row['excerpt'].startswith(prefix):
                print(f'abort: {arena}/{eid} excerpt does not start with the expected prefix — pack re-numbered?', file=sys.stderr)
                return 1
            drop_ids.add(eid)
        kept = [e for e in ev if e['id'] not in drop_ids]
        with open(path, 'w') as f:
            json.dump(kept, f, indent=2, ensure_ascii=False)
            f.write('\n')
        print(f'{arena}: dropped {len(drop_ids)} off-scope rows, kept {len(kept)}')
    return 0


if __name__ == '__main__':
    sys.exit(run())
