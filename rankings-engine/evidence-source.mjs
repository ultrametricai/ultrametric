import { createHash } from 'node:crypto'

export const sourceText = text => text.trim().replace(/\s+/g, ' ')
export const sourceHash = text => createHash('sha256').update(sourceText(text)).digest('hex')
export const questionOnly = text => sourceText(text).split(/(?<=[.!?])\s+/).filter(part => /[\p{L}\p{N}]/u.test(part)).every(part => part.endsWith('?'))

export function canonicalSource(url) {
  try {
    const parsed = new URL(url)
    const hn = parsed.hostname === 'hn.algolia.com' && parsed.pathname.match(/^\/api\/v1\/items\/(\d+)\/?$/)
    const item = parsed.hostname === 'news.ycombinator.com' && parsed.pathname === '/item' && parsed.searchParams.get('id')
    if (hn || (item && /^\d+$/.test(item))) return `https://news.ycombinator.com/item?id=${hn ? hn[1] : item}`
  } catch { /* malformed fixture data cannot establish source equivalence */ }
  return url
}

export const sameSource = (a, b) => a.tier === b.tier && canonicalSource(a.url) === canonicalSource(b.url)
export const sameEvidence = (a, b) => sameSource(a, b) && sourceText(a.excerpt ?? '') === sourceText(b.excerpt ?? '')

// A new model-written excerpt or label does not establish that its source changed.
// Legacy sources without a digest fail closed for same-source grade changes.
export function newSourceSupport(item, before) {
  if (before.some(old => sameEvidence(old, item))) return false
  const peers = before.filter(old => sameSource(old, item))
  if (!peers.length) return true
  if (item.tier === 'probe') return true // a new recorded observation, not model extraction
  return Boolean(item.sourceHash) && peers.every(old => old.sourceHash && old.sourceHash !== item.sourceHash)
}

export function supportDisappeared(item, after) {
  if (after.some(next => sameEvidence(item, next))) return false
  const peers = after.filter(next => sameSource(item, next))
  if (!peers.length) return true
  if (item.tier === 'probe') return true
  return Boolean(item.sourceHash) && peers.every(next => next.sourceHash && next.sourceHash !== item.sourceHash)
}

// The scheduled probe owns only its numbered rows. Recorded runtime/audit rows
// remain evidence even when older ingestion scripts omitted preserve:true (#556).
export function recordedProbe(item) {
  return item.tier === 'probe' && (item.preserve === true
    || !/-probe-\d+(?:-refresh-[a-f0-9]{16})*$/.test(item.id)
    || /^PROBE (runtime|audit|recorded)\b/i.test(item.excerpt))
}
