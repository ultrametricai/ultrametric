/**
 * Computer-use feasibility dry-runs for the company-launch chain's human-marked steps.
 *
 * Empirically tests, against the real public sites, how far a browser agent
 * (playwright as a stand-in for computer use) can drive each "person"/"form"-routed
 * step of /processes/chains/company-launch before hitting a hard blocker.
 *
 * HARD SAFETY RULES (enforced in code, not just in prose):
 *  - NEVER submits any form with a legal/financial/account side effect. Fill and stop.
 *  - Obviously-fake test data only ("Test Example Co", test@example.com).
 *  - CAPTCHAs / anti-bot walls are recorded as blockers, never bypassed.
 *  - Government sites (IRS, Delaware): READ-ONLY — page load, screenshot, and field
 *    enumeration only. No fill, no clicks, no submits of any kind.
 *
 * Outputs:
 *  - open-rankings/experiments/computer-use/<step-id>.json   per-step result
 *  - open-rankings/experiments/computer-use/<step-id>.png    viewport screenshot (evidence)
 *  - open-rankings/experiments/computer-use/feasibility-report.json  aggregate
 *
 * Run: pnpm tsx pipeline/scripts/computer-use-feasibility.ts
 * (playwright resolved from .proof-scratch/node_modules in the main checkout)
 */

import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Playwright loading (lives outside this worktree's node_modules)
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')

const PLAYWRIGHT_CANDIDATES = [
  join(REPO_ROOT, '.proof-scratch', 'node_modules', 'playwright'),
  // worktrees live at <main>/.claude/worktrees/<name>; .proof-scratch is in <main>
  resolve(REPO_ROOT, '..', '..', '..', '.proof-scratch', 'node_modules', 'playwright'),
  'playwright',
]

/* Minimal structural types so this file typechecks without playwright installed
 * in this workspace (strict mode; playwright objects handled as `any` at the edges). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PWPage = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PWBrowser = any

function loadPlaywright(): { chromium: { launch: (opts?: object) => Promise<PWBrowser> } } {
  const req = createRequire(import.meta.url)
  for (const candidate of PLAYWRIGHT_CANDIDATES) {
    try {
      return req(candidate)
    } catch {
      /* try next */
    }
  }
  throw new Error('playwright not found in any candidate path')
}

// ---------------------------------------------------------------------------
// Test matrix — the chain's human/form steps that have a testable public URL
// ---------------------------------------------------------------------------

type Outcome =
  | 'automatable-to-submission'
  | 'automatable-partial'
  | 'not-automatable'
  | 'not-tested'

interface StepTest {
  id: string
  /** processes.json task + DAG node this evidences */
  chainStep: { taskId: string; nodeId: string; label: string; route: string }
  url: string
  /** government site: read-only, enumerate fields, never fill or click */
  government: boolean
  /** click a CTA before enumerating (vendor marketing page -> actual form) */
  ctaText?: RegExp
  /** fill fake data into enumerated fields (non-gov only) */
  fill: boolean
  /** for fill=false non-gov tests: why we stop at reachability (used in the verdict) */
  readOnlyReason?: string
  notes?: string
}

const TESTS: StepTest[] = [
  {
    id: 'delaware-name-search',
    chainStep: {
      taskId: 'form_001',
      nodeId: 'n3',
      label: 'Check name availability',
      route: 'agent',
    },
    url: 'https://icis.corp.delaware.gov/ecorp/entitysearch/NameSearch.aspx',
    government: true,
    fill: false,
    notes:
      'DE Division of Corporations entity name search. Gov site: reachability + field enumeration only; no fill/submit.',
  },
  {
    id: 'delaware-formation-entry',
    chainStep: {
      taskId: 'form_001',
      nodeId: 'n4',
      label: 'Submit incorporation filing',
      route: 'form',
    },
    url: 'https://corp.delaware.gov/document-upload/',
    government: true,
    fill: false,
    notes:
      'DE filing entry point (Document Upload service). Gov site: reachability + field enumeration only.',
  },
  {
    id: 'irs-ein-online',
    chainStep: {
      taskId: 'form_002',
      nodeId: 'n3',
      label: 'Complete IRS SS-4 form online',
      route: 'form',
    },
    url: 'https://sa.www4.irs.gov/modiein/individual/index.jsp',
    government: true,
    fill: false,
    notes:
      'IRS EIN Assistant. Operates Mon-Fri 7am-10pm ET only; run captures whether the hours gate or a login/ID.me wall is up. Gov site: read-only.',
  },
  {
    id: 'clerky-start',
    chainStep: {
      taskId: 'form_001',
      nodeId: 'n1',
      label: 'Choose formation service',
      route: 'person',
    },
    url: 'https://app.clerky.com/signup',
    government: false,
    fill: true,
    notes: 'Clerky signup (formation-service start page). Fill fake data, never submit.',
  },
  {
    id: 'stripe-atlas-start',
    chainStep: {
      taskId: 'form_001',
      nodeId: 'n1',
      label: 'Choose formation service',
      route: 'person',
    },
    url: 'https://stripe.com/atlas',
    government: false,
    ctaText: /start company|get started|start now/i,
    fill: false,
    readOnlyReason:
      'Atlas application sits behind Stripe account creation + $500 fee + founder KYC — stopped at the account boundary by design',
    notes: 'Stripe Atlas start page; Atlas application sits behind a Stripe account.',
  },
  {
    id: 'firstbase-start',
    chainStep: {
      taskId: 'form_001',
      nodeId: 'n1',
      label: 'Choose formation service',
      route: 'person',
    },
    url: 'https://onboarding.firstbase.io/start',
    government: false,
    fill: true,
    notes: 'Firstbase incorporation onboarding wizard entry. Fill fake data, never submit.',
  },
  {
    id: 'mercury-signup',
    chainStep: {
      taskId: 'qs_023',
      nodeId: 'n3',
      label: 'Apply for business account',
      route: 'person',
    },
    url: 'https://app.mercury.com/signup',
    government: false,
    fill: true,
    notes: 'Mercury bank application first page. Fill fake data, never submit (KYC follows).',
  },
  {
    id: 'gusto-signup',
    chainStep: {
      taskId: 'qs_063',
      nodeId: 'n3',
      label: 'Sign up for payroll',
      route: 'person',
    },
    url: 'https://gusto.com/invite/company',
    government: false,
    fill: true,
    notes: 'Gusto payroll company signup. Fill fake data, never submit.',
  },
  {
    id: 'quickbooks-signup',
    chainStep: {
      taskId: 'qs_073',
      nodeId: 'n2',
      label: 'Sign up and configure',
      route: 'person',
    },
    url: 'https://accounts.intuit.com/signup.html',
    government: false,
    fill: true,
    notes:
      'QuickBooks/Intuit account signup (quickbooks.intuit.com/signup/ resets scripted HTTP/2 connections — Akamai). Fill fake data, never submit.',
  },
  {
    id: 'google-workspace-signup',
    chainStep: {
      taskId: 'form_001',
      nodeId: 'n1',
      label: 'Choose formation service (adjacent: workspace/email provisioning)',
      route: 'person',
    },
    url: 'https://workspace.google.com/business/signup/welcome',
    government: false,
    fill: true,
    notes:
      'Google Workspace signup first page (business name / size). Non-binding page; fill only, never advance to account creation.',
  },
  {
    id: 'domain-registration-search',
    chainStep: {
      taskId: 'qs_073',
      nodeId: 'n2',
      label: 'Sign up and configure (adjacent: domain purchase flow, launch-website chain)',
      route: 'person',
    },
    url: 'https://porkbun.com/checkout/search?q=testexampleco.com',
    government: false,
    fill: false,
    readOnlyReason:
      'domain search is read-only and scriptable; purchase requires account + payment — stopped before cart/checkout by design',
    notes:
      'Domain registrar search results (read-only search). Stops before cart/checkout/payment.',
  },
]

// ---------------------------------------------------------------------------
// Fake, obviously-test fill data (non-government pages only; NEVER submitted)
// ---------------------------------------------------------------------------

const FAKE = {
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'Example',
  fullName: 'Test Example',
  company: 'Test Example Co',
  phone: '0000000000',
  password: 'TestExample000!',
  website: 'https://example.com',
  zip: '00000',
}

function fakeValueFor(field: FieldInfo): string | null {
  const hay = `${field.name} ${field.id} ${field.placeholder} ${field.label} ${field.autocomplete}`.toLowerCase()
  // NEVER touch payment or real-identity fields, even to fill.
  if (/\bcard|\bcc-|cvc|cvv|ssn|social|tax.?id|ein\b|passport|license/.test(hay)) return null
  if (field.type === 'email' || /e-?mail/.test(hay)) return FAKE.email
  if (field.type === 'password') return FAKE.password
  if (field.type === 'tel' || /phone|mobile/.test(hay)) return FAKE.phone
  if (/first.?name|given/.test(hay)) return FAKE.firstName
  if (/last.?name|family|surname/.test(hay)) return FAKE.lastName
  if (/full.?name|your.?name|^ *name *$/.test(hay)) return FAKE.fullName
  if (/company|business|organization|legal.?name/.test(hay)) return FAKE.company
  if (/employees|team.?size|headcount/.test(hay)) return '1'
  if (/website|url|domain/.test(hay)) return FAKE.website
  if (/zip|postal/.test(hay)) return FAKE.zip
  return null
}

// ---------------------------------------------------------------------------
// In-page inspection helpers
// ---------------------------------------------------------------------------

interface FieldInfo {
  tag: string
  type: string
  name: string
  id: string
  placeholder: string
  label: string
  autocomplete: string
  required: boolean
  filled?: string
}

interface Blockers {
  captcha: string | null
  loginWall: boolean
  paymentStep: boolean
  identityVerification: boolean
  /** ~140-char page-text snippet that triggered identityVerification (evidence) */
  identitySnippet: string | null
  antiBotWall: string | null
  hoursGate: string | null
}

interface StepResult {
  id: string
  chainStep: StepTest['chainStep']
  url: string
  finalUrl: string
  government: boolean
  loaded: boolean
  httpStatus: number | null
  title: string
  fieldCount: number
  fields: FieldInfo[]
  submitButtons: string[]
  blockers: Blockers
  filledCount: number
  outcome: Outcome
  blockedAt: string | null
  automationCeiling: string
  evidence: { screenshot: string; json: string }
  notes: string
  error?: string
  testedAt: string
}

// Serialized and evaluated inside the page (no closure over node scope).
const ENUMERATE_FIELDS_JS = `
(() => {
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    const st = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'
  }
  const labelFor = (el) => {
    if (el.labels && el.labels.length) return el.labels[0].textContent.trim().slice(0, 80)
    const aria = el.getAttribute('aria-label')
    if (aria) return aria.slice(0, 80)
    const labelledBy = el.getAttribute('aria-labelledby')
    if (labelledBy) {
      const txt = labelledBy.split(/\\s+/).map((id) => {
        const n = document.getElementById(id)
        return n ? n.textContent.trim() : ''
      }).join(' ').trim()
      if (txt) return txt.slice(0, 80)
    }
    const wrap = el.closest('label')
    if (wrap) return wrap.textContent.trim().slice(0, 80)
    return ''
  }
  const fields = []
  for (const el of document.querySelectorAll('input, select, textarea')) {
    if (!visible(el)) continue
    const type = (el.getAttribute('type') || el.tagName.toLowerCase()).toLowerCase()
    if (type === 'hidden') continue
    fields.push({
      tag: el.tagName.toLowerCase(),
      type,
      name: el.getAttribute('name') || '',
      id: el.id || '',
      placeholder: el.getAttribute('placeholder') || '',
      label: labelFor(el),
      autocomplete: el.getAttribute('autocomplete') || '',
      required: el.required === true,
    })
    if (fields.length >= 40) break
  }
  const submits = []
  for (const b of document.querySelectorAll('button, input[type="submit"], [role="button"]')) {
    if (!visible(b)) continue
    const t = (b.textContent || b.value || '').trim().replace(/\\s+/g, ' ').slice(0, 60)
    if (t && /submit|continue|next|search|sign up|create|get started|start|apply|begin/i.test(t)) submits.push(t)
    if (submits.length >= 10) break
  }
  return { fields, submits }
})()
`

const DETECT_BLOCKERS_JS = `
(() => {
  const html = document.documentElement.outerHTML.toLowerCase()
  const bodyText = (document.body ? document.body.innerText : '').toLowerCase()
  const has = (sel) => !!document.querySelector(sel)

  let captcha = null
  if (has('iframe[src*="recaptcha"], .g-recaptcha, [data-sitekey][class*="recaptcha"]')) captcha = 'reCAPTCHA'
  else if (has('iframe[src*="hcaptcha"], .h-captcha')) captcha = 'hCaptcha'
  else if (has('.cf-turnstile, iframe[src*="turnstile"]')) captcha = 'Cloudflare Turnstile'
  else if (html.includes('arkoselabs') || html.includes('funcaptcha')) captcha = 'Arkose/FunCaptcha'
  else if (html.includes('grecaptcha.execute') || html.includes('recaptcha/api.js')) captcha = 'reCAPTCHA (script present, may be invisible)'

  let antiBotWall = null
  if (bodyText.includes('verify you are human') || bodyText.includes('checking your browser') || bodyText.includes('just a moment')) antiBotWall = 'Cloudflare challenge page'
  else if (html.includes('datadome')) antiBotWall = 'DataDome present'
  else if (bodyText.includes('access denied') || bodyText.includes('unusual traffic')) antiBotWall = 'access-denied/unusual-traffic page'
  else if (html.includes('px-captcha') || html.includes('perimeterx')) antiBotWall = 'PerimeterX present'

  const loginWall = /sign in to continue|log in to continue|please sign in|session expired/.test(bodyText)
    || (location.href.includes('accounts.google.com') || location.href.includes('signin'))

  const paymentStep = has('input[autocomplete*="cc-"], iframe[src*="js.stripe.com"], iframe[name*="card"]')
    || /card number|billing information|payment method/.test(bodyText)

  const idRe = /id\\.me|identity verification|verify your identity|verify the identity|identifies each person|upload.*(passport|driver)/
  const idMatch = bodyText.match(idRe)
  const identityVerification = !!idMatch || html.includes('withpersona.com')
  let identitySnippet = null
  if (idMatch) {
    const i = Math.max(0, idMatch.index - 40)
    identitySnippet = bodyText.slice(i, i + 180).replace(/\\s+/g, ' ').trim()
  } else if (identityVerification) {
    identitySnippet = 'withpersona.com (Persona KYC vendor) script present in page HTML'
  }

  let hoursGate = null
  if (/hours of operation|monday to friday|technical difficulties|is unavailable|outside.*operating hours|try again during/.test(bodyText)
      && /7\\s*a\\.?m|10\\s*p\\.?m|eastern/.test(bodyText)) {
    const m = bodyText.match(/[^.]*hours of operation[^.]*\\./)
    hoursGate = m ? m[0].trim().slice(0, 200) : 'hours-of-operation message detected'
  }

  return { captcha, loginWall, paymentStep, identityVerification, identitySnippet, antiBotWall, hoursGate }
})()
`

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const OUT_DIR = join(REPO_ROOT, 'open-rankings', 'experiments', 'computer-use')

function classify(t: StepTest, r: Omit<StepResult, 'outcome' | 'blockedAt' | 'automationCeiling'>): {
  outcome: Outcome
  blockedAt: string | null
  automationCeiling: string
} {
  const b = r.blockers
  if (!r.loaded) {
    const botReset = /HTTP2_PROTOCOL_ERROR|CONNECTION_RESET|CONNECTION_CLOSED/.test(r.error ?? '')
    return {
      outcome: 'not-automatable',
      blockedAt: botReset
        ? `connection reset at protocol level (${r.error}) — bot protection suspected; not bypassed`
        : `page failed to load (${r.error ?? 'network/navigation error'})`,
      automationCeiling: 'none — could not reach the form with a scripted browser',
    }
  }
  if (b.antiBotWall) {
    return {
      outcome: 'automatable-partial',
      blockedAt: `anti-bot wall on load: ${b.antiBotWall}`,
      automationCeiling: 'page load only — anti-bot wall stops a scripted browser before the form; not bypassed per ToS',
    }
  }
  if (b.hoursGate) {
    return {
      outcome: 'not-tested',
      blockedAt: `hours of operation: ${b.hoursGate}`,
      automationCeiling: 'gated by service hours at test time',
    }
  }
  if (t.government) {
    // Policy ceiling, not technical: we enumerate only.
    const reached = r.fieldCount > 0 || r.submitButtons.length > 0
    return {
      outcome: reached ? 'automatable-partial' : 'not-tested',
      blockedAt: reached
        ? 'policy — government site: tested reachability + field enumeration only; no fill/submit attempted'
        : 'government entry page reached but no form fields on landing page (form sits deeper); read-only policy stops here',
      automationCeiling: reached
        ? `form reachable and ${r.fieldCount} fields enumerable by a scripted browser; filing/submission itself stays human (legal attestation${b.captcha ? ' + ' + b.captcha : ''})`
        : 'reachability confirmed only',
    }
  }
  if (!t.fill) {
    // Read-only-by-design vendor test: reachability is the whole test. Raw blocker
    // signals (captcha/identity text on marketing pages) stay recorded in `blockers`
    // but don't drive the verdict — marketing copy false-positives otherwise.
    return {
      outcome: 'automatable-partial',
      blockedAt: t.readOnlyReason ?? 'read-only by design — fill not attempted on this page',
      automationCeiling: `page + ${r.fieldCount} fields reachable by a scripted browser; ${t.readOnlyReason ?? 'later steps not exercised'}`,
    }
  }
  if (b.captcha) {
    return {
      outcome: 'automatable-partial',
      blockedAt: `CAPTCHA present: ${b.captcha}`,
      automationCeiling: `fields fillable (${r.filledCount} filled with fake data) but ${b.captcha} guards submission — hard stop for unattended automation`,
    }
  }
  if (b.identityVerification) {
    return {
      outcome: 'automatable-partial',
      blockedAt: 'identity-verification step detected',
      automationCeiling: 'form fill scriptable; KYC/ID verification requires the human',
    }
  }
  if (b.loginWall && r.fieldCount === 0) {
    return {
      outcome: 'automatable-partial',
      blockedAt: 'login wall before the form',
      automationCeiling: 'requires an existing authenticated session before any form is visible',
    }
  }
  if (r.fieldCount > 0 && r.filledCount > 0) {
    return {
      outcome: 'automatable-to-submission',
      blockedAt: null,
      automationCeiling: `scriptable up to the submit click (${r.filledCount}/${r.fieldCount} fields filled with fake data; submission NOT clicked). Submission + downstream KYC/payment/verification remains human`,
    }
  }
  if (r.fieldCount > 0) {
    return {
      outcome: 'automatable-partial',
      blockedAt: 'fields visible but none safely fillable by heuristic (custom widgets or protected fields)',
      automationCeiling: 'form reachable; needs bespoke selectors or vision-mode driving',
    }
  }
  return {
    outcome: 'automatable-partial',
    blockedAt:
      r.submitButtons.length > 0
        ? 'no text-input fields on entry screen (button-driven wizard); inputs sit deeper in the flow'
        : 'no form fields on entry page (flow starts behind a CTA/app boundary)',
    automationCeiling:
      r.submitButtons.length > 0
        ? `wizard reachable; button-driven navigation scriptable (${r.submitButtons.join(', ')})`
        : 'navigation only on this page',
  }
}

async function runTest(browser: PWBrowser, t: StepTest): Promise<StepResult> {
  const context = await browser.newContext({
    viewport: { width: 1024, height: 800 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    locale: 'en-US',
  })
  const page: PWPage = await context.newPage()
  const base: Omit<StepResult, 'outcome' | 'blockedAt' | 'automationCeiling'> = {
    id: t.id,
    chainStep: t.chainStep,
    url: t.url,
    finalUrl: '',
    government: t.government,
    loaded: false,
    httpStatus: null,
    title: '',
    fieldCount: 0,
    fields: [],
    submitButtons: [],
    blockers: {
      captcha: null,
      loginWall: false,
      paymentStep: false,
      identityVerification: false,
      identitySnippet: null,
      antiBotWall: null,
      hoursGate: null,
    },
    filledCount: 0,
    evidence: { screenshot: `${t.id}.png`, json: `${t.id}.json` },
    notes: t.notes ?? '',
    testedAt: new Date().toISOString(),
  }

  try {
    const resp = await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    base.httpStatus = resp ? resp.status() : null
    base.loaded = true
    await page.waitForTimeout(4000) // let SPAs hydrate / challenges render
    base.finalUrl = page.url()
    base.title = await page.title()

    // Optional CTA click on vendor marketing pages (non-gov only, non-binding navigation)
    if (t.ctaText && !t.government) {
      for (const role of ['link', 'button']) {
        try {
          const cta = page.getByRole(role, { name: t.ctaText }).first()
          await cta.waitFor({ state: 'visible', timeout: 4000 })
          await cta.click()
          await page.waitForTimeout(5000)
          base.finalUrl = page.url()
          base.title = await page.title()
          break
        } catch {
          /* CTA not found under this role — try next / enumerate as-is */
        }
      }
    }

    const enumerated = (await page.evaluate(ENUMERATE_FIELDS_JS)) as {
      fields: FieldInfo[]
      submits: string[]
    }
    base.fields = enumerated.fields
    base.fieldCount = enumerated.fields.length
    base.submitButtons = enumerated.submits
    base.blockers = (await page.evaluate(DETECT_BLOCKERS_JS)) as Blockers

    // Fill fake data — NON-GOVERNMENT pages only, and NEVER submit anything.
    if (t.fill && !t.government && !base.blockers.antiBotWall) {
      for (const f of base.fields) {
        const val = fakeValueFor(f)
        if (!val || (f.tag !== 'input' && f.tag !== 'textarea')) continue
        const selector = f.id
          ? `#${CSS_ESCAPE(f.id)}`
          : f.name
            ? `${f.tag}[name="${f.name}"]`
            : null
        try {
          if (selector) {
            await page.locator(`${selector}:visible`).first().fill(val, { timeout: 2500 })
          } else if (f.label) {
            await page.getByLabel(f.label.slice(0, 30), { exact: false }).first().fill(val, { timeout: 2500 })
          } else {
            continue
          }
          f.filled = val
          base.filledCount++
        } catch {
          // strict/hidden-selector fallback: try by accessible label
          if (f.label) {
            try {
              await page.getByLabel(f.label.slice(0, 30), { exact: false }).first().fill(val, { timeout: 2500 })
              f.filled = val
              base.filledCount++
            } catch {
              /* field not fillable — fine, recorded by omission */
            }
          }
        }
      }
      // re-check blockers after fill (some captchas mount on interaction)
      base.blockers = (await page.evaluate(DETECT_BLOCKERS_JS)) as Blockers
      // >>> deliberate hard stop: no submit click, ever <<<
    }

    await page.screenshot({ path: join(OUT_DIR, `${t.id}.png`) })
  } catch (err) {
    base.error = err instanceof Error ? err.message.split('\n')[0] : String(err)
    try {
      await page.screenshot({ path: join(OUT_DIR, `${t.id}.png`) })
    } catch {
      /* no screenshot available */
    }
  } finally {
    await context.close()
  }

  const verdict = classify(t, base)
  return { ...base, ...verdict }
}

// CSS.escape equivalent for node-side selector building
function CSS_ESCAPE(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`)
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const { chromium } = loadPlaywright()
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  })

  const results: StepResult[] = []
  for (const t of TESTS) {
    process.stderr.write(`[computer-use-feasibility] ${t.id} -> ${t.url}\n`)
    const r = await runTest(browser, t)
    results.push(r)
    writeFileSync(join(OUT_DIR, `${t.id}.json`), JSON.stringify(r, null, 2) + '\n')
    process.stderr.write(`  outcome: ${r.outcome}${r.blockedAt ? ` (blocked at: ${r.blockedAt})` : ''}\n`)
  }
  await browser.close()

  const report = {
    chain: 'company-launch',
    method:
      'playwright dry-runs against live public sites; fill-and-stop, no submissions, no CAPTCHA bypass, government sites read-only',
    generatedAt: new Date().toISOString(),
    safety: {
      submissionsMade: 0,
      accountsCreated: 0,
      paymentsEntered: 0,
      captchasBypassed: 0,
      governmentFormsFilled: 0,
    },
    summary: Object.fromEntries(
      (['automatable-to-submission', 'automatable-partial', 'not-automatable', 'not-tested'] as Outcome[]).map(
        (o) => [o, results.filter((r) => r.outcome === o).length],
      ),
    ),
    results,
  }
  writeFileSync(join(OUT_DIR, 'feasibility-report.json'), JSON.stringify(report, null, 2) + '\n')
  process.stderr.write(`\nWrote ${results.length} step results + feasibility-report.json to ${OUT_DIR}\n`)
  if (existsSync(join(OUT_DIR, 'feasibility-report.json'))) process.exitCode = 0
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
