'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { fetchLogoutUrl, loginUrl, registrationUrl, useSession } from '@/lib/session'
import { SITE_URL } from '@/lib/site'

// The header's account corner. Anonymous (and still-loading — same render, so the header never
// jumps while /auth/me is in flight) readers get one quiet "Log in" text link — currently
// hidden behind the pa-auth-test flag until the WorkOS flow is signed off; nothing else about
// the site changes for them. Authenticated readers get a small chip (their email's first
// letter) opening a menu: Account, My vendors, Watchlist + Log out. Menu open/close behavior mirrors
// components/ArenaMenu.tsx (outside pointerdown + Escape).
//
// The login href carries return_to back to the exact page the reader is on — computed at click
// time from window.location (the static HTML can't know the page URL, so the server-rendered
// fallback href returns to the site root).

function currentUrl(): string {
  return typeof window === 'undefined' ? SITE_URL : window.location.href
}

export default function AccountMenu() {
  const session = useSession()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (session.state !== 'authenticated') {
    // Founder 2026-09-18: the Sign up button ships visibly (supersedes the 09-14 hide-until-
    // tested call) — AuthKit's hosted page handles both signup and login via the standard
    // Ultrametric WorkOS environment. The pa-auth-test flag is retired.
    // Signed-out: quiet "Log in" text link + the Sign up pill (founder 2026-09-18). Same worker
    // /auth/login route, DIFFERENT screens (founder bug 2026-10-08: Sign up landed on the login
    // screen): the pill carries screen_hint=sign-up (lib/session.ts registrationUrl — the same
    // mechanism ProcessCheck/YourStack already use), which the worker forwards to the AuthKit
    // authorize URL so the hosted page opens on its sign-up screen.
    const go = (build: (returnTo: string) => string) => (e: React.MouseEvent) => {
      e.preventDefault()
      window.location.href = build(currentUrl())
    }
    return (
      <span className="flex shrink-0 items-center gap-2.5">
        <a
          href={loginUrl(SITE_URL)}
          onClick={go(loginUrl)}
          className="text-xs text-zinc-400 transition hover:text-emerald-300"
        >
          Log in
        </a>
        <a
          href={registrationUrl(SITE_URL)}
          onClick={go(registrationUrl)}
          className="rounded-full border border-emerald-400/60 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-400/20"
        >
          Sign up
        </a>
      </span>
    )
  }

  const email = session.email
  const initial = (email?.[0] ?? '?').toUpperCase()

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={email ? `Account — ${email}` : 'Account'}
        title={email ?? 'Account'}
        onClick={() => setOpen((v) => !v)}
        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-400/10 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-400/20"
      >
        <span aria-hidden>{initial}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-zinc-800 bg-zinc-900 p-1.5 shadow-xl shadow-black/40"
        >
          {email && (
            <p className="truncate px-3 py-1.5 text-xs text-zinc-500" title={email}>
              {email}
            </p>
          )}
          <Link
            role="menuitem"
            href="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 hover:text-emerald-300"
          >
            <span aria-hidden className="text-emerald-400">⚙</span>
            Account
          </Link>
          <Link
            role="menuitem"
            href="/account/vendors"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 hover:text-emerald-300"
          >
            <span aria-hidden className="text-emerald-400">▦</span>
            My vendors
          </Link>
          <Link
            role="menuitem"
            href="/watchlist"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800 hover:text-emerald-300"
          >
            <span aria-hidden className="text-emerald-400">☆</span>
            Watchlist
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              const url = await fetchLogoutUrl(currentUrl())
              if (url) window.location.href = url
              else setOpen(false) // logout flow unreachable — leave the session as-is
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800 hover:text-emerald-300"
          >
            <span aria-hidden className="text-zinc-500">↩</span>
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
