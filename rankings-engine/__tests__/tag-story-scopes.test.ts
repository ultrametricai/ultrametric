import { describe, expect, it } from 'vitest'
import type { Story } from '@/lib/schemas'
import { domainPattern, scopeForStory, type ScopeContext } from '@/pipeline/scripts/tag-story-scopes'

function story(overrides: Partial<Story> & { id: string; title: string }): Story {
  return { persona: 'a developer', theme: 'core', group: 'core', weight: 2, ...overrides }
}

function ctx(overrides: Partial<ScopeContext> = {}): ScopeContext {
  return { domain: null, positiveVerdicts: 0, ...overrides }
}

describe('scopeForStory', () => {
  it('tags every canonical lens story global, whatever the arena', () => {
    const canon = story({
      id: 'agentic-public-api',
      title: 'As an AI-native user, I can drive the product through a documented public API',
    })
    // Even in the most domain-flavored arena, canon is global by definition.
    expect(scopeForStory(canon, ctx({ domain: domainPattern('payroll') }))).toEqual({
      scope: 'global',
      rule: 'canonical',
    })
    // origin kind alone is enough too (belt and suspenders for future canon ids).
    const byOrigin = story({ id: 'future-canon', title: 'x', origin: { kind: 'canonical' } })
    expect(scopeForStory(byOrigin, ctx()).scope).toBe('global')
  })

  it('tags a claims-derived depth story product only when exactly one product holds it', () => {
    const probe = story({
      id: 'agent-session-checkpoint-restore',
      title: "As an engineer, I can restore an AI coding agent's session to any previous checkpoint",
      origin: { kind: 'normalized', promptVersion: 'v2-depth' },
    })
    expect(scopeForStory(probe, ctx({ positiveVerdicts: 1 })).scope).toBe('product')
    expect(scopeForStory(probe, ctx({ positiveVerdicts: 1 })).rule).toBe('claims-probe')
    // Two products holding it means it generalized — no longer a single-product probe.
    expect(scopeForStory(probe, ctx({ positiveVerdicts: 2, domain: domainPattern('project-management') })).scope).toBe('category')
    // A demand-mined story is never a claims probe, however lonely its verdict.
    const mined = story({ id: 'x', title: 'As a developer, I can frobnicate', origin: { kind: 'mined', promptVersion: 'v2-depth' } })
    expect(scopeForStory(mined, ctx({ positiveVerdicts: 1 })).scope).toBe('category')
  })

  it('keeps strong global concepts (2FA, SSO, audit logs, pricing, uptime) global even amid domain nouns', () => {
    const domain = domainPattern('code-hosting')
    const twoFactor = story({
      id: 'two-factor-authentication',
      title: 'As a developer, I can secure my account with two-factor authentication',
    })
    expect(scopeForStory(twoFactor, ctx({ domain }))).toEqual({ scope: 'global', rule: 'global:auth' })

    const sso = story({ id: 'sso-saml-login', title: 'As an engineer, I can secure organization access with SSO and SAML' })
    expect(scopeForStory(sso, ctx({ domain: domainPattern('project-management') })).scope).toBe('global')

    const audit = story({
      id: 'audit-log-admin-controls',
      title: 'As a product manager, I can review an admin audit log of actions taken across the workspace',
    })
    expect(scopeForStory(audit, ctx({ domain: domainPattern('project-management') })).rule).toBe('global:access-control')

    const overage = story({
      id: 'credit-overage-billing',
      title: "As a developer, I know whether exceeding my plan's monthly credit quota triggers overage charges",
    })
    expect(scopeForStory(overage, ctx({ domain: domainPattern('web-scraping') })).rule).toBe('global:pricing-transparency')

    const status = story({
      id: 'public-status-page-history',
      title: 'As a data-engineer, I can check a public status page showing uptime history before committing',
    })
    expect(scopeForStory(status, ctx({ domain: domainPattern('web-scraping') })).scope).toBe('global')
  })

  it('vetoes generic capabilities phrased in domain vocabulary to category', () => {
    // A webhook story about payroll lifecycle events is a payroll story, not a global one.
    const payrollWebhooks = story({
      id: 'payroll-event-webhooks',
      title: 'As a developer, I can subscribe to payroll lifecycle events via webhooks',
    })
    const result = scopeForStory(payrollWebhooks, ctx({ domain: domainPattern('payroll') }))
    expect(result.scope).toBe('category')
    expect(result.rule).toMatch(/^domain:/)

    // "Treasury yield" style domain stories are category even with no global keyword at all.
    const treasury = story({
      id: 'earn-yield-on-balances',
      title: 'As a finance-lead, I can earn yield on operating cash balances',
    })
    expect(scopeForStory(treasury, ctx({ domain: domainPattern('startup-banking') })).scope).toBe('category')

    // CLI in a deploy arena is the arena's own workflow, not the generic "I can use a CLI".
    const cliDeploy = story({
      id: 'cli-deploy',
      title: 'As a developer, I can deploy my project directly from the command line',
    })
    expect(scopeForStory(cliDeploy, ctx({ domain: domainPattern('edge-platforms') })).scope).toBe('category')
  })

  it('tags generic capabilities global when NOT phrased in domain vocabulary', () => {
    const offline = story({
      id: 'offline-local-workspace',
      title: 'As a developer, I can work fully offline in a local workspace without a cloud account',
    })
    expect(scopeForStory(offline, ctx({ domain: domainPattern('api-platforms') }))).toEqual({
      scope: 'global',
      rule: 'global:offline',
    })

    const importSwitch = story({
      id: 'import-from-other-tools',
      title: 'As a product manager, I can import my data from another tool when switching over',
    })
    expect(scopeForStory(importSwitch, ctx({ domain: domainPattern('project-management') })).rule).toBe('global:export-import')
  })

  it('never matches capability patterns against the persona clause', () => {
    // "open-source-maintainer" as persona must not trigger the open-source global rule.
    const packages = story({
      id: 'multi-format-package-publishing',
      title: 'As an open-source-maintainer, I can publish and consume software packages in multiple formats',
    })
    expect(scopeForStory(packages, ctx())).toEqual({ scope: 'category', rule: 'default' })
  })

  it('defaults anything ambiguous to category', () => {
    const ambiguous = story({ id: 'do-not-disturb-mode', title: 'As a power-user, I can silence notifications' })
    expect(scopeForStory(ambiguous, ctx({ domain: domainPattern('desktop-os') }))).toEqual({
      scope: 'category',
      rule: 'default',
    })
  })
})

describe('domainPattern', () => {
  it('compiles an arena vocabulary and returns null for unknown arenas', () => {
    expect(domainPattern('nonexistent-arena')).toBeNull()
    const payroll = domainPattern('payroll')!
    expect(payroll.test('run a payroll cycle')).toBe(true)
    expect(payroll.test('secure my account with two-factor authentication')).toBe(false)
  })
})
