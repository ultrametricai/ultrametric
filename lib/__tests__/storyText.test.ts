import { describe, expect, it } from 'vitest'
import { parseStoryPersona } from '@/lib/storyText'

// Fixtures below marked "live" are copied VERBATIM from rankings/*/stories.json — the parser must
// hold against the real corpus (3,724 titles at time of writing, 100% in the comma form), not
// just textbook Connextra examples. The data files themselves are never touched: judge caching
// keys on the exact title (pipeline/stages/judge.ts's cellHash), so this is display-only.

describe('parseStoryPersona — live "I can" titles', () => {
  const cases: Array<[string, string, string]> = [
    [
      'As an AI-native user, I can point an agent at llms.txt or agent-oriented docs',
      'ai-native user',
      'Point an agent at llms.txt or agent-oriented docs',
    ],
    [
      'As an accountant, I can reconcile each bank account against the ledger with matched, unmatched, and duplicate transactions surfaced for review',
      'accountant',
      'Reconcile each bank account against the ledger with matched, unmatched, and duplicate transactions surfaced for review',
    ],
    [
      'As a legal-ops lead, I can rely on a tamper-evident audit trail and completion certificate for every signed document',
      'legal-ops lead',
      'Rely on a tamper-evident audit trail and completion certificate for every signed document',
    ],
    [
      'As a robotics engineer, I can swap sensors and actuators behind stable hardware-abstraction interfaces without rewriting application code',
      'robotics engineer',
      'Swap sensors and actuators behind stable hardware-abstraction interfaces without rewriting application code',
    ],
    [
      'As an open-source-maintainer, I can publish and consume software packages in multiple package formats from the same platform',
      'open-source-maintainer',
      'Publish and consume software packages in multiple package formats from the same platform',
    ],
    [
      'As an AI agent, I can submit a browser task over a hosted HTTP API and receive the result by polling or webhook, without managing any browser myself',
      'ai agent',
      'Submit a browser task over a hosted HTTP API and receive the result by polling or webhook, without managing any browser myself',
    ],
    [
      'As a finance-ops user, I can send hosted invoices with online payment and automatic reminders',
      'finance-ops user',
      'Send hosted invoices with online payment and automatic reminders',
    ],
  ]
  it.each(cases)('%s', (title, persona, action) => {
    expect(parseStoryPersona(title)).toEqual({ persona, action })
  })
})

describe('parseStoryPersona — live "I know" (depth-mined pricing/limits) titles', () => {
  it('strips the "I know" lead', () => {
    expect(
      parseStoryPersona(
        'As a devops-lead, I know the guaranteed support response times and escalation paths for my plan tier',
      ),
    ).toEqual({
      persona: 'devops-lead',
      action: 'The guaranteed support response times and escalation paths for my plan tier',
    })
  })
})

describe('parseStoryPersona — live first-person leads that must NOT be stripped', () => {
  // "I get/see/run/am/mark/connect/author" leads read as sentences on their own — dropping the
  // "I" would leave a noun fragment, so only the capitalization changes.
  const cases: Array<[string, string, string]> = [
    [
      'As a developer, I get the same review inside my IDE before I push, catching issues while the code is still in my editor',
      'developer',
      'I get the same review inside my IDE before I push, catching issues while the code is still in my editor',
    ],
    [
      'As an engineering lead, I see dashboards of findings, acceptance rates, and review coverage across my org',
      'engineering lead',
      'I see dashboards of findings, acceptance rates, and review coverage across my org',
    ],
    [
      'As a developer, I run reviews from a CLI against local diffs or in CI scripts, with machine-readable output my tooling can consume',
      'developer',
      'I run reviews from a CLI against local diffs or in CI scripts, with machine-readable output my tooling can consume',
    ],
    [
      'As an ML engineer, I am billed at per-second or per-minute granularity and only while my instance is actually running',
      'ml engineer',
      'I am billed at per-second or per-minute granularity and only while my instance is actually running',
    ],
    [
      'As a support ops lead, I mark topics as human-only — legal threats, cancellations, security — and the agent never freelances on them',
      'support ops lead',
      'I mark topics as human-only — legal threats, cancellations, security — and the agent never freelances on them',
    ],
    [
      'As a product manager, I connect Google or Outlook calendar once and control per-meeting-type rules for which meetings get captured automatically',
      'product manager',
      'I connect Google or Outlook calendar once and control per-meeting-type rules for which meetings get captured automatically',
    ],
    [
      'As a technical writer, I author pages in Markdown/MDX with rich components — tabs, callouts, code groups, steps — without writing custom HTML',
      'technical writer',
      'I author pages in Markdown/MDX with rich components — tabs, callouts, code groups, steps — without writing custom HTML',
    ],
  ]
  it.each(cases)('%s', (title, persona, action) => {
    expect(parseStoryPersona(title)).toEqual({ persona, action })
  })
})

describe('parseStoryPersona — live subject-led clauses (no first-person verb at all)', () => {
  const cases: Array<[string, string, string]> = [
    [
      'As a switcher, my mail stays reachable over open protocols and standard formats — IMAP/JMAP/SMTP access and standards-based export — so no client can lock me in',
      'switcher',
      'My mail stays reachable over open protocols and standard formats — IMAP/JMAP/SMTP access and standards-based export — so no client can lock me in',
    ],
    [
      'As a team-lead, we can discuss an email in an internal side-thread — comments and @mentions beside the message — instead of forwarding copies around',
      'team-lead',
      'We can discuss an email in an internal side-thread — comments and @mentions beside the message — instead of forwarding copies around',
    ],
    [
      'As an SRE, escalation policies walk unacknowledged pages through multiple steps — delays, fallback responders, and repeat rounds — until someone acknowledges',
      'sre',
      'Escalation policies walk unacknowledged pages through multiple steps — delays, fallback responders, and repeat rounds — until someone acknowledges',
    ],
    [
      'As a founder, a genuinely usable free tier lets me run real prototypes before paying',
      'founder',
      'A genuinely usable free tier lets me run real prototypes before paying',
    ],
    [
      'As an ai-native user, my agent can provision its own sandbox, execute code, read the results, and tear it down — end to end without a human',
      'ai-native user',
      'My agent can provision its own sandbox, execute code, read the results, and tear it down — end to end without a human',
    ],
    [
      'As a data platform lead, the pricing model is published and predictable — I can estimate what a new source costs before connecting it',
      'data platform lead',
      'The pricing model is published and predictable — I can estimate what a new source costs before connecting it',
    ],
    [
      'As an IT admin, the product ships real consent features — participant notifications, in-meeting disclosure, or admin-enforced transparency — not just a policy PDF',
      'it admin',
      'The product ships real consent features — participant notifications, in-meeting disclosure, or admin-enforced transparency — not just a policy PDF',
    ],
    [
      "As a knowledge worker, AI finds and continuously optimizes the best meeting time across all attendees' calendars, not just the first open slot",
      'knowledge worker',
      "AI finds and continuously optimizes the best meeting time across all attendees' calendars, not just the first open slot",
    ],
    [
      'As a merchant, buyers can pay with accelerated wallets — Apple Pay, Google Pay, PayPal, platform one-click — without re-entering details',
      'merchant',
      'Buyers can pay with accelerated wallets — Apple Pay, Google Pay, PayPal, platform one-click — without re-entering details',
    ],
    [
      'As a privacy lead, user consent is captured and enforced across destinations — opt-outs and consent categories are honored downstream automatically',
      'privacy lead',
      'User consent is captured and enforced across destinations — opt-outs and consent categories are honored downstream automatically',
    ],
    [
      'As an on-call engineer, pages reach me over the channels I choose — push, SMS, phone call, and email — with per-channel notification rules',
      'on-call engineer',
      'Pages reach me over the channels I choose — push, SMS, phone call, and email — with per-channel notification rules',
    ],
    [
      'As a security engineer, reviews flag security problems in the diff — injection risks, leaked secrets, insecure patterns — alongside functional bugs',
      'security engineer',
      'Reviews flag security problems in the diff — injection risks, leaked secrets, insecure patterns — alongside functional bugs',
    ],
    [
      'As an agent builder, first-party integrations wrap my AI stack — AI SDKs, agent frameworks, model providers — so agent steps get durability without glue code',
      'agent builder',
      'First-party integrations wrap my AI stack — AI SDKs, agent frameworks, model providers — so agent steps get durability without glue code',
    ],
    [
      'As a designer, my whole team can edit the same file simultaneously with live cursors and instant sync',
      'designer',
      'My whole team can edit the same file simultaneously with live cursors and instant sync',
    ],
    [
      'As an AI-native user, my coding agent can install a skill by itself — a non-interactive, promptless install path an agent can run headlessly end to end',
      'ai-native user',
      'My coding agent can install a skill by itself — a non-interactive, promptless install path an agent can run headlessly end to end',
    ],
  ]
  it.each(cases)('%s', (title, persona, action) => {
    expect(parseStoryPersona(title)).toEqual({ persona, action })
  })
})

describe('parseStoryPersona — clause-internal commas stay with the action', () => {
  it('splits at the FIRST comma only', () => {
    expect(
      parseStoryPersona(
        'As a platform-engineer, budgets, resource monitors, or auto-suspend stop a runaway query or idle compute from burning money overnight',
      ),
    ).toEqual({
      persona: 'platform-engineer',
      action: 'Budgets, resource monitors, or auto-suspend stop a runaway query or idle compute from burning money overnight',
    })
  })
})

describe('parseStoryPersona — classic Connextra variants (synthetic)', () => {
  it('strips "I want to" and keeps the "so that" benefit clause', () => {
    expect(parseStoryPersona('As a user, I want to export my data so that I am never locked in')).toEqual({
      persona: 'user',
      action: 'Export my data so that I am never locked in',
    })
  })

  it('strips "I need to"', () => {
    expect(parseStoryPersona('As an ops lead, I need to rotate credentials without downtime')).toEqual({
      persona: 'ops lead',
      action: 'Rotate credentials without downtime',
    })
  })

  it("strips \"I'd like to\"", () => {
    expect(parseStoryPersona("As a founder, I'd like to see spend per project")).toEqual({
      persona: 'founder',
      action: 'See spend per project',
    })
  })

  it('handles a qualified persona ("developer using X")', () => {
    expect(parseStoryPersona('As a developer using the REST API, I want to paginate large result sets')).toEqual({
      persona: 'developer using the rest api',
      action: 'Paginate large result sets',
    })
  })

  it('handles the missing-comma variant', () => {
    expect(parseStoryPersona('As an ops lead I want to deploy from a single command')).toEqual({
      persona: 'ops lead',
      action: 'Deploy from a single command',
    })
  })
})

describe('parseStoryPersona — persona casing/whitespace dedupe', () => {
  it('lowercases so "Founder" and "founder" chip identically', () => {
    expect(parseStoryPersona('As a Founder, I can close my books monthly').persona).toBe('founder')
    expect(parseStoryPersona('As a founder, I can close my books monthly').persona).toBe('founder')
  })

  it('dedupes the live "AI-native user" vs "ai-native user" drift', () => {
    expect(parseStoryPersona('As an AI-native user, I can do x').persona).toBe(
      parseStoryPersona('As an ai-native user, I can do x').persona,
    )
  })

  it('collapses internal whitespace', () => {
    expect(parseStoryPersona('As a  data   engineer, I can load data').persona).toBe('data engineer')
  })
})

describe('parseStoryPersona — non-matching text falls through untouched', () => {
  const passthrough = [
    'A hand-edited title with no persona prefix',
    'Accept a card payment online',
    'As always, the build stays green', // "As a…" only as a coincidence of letters — no article
    '', // degenerate
  ]
  it.each(passthrough)('%s', (text) => {
    expect(parseStoryPersona(text)).toEqual({ persona: null, action: text })
  })

  it('rejects paragraph-long "personas" (prose that happens to start with "As a")', () => {
    const prose =
      'As a general rule of thumb that most teams eventually discover the hard way after shipping, caching is hard'
    expect(parseStoryPersona(prose)).toEqual({ persona: null, action: prose })
  })

  it('is pure — never mutates its input', () => {
    const title = 'As a developer, I can do a thing'
    const result = parseStoryPersona(title)
    expect(title).toBe('As a developer, I can do a thing')
    expect(result.action).toBe('Do a thing')
  })
})
