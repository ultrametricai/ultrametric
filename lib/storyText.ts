// Pure, display-only parsing of user-story text. Every canonical story title is authored in
// the Connextra frame — "As a(n) {persona}, {clause}" (see rankings-engine/agentic-stories.ts,
// normalize.ts, depth-mine.ts's commonRules) — which reads fine once but is deafeningly
// repetitive down a list: the arena tables were fifty rows of "As a developer, …". This module
// splits that frame into a persona label (chip/column/filter material) and a standalone action
// sentence, WITHOUT ever touching the stored Story.title: judge caching keys on the exact
// title (rankings-engine/stages/judge.ts's cellHash includes it), so data files and the canonical
// text are never mutated — presentation-layer derivation only.
//
// Node-builtin-free and pure so both client components (StoryVerdictsTable, CompareBuilder)
// and server renderers (llms.md, checklist markdown) can share it, and so the parsed persona
// can later back a filter without re-plumbing story data.

export interface ParsedStory {
  // Lowercased, whitespace-collapsed persona ("founder", "ai-native user") with the leading
  // "a"/"an" article dropped — lowercasing dedupes the authored casing drift ("As a Founder"
  // vs "as a founder", "Built-in AI user" vs "ai-native user") so chips and future filters treat
  // equal personas as equal. Null when the text doesn't match the Connextra frame.
  persona: string | null
  // The story minus its persona frame, reading as a standalone sentence: first-person leads
  // ("I want to " / "I need to " / "I can " / "I know " / "I'd like to ") are dropped and the
  // first letter capitalized, while any "so that {benefit}" clause is kept — the benefit is
  // part of the action's meaning, not the persona's. Equals the original text (unchanged)
  // when no persona parses out.
  action: string
}

// Canonical comma form: "As a(n) {persona}, {clause}". Persona is everything up to the FIRST
// comma, so hyphenated/qualified personas survive intact ("data platform lead", "developer
// using the API") while clause-internal commas stay with the action.
const COMMA_FORM = /^As an? ([^,]+?)\s*,\s*(\S[\s\S]*)$/i

// Defensive missing-comma variant ("As an ops lead I want to deploy…"): the persona ends where
// the first-person clause starts. Anchored to a real first-person lead so a title like
// "As a rule the parser stays out of prose" can never mint a bogus persona.
const BARE_FORM = /^As an? (.+?) (I (?:want|need|can|know|must|should|expect|get|see|have|am|'d like|would like)\b[\s\S]*)$/i

// First-person leads that add no meaning once the action stands alone. "I want/need (to)",
// "I can", "I'd like to" are the classic Connextra verbs; "I know" is the variant
// depth-mine.ts authors for pricing/limits stories. Leads like "I get"/"I see"/"I run" are
// deliberately NOT stripped — dropping them would leave a noun phrase, not a sentence.
const LEAD = /^I(?: want to| need to| can| know|'d like to| would like to)\s+/i

// A real persona is a short noun phrase ("switcher", "data platform lead", "developer using
// the API"). Anything longer is almost certainly prose that happens to start with "As a …" —
// bail out rather than mint a paragraph-long "persona".
const MAX_PERSONA_WORDS = 8

export function parseStoryPersona(text: string): ParsedStory {
  const match = COMMA_FORM.exec(text) ?? BARE_FORM.exec(text)
  if (!match) return { persona: null, action: text }
  const persona = match[1].trim().replace(/\s+/g, ' ').toLowerCase()
  if (persona.length === 0 || persona.split(' ').length > MAX_PERSONA_WORDS) {
    return { persona: null, action: text }
  }
  const rest = match[2].replace(LEAD, '').trim()
  if (rest.length === 0) return { persona: null, action: text }
  return { persona, action: rest.charAt(0).toUpperCase() + rest.slice(1) }
}
