export const START_METHODS = [
  { id: 'claude', name: 'Claude', logo: '/logos/claude.png' },
  { id: 'chatgpt', name: 'ChatGPT', logo: '/logos/chatgpt.png' },
  { id: 'codex', name: 'Codex', logo: '/logos/codex.png' },
  { id: 'claude-code', name: 'Claude Code', logo: '/logos/claude-code.png' },
  { id: 'cursor', name: 'Cursor', logo: '/logos/cursor.png' },
  { id: 'cli', name: 'Ultrametric CLI', logo: null },
] as const

export type StartAgent = typeof START_METHODS[number]['id']

export type StartTarget = {
  id: string
  title: string
  regions: Array<{ id: string; title: string }>
}

export function startRegion(target: StartTarget, value?: string | null) {
  return target.regions.find(region => region.id === value)
}

export function processHandoffUrl(target: StartTarget, region?: string, agent?: StartAgent) {
  const query = new URLSearchParams({ process: target.id })
  const selected = startRegion(target, region)
  if (selected) query.set('region', selected.id)
  if (agent) {
    query.set('method', agent === 'claude' || agent === 'chatgpt' ? 'mcp' : 'cli')
    if (agent !== 'cli') query.set('vendor', agent)
  }
  return `https://api.ultrametric.ai/start?${query}`
}

export function startPrompt(target: StartTarget, region?: string, agent?: StartAgent) {
  return `Start “${target.title}” with Ultrametric. Install and use the supported connection if needed. Read and follow ${processHandoffUrl(target, region, agent)}`
}

// The product page's 'Install via Ultrametric' prompt (founder 2026-10-08): the startPrompt
// idiom scoped to one product — the agent runs the committed setup process (the one mapping in
// lib/installViaUm.ts) with this product as the vendor choice. The handoff URL is the same
// committed process-scoped contract; the product name only steers the vendor choices inside it.
export function installPrompt(productName: string, target: StartTarget) {
  return `Set up ${productName} with Ultrametric. Start “${target.title}” and use ${productName} for the vendor choice. Install and use the supported connection if needed. Read and follow ${processHandoffUrl(target)}`
}

// Launch URLs omit the selected country and open only after the user's click.
export function agentLaunch(target: StartTarget, method: StartAgent) {
  if (method === 'claude') return {
    label: 'Run on web',
    description: 'Open a new Claude chat with a draft to review and send.',
    href: `https://claude.ai/new?${new URLSearchParams({ q: startPrompt(target, undefined, method) })}`,
  }
  if (method === 'chatgpt') return {
    label: 'Run on web',
    description: 'Start a new ChatGPT chat and send this process prompt.',
    href: `https://chatgpt.com/?${new URLSearchParams({ q: startPrompt(target, undefined, method) })}`,
  }
  if (method === 'cursor') return {
    label: 'Open in Cursor',
    description: 'Open a Cursor prompt to review and send in the app.',
    href: `https://cursor.com/link/prompt?${new URLSearchParams({ text: startPrompt(target, undefined, method) })}`,
  }
  return undefined
}
