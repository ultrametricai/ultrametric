// Pure stack primitives shared across the open/closed boundary:
// the account-stack map shape and pick accessor (read by lib/processCheck.ts and
// lib/shared-processes/selection-compatibility.ts), the serialized catalog row consumed by
// lib/stackBattle.ts, and the integration pair-key format. The stateful My Stack store
// (localStorage/KV sync, recommendations engine) and the stack-builder UI logic live in the
// private site repo; this module stays free of node builtins, React, and the DOM.

// The account stack: { arenaId: productId[] } — an ORDERED list of picks per arena, first =
// primary. Parsing/serialization and the pa-account-stack storage contract live with the
// store; consumers here only read the shape.
export type StackMap = Record<string, string[]>

/** The ordered picks for one arena — [] when the arena has none. */
export function stackPicks(stack: StackMap, arenaId: string): string[] {
  return stack[arenaId] ?? []
}

// One catalog row — the lean serialized shape /my-stack and /stacks/battle receive as a
// prop (built server-side from CategoryData). A product ranked in two arenas (e.g. square
// in payments AND mobile-payments) has one row per arena; pick resolution takes the first row
// (categories order), the same canonical-arena convention as lib/alternatives.ts.
export interface MyStackProduct {
  id: string
  name: string
  vendor: string
  arenaId: string
  arenaName: string
  type: 'oss' | 'commercial' | 'government'
  /** Overall score from the arena leaderboard (null = not scored yet). */
  aiEra: number | null
  agentReady: number | null
  /** Evidence-confidence grade for the score's footing — see lib/confidence.ts. */
  confidence: 'A' | 'B' | 'C' | 'D'
  /** 1-based position in the arena leaderboard (its canonical order) and the field size. */
  rank: number
  fieldSize: number
  hasLogo: boolean
  /** The verified shutdown note (lib/schemas.ts ProductSchema) when the vendor announced it is
   *  closing — never offered as an upgrade/leader/add (lib/shutdown.ts founder rule); a reader
   *  who RUNS one gets MIGRATE advice on top. */
  shutdown?: string
}

// Same 'a|b' sorted-pair format as lib/integrations.ts's pairKey/verifiedPairKeys (that module
// is server-only — it reads open-rankings/ with fs — so the one-liner is mirrored here for the client;
// lib/__tests__/integrations.test.ts cross-checks the two formats against each other).
export function stackPairKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}
