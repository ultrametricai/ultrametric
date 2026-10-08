'use client'

import { useState } from 'react'
import { installVariants } from '@/lib/installVariants'
import type { Product } from '@/lib/schemas'

// Copy-pasteable install/try commands (schema: Product.install). Curation is a separate,
// partial pass — most products have none yet (SaaS-only products genuinely have nothing to
// install), so this renders nothing until an install array is present. Every command here is
// vendor-official and hand-verified against the registry/installer it names (see
// .superpowers/install-report.md) — never invented or community-forked.
export default function InstallCommands({ product }: { product: Product }) {
  const install = product.install
  if (!install || install.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {install.map((entry, i) => (
        <InstallRow key={`${entry.label}-${i}`} entry={entry} />
      ))}
    </div>
  )
}

function InstallRow({ entry }: { entry: NonNullable<Product['install']>[number] }) {
  const [copied, setCopied] = useState(false)
  const variants = installVariants(entry.command)
  const [variant, setVariant] = useState(0)
  const command = variants[variant]?.command ?? entry.command
  const isPipedShell = /\|\s*(sh|bash|zsh)\b/.test(command)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard API unavailable (e.g. insecure context) — silently no-op, the command is
      // still selectable/copyable by hand from the code block below.
    }
  }

  const labelChip = (
    <span className="shrink-0 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
      {entry.label}
    </span>
  )

  return (
    <div>
      {/* Founder 2026-09-17: no box around install commands — a quiet inline row (label chip,
          command, copy) reads cleaner than a bordered pill per command. */}
      <div className="inline-flex w-fit max-w-full items-center gap-2 py-0.5">
        {entry.url ? (
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${entry.label} docs ↗`}
            className="shrink-0 hover:border-emerald-400 hover:text-emerald-300"
          >
            {labelChip}
          </a>
        ) : (
          labelChip
        )}
        {variants.length > 1 && (
          <span className="flex shrink-0 gap-0.5" role="tablist" aria-label="Package manager">
            {variants.map((v, i) => (
              <button
                key={v.manager}
                type="button"
                role="tab"
                aria-selected={i === variant}
                onClick={() => setVariant(i)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition ${
                  i === variant ? 'bg-emerald-400/15 text-emerald-300' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {v.manager}
              </button>
            ))}
          </span>
        )}
        <code className="min-w-0 whitespace-pre-wrap break-all font-mono text-xs text-zinc-200">
          {command}
        </code>
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy ${entry.label} command`}
          title={copied ? 'Copied' : `Copy ${entry.label} command`}
          className="shrink-0 rounded p-1 text-zinc-500 transition hover:text-emerald-300"
        >
          {copied ? (
            <svg viewBox="0 0 16 16" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="M3 8.5 6.5 12 13 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
              <rect x="5" y="5" width="8" height="8" rx="1.5" />
              <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2H3.5A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
            </svg>
          )}
        </button>
      </div>
      {isPipedShell && (
        <p className="mt-1 text-[11px] text-zinc-400">
          Vendor-official, but review any script before piping it to a shell.
        </p>
      )}
    </div>
  )
}
