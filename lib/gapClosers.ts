import { isPopulated, loadCategories, loadCategory } from './data'
import type { GapCloser, GapResolution, StepRoute, SwapOption } from './processSim'
import { gapWhy } from './processSim'
import { isShutdown } from './shutdown'

// Agentic gap-closers: clever-but-honest ways to achieve a process's non-agent steps with
// today's agentic vendors. A pure keyword rule engine (classifyGapStep — unit-testable without
// touching disk) maps a gap step's route + label onto an arena; resolution then binds the rule
// to the LIVE market at build time — the arena's #1 product by agent-readiness — and degrades
// gracefully: a rule keyed to an arena that isn't live yet (not in categories.json, or not yet
// populated) simply yields no suggestion rather than a dead link. The other honest outcome is
// the typed 'irreducible' marker: pure judgment/identity steps (approvals, KYC, board
// decisions, notarization) get NO workaround — we never oversell.

export interface GapStep {
  label: string
  route?: StepRoute
  async?: boolean
}

export const IRREDUCIBLE_REASON =
  'judgment or identity — work an agent shouldn’t stand in for'

// Judgment/identity keywords checked FIRST: a step that is fundamentally a human decision
// (approve, board, KYC, notarize, review, professional counsel) must never pick up a workaround
// from a later rule, even when its label also mentions signatures, portals, or drafting.
const IRREDUCIBLE_RE =
  /approv|kyc|\bboard\b|notari|verify identity|identity verification|sign[\s-]?off|\breview|attorney|counsel|tax advis[eo]r|\bcpa\b|auditor|\baudit\b|calibration|negotiat|meeting|interview|decision/

// "Sign up" is account creation, not a signature — keep it away from the e-sign rule.
const SIGNUP_RE = /sign[\s-]?up|signup/

export interface CloserRule {
  id: string
  // Arena to draw the suggestion from; skipped (no suggestion) when the arena isn't live.
  arenaId: string
  // Used only when the primary arena isn't live yet (e.g. web-scraping until browser-agents lands).
  fallbackArenaId?: string
  blurb: string
  caution?: string
  test: (label: string, step: GapStep) => boolean
}

// Ordered — first match wins. Keyed by arena id so rules survive arenas landing later.
export const CLOSER_RULES: CloserRule[] = [
  {
    id: 'esign',
    arenaId: 'legal-ops',
    blurb: 'route the signature through an e-sign API instead of paper',
    test: (l) =>
      !SIGNUP_RE.test(l) &&
      /signature|docusign|counter-?sign|\bnda\b|\bsigns?\b|agreement|bylaws|resolution|consent/.test(l),
  },
  {
    // Cap-table paperwork (stock issuance, option grants) — the judged equity platforms expose
    // draft-grant APIs, so an agent can prepare the issuance; the board still approves.
    id: 'equity',
    arenaId: 'equity-management',
    blurb: 'draft the issuance on a cap-table platform’s API — the board still approves',
    test: (l) => /founder stock|stock option|option grant|cap table|\bvesting\b|409a/.test(l),
  },
  {
    // Code changes dressed up as manual steps (install the SDK, add the snippet) — a coding
    // agent makes the change; a human reviews the diff.
    id: 'coding',
    arenaId: 'ai-coding',
    blurb: 'a coding agent can make this code change — a human reviews the diff',
    test: (l) => /\bsdk\b|codebase|instrument|snippet/.test(l),
  },
  {
    // Deterministic web flows with no API path — 2026 computer-use browser agents can drive
    // them, honestly marked assisted (a human supervises), never autonomous.
    id: 'browser',
    arenaId: 'browser-agents',
    fallbackArenaId: 'web-scraping',
    blurb: 'computer-use candidate — a browser agent can drive this deterministic web flow',
    caution: 'assisted, not autonomous — a human supervises; verify the portal’s terms allow automation',
    test: (l, step) =>
      step.route === 'form' &&
      /portal|filing|\bfiles?\b|website|\bforms?\b|console|\bsubmit\b|regist|checkout|\.gov|wizard|provision|enroll|set ?up|sign ?up|signup|create ([a-z0-9.&-]+ )?(user|workspace|account|email|project)/.test(l),
  },
  {
    id: 'voice',
    arenaId: 'voice-agents',
    blurb: 'a voice agent can place the call and hold on the line',
    test: (l) => /\bphone\b|\bcalls?\b|\bdial\b/.test(l),
  },
  {
    // "Choose/select/pick" steps match on either non-agent route — a choose step is a decision
    // whichever way the corpus routed it, and the honest assist is the same: research in, pick out.
    id: 'research',
    arenaId: 'ai-research-agents',
    blurb: 'a research agent can gather and compare the options — a human makes the pick',
    test: (l, step) =>
      /\bchoose\b|\bselect\b|\bpick\b/.test(l) ||
      (step.route === 'person' && /research|compar|\bfind\b|\bevaluate\b|get quotes|shortlist|scout/.test(l)),
  },
  {
    id: 'doc-prep',
    arenaId: 'ai-assistants',
    blurb: 'draft with an assistant, human reviews',
    test: (l, step) =>
      step.route === 'person' &&
      // "File conversion documents" is a filing action, not drafting — don't claim it.
      !/\bfile\b|filing/.test(l) &&
      /\bdraft|prepar|\bwrite\b|data entry|\benter\b|compile|customiz|articles?\b|handbook|questionnaire|\bdocument/.test(l),
  },
  {
    // Last: the async catch-all. Third-party waits (certificates, quotes, review turnaround)
    // don't need a human babysitter once a workflow watches for the completion event.
    id: 'watcher',
    arenaId: 'workflow-automation',
    blurb: 'a workflow with webhooks/polling watches this so no human has to',
    test: (l, step) =>
      Boolean(step.async) || /\bwait|turnaround|processing|\breceive\b|respond/.test(l),
  },
]

export type GapClassification =
  | { kind: 'irreducible'; reason: string }
  | { kind: 'closer'; ruleId: string; arenaId: string; fallbackArenaId: string | null; blurb: string; caution: string | null }
  | null

// Pure keyword routing — no disk access, so the rules are unit-testable in isolation.
// Agent steps are never classified (they aren't gaps).
export function classifyGapStep(step: GapStep): GapClassification {
  if (step.route === 'agent' || step.route === undefined) return null
  const l = step.label.toLowerCase()
  if (IRREDUCIBLE_RE.test(l)) return { kind: 'irreducible', reason: IRREDUCIBLE_REASON }
  const rule = CLOSER_RULES.find((r) => r.test(l, step))
  if (!rule) return null
  return {
    kind: 'closer',
    ruleId: rule.id,
    arenaId: rule.arenaId,
    fallbackArenaId: rule.fallbackArenaId ?? null,
    blurb: rule.blurb,
    caution: rule.caution ?? null,
  }
}

// ---------------------------------------------------------------------------
// Live-market resolution (build-time, cached per dir+arena)
// ---------------------------------------------------------------------------

function isLiveArena(arenaId: string, dir?: string): boolean {
  return loadCategories(dir).some((c) => c.id === arenaId) && isPopulated(arenaId, dir)
}

const topProductCache = new Map<string, SwapOption>()

// The arena's current #1 by agentReady (nulls last) — same ranking the swap options use.
// Shutdown products are never suggested (lib/shutdown.ts founder rule): the next product on
// the agent-readiness ladder moves up.
function topProduct(arenaId: string, dir?: string): SwapOption | null {
  const key = `${dir ?? ''}::${arenaId}`
  const hit = topProductCache.get(key)
  if (hit) return hit
  const data = loadCategory(arenaId, dir)
  const shutdownIds = new Set(data.products.filter((p) => isShutdown(p)).map((p) => p.id))
  const best = [...data.rankings.leaderboard]
    .filter((e) => !shutdownIds.has(e.productId))
    .sort((a, b) => (b.agentReady ?? -1) - (a.agentReady ?? -1))[0]
  if (!best) return null
  const top: SwapOption = {
    id: best.productId,
    name: data.products.find((p) => p.id === best.productId)?.name ?? best.productId,
    agentReady: best.agentReady,
  }
  topProductCache.set(key, top)
  return top
}

// Bind a classification to the live market. Absent/unpopulated arenas degrade to null (after
// trying the rule's fallback arena); irreducible markers pass straight through.
export function resolveGapStep(step: GapStep, dir?: string): GapResolution | null {
  const cls = classifyGapStep(step)
  if (!cls) return null
  if (cls.kind === 'irreducible') return cls
  const arenaId = [cls.arenaId, cls.fallbackArenaId].find(
    (id): id is string => Boolean(id) && isLiveArena(id!, dir),
  )
  if (!arenaId) return null
  const top = topProduct(arenaId, dir)
  if (!top) return null
  const closer: GapCloser = {
    arenaId,
    arenaName: loadCategory(arenaId, dir).category.name,
    topProduct: top,
    blurb: cls.blurb,
    caution: cls.caution,
  }
  return { kind: 'closer', closer }
}

// ---------------------------------------------------------------------------
// The sharper ceiling story: which gaps today's market can close vs the irreducibly human core
// ---------------------------------------------------------------------------

export interface ClosableGap {
  label: string
  route?: 'form' | 'person'
  closer: GapCloser
}

export interface HumanGap {
  label: string
  route?: 'form' | 'person'
  why: string
  // True when the step matched the judgment/identity rule; false = no honest workaround yet.
  irreducible: boolean
}

export interface GapSplit {
  closable: ClosableGap[]
  human: HumanGap[]
  // Distinct arena names backing the closable gaps, in first-seen order.
  arenas: string[]
}

export function splitGaps(steps: GapStep[], dir?: string): GapSplit {
  const closable: ClosableGap[] = []
  const human: HumanGap[] = []
  const arenas: string[] = []
  for (const step of steps) {
    if (step.route === 'agent') continue
    const res = resolveGapStep(step, dir)
    if (res?.kind === 'closer') {
      closable.push({ label: step.label, route: step.route, closer: res.closer })
      if (!arenas.includes(res.closer.arenaName)) arenas.push(res.closer.arenaName)
    } else {
      human.push({
        label: step.label,
        route: step.route,
        why: gapWhy(step.route),
        irreducible: res?.kind === 'irreducible',
      })
    }
  }
  return { closable, human, arenas }
}
