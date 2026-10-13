# Ultrametric CLI/MCP in the Startup Simulator — design note

Date: 2026-10-02 (founder batch, sim round 8, item 5). Companion to
`docs/ULTRAMETRIC-CLI-CAPABILITIES.md` (the shipped-capability audit this note must never
outrun).

## Current touchpoints (inventory, verified in code 2026-10-02)

1. **The curated map** — `lib/ultrametricCli.ts`: 10 corpus taskIds → live hosted processes
   (`incorporate-c-corp`, `get-ein`, registered agent, runway, cap table, founder agreement,
   name/logo/palette, domain check), each with the exact shipped command
   (`ultrametric process open <id>`), the MCP tool (`open_process`), and audit provenance
   (`ultrametric@0.4.1 · production catalog 2026-09-30`). Accessor returns null on a miss —
   callers render nothing, never a fabricated capability. Tests:
   `lib/__tests__/ultrametricCli.test.ts`.
2. **Terminal process rows** — `components/VirtualStartup.tsx`, testid `vs-um-cli`: a muted line
   under each revealed MAPPED process row — "drive this process from your agent via the
   Ultrametric CLI/MCP — our own product: `<command>` · MCP open_process — guide + saved
   records; your agent does the work", linking `/get-started`, with the full
   `ULTRAMETRIC_CLI_DISCLOSURE` sentence as the tooltip. Sits on the process row because the
   CLI drives whole processes, not steps. As of round 8 the line carries an inline **copy
   button** (`components/VsCopyCommand.tsx`, testid `vs-um-cli-copy`).
3. **State panel, Vendors tab** — `components/VsStateGraph.tsx`, testids `vs-sg-umcli` /
   `vs-sg-umcli-line`: the revealed UM-driveable processes collect BELOW the judged vendors
   under the explicit label "first-party · Ultrametric CLI/MCP (ours) — not a judged pick",
   never counted with the judged picks. Round 8 adds the same copy button per line.
4. **No other sim touchpoints.** No terminal lines outside the per-task `vs-um-cli` line, no
   scorecard mention, nothing in the DAG, events, rhythm views, or the decisions grid.

## Owner-product disclosure rules (restated — every current and future touchpoint)

- **Display-only, always.** Nothing from the UM map may feed scoring, reorder a judged pick,
  or join a judged count. The judged `(recommended · judged)` surfaces never move.
- **Explicit first-party label at every render site** — "our own product" / "first-party ·
  Ultrametric CLI/MCP (ours) — not a judged pick", plus the full `ULTRAMETRIC_CLI_DISCLOSURE`
  sentence reachable (tooltip or visible text).
- **The honest verb is "drive"**: the CLI/MCP serves the process guide and saves run records;
  it executes nothing — the user's agent does the work. Never imply filing/purchasing/acting.
- **Only verified shipped capability renders** — an affordance exists only for entries in the
  curated map, which exists only where the live production catalog serves a same-result hosted
  process. Catalog access is per-account; availability may be narrower for external users.

## Where UM CLI/MCP naturally fits next (candidates, honesty-ranked)

1. **Copy-the-command on the existing revealed lines** — *implemented in round 8* (see above).
   Zero new claims: the command is already printed, disclosed, and first-party-labeled; the
   button only moves it to the clipboard.
2. **Phase-completion terminal line** — when a phase whose tasks include mapped processes
   finishes, print one muted, first-party-labeled line ("pick this up in your own agent:
   `ultrametric process open <id>`"). Honest (the run already revealed those rows) but touches
   the row builder (`buildRunRows`) whose signatures drive the semi-auto pause schedule —
   medium risk; every added row must be display-only and keyed so replays stay byte-identical.
   **Deferred.**
3. **Install banner tie-in** — the scorecard's end-of-run block could link the existing
   `/get-started` install surface ("run the same journey for real: npm i -g ultrametric"),
   under the first-party label. Low mechanical risk, but it is an ad inside the judged
   scorecard surface — needs a founder call on placement. **Deferred.**
4. **Per-phase "drive this with Ultrametric" affordances in the DAG** — a marker on nodes whose
   task is mapped. Honest but decorates the shared DAG surface used for judged navigation;
   visual-noise and label-crowding risk. **Deferred.**
5. **MCP-first framing for the assistant pin** — connecting the "I'm using" assistant row to the
   hosted MCP URL. NOT honest today without per-host support verification (the CLI's own README
   requires separate host checks) — **excluded** until verified per
   `docs/ULTRAMETRIC-CLI-CAPABILITIES.md`.

## Round-8 decision

Implemented: candidate 1 only — `components/VsCopyCommand.tsx` on both revealed UM-CLI
surfaces (terminal `vs-um-cli` line, state-panel `vs-sg-umcli-line` rows), always under the
already-present first-party labels, never counted among judged picks. Everything else deferred
as listed above.
