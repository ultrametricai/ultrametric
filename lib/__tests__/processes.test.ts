import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { isPopulated, loadCategories, loadCategory } from '@/lib/data'
import {
  buildSimSteps, CADENCE_META, CADENCE_ORDER, cadenceRank, chainTasks, computeCeiling,
  findProcessBySlug, formatMinutes, gapThemes, loadChains, loadProcesses, processesByCadence,
  processSlug, siteCeiling, slugAliasFor, STEP_OPTIONS_CAP, stepVendorOptions, taskCeiling,
  VENDOR_ARENA, VENDOR_SIGNUP_URL, vendorChipInfo, vendorProductId, vendorRoles,
  type DagNode,
} from '@/lib/processes'
import { stepRanking } from '@/lib/processRankings'
import { verdictGaps } from '@/lib/humanSteps'
import { showComputerUseChips } from '@/lib/humanStepsUi'
import { buildSimRun, LEGAL_SIGNATURE_WHY } from '@/lib/processSim'

const DATA_DIR = path.resolve(__dirname, '../../data')

const node = (over: Partial<DagNode>): DagNode => ({
  id: 'n1',
  label: 'step',
  route: 'agent',
  reversibility: 'reversible',
  estimatedMinutes: 5,
  ...over,
})

describe('corpus', () => {
  it('loads all 147 records (125 processes + 22 situations) with unique, non-empty slugs', () => {
    const tasks = loadProcesses(DATA_DIR)
    expect(tasks.length).toBe(147)
    const slugs = tasks.map((t) => processSlug(t.title))
    expect(new Set(slugs).size).toBe(tasks.length)
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('keeps renamed processes reachable via slug aliases, with unique slugs across the namespace', () => {
    const tasks = loadProcesses(DATA_DIR)
    const canonical = new Set(tasks.map((t) => processSlug(t.title)))
    const aliases = tasks.flatMap((t) => t.slugAliases ?? [])
    expect(aliases.length).toBeGreaterThan(0)
    for (const a of aliases) expect(canonical.has(a.slug), `alias ${a.slug} collides with a canonical slug`).toBe(false)

    // The founder example: "Send Stripe invoice" is now the vendor-neutral "Send an invoice",
    // but the old indexed slug still resolves to the same task — with the alias identifiable
    // so the page can render its canonical pointer.
    const viaAlias = findProcessBySlug('send-stripe-invoice', DATA_DIR)
    expect(viaAlias?.title).toBe('Send an invoice')
    expect(slugAliasFor(viaAlias!, 'send-stripe-invoice')?.label).toBe('Send Stripe invoice')
    expect(slugAliasFor(viaAlias!, 'send-an-invoice')).toBeNull()
    expect(findProcessBySlug('send-an-invoice', DATA_DIR)?.id).toBe(viaAlias?.id)
  })

  it('folded processes redirect to their keeper; AFK-app-legacy slugs are gone', () => {
    // Curation sweep (founder 2026-09-18): duplicates fold into the real process via slug
    // aliases, so old indexed links keep landing somewhere honest.
    const folded: Array<[string, string]> = [
      ['incorporate-a-company', 'form_001'], // 2-step duplicate of the full incorporation flow
      // 2026-09-28 old-process-site sweep: with the LLC path first-class (form_011), the honest
      // keeper for the old conversion page is the ported statutory-conversion process itself.
      ['evaluate-c-corp-conversion', 'form_012'],
      ['file-de-annual-report', 'tax_001'], // the DE annual report IS the franchise-tax filing
      ['file-an-annual-report-registered-agent', 'qs_047'], // duplicate of the state annual report
      ['set-up-website', 'site_001'], // wizard duplicate of "Generate a website"
      ['import-documents-from-dropbox', 'qs_015'], // now an import step inside doc-storage setup
      ['goals-due-this-week', 'scale_012'], // goal tracking lives in Company OKRs
    ]
    for (const [slug, keeperId] of folded) {
      const task = findProcessBySlug(slug, DATA_DIR)
      expect(task?.id, `${slug} should fold into ${keeperId}`).toBe(keeperId)
      expect(slugAliasFor(task!, slug)).not.toBeNull()
    }
    // AFK-app chat/wizard suggestions were removed outright — not general startup operations,
    // and there is no honest keeper to redirect them onto.
    for (const gone of ['summarize-my-company', 'list-my-tasks', 'list-capabilities', 'extract-ultrametric-context']) {
      expect(findProcessBySlug(gone, DATA_DIR), `${gone} should be removed`).toBeNull()
    }
  })

  it('vendor-neutral titles: no tracked vendor is named in a process title', () => {
    const vendorPhrases = Object.keys(VENDOR_ARENA)
      .map((v) => v.replace(/_/g, ' '))
      .filter((p) => p.length > 3)
    for (const t of loadProcesses(DATA_DIR)) {
      const words = new Set(t.title.toLowerCase().split(/[^a-z0-9]+/))
      for (const phrase of vendorPhrases) {
        const named = phrase.includes(' ') ? t.title.toLowerCase().includes(phrase) : words.has(phrase)
        expect(named, `"${t.title}" names vendor "${phrase}" — titles are vendor-neutral (use slugAliases for old names)`).toBe(false)
      }
    }
  })

  it('vendor-neutral openers: no tracked vendor is named in a process\'s FIRST step label', () => {
    // Founder 2026-09-23: "processes don't start with just one supplier — the first step is to
    // SELECT a supplier on almost all of these." The opener names the FUNCTION ("create an
    // account with your compliance platform"), the market row offers the suppliers, and the
    // old vendor stays as node.vendor (the canonical call target) — never in the label.
    // Same phrase logic as the title test above, applied to node[0] of every task.
    const vendorPhrases = Object.keys(VENDOR_ARENA)
      .map((v) => v.replace(/_/g, ' '))
      .filter((p) => p.length > 3)
    for (const t of loadProcesses(DATA_DIR)) {
      const first = t.dag.nodes[0]
      const label = first.label.toLowerCase()
      const words = new Set(label.split(/[^a-z0-9]+/))
      for (const phrase of vendorPhrases) {
        const named = phrase.includes(' ') ? label.includes(phrase) : words.has(phrase)
        expect(
          named,
          `${t.id}/${first.id} "${first.label}" names vendor "${phrase}" — first steps are vendor-neutral (the market row is the selection surface; keep the vendor as node.vendor)`,
        ).toBe(false)
      }
    }
  })

  it('every step actionUrl is https and labeled, and every signup URL is https', () => {
    for (const t of loadProcesses(DATA_DIR)) {
      for (const n of t.dag.nodes) {
        if (!n.actionUrl) continue
        expect(n.actionUrl.startsWith('https://'), `${t.id}/${n.id} actionUrl must be https`).toBe(true)
        expect(n.actionLabel, `${t.id}/${n.id} actionUrl needs an actionLabel`).toBeTruthy()
      }
    }
    for (const [vendor, url] of Object.entries(VENDOR_SIGNUP_URL)) {
      expect(url.startsWith('https://'), `${vendor} signup URL must be https`).toBe(true)
    }
  })

  it('every process declares a cadence, and every cadence bucket is honestly non-trivial', () => {
    const tasks = loadProcesses(DATA_DIR)
    const valid = new Set<string>(CADENCE_ORDER)
    for (const t of tasks) {
      expect(valid.has(t.cadence), `${t.id} (${t.title}) has invalid cadence "${t.cadence}"`).toBe(true)
    }
    // The operating rhythm is only an honest x-ray if every recurring bucket has real corpus
    // members — daily code shipping through annual filings — not just a wall of one-time setup.
    const groups = processesByCadence(tasks)
    expect(groups.map((g) => g.cadence)).toEqual([...CADENCE_ORDER])
    expect(groups.reduce((n, g) => n + g.tasks.length, 0)).toBe(tasks.length)
    // Anchor the honest curation: the software loop ships daily, payroll runs monthly (the
    // corpus DAG says "regular monthly payroll run"), franchise tax is annual, incorporation
    // happens once, and a churn save only fires when a customer cancels.
    const cadenceOf = (id: string) => tasks.find((t) => t.id === id)!.cadence
    expect(cadenceOf('sw_001')).toBe('daily')
    expect(cadenceOf('hr_002')).toBe('monthly')
    expect(cadenceOf('fin_002')).toBe('monthly')
    expect(cadenceOf('tax_001')).toBe('annual')
    expect(cadenceOf('form_001')).toBe('once')
    expect(cadenceOf('growth_002')).toBe('event-driven')
    expect(cadenceOf('scale_005')).toBe('quarterly')
    expect(cadenceOf('sw_002')).toBe('weekly')
  })

  it('the five orderings are fully curated: timeOrder unique over processes, 1–5 scores everywhere', () => {
    const tasks = loadProcesses(DATA_DIR)
    // Situations (founder 2026-10-01) are reactive: NO timeOrder slot, a trigger sentence and
    // an honest urgency tier instead. Processes keep the exact pre-situation contract. The
    // loader enforces both directions; these assertions name offenders precisely.
    const processes = tasks.filter((t) => t.kind === 'process')
    const situations = tasks.filter((t) => t.kind === 'situation')
    for (const t of processes) {
      expect(Number.isInteger(t.timeOrder) && (t.timeOrder ?? 0) >= 1, `${t.id} timeOrder`).toBe(true)
      expect(t.trigger, `${t.id}: trigger is situation-only`).toBeUndefined()
      expect(t.urgency, `${t.id}: urgency is situation-only`).toBeUndefined()
    }
    for (const t of situations) {
      expect(t.timeOrder, `${t.id}: situations carry no timeline slot`).toBeUndefined()
      expect((t.trigger ?? '').length, `${t.id}: a situation names its trigger`).toBeGreaterThan(20)
      expect(['hours', 'days', 'weeks'], `${t.id} urgency`).toContain(t.urgency)
    }
    for (const t of tasks) {
      for (const [field, v] of [['annoyance', t.annoyance], ['risk', t.risk], ['growthImpact', t.growthImpact]] as const) {
        expect(Number.isInteger(v) && v >= 1 && v <= 5, `${t.id} ${field}=${v} must be an integer 1–5`).toBe(true)
      }
    }
    // The founder timeline is a total order OVER PROCESSES: every position unique, so the sort
    // is deterministic; situations sit outside it by design.
    expect(new Set(processes.map((t) => t.timeOrder)).size).toBe(processes.length)
    // …and every score axis actually discriminates (not a wall of 3s).
    for (const field of ['annoyance', 'risk', 'growthImpact'] as const) {
      expect(new Set(tasks.map((t) => t[field])).size, `${field} should span multiple values`).toBeGreaterThanOrEqual(4)
    }
  })

  it('ordering anchors: the founder spot checks hold', () => {
    const tasks = loadProcesses(DATA_DIR)
    const byId = (id: string) => tasks.find((t) => t.id === id)!
    // Incorporation is where the founder timeline starts (situations sit outside the timeline).
    const timeline = tasks.filter((t) => t.kind === 'process')
    const first = timeline.reduce((min, t) => ((t.timeOrder ?? Infinity) < (min.timeOrder ?? Infinity) ? t : min))
    expect(first.id).toBe('form_001')
    expect(byId('form_001').timeOrder).toBe(1)
    // DE franchise tax: high risk, annual.
    expect(byId('tax_001').risk).toBe(5)
    expect(byId('tax_001').cadence).toBe('annual')
    // Daily ship-a-feature: the growth loop.
    expect(byId('sw_001').growthImpact).toBe(5)
    expect(byId('sw_001').cadence).toBe('daily')
    // 409A: annoying AND risky.
    expect(byId('fund_003').annoyance).toBeGreaterThanOrEqual(4)
    expect(byId('fund_003').risk).toBeGreaterThanOrEqual(4)
  })

  // The GEO dimension (founder 2026-09-28: "USA-centric processes vs global processes —
  // choosing a name is global"). geoScope is required in the schema, so totality is enforced
  // by the parse itself; these tests pin the curation and the region-flag consistency.
  it('geoScope is total and consistent with the 🇺🇸 region flag both ways', () => {
    const tasks = loadProcesses(DATA_DIR)
    for (const t of tasks) {
      expect(['global', 'us', 'us-state'], `${t.id} geoScope`).toContain(t.geoScope)
      // The flag and the scope tell one story: every US-scoped process wears the flag,
      // and no jurisdiction-neutral process does.
      expect(t.region === 'us', `${t.id}: region flag must match geoScope ${t.geoScope}`)
        .toBe(t.geoScope !== 'global')
    }
    // Honest distribution: most of running a company is global tooling work; the US-centric
    // core is real but the minority.
    const scopes = tasks.map((t) => t.geoScope)
    expect(scopes.filter((s) => s === 'global').length).toBeGreaterThan(scopes.length / 2)
    expect(scopes.filter((s) => s === 'us').length).toBeGreaterThan(0)
    expect(scopes.filter((s) => s === 'us-state').length).toBeGreaterThan(0)
  })

  it('geo anchors: name is global, EIN is federal, franchise tax is state-level', () => {
    const tasks = loadProcesses(DATA_DIR)
    const byId = (id: string) => tasks.find((t) => t.id === id)!
    expect(byId('brand_001').geoScope).toBe('global') // choosing a name is global
    expect(byId('site_001').geoScope).toBe('global') // so is generating a website
    expect(byId('form_002').geoScope).toBe('us') // EIN — the IRS
    expect(byId('form_001').geoScope).toBe('us') // DE incorporation (founder call: us)
    expect(byId('tax_003').geoScope).toBe('us') // 1099s — the IRS
    // Truly state-level: the counterparty is a US state.
    for (const id of ['tax_001', 'form_005', 'qs_043', 'qs_045', 'qs_047', 'tax_011']) {
      expect(byId(id).geoScope, `${id} is state-level work`).toBe('us-state')
    }
    // Payroll RUNNING is global (the vendor loop); payroll SETUP is US (state/federal
    // registrations) and carries the per-country analogs.
    expect(byId('hr_002').geoScope).toBe('global')
    expect(byId('qs_063').geoScope).toBe('us')
    expect((byId('qs_063').geoNotes ?? []).length).toBeGreaterThan(0)
  })

  it('geoNotes are curated, deduped per country, and honest about scope', () => {
    const tasks = loadProcesses(DATA_DIR)
    let total = 0
    let globalWithNotes = 0
    for (const t of tasks) {
      const notes = t.geoNotes ?? []
      if (notes.length === 0) continue
      if (t.geoScope === 'global') globalWithNotes++
      // At most one note per country per process, the committed country enum only (the schema
      // re-checks it: IN/UK/DE/FR plus PT/CA since the 2026-10-03 new-countries wave).
      expect(new Set(notes.map((n) => n.country)).size).toBe(notes.length)
      for (const n of notes) {
        expect(n.actionUrl).toMatch(/^https:\/\//)
        expect(n.summary.length).toBeGreaterThan(20)
        expect(n.actionLabel.length).toBeGreaterThan(2)
      }
      total += notes.length
    }
    // The mapping expansion (founder ask 2026-09-29: "map the processes in the countries we
    // tried to spike"): every US-scoped process with a true analog is mapped, PLUS the
    // jurisdictionally-flavored global processes (founder agreement, invoicing, offboarding,
    // data protection, accounting…). Honest coverage, not completeness theater — a country
    // with no real analog carries no note, so the band stays wide.
    expect(total).toBeGreaterThanOrEqual(120)
    expect(total).toBeLessThanOrEqual(500)
    // Global notes exist (the flavored set) but stay the minority of note-carrying processes.
    expect(globalWithNotes).toBeGreaterThan(0)
    const usWithNotes = tasks.filter((t) => t.geoScope !== 'global' && (t.geoNotes ?? []).length > 0).length
    expect(usWithNotes).toBeGreaterThan(globalWithNotes)
    // The founder's worked examples: incorporation has all four country analogs, and the
    // founder agreement / equity split (founder example 2026-09-29: "?geo=in currently has
    // no India note") carries all four too — stamp duty in India, share classes in the UK.
    for (const id of ['form_001', 'startup_002']) {
      const t = tasks.find((x) => x.id === id)!
      expect((t.geoNotes ?? []).map((n) => n.country).sort(), id).toEqual(['CA', 'DE', 'FR', 'IN', 'PT', 'UK'])
    }
  })

  // The geo-note KIND (founder ask 2026-10-02: "?geo=in should hide the processes that are not
  // used in that country — an EIN for India doesn't make sense"). Required with no zod default,
  // so totality over every committed note is enforced by the parse itself; these pin the
  // curation decisions and the honest distribution.
  it('every geoNote carries a curated kind; the distribution and the worked examples hold', () => {
    const tasks = loadProcesses(DATA_DIR)
    const kinds = { analog: 0, absorbed: 0, 'not-applicable': 0 }
    for (const t of tasks) {
      for (const n of t.geoNotes ?? []) {
        expect(['analog', 'absorbed', 'not-applicable'], `${t.id}/${n.country} kind`).toContain(n.kind)
        kinds[n.kind]++
        // A note on a GLOBAL process is a per-country flavor of work that exists everywhere —
        // by construction it can only be 'analog' (the other kinds would contradict the scope).
        if (t.geoScope === 'global') expect(n.kind, `${t.id}/${n.country}: global flavor notes are analogs`).toBe('analog')
      }
    }
    // Honest distribution: most mapped needs exist abroad as their own processes; the absorbed/
    // not-applicable tails are real but small (each entry is individually curated).
    expect(kinds.analog).toBeGreaterThan(kinds.absorbed + kinds['not-applicable'])
    expect(kinds.absorbed).toBeGreaterThan(0)
    expect(kinds['not-applicable']).toBeGreaterThan(0)

    const noteKind = (id: string, country: string) =>
      tasks.find((t) => t.id === id)!.geoNotes!.find((n) => n.country === country)?.kind
    // The founder's example, pinned: an EIN doesn't make sense in India — PAN/TAN arrive inside
    // the SPICe+ incorporation filing. The UK's UTR and France's SIREN/SIRET are automatic too;
    // Germany's ELSTER tax-office registration is a real filing of its own.
    expect(noteKind('form_002', 'IN')).toBe('absorbed')
    expect(noteKind('form_002', 'UK')).toBe('absorbed')
    expect(noteKind('form_002', 'FR')).toBe('absorbed')
    expect(noteKind('form_002', 'DE')).toBe('analog')
    // Incorporation has a true doable analog in every covered country.
    for (const c of ['IN', 'UK', 'DE', 'FR', 'PT', 'CA']) expect(noteKind('form_001', c), `form_001/${c}`).toBe('analog')
    // No country has a US-style registered-agent industry — the registered office is declared
    // inside formation everywhere.
    for (const c of ['IN', 'UK', 'DE', 'FR', 'PT', 'CA']) expect(noteKind('qs_043', c), `qs_043/${c}`).toBe('absorbed')
    // The need genuinely absent: no UK 1099 regime; nothing to foreign-qualify for inside the
    // UK; no German franchise-tax ritual (the IHK-Beitrag arrives automatically).
    expect(noteKind('tax_003', 'UK')).toBe('not-applicable')
    expect(noteKind('qs_045', 'UK')).toBe('not-applicable')
    expect(noteKind('tax_001', 'DE')).toBe('not-applicable')
  })

  // Geo coverage to totality (founder boost 2026-10-02: "close EVERY gap … pin totality:
  // uncovered = 0"; PT and CA joined the enum in the 2026-10-03 new-countries wave). Every
  // US-scoped record — processes and situations alike — says what the need becomes in all six
  // countries, with the honesty carried by the note KIND (a not-applicable note is a closed gap
  // too: sit_002 is inherently US-inbound, Germany has no 409A ritual and no 1099 regime,
  // Canada has no LLC). The six-country set is the whole enum, so this is the uncovered=0 pin.
  it('geo totality: every US-scoped record carries all six countries (uncovered = 0)', () => {
    const tasks = loadProcesses(DATA_DIR)
    for (const t of tasks.filter((x) => x.geoScope !== 'global')) {
      expect(
        (t.geoNotes ?? []).map((n) => n.country).sort(),
        `${t.id} (${t.title}): six-country geo totality`,
      ).toEqual(['CA', 'DE', 'FR', 'IN', 'PT', 'UK'])
    }
    // The worked decisions of the closing passes, pinned: bank-account analogs exist in the four
    // original countries (vendor-geo-aligned; qs_023 is global-scoped, so PT/CA notes are not
    // required of it); 409A and 1099s honestly have no DE equivalent and no PT/CA appraisal
    // ritual exists either; the visa situation is honestly not-applicable everywhere (inherently
    // US-inbound); Canada's LLC gap is a real not-applicable, not a missing note.
    const noteKind = (id: string, country: string) =>
      tasks.find((t) => t.id === id)!.geoNotes!.find((n) => n.country === country)?.kind
    for (const c of ['IN', 'UK', 'DE', 'FR']) {
      expect(noteKind('qs_023', c), `qs_023/${c}`).toBe('analog')
    }
    for (const c of ['IN', 'UK', 'DE', 'FR', 'PT', 'CA']) {
      expect(noteKind('sit_002', c), `sit_002/${c}`).toBe('not-applicable')
    }
    expect(noteKind('fund_003', 'DE')).toBe('not-applicable')
    expect(noteKind('fund_003', 'FR')).toBe('not-applicable')
    expect(noteKind('fund_003', 'UK')).toBe('analog') // the EMI valuation precedent
    expect(noteKind('fund_003', 'PT')).toBe('not-applicable') // no safe-harbor appraisal; Lei 21/2023 defers tax instead
    expect(noteKind('fund_003', 'CA')).toBe('not-applicable') // CCPC deferral, no appraisal ritual
    expect(noteKind('tax_003', 'DE')).toBe('not-applicable')
    expect(noteKind('tax_003', 'PT')).toBe('not-applicable') // e-Fatura already reports invoices
    expect(noteKind('tax_003', 'CA')).toBe('analog') // the T4A slip is a real information return
    expect(noteKind('form_011', 'CA')).toBe('not-applicable') // Canada has no LLC form at all
    expect(noteKind('qs_045', 'CA')).toBe('analog') // extra-provincial registration genuinely exists
    expect(noteKind('vc_002', 'DE')).toBe('analog') // AIFMD/BaFin is real, doable work
  })

  // US state coverage (founder state wave 2026-10-03): where founders actually diverge from the
  // DE-corp default, the state-scoped records cite dated rule cards against primary sources —
  // CA SOI + FTB minimum tax, NV annual list/license + commerce tax, TX margin tax + foreign
  // registration. Same contract as the situations' rule-card pins: the id appears in the
  // description AND the card is committed on disk.
  it('state-coverage records cite their US-CA/US-NV/US-TX rule cards, committed on disk', () => {
    const tasks = loadProcesses(DATA_DIR)
    const byId = (id: string) => tasks.find((t) => t.id === id)!
    for (const [pid, dir, ruleId] of [
      ['form_005', 'US-CA', 'us-ca.minimum-franchise-tax'],
      ['form_005', 'US-NV', 'us-nv.commerce-tax-threshold'],
      ['form_005', 'US-TX', 'us-tx.franchise-tax-report'],
      ['qs_045', 'US-CA', 'us-ca.foreign-qualification'],
      ['qs_045', 'US-TX', 'us-tx.foreign-registration'],
      ['qs_047', 'US-CA', 'us-ca.statement-of-information'],
      ['qs_047', 'US-NV', 'us-nv.annual-list-business-license'],
      ['qs_047', 'US-TX', 'us-tx.franchise-tax-report'],
    ] as const) {
      expect(byId(pid).description, `${pid} cites ${ruleId}`).toContain(ruleId)
      const file = path.join(__dirname, '..', '..', 'rules', dir, `${ruleId.replace(/\./g, '-')}.json`)
      expect(fs.existsSync(file), `${ruleId} card committed at ${file}`).toBe(true)
      expect(JSON.parse(fs.readFileSync(file, 'utf8')).id).toBe(ruleId)
    }
  })

  it('cadence display helpers cover every bucket in board order', () => {
    for (const c of CADENCE_ORDER) {
      expect(CADENCE_META[c].label).toBeTruthy()
      expect(CADENCE_META[c].blurb).toBeTruthy()
    }
    expect(CADENCE_ORDER.map(cadenceRank)).toEqual(CADENCE_ORDER.map((_, i) => i))
    expect(cadenceRank('daily')).toBe(0)
    expect(cadenceRank('once')).toBe(CADENCE_ORDER.length - 1)
  })

  // Situations (founder ask 2026-10-01): reactive, trigger-driven records — the honest-curation
  // spot pins. Kind invariants (trigger/urgency/timeOrder) are pinned in the orderings test
  // above; these pin the CONTENT decisions.
  it('situations: the founder examples and the curated set hold their honest shape', () => {
    const tasks = loadProcesses(DATA_DIR)
    const byId = (id: string) => tasks.find((t) => t.id === id)!
    const situations = tasks.filter((t) => t.kind === 'situation')
    expect(situations.length).toBe(22)
    // Reactive by definition: every situation is event-driven — no situation sits on a calendar.
    for (const t of situations) expect(t.cadence, `${t.id} cadence`).toBe('event-driven')
    // The urgency clock is curated, not uniform — all three tiers exist in the set.
    expect(new Set(situations.map((t) => t.urgency)).size).toBe(3)

    // C&D (founder example 1): the counsel step routes through the judged startup-law-firms
    // arena, and the engagement-letter signature is the legally-human step.
    const cnd = byId('sit_001')
    expect(cnd.urgency).toBe('days')
    const counsel = cnd.dag.nodes.find((n) => n.optionsArenaId === 'startup-law-firms')!
    expect(counsel, 'C&D counsel step routes via the judged law-firm arena').toBeDefined()
    const engagement = cnd.dag.nodes.find((n) => n.legalSignature)!
    expect(engagement.route).toBe('person')
    expect(engagement.label.toLowerCase()).toContain('engagement')
    // No statutory C&D response clock exists — the honest framing is the letter's own deadline.
    expect(cnd.dag.nodes.some((n) => n.label.toLowerCase().includes('stated deadline'))).toBe(true)

    // Visa (founder example 2): the real status portals are cited — CEAC and the USCIS tracker —
    // and premium processing carries its honest scope (petition classes, per USCIS).
    const visa = byId('sit_002')
    const urls = visa.dag.nodes.map((n) => n.actionUrl ?? '')
    expect(urls.some((u) => u.startsWith('https://ceac.state.gov/'))).toBe(true)
    expect(urls.some((u) => u.startsWith('https://egov.uscis.gov/'))).toBe(true)
    expect(urls.some((u) => u.includes('uscis.gov/forms/all-forms/how-do-i-request-premium-processing'))).toBe(true)
    expect(urls.some((u) => u.includes('travel.state.gov')), '221(g) reality cited').toBe(true)
    expect(taskCeiling(visa).pct, 'a consulate is not an API — the low ceiling is the truth').toBeLessThanOrEqual(25)

    // Legal-deadline honesty: where a situation leans on a statute/rule, its description names
    // the dated rule card (the deadlines.ts pattern) — and the card is committed on disk.
    for (const [sid, dir, ruleId] of [
      ['sit_008', 'US-FED', 'us-fed.frcp-answer-deadline'],
      ['sit_009', 'US-FED', 'us-fed.trademark-office-action-response'],
      ['sit_010', 'US-DE', 'us-de.franchise-tax-annual-report'],
      // Wave 3 (founder boost 2026-10-02): the GDPR one-month DSAR clock and the OSHA
      // 8/24-hour severe-injury clocks, carded against their primary sources.
      ['sit_015', 'EU', 'eu.gdpr-dsar-response-deadline'],
      ['sit_021', 'US-FED', 'us-fed.osha-severe-injury-reporting'],
    ] as const) {
      expect(byId(sid).description, `${sid} cites its rule card`).toContain(ruleId)
      const file = path.join(__dirname, '..', '..', 'rules', dir, `${ruleId.replace(/\./g, '-')}.json`)
      expect(fs.existsSync(file), `${ruleId} card committed at ${file}`).toBe(true)
      expect(JSON.parse(fs.readFileSync(file, 'utf8')).id).toBe(ruleId)
    }

    // The lawsuit's filed pleading and the office action's TEAS filing are signature acts; the
    // breach's regulator/individual notifications are the honestly-irreversible steps.
    expect(byId('sit_008').dag.nodes.filter((n) => n.legalSignature).length).toBeGreaterThanOrEqual(1)
    expect(byId('sit_009').dag.nodes.find((n) => n.legalSignature)!.label).toContain('TEAS')
    const breach = byId('sit_003')
    expect(breach.urgency).toBe('hours')
    expect(breach.reversibility).toBe('irreversible')
    expect(breach.dag.nodes.filter((n) => n.reversibility === 'irreversible').length).toBe(2)
    // Geo honesty: the breach clocks are US-state statutes with real non-US analogs mapped —
    // country-total since the totality passes (the CNIL teleservice URL verified live
    // 2026-10-02 closed the FR gap the first pass couldn't; CNPD and the OPC closed PT/CA
    // in the 2026-10-03 wave).
    expect(breach.geoScope).toBe('us-state')
    expect((breach.geoNotes ?? []).map((n) => n.country).sort()).toEqual(['CA', 'DE', 'FR', 'IN', 'PT', 'UK'])
    expect(breach.geoNotes!.find((n) => n.country === 'FR')!.actionUrl).toContain('cnil.fr')
  })

  it('contains no scrubbed vendor names and no AFK-app-legacy framing', () => {
    const raw = JSON.stringify(loadProcesses(DATA_DIR)).toLowerCase()
    for (const banned of [
      'searchmarq', 'domscan', 'daytona', 'linear.app',
      // The corpus is a general startup-operations map, not the original AFK app's task list.
      'ultrametric', 'setup wizard', 'coworker chat', 'content firewall',
    ]) {
      expect(raw.includes(banned), `corpus must not mention ${banned}`).toBe(false)
    }
  })
})

describe('computeCeiling', () => {
  it('computes agent share, minutes, approval gates, and gaps', () => {
    const ceiling = computeCeiling([
      node({ id: 'a', route: 'agent', estimatedMinutes: 2 }),
      node({ id: 'b', route: 'agent', estimatedMinutes: 4, approvalRequired: true }),
      node({ id: 'c', label: 'Notarized signature', route: 'person', estimatedMinutes: 10 }),
      node({ id: 'd', label: 'State portal filing', route: 'form', estimatedMinutes: 8 }),
    ])
    expect(ceiling.agentSteps).toBe(2)
    expect(ceiling.totalSteps).toBe(4)
    expect(ceiling.pct).toBe(50)
    expect(ceiling.agentMinutes).toBe(6)
    expect(ceiling.totalMinutes).toBe(24)
    expect(ceiling.approvalGates).toBe(1)
    expect(ceiling.gaps).toEqual([
      { label: 'Notarized signature', route: 'person', why: 'human or computer use' },
      { label: 'State portal filing', route: 'form', why: 'manual form/portal — no API path' },
    ])
  })

  it('an all-agent process has a 100% ceiling and no gaps', () => {
    const ceiling = computeCeiling([node({ id: 'a' }), node({ id: 'b' })])
    expect(ceiling.pct).toBe(100)
    expect(ceiling.gaps).toEqual([])
  })

  it('site-wide ceiling aggregates every task and stays in (0, 100)', () => {
    const tasks = loadProcesses(DATA_DIR)
    const site = siteCeiling(tasks)
    expect(site.totalSteps).toBe(tasks.reduce((n, t) => n + t.dag.nodes.length, 0))
    expect(site.agentSteps).toBe(tasks.reduce((n, t) => n + taskCeiling(t).agentSteps, 0))
    expect(site.pct).toBeGreaterThan(0)
    expect(site.pct).toBeLessThan(100)
  })
})

describe('gap themes', () => {
  it('classifies every non-agent step into exactly one theme', () => {
    const tasks = loadProcesses(DATA_DIR)
    const themes = gapThemes(tasks)
    const gapCount = tasks.reduce((n, t) => n + taskCeiling(t).gaps.length, 0)
    expect(themes.reduce((n, th) => n + th.count, 0)).toBe(gapCount)
    for (const th of themes) expect(th.examples.length).toBeGreaterThan(0)
  })
})

describe('vendor -> arena mapping', () => {
  it('every mapped vendor resolves (via vendorProductId) to a real product in its arena', () => {
    for (const [vendor, arenaId] of Object.entries(VENDOR_ARENA)) {
      const data = loadCategory(arenaId, DATA_DIR)
      const productId = vendorProductId(vendor)
      expect(
        data.products.some((p) => p.id === productId),
        `${vendor} (product id ${productId}) should be a product id in ${arenaId}`,
      ).toBe(true)
    }
  })

  it('every corpus vendorOption is either arena-tracked or an intentional unlinked chip', () => {
    const tracked = new Set(Object.keys(VENDOR_ARENA))
    // Untracked options we still show honestly (no arena yet) — keep this list deliberate.
    // (legalzoom and mailchimp graduated to tracked when legal-ops/email-marketing shipped;
    // vanta/secureframe/oneleet, namecheap/name_com/porkbun graduated 2026-09-22 when the
    // wave-5 compliance-automation and domain-registrars arenas shipped; dropbox/google_drive,
    // sendgrid, resend/postmark/mailgun, and stable/earth_class_mail/virtualpostmail graduated
    // 2026-09-23 when the launch-day cloud-storage, email-apis, and virtual-mailboxes arenas
    // shipped. google_sheets stays an honest chip: no spreadsheet arena exists and
    // product-analytics' event-analytics stories don't apply to it.)
    const allowedUntracked = new Set([
      'doola', 'google_sheets', 'northwest',
      'termly', 'iubenda', 'producthunt', 'betalist', 'hackernews',
      'ahrefs', 'semrush', 'google_search_console', 'apollo',
      // vendor_011 "Compare on evidence": our own surface, labeled '(ours)' — honest
      // affiliation, never passed off as an independently judged product.
      'productarena',
      // 2026-09-22 corpus expansion — real suppliers with no arena yet, shown as honest
      // unlinked chips: R&D-credit study shops, pen-test firms, 401(k) providers, MDMs,
      // EOR/status-page/questionnaire vendors, and mobile build/submit tooling.
      'fondo', 'neo_tax', 'cobalt', 'guideline', 'human_interest',
      'kandji', 'jamf', 'remote', 'statuspage', 'conveyor', 'fastlane', 'expo',
      // 2026-09-22 wave-3 vendor-cell fill — real suppliers with no arena yet (password
      // managers, trademark watch services), every listed signup URL curl-verified 200 in
      // lib/processes.ts.
      'onepassword', 'bitwarden', 'dashlane',
      'markify', 'corsearch', 'harbor_compliance',
      // 2026-09-23 vendor-neutral first-step sweep — markets with no arena yet, shown as
      // honest unlinked chips: team wikis, company-email suites, transactional email senders.
      'confluence', 'slite', 'slab',
      'microsoft_365', 'zoho_mail',
      // 2026-09-23 VC-fund phase (founder: "a process area for VC processes") — genuine
      // fund-formation/sub-doc/fund-admin suppliers with no arena yet, shown as honest
      // unlinked chips; signup URLs curl-verified 200 in lib/processes.ts.
      'angellist', 'sydecar', 'passthrough', 'juniper_square',
    ])
    for (const task of loadProcesses(DATA_DIR)) {
      for (const n of task.dag.nodes) {
        for (const v of n.vendorOptions ?? []) {
          expect(
            tracked.has(v) || allowedUntracked.has(v),
            `${task.id}/${n.id}: vendorOption ${v} is neither tracked nor allow-listed`,
          ).toBe(true)
        }
      }
    }
  })

  it('vendorChipInfo resolves tracked vendors to a live product with rank, untracked to an unlinked chip', () => {
    const clerky = vendorChipInfo('clerky', DATA_DIR)
    expect(clerky.productId).toBe('clerky')
    expect(clerky.arenaId).toBe('legal-ops')
    expect(clerky.arenaName).toBeTruthy()
    expect(clerky.rank).toBeGreaterThanOrEqual(1)

    // snake_case vendor key resolves to the kebab-case judged product id
    const atlas = vendorChipInfo('stripe_atlas', DATA_DIR)
    expect(atlas.productId).toBe('stripe-atlas')
    expect(atlas.arenaId).toBe('legal-ops')
    expect(atlas.label).toBe('Stripe Atlas')

    // untracked vendor: honest unlinked chip, label still pretty
    const doola = vendorChipInfo('doola', DATA_DIR)
    expect(doola.productId).toBeNull()
    expect(doola.arenaId).toBeNull()
    expect(doola.label).toBe('Doola')
  })

  it('the formation-service step lists the real market: 4 tracked formation services + honest unlinked chips', () => {
    const incorporate = loadProcesses(DATA_DIR).find((t) => t.id === 'form_001')!
    const choose = incorporate.dag.nodes.find((n) => n.label === 'Choose formation service')!
    // Deliberately CURATED, not arena-derived: the function (formation services) is narrower
    // than legal-ops, whose roster also holds e-signature and contract tools.
    expect(choose.optionsArenaId).toBeUndefined()
    expect(choose.vendorOptions).toEqual([
      'clerky', 'stripe_atlas', 'firstbase', 'legalzoom', 'northwest', 'doola',
    ])
    const chips = stepVendorOptions(choose, DATA_DIR)
    expect(chips.filter((c) => c.productId).length).toBe(4)
    expect(chips.filter((c) => !c.productId).map((c) => c.label)).toEqual(
      ['Northwest Registered Agent', 'Doola'],
    )
  })

  it('track-runway lists the real market: banking AND accounting options, not just Mercury', () => {
    const runway = loadProcesses(DATA_DIR).find((t) => t.id === 'qs_050')!
    const optionVendors = new Set(runway.dag.nodes.flatMap((n) => n.vendorOptions ?? []))
    for (const v of ['mercury', 'brex', 'relay', 'quickbooks', 'xero', 'pilot']) {
      expect(optionVendors.has(v), `track-runway should list ${v}`).toBe(true)
    }
    const roles = vendorRoles([runway], DATA_DIR)
    const arenas = roles.map((r) => r.arenaId)
    expect(arenas).toContain('startup-banking')
    expect(arenas).toContain('accounting')
  })

  it('vendorRoles dedupes per arena, defaults to the canonical vendor, and ranks by agentReady', () => {
    const tasks = loadProcesses(DATA_DIR)
    const payrollTask = tasks.find((t) => t.id === 'qs_063')!
    const roles = vendorRoles([payrollTask], DATA_DIR)
    const payroll = roles.find((r) => r.arenaId === 'payroll')
    expect(payroll).toBeDefined()
    // gusto is listed first in the task's vendors, so it is the canonical default.
    expect(payroll!.canonicalVendor).toBe('gusto')
    expect(payroll!.defaultProductId).toBe('gusto')
    const scores = payroll!.alternatives.map((o) => o.agentReady ?? -1)
    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
    // one role per arena, not one per vendor
    expect(roles.filter((r) => r.arenaId === 'payroll').length).toBe(1)
  })

  it('vendorRoles includes arenas claimed only via a step optionsArenaId (corporate cards → expense-management)', () => {
    const cards = loadProcesses(DATA_DIR).find((t) => t.id === 'qs_024')!
    const roles = vendorRoles([cards], DATA_DIR)
    const expense = roles.find((r) => r.arenaId === 'expense-management')
    expect(expense).toBeDefined()
    // No curated qs_024 vendor maps to expense-management, so the role's canonical/default is
    // the arena's agent-readiness leader.
    expect(expense!.canonicalVendor).toBe(expense!.defaultProductId)
    expect(expense!.alternatives.map((o) => o.id)).toContain(expense!.defaultProductId)
  })

  it('node vendors take precedence over the task vendor list as canonical', () => {
    const tasks = loadProcesses(DATA_DIR)
    const hire = tasks.find((t) => t.id === 'hr_001')!
    const roles = vendorRoles([hire], DATA_DIR)
    const payroll = roles.find((r) => r.arenaId === 'payroll')
    expect(payroll?.canonicalVendor).toBe('gusto')
    expect(payroll!.stepCount).toBeGreaterThan(0)
  })

  it('LLM-first steps (founder 2026-09-30): validate-the-idea gains an ai-assistants role beside the Notion capture role', () => {
    const idea = loadProcesses(DATA_DIR).find((t) => t.id === 'startup_001')!
    const roles = vendorRoles([idea], DATA_DIR)
    const assistants = roles.find((r) => r.arenaId === 'ai-assistants')
    expect(assistants, 'the sim Vendors tab should offer the assistants role').toBeDefined()
    expect(assistants!.stepCount).toBeGreaterThan(0)
    expect(assistants!.alternatives.map((o) => o.id)).toContain(assistants!.defaultProductId)
    // "and maybe Notion after" — the capture step keeps the arena where Notion is judged.
    const pm = roles.find((r) => r.arenaId === 'project-management')
    expect(pm?.canonicalVendor).toBe('notion')
  })
})

describe('derived step options (optionsArenaId)', () => {
  it('every optionsArenaId in the corpus is a real, populated arena', () => {
    const arenaIds = new Set(loadCategories(DATA_DIR).map((c) => c.id))
    for (const t of loadProcesses(DATA_DIR)) {
      for (const n of t.dag.nodes) {
        if (!n.optionsArenaId) continue
        expect(arenaIds.has(n.optionsArenaId), `${t.id}/${n.id}: unknown arena ${n.optionsArenaId}`).toBe(true)
        expect(isPopulated(n.optionsArenaId, DATA_DIR), `${t.id}/${n.id}: arena ${n.optionsArenaId} not populated`).toBe(true)
        // Derived steps keep a curated default set too — the frozen fallback and role seeds.
        expect(n.vendorOptions?.length, `${t.id}/${n.id}: derived step should keep curated vendorOptions`).toBeGreaterThan(0)
      }
    }
  })

  it('a derived step lists the arena\'s CURRENT roster in Overall-score (leaderboard) order, every chip tracked', () => {
    const payrollStep = loadProcesses(DATA_DIR)
      .find((t) => t.id === 'qs_063')!.dag.nodes.find((n) => n.id === 'n3')!
    expect(payrollStep.optionsArenaId).toBe('payroll')
    const chips = stepVendorOptions(payrollStep, DATA_DIR)
    const leaderboard = loadCategory('payroll', DATA_DIR).rankings.leaderboard.map((e) => e.productId)
    // Every curated payroll option is already in the roster, so the list IS the leaderboard.
    expect(chips.map((c) => c.productId)).toEqual(leaderboard.slice(0, STEP_OPTIONS_CAP))
    for (const c of chips) {
      expect(c.arenaId).toBe('payroll')
      expect(c.rank).toBeGreaterThanOrEqual(1)
    }
  })

  it('caps the derived roster at STEP_OPTIONS_CAP and appends curated extras after it', () => {
    // ai-coding judges >8 products; the derived list is the top 8 by Overall score, and the curated
    // option that falls outside the top 8 (cursor) is appended rather than dropped.
    const codeStep = loadProcesses(DATA_DIR)
      .find((t) => t.id === 'sw_001')!.dag.nodes.find((n) => n.id === 'n3')!
    expect(codeStep.optionsArenaId).toBe('ai-coding')
    const leaderboard = loadCategory('ai-coding', DATA_DIR).rankings.leaderboard
    expect(leaderboard.length).toBeGreaterThan(STEP_OPTIONS_CAP)
    const chips = stepVendorOptions(codeStep, DATA_DIR)
    expect(chips.slice(0, STEP_OPTIONS_CAP).map((c) => c.productId)).toEqual(
      leaderboard.slice(0, STEP_OPTIONS_CAP).map((e) => e.productId),
    )
    const extras = chips.slice(STEP_OPTIONS_CAP)
    for (const extra of extras) {
      expect(codeStep.vendorOptions!.map(vendorProductId)).toContain(extra.productId ?? extra.vendor)
    }
    // No duplicates: curated options already in the derived roster are subsumed, not repeated.
    const ids = chips.map((c) => c.productId ?? c.vendor)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps curated untracked extras as honest unlinked chips after the derived roster', () => {
    const runwayStep = loadProcesses(DATA_DIR)
      .find((t) => t.id === 'qs_050')!.dag.nodes.find((n) => n.id === 'n3')!
    expect(runwayStep.optionsArenaId).toBe('accounting')
    const chips = stepVendorOptions(runwayStep, DATA_DIR)
    const sheets = chips.find((c) => c.label === 'Google Sheets')
    expect(sheets).toBeDefined()
    expect(sheets!.productId).toBeNull()
    // …and it sorts after every tracked accounting chip. Compare against the tracked chips
    // actually rendered, not the raw leaderboard length — the derived roster caps at
    // STEP_OPTIONS_CAP, so an arena larger than the cap (accounting grew to 11 products the
    // day this test landed) renders fewer tracked chips than it has ranked products.
    const trackedCount = chips.filter((c) => c.productId !== null).length
    expect(chips.indexOf(sheets!)).toBeGreaterThanOrEqual(trackedCount)
  })

  it('curated extras tracked in ANOTHER arena keep their own arena chip (release notes: Notion after code hosts)', () => {
    const notesStep = loadProcesses(DATA_DIR)
      .find((t) => t.id === 'sw_002')!.dag.nodes.find((n) => n.id === 'n3')!
    expect(notesStep.optionsArenaId).toBe('code-hosting')
    const chips = stepVendorOptions(notesStep, DATA_DIR)
    const notion = chips.find((c) => c.vendor === 'notion')
    expect(notion?.arenaId).toBe('project-management')
    expect(chips.filter((c) => c.arenaId === 'code-hosting').length).toBe(
      loadCategory('code-hosting', DATA_DIR).rankings.leaderboard.length,
    )
  })

  it('steps without an optionsArenaId keep their curated options exactly (coverage gaps stay frozen)', () => {
    // (qs_015/n1 — the previous example — graduated to a derived cloud-storage roster when the
    // launch-day arena shipped; comp_011/n2's minutes-template step stays deliberately curated:
    // its function is a document template, not storage hosting.)
    const template = loadProcesses(DATA_DIR)
      .find((t) => t.id === 'comp_011')!.dag.nodes.find((n) => n.id === 'n2')!
    expect(template.optionsArenaId).toBeUndefined()
    expect(stepVendorOptions(template, DATA_DIR).map((c) => c.vendor)).toEqual(template.vendorOptions)
  })
})

describe('cross-arena option declarations (extraOptionArenas / extraOptionRefs)', () => {
  it('every declared extra arena is real and populated, never repeats the covering arena; every ref names a real product, no duplicates', () => {
    const arenaIds = new Set(loadCategories(DATA_DIR).map((c) => c.id))
    let declaredSteps = 0
    for (const t of loadProcesses(DATA_DIR)) {
      for (const n of t.dag.nodes) {
        if (!n.extraOptionArenas && !n.extraOptionRefs) continue
        declaredSteps += 1
        const primary = n.optionsArenaId ?? (n.vendor ? VENDOR_ARENA[n.vendor] : undefined)
        const seenArenas = new Set<string>()
        for (const a of n.extraOptionArenas ?? []) {
          expect(arenaIds.has(a), `${t.id}/${n.id}: unknown extra arena ${a}`).toBe(true)
          expect(isPopulated(a, DATA_DIR), `${t.id}/${n.id}: extra arena ${a} not populated`).toBe(true)
          expect(a, `${t.id}/${n.id}: extra arena repeats the covering arena`).not.toBe(primary)
          expect(seenArenas.has(a), `${t.id}/${n.id}: duplicate extra arena ${a}`).toBe(false)
          seenArenas.add(a)
        }
        const seenRefs = new Set<string>()
        for (const r of n.extraOptionRefs ?? []) {
          expect(arenaIds.has(r.arenaId), `${t.id}/${n.id}: unknown ref arena ${r.arenaId}`).toBe(true)
          expect(isPopulated(r.arenaId, DATA_DIR), `${t.id}/${n.id}: ref arena ${r.arenaId} not populated`).toBe(true)
          expect(r.arenaId, `${t.id}/${n.id}: ref arena repeats the covering arena`).not.toBe(primary)
          const key = `${r.arenaId}:${r.productId}`
          expect(seenRefs.has(key), `${t.id}/${n.id}: duplicate ref ${key}`).toBe(false)
          seenRefs.add(key)
          expect(
            loadCategory(r.arenaId, DATA_DIR).products.some((p) => p.id === r.productId),
            `${t.id}/${n.id}: ref ${key} is not a judged product`,
          ).toBe(true)
        }
      }
    }
    // The founder sweep is in the data, not vacuously green.
    expect(declaredSteps).toBeGreaterThanOrEqual(50)
  })
})

describe('chains', () => {
  it('the YC-journey playbooks exist and compose real processes', () => {
    const ids = new Set(loadChains(DATA_DIR).map((c) => c.id))
    for (const id of [
      'company-launch', 'first-hire', 'month-end-close', 'get-paid', 'launch-website',
      // Founder 2026-09-18: the missing end-to-end journeys YC startups actually run.
      'raise-a-seed-round', 'get-first-10-customers', 'launch-on-product-hunt',
      'set-up-compliance', 'ship-v1', 'go-fundraise-follow-on',
    ]) {
      expect(ids.has(id), `chain ${id} should exist`).toBe(true)
    }
    // The follow-on raise runs through the new atomic processes it genuinely needed.
    const followOn = loadChains(DATA_DIR).find((c) => c.id === 'go-fundraise-follow-on')!
    expect(followOn.taskIds).toContain('fund_002') // Close a priced equity round
    expect(followOn.taskIds).toContain('fund_005') // Set up a data room
  })

  it('the founder-2026-09-25 playbooks exist and compose the uncovered corpus', () => {
    const ids = new Set(loadChains(DATA_DIR).map((c) => c.id))
    for (const id of [
      'set-up-the-office-stack', 'ship-it-right', 'price-and-monetize',
      'run-support-and-keep-customers', 'build-the-team', 'go-global',
      'board-and-governance-rhythm',
    ]) {
      expect(ids.has(id), `chain ${id} should exist`).toBe(true)
    }
  })

  it('validate-the-idea opens the pre-formation playbook, which sorts first (founder 2026-09-25)', () => {
    const chains = loadChains(DATA_DIR)
    // Lifecycle ordering: the recomposed name-the-company chain stays the first playbook…
    expect(chains[0].id).toBe('name-the-company')
    // …and "Validate the idea" (startup_001) is its opening act.
    expect(chains[0].taskIds[0]).toBe('startup_001')
  })

  it('every chain taskId exists in the corpus and ids are unique kebab-case', () => {
    const chains = loadChains(DATA_DIR)
    expect(chains.length).toBeGreaterThanOrEqual(22)
    const taskIds = new Set(loadProcesses(DATA_DIR).map((t) => t.id))
    const ids = new Set<string>()
    for (const chain of chains) {
      expect(ids.has(chain.id)).toBe(false)
      ids.add(chain.id)
      for (const tid of chain.taskIds) {
        expect(taskIds.has(tid), `${chain.id}: unknown task ${tid}`).toBe(true)
      }
      expect(chainTasks(chain, DATA_DIR).map((t) => t.id)).toEqual(chain.taskIds)
    }
  })
})

// The agentic showcases (founder 2026-09-25: "cool playbooks that leverage the actually-agentic
// vendors") were chosen BY THE DATA, and these tests recompute the selection claims from the
// committed corpus + verdicts so the taglines can never drift from the numbers:
//   agent-run-back-office — the recurring money loop; claims the highest agent ceiling of any
//     committed playbook (90% at composition time), with most agent steps reachable via a top
//     judged vendor holding a full/partial verdict on a canonical agent surface
//     (agentic-mcp-server / agentic-official-cli).
//   mcp-native-stack — claims that at nearly every rankable step the top judged vendor ships an
//     official MCP server (32 of 34 rankable steps at composition time).
describe('agentic showcase chains (founder 2026-09-25) — tagline claims recompute from committed data', () => {
  const chains = loadChains(DATA_DIR)
  const chainNodes = (id: string) => {
    const chain = chains.find((c) => c.id === id)
    expect(chain, `showcase chain ${id} missing`).toBeDefined()
    return chainTasks(chain!, DATA_DIR).flatMap((t) => t.dag.nodes.map((n) => ({ taskId: t.id, node: n })))
  }
  const chainCeilingPct = (id: string) => computeCeiling(chainNodes(id).map((s) => s.node)).pct

  // The top judged vendor for one step (the same stepRanking the pages render), with its
  // canonical agent-surface verdicts — full/partial on the MCP-server / official-CLI stories.
  const topSurfaces = (taskId: string, dagNode: DagNode): { ranked: boolean; surfaces: string[] } => {
    const r = stepRanking(taskId, dagNode, DATA_DIR)
    if (!r) return { ranked: false, surfaces: [] }
    const data = loadCategory(r.arenaId, DATA_DIR)
    const top = r.vendors[0]
    const surfaces = (['agentic-mcp-server', 'agentic-official-cli'] as const).filter((sid) => {
      const v = data.verdicts.find((x) => x.productId === top.productId && x.storyId === sid)
      return v !== undefined && (v.verdict === 'full' || v.verdict === 'partial')
    })
    return { ranked: true, surfaces }
  }

  it('agent-run-back-office has the highest agent ceiling of every RECURRING playbook', () => {
    const backOffice = chainCeilingPct('agent-run-back-office')
    expect(backOffice).toBeGreaterThanOrEqual(88) // the tagline's "roughly nine steps in ten"
    // The showcase is "highest-ceiling recurring ops" — its every process is monthly.
    const tasks = new Map(loadProcesses(DATA_DIR).map((t) => [t.id, t]))
    const chain = chains.find((c) => c.id === 'agent-run-back-office')!
    for (const tid of chain.taskIds) expect(tasks.get(tid)!.cadence).toBe('monthly')
    // No other playbook made of recurring processes (nothing 'once' — the setup chains like
    // launch-website honestly ceiling higher, but they run one time) outranks it.
    for (const c of chains) {
      if (c.taskIds.some((tid) => tasks.get(tid)!.cadence === 'once')) continue
      expect(chainCeilingPct(c.id), `${c.id} outranks the back-office showcase`).toBeLessThanOrEqual(backOffice)
    }
  })

  it('agent-run-back-office: most steps run TODAY via a top judged vendor with a real agent surface', () => {
    const steps = chainNodes('agent-run-back-office')
    const agentic = steps.filter(
      ({ taskId, node: n }) => n.route === 'agent' && topSurfaces(taskId, n).surfaces.length > 0,
    )
    // 26 of 31 steps (84%) at composition time — the tagline's "most reachable today over
    // judged MCP servers and CLIs".
    expect(agentic.length / steps.length).toBeGreaterThanOrEqual(0.75)
  })

  it('mcp-native-stack: at nearly every rankable step the top judged vendor ships an official MCP server', () => {
    const ranked = chainNodes('mcp-native-stack')
      .map(({ taskId, node: n }) => topSurfaces(taskId, n))
      .filter((s) => s.ranked)
    const mcp = ranked.filter((s) => s.surfaces.includes('agentic-mcp-server'))
    expect(ranked.length).toBeGreaterThanOrEqual(20) // the claim rests on a broad judged base
    expect(mcp.length / ranked.length).toBeGreaterThanOrEqual(0.85) // 32/34 (94%) at composition time
  })
})

describe('simulator correctness — the Mercury bank case (founder 2026-09-18)', () => {
  // "mercury was selected and the AI said it was a human process but it's already been done."
  // Two fixes under test: (1) the corpus routes the online application/KYC as FORM work, never
  // "needs a human" for something the bank fully automates; (2) the transcript resolves the
  // "Choose a bank" step from the role picker instead of declaring a human gap.
  it('open-bank-account: choosing Mercury resolves the decision; no step claims a human agent is needed to apply', () => {
    const task = loadProcesses(DATA_DIR).find((t) => t.id === 'qs_023')!
    const apply = task.dag.nodes.find((n) => n.label.toLowerCase().includes('application'))!
    expect(apply.route).toBe('form') // Mercury's application is a fully online form
    const kyc = task.dag.nodes.find((n) => n.label.includes('KYC'))!
    expect(kyc.route).toBe('form') // the founder uploads docs — no human agent involved
    const wait = task.dag.nodes.find((n) => n.label.toLowerCase().includes('wait'))!
    expect(wait.route).toBe('person')
    expect(wait.async).toBe(true) // the only human-ish part is the bank-side wait
    const connect = task.dag.nodes.find((n) => n.id === 'n4')!
    expect(connect.route).toBe('agent') // the opened account connects over the bank API

    const steps = buildSimSteps([task], DATA_DIR)
    const roles = vendorRoles([task], DATA_DIR)
    const banking = roles.find((r) => r.arenaId === 'startup-banking')!
    expect(banking.canonicalVendor).toBe('mercury')

    const { lines, stats } = buildSimRun(steps, { 'startup-banking': 'mercury' }, roles)
    const text = lines.map((l) => l.text).join('\n')
    // The choice was made in the picker — the transcript says decided, never GAP.
    expect(text).not.toContain('GAP: Choose a bank')
    const decision = lines.find((l) => l.kind === 'decision')!
    expect(decision.text).toContain('Choose a bank')
    expect(decision.text).toContain('Mercury')
    // No transcript line declares the application "needs a human".
    for (const line of lines.filter((l) => l.text.includes('application'))) {
      expect(line.text).not.toContain('needs a human')
    }
    expect(stats.decidedSteps).toBe(1)
    // decided steps are not counted as human handoffs
    expect(stats.gaps).toBe(steps.filter((s) => s.route !== 'agent').length - 1)
  })

  it('choice steps carry their market arena so any derived-market decision resolves', () => {
    const steps = buildSimSteps(loadProcesses(DATA_DIR), DATA_DIR)
    const bankChoice = steps.find((s) => s.taskId === 'qs_023' && s.label === 'Choose a bank')!
    expect(bankChoice.choiceArenaId).toBe('startup-banking')
    // Non-choice steps never carry one.
    for (const s of steps.filter((x) => !/^(choose|select|pick)\b/i.test(x.label))) {
      expect(s.choiceArenaId).toBeNull()
    }
  })
})

describe('buildSimSteps', () => {
  it('flattens tasks into ordered serializable steps with mapped arenas', () => {
    const tasks = loadProcesses(DATA_DIR)
    const payroll = tasks.find((t) => t.id === 'hr_002')!
    const steps = buildSimSteps([payroll])
    expect(steps.length).toBe(payroll.dag.nodes.length)
    for (const s of steps) {
      expect(s.taskId).toBe('hr_002')
      if (s.vendor && VENDOR_ARENA[s.vendor]) expect(s.arenaId).toBe(VENDOR_ARENA[s.vendor])
      if (s.vendor && !VENDOR_ARENA[s.vendor]) expect(s.arenaId).toBeNull()
    }
    // steps must be plain JSON (client-component props)
    expect(JSON.parse(JSON.stringify(steps))).toEqual(steps)
  })
})

describe('legalSignature — the true human floor (founder 2026-09-21)', () => {
  const SPLIT_TASK_IDS = ['form_001', 'fund_002', 'fund_004', 'qs_044', 'qs_052', 'tax_002', 'startup_002'] as const

  it('every legalSignature node is route person', () => {
    let count = 0
    for (const t of loadProcesses(DATA_DIR)) {
      for (const n of t.dag.nodes) {
        if (!n.legalSignature) continue
        count += 1
        expect(n.route, `${t.id}:${n.id} legalSignature must stay route person`).toBe('person')
      }
    }
    // The extraction is in the data, not vacuously green.
    expect(count).toBeGreaterThanOrEqual(13)
  })

  it('split tasks keep valid DAGs: every edge resolves, acyclic, every node reachable', () => {
    for (const id of SPLIT_TASK_IDS) {
      const task = loadProcesses(DATA_DIR).find((t) => t.id === id)!
      const ids = new Set(task.dag.nodes.map((n) => n.id))
      expect(ids.size).toBe(task.dag.nodes.length)
      const edges = task.dag.edges ?? []
      for (const e of edges) {
        expect(ids.has(e.from), `${id}: edge from unknown node ${e.from}`).toBe(true)
        expect(ids.has(e.to), `${id}: edge to unknown node ${e.to}`).toBe(true)
      }
      // Kahn: with a cycle, some node never reaches in-degree 0 — the peel stalls short.
      const inDegree = new Map<string, number>(task.dag.nodes.map((n) => [n.id, 0]))
      for (const e of edges) inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1)
      const peeled = new Set<string>()
      let frontier = task.dag.nodes.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id)
      while (frontier.length > 0) {
        const next: string[] = []
        for (const nid of frontier) {
          peeled.add(nid)
          for (const e of edges.filter((e) => e.from === nid)) {
            const d = inDegree.get(e.to)! - 1
            inDegree.set(e.to, d)
            if (d === 0) next.push(e.to)
          }
        }
        frontier = next
      }
      expect(peeled.size, `${id}: DAG has a cycle or an unreachable node`).toBe(task.dag.nodes.length)
      // Split tasks stay connected as before: with edges present, exactly one source-less
      // node would mean a single linear-ish flow; at minimum no node is stranded with neither
      // an in- nor out-edge (the corpus's split flows are single components).
      if (edges.length > 0) {
        for (const n of task.dag.nodes) {
          const touched = edges.some((e) => e.from === n.id || e.to === n.id)
          expect(touched, `${id}:${n.id} is stranded — no edge touches it`).toBe(true)
        }
      }
    }
  })

  it('verdict buckets: legalSignature nodes land in the signature bucket and never render computer-use chips', () => {
    const tasks = loadProcesses(DATA_DIR)
    const buckets = verdictGaps(tasks, DATA_DIR)
    const sigKeys = new Set(buckets.signature.map((g) => `${g.taskId}:${g.node.id}`))
    for (const t of tasks) {
      for (const n of t.dag.nodes) {
        if (!n.legalSignature) continue
        expect(sigKeys.has(`${t.id}:${n.id}`), `${t.id}:${n.id} must bucket as signature`).toBe(true)
        // The chip gate the verdict box and the DAG blocks share: a signature node never
        // shows "could attempt it today", whatever its audited feasibility.
        for (const f of ['drivable', 'assist', 'policy-gate', 'no-screen', 'third-party-wait', undefined] as const) {
          expect(showComputerUseChips(f, n.legalSignature)).toBe(false)
        }
      }
    }
    // …and no signature node leaks into the other buckets (the e-sign closer rule would
    // otherwise claim "Sign the term sheet").
    for (const bucket of [buckets.closable, buckets.irreducible, buckets.unclosed]) {
      for (const g of bucket) {
        expect(g.node.legalSignature ?? false, `${g.taskId}:${g.node.id} leaked out of the signature bucket`).toBe(false)
      }
    }
  })

  it('the simulator names signature steps honestly and never offers them a workaround', () => {
    const task = loadProcesses(DATA_DIR).find((t) => t.id === 'fund_002')!
    const steps = buildSimSteps([task], DATA_DIR)
    const { lines } = buildSimRun(steps, {}, vendorRoles([task], DATA_DIR))
    const text = lines.map((l) => l.text).join('\n')
    expect(text).toContain('✍ SIGNATURE: Sign the term sheet')
    expect(text).toContain(LEGAL_SIGNATURE_WHY)
    // No workaround line directly follows a signature line.
    lines.forEach((line, i) => {
      if (line.text.startsWith('✍ SIGNATURE')) {
        expect(lines[i + 1]?.kind).not.toBe('workaround')
      }
    })
    // The generic person gap phrase is the calm one everywhere.
    expect(text).not.toContain('needs a human')
  })
})

describe('formatMinutes', () => {
  it('renders minutes, hours, and days at human scale', () => {
    expect(formatMinutes(12)).toBe('12 min')
    expect(formatMinutes(90)).toBe('1.5 h')
    expect(formatMinutes(2880)).toBe('2 d')
  })
})
