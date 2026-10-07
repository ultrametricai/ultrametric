'use client'

import { useState, useSyncExternalStore } from 'react'
import { useSession } from '@/lib/session'

// Hidden, admin-only "Do via AFK" affordance on process/chain pages — the handoff into the AFK
// remake (the Ultrametric agent-execution product that will actually RUN these processes).
// Clicking it opens AFK's run endpoint with this page's manifest URL and copies that URL to the
// clipboard as a fallback (the AFK route may not exist yet). The MANIFEST is public; only this
// button is gated — non-admins get literally nothing rendered, not hidden markup.
//
// Admin = either of:
//   1. a WorkOS session (lib/session.ts) whose email is listed in NEXT_PUBLIC_ADMIN_EMAILS
//      (comma-separated, inlined at build time; unset/empty → the email path never matches), or
//   2. the founder's local testing switch: in devtools run
//        localStorage.setItem('pa-admin', '1')
//      to show the button on this device, localStorage.removeItem('pa-admin') to hide it again
//      (then reload — same-tab localStorage writes fire no storage event). Read client-side via
//      useSyncExternalStore with a `false` server snapshot, so the static HTML never includes
//      the button.
//
// Full contract: docs/AFK-HANDOFF.md.

export const ADMIN_FLAG_KEY = 'pa-admin'
export const AFK_RUN_URL = 'https://app.ultrametric.ai/afk/run'

// Pure so the gate is unit-testable: case-insensitive membership of `email` in the
// comma-separated allowlist. Empty/unset allowlist admits nobody.
export function isAdminEmail(email: string | undefined, allowlist: string | undefined): boolean {
  if (!email || !allowlist) return false
  const needle = email.trim().toLowerCase()
  if (needle === '') return false
  return allowlist
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e !== '')
    .includes(needle)
}

function readAdminFlag(): boolean {
  try {
    return window.localStorage.getItem(ADMIN_FLAG_KEY) === '1'
  } catch {
    // localStorage unavailable (privacy mode) — the flag path just stays off.
    return false
  }
}

function subscribeAdminFlag(callback: () => void): () => void {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

function getServerAdminFlag(): boolean {
  return false
}

export default function DoViaAfk({ manifestUrl, className = '' }: {
  // Absolute URL of this page's manifest (process or chain) — the one artifact AFK consumes.
  manifestUrl: string
  className?: string
}) {
  // Hooks run unconditionally (rules of hooks); the admin gate comes after.
  const session = useSession()
  const localFlag = useSyncExternalStore(subscribeAdminFlag, readAdminFlag, getServerAdminFlag)
  const [copied, setCopied] = useState(false)

  const emailAdmin =
    session.state === 'authenticated' &&
    isAdminEmail(session.email, process.env.NEXT_PUBLIC_ADMIN_EMAILS)
  if (!emailAdmin && !localFlag) return null

  const onClick = () => {
    // window.open first, synchronously in the click — popup blockers distrust openers that run
    // after an await. The clipboard copy is the fallback path and can settle whenever.
    window.open(
      `${AFK_RUN_URL}?manifest=${encodeURIComponent(manifestUrl)}`,
      '_blank',
      'noopener,noreferrer',
    )
    navigator.clipboard?.writeText(manifestUrl).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => {
        // Clipboard refused (permissions) — the opened tab still carries the manifest URL.
      },
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title="Hands this process manifest URL to AFK and copies it to your clipboard — the run endpoint may not be live yet"
      className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-400/50 px-3 py-1 text-xs font-medium text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-400/10 ${className}`}
    >
      <span aria-hidden>▶</span>
      Do via AFK (admin preview)
      {copied && <span className="text-emerald-400/80">· manifest URL copied</span>}
    </button>
  )
}
