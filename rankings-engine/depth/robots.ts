// Minimal RFC 9309 robots.txt evaluation for the depth runner. Robots decisions are absolute:
// a disallowed path is recorded as 'robots-disallowed' and never fetched. Where certify.ts
// asks only "does robots.txt block all agents?", the depth runner needs a per-path answer for
// every GET it is about to make, so this module implements group selection (most specific
// user-agent token wins) and longest-match rule precedence with `*` wildcards and `$` anchors.

export interface RobotsRule {
  allow: boolean
  path: string
}

export interface RobotsGroup {
  agents: string[]
  rules: RobotsRule[]
}

export interface RobotsDecision {
  allowed: boolean
  detail: string
}

export function parseRobots(body: string): RobotsGroup[] {
  const groups: RobotsGroup[] = []
  let current: RobotsGroup | null = null
  let inAgentHeader = false
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (line === '') continue
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/)
    if (!m) continue
    const field = m[1].toLowerCase()
    const value = m[2].trim()
    if (field === 'user-agent') {
      if (!inAgentHeader || current === null) {
        current = { agents: [], rules: [] }
        groups.push(current)
      }
      inAgentHeader = true
      current.agents.push(value.toLowerCase())
    } else {
      inAgentHeader = false
      if ((field === 'allow' || field === 'disallow') && current !== null) {
        current.rules.push({ allow: field === 'allow', path: value })
      }
    }
  }
  return groups
}

// `*` matches any run of characters, `$` at the end anchors; everything else is literal.
function ruleMatches(rulePath: string, path: string): boolean {
  if (rulePath === '') return false // "Disallow:" (empty) matches nothing
  const anchored = rulePath.endsWith('$')
  const core = anchored ? rulePath.slice(0, -1) : rulePath
  const rx = new RegExp(
    '^' + core.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (anchored ? '$' : ''),
  )
  return rx.test(path)
}

// Group selection per RFC 9309: the groups whose user-agent token is the longest prefix of our
// product token apply; absent any match, the `*` groups; absent those, everything is allowed.
// RFC 9309 §2.2.1 merges the rules of EVERY group naming the matched agent — a robots.txt that
// repeats `User-agent: *` (or our token) in separate groups means all of those groups' rules,
// so returning only the first group would silently drop the later groups' Disallow lines.
function selectRules(groups: RobotsGroup[], userAgentToken: string): RobotsRule[] | null {
  const token = userAgentToken.toLowerCase()
  let bestLen = 0
  for (const g of groups) {
    for (const agent of g.agents) {
      if (agent !== '*' && token.startsWith(agent) && agent.length > bestLen) bestLen = agent.length
    }
  }
  const applies = bestLen > 0
    ? (g: RobotsGroup) => g.agents.some((a) => a !== '*' && a.length === bestLen && token.startsWith(a))
    : (g: RobotsGroup) => g.agents.includes('*')
  const matched = groups.filter(applies)
  if (matched.length === 0) return null
  return matched.flatMap((g) => g.rules)
}

export function robotsAllows(body: string, path: string, userAgentToken: string): RobotsDecision {
  const rules = selectRules(parseRobots(body), userAgentToken)
  if (!rules) return { allowed: true, detail: 'no applicable robots.txt group' }
  // Longest matching rule wins; on a tie, allow wins.
  let best: { rule: RobotsRule; len: number } | null = null
  for (const rule of rules) {
    if (!ruleMatches(rule.path, path)) continue
    const len = rule.path.length
    if (best === null || len > best.len || (len === best.len && rule.allow && !best.rule.allow)) {
      best = { rule, len }
    }
  }
  if (!best) return { allowed: true, detail: 'no matching rule' }
  return {
    allowed: best.rule.allow,
    detail: `${best.rule.allow ? 'Allow' : 'Disallow'}: ${best.rule.path}`,
  }
}
