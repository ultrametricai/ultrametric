# Reports

Dated operational ledgers, appended by the tooling and kept as records; nothing here is
hand-edited after the fact.

`vendor-radar/` holds the vendor-radar run ledgers: per scan day a candidates report
(`<date>.json` + `<date>.md`) and the triage dispositions (`<date>-triage.json`), written
by `rankings-engine/scripts/vendor-radar.ts` and `radar-triage.ts`. The protocol, the
approval criteria, and what a disposition means are in
[`docs/VENDOR-RADAR.md`](../docs/VENDOR-RADAR.md) and `policies/AGENT_POLICY.md`
("Vendor-radar candidate approval").
