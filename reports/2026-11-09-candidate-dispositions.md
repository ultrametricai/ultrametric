# Candidate dispositions, 2026-11-09

Maintainer decisions on the standing candidate queue. The adjacent JSON carries each row
with its evidence pointers. Scan and triage records stay unchanged; approved bring-ups run
the standard scoped engine run in their own PR, and no score or rank is set here.

| candidate | arena | decision | reason |
| --- | --- | --- | --- |
| pixelfx | agent-skills | parked | popularity unverifiable, suspected inorganic star velocity; manual maintainer recheck required when popularity can be verified; kept as a roadmap candidate |
| ernd | expense-management | approved | corporate card with AI-vendor rewards; llms.txt and machine-readable rates verified live 2026-11-09; the earlier card-issuing skip stands |
| DS-Bot | team-chat | skipped | low-evidence product: anomalous star velocity, no citable surface beyond the repository README |
| nxnative | screen-sharing | skipped | low-evidence product: anomalous star velocity, no citable surface beyond the repository README |
| Cloudflare Clairic | speech-to-text | skipped | extraction-model launch; no speech-to-text API documented in the source |
| CalendarHero | scheduling | skipped | PR #629 skip stands: no API, MCP server, agent docs, or llms.txt; queue row annotated closed |
| Smithery | mcp-infrastructure | retained | post-shutdown the AGPL CLI stays live under the acquirer's organization; publishes as judged at 6.8 (8 of 8); radar monitors |
| StaysPrivate (#607) | file-converters | needs-human | disclosed vendor self-submission held for maintainer decision; verification receipts in the 2026-11-05 follow-up |

The parked rows (pixelfx here; bla and HGhub in
`reports/vendor-radar/2026-11-09-issue-669-review.md`) stay listed in
`open-rankings/arena-roadmap.json` under their arena's `candidateProducts` for tracking.
Radar skips previously seen keys; these entries do not schedule another check.
To reconsider a parked candidate, a maintainer must recheck the popularity evidence and
record a new dated disposition before initiating any approved bring-up.
