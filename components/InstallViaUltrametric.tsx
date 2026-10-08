'use client'

import { useEffect, useRef, useState } from 'react'
import { installPrompt, type StartTarget } from '@/lib/process-start'

// 'Install via Ultrametric' (founder 2026-10-08): directly under the product page's Install
// commands, a copyable PROMPT that hands an agent the instruction to install/set up THIS
// product through Ultrametric's process guidance. The prompt is lib/process-start.ts's
// committed start mechanics (installPrompt → api.ultrametric.ai/start?process=<id>) against the
// setup process lib/installViaUm.ts maps this product to — the page renders this component only
// when that mapping exists, so the prompt target is always a committed process. Copy mechanics
// follow components/process-start/ProcessRunCTA.tsx: one-click copy with "Copied." feedback,
// and a focused/selected manual-copy textarea only after a clipboard failure.

export default function InstallViaUltrametric({ productName, target, processTitle }: {
  productName: string
  target: StartTarget
  /** The mapped setup process title — said out loud under the prompt, with its grounding. */
  processTitle: string
}) {
  const prompt = installPrompt(productName, target)
  const manualCopy = useRef<HTMLTextAreaElement>(null)
  const copyAttempt = useRef(0)
  const [copy, setCopy] = useState<{ failed: boolean }>()

  useEffect(() => {
    if (copy?.failed) {
      manualCopy.current?.focus()
      manualCopy.current?.select()
    } else if (copy) {
      const timer = window.setTimeout(() => setCopy(undefined), 2000)
      return () => window.clearTimeout(timer)
    }
  }, [copy])

  async function copyPrompt() {
    const attempt = ++copyAttempt.current
    try {
      await navigator.clipboard.writeText(prompt)
      if (attempt === copyAttempt.current) setCopy({ failed: false })
    } catch {
      if (attempt === copyAttempt.current) setCopy({ failed: true })
    }
  }

  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-widest text-zinc-500">Install via Ultrametric</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 px-3 py-2">
        <code title={prompt} className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-300">
          {prompt}
        </code>
        <button
          type="button"
          onClick={copyPrompt}
          className="shrink-0 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
        >
          Copy prompt
        </button>
        <p role="status" className="shrink-0 text-xs text-zinc-400">
          {copy && (copy.failed
            ? 'Clipboard unavailable. The prompt is selected; copy it with your keyboard or touch menu.'
            : 'Copied.')}
        </p>
        {copy?.failed && (
          <textarea
            ref={manualCopy}
            readOnly
            value={prompt}
            rows={3}
            aria-label="Install prompt for manual copy"
            className="block w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-300 focus-visible:outline-2 focus-visible:outline-emerald-300"
          />
        )}
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Paste into your agent — it runs &ldquo;{processTitle}&rdquo;, the Ultrametric process this
        product serves, with {productName} as the vendor choice.
      </p>
    </div>
  )
}
