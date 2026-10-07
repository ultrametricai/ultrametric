'use client'

import { createContext, type ReactNode, useEffect, useState } from 'react'
import { IconGlyph } from '@/components/IconChip'
import { HOME_MODE_ICONS } from '@/lib/arenaIcons'
import { readParam, setParams } from '@/lib/urlState'

// Homepage mode switch (founder 2026-09-21: "add processes onto the homepage as well, maybe have
// two modes, company mode/process mode"; founder 2026-09-23: "add 'Products' as the 3rd ranking
// set which will replace the 'include all products of companies' button"). Companies and
// Products share ONE server-rendered table — the mode reaches MegaTable through
// HomeModeContext (client provider around server children), so no second copy of the row data
// ships in the page. Processes is toggled in client-side via CSS as before.
//
// Shareable URLs (lib/urlState.ts): ?view=products / ?view=processes reproduce the sender's
// mode. URL ONLY (founder 2026-09-23): restoring the device's last mode from localStorage after
// hydration flashed companies→processes on every load for process-mode readers — a pristine
// visit is now always companies with zero flicker. Legacy ?all=1 links (the retired
// include-sub-products checkbox) resolve to products mode.
export type HomeMode = 'companies' | 'products' | 'processes' | 'arenas'

export const HomeModeContext = createContext<HomeMode>('companies')

export default function HomeModes({
  companies,
  processes,
  arenas,
}: {
  companies: ReactNode
  processes: ReactNode
  arenas?: ReactNode
}) {
  const [mode, setMode] = useState<HomeMode>('companies')
  /* eslint-disable react-hooks/set-state-in-effect -- one-time post-hydration sync FROM the URL
     (external system). The static HTML must render the default mode, so this cannot be a
     useState initializer (hydration mismatch); it runs once and renders at most one extra pass. */
  useEffect(() => {
    const view = readParam('view')
    if (view === 'processes' || view === 'products' || (view === 'arenas' && arenas !== undefined)) setMode(view)
    else if (readParam('all') === '1') setMode('products')
    // Mount-only: the URL is the INITIAL view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */
  const pick = (m: HomeMode) => {
    setMode(m)
    setParams({ view: m === 'companies' ? null : m, all: null })
  }
  // Founder 2026-09-24 (mobile): all four tabs on ONE line — icons and roomy padding are
  // desktop-only; phones get tight text-only pills. The icons are house glyph tokens
  // (lib/arenaIcons.ts HOME_MODE_ICONS), not the old 🏢/📦/🔁/🏟 emoji (founder 2026-10-02).
  const tab = (m: HomeMode, icon: string, label: string, title: string) => (
    <button
      type="button"
      onClick={() => pick(m)}
      title={title}
      aria-pressed={mode === m}
      className={`whitespace-nowrap rounded-full px-2 py-1 text-xs transition sm:px-3.5 sm:text-sm ${
        mode === m
          ? 'bg-emerald-400/15 font-medium text-emerald-300 ring-1 ring-emerald-400/50'
          : 'text-zinc-400 hover:text-zinc-200'
      }`}
    >
      <span aria-hidden className="mr-1.5 hidden align-[-0.125em] sm:inline-flex">
        <IconGlyph icon={icon} />
      </span>
      {label}
    </button>
  )

  return (
    <HomeModeContext.Provider value={mode}>
      <div>
        <div className="mb-4 inline-flex flex-nowrap items-center gap-0.5 rounded-full border border-zinc-800 p-1 sm:gap-1">
          {tab('companies', HOME_MODE_ICONS.companies, 'Companies', 'One row per company — a multi-product family (Stripe, Adyen…) shows only its parent')}
          {tab('products', HOME_MODE_ICONS.products, 'Products', 'Every judged product line ranked separately, as it does inside its own arena')}
          {tab('processes', HOME_MODE_ICONS.processes, 'Processes', 'Startup processes, the software that runs them, and the best an agent can do today')}
          {arenas !== undefined && tab('arenas', HOME_MODE_ICONS.arenas, 'Rankings', 'Every judged market — visual navigation, grouped by section')}
        </div>
        <div className={mode === 'companies' || mode === 'products' ? '' : 'hidden'}>{companies}</div>
        <div className={mode === 'processes' ? '' : 'hidden'}>{processes}</div>
        {arenas !== undefined && <div className={mode === 'arenas' ? '' : 'hidden'}>{arenas}</div>}
      </div>
    </HomeModeContext.Provider>
  )
}
