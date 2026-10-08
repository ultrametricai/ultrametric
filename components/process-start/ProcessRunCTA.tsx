'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { START_METHODS, agentLaunch, startPrompt, type StartAgent, type StartTarget } from '@/lib/process-start'
import { useRegionalVariant } from '@/components/shared-processes/RegionalVariant'

// The run-with-Ultrametric affordance: an emerald trigger opening the agent-picker modal
// (Claude / ChatGPT / Codex / Claude Code / Cursor / Ultrametric CLI), which hands off the
// public start prompt — launch on web where a verified URL exists, copy otherwise. The CLI
// entry copies on selection and links the install path (/get-started). PUBLIC by
// design (no admin gate): the handoff is a real prompt against api.ultrametric.ai/start, the
// same contract the v2 reader publishes. The canonical process page mounts this same component
// with the site's header-CTA trigger idiom (label/trigger overrides below); defaults are the
// v2 reader's original pill.
export default function ProcessRunCTA({
  target,
  label = 'Run this process with Ultrametric',
  className = 'mt-6',
  triggerClassName = 'inline-flex min-h-12 max-w-full items-center justify-center rounded-full bg-emerald-300 px-6 py-3 text-center font-medium leading-snug text-zinc-950 shadow-[0_0_30px_-15px_#6ee7b7] transition hover:bg-emerald-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300',
}: {
  target: StartTarget
  label?: string
  className?: string
  triggerClassName?: string
}) {
  const region = useRegionalVariant()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const manualCopy = useRef<HTMLTextAreaElement>(null)
  const ownsHistory = useRef(false)
  const returningHistory = useRef(false)
  const copyAttempt = useRef(0)
  const heading = useId()
  const choices = useId()
  const [selected, setSelected] = useState<StartAgent>('claude')
  const [returning, setReturning] = useState(false)
  const prompt = startPrompt(target, region?.selected, selected)
  const [copy, setCopy] = useState<{ text: string; failed: boolean }>()
  const currentCopy = copy?.text === prompt ? copy : undefined
  const launch = agentLaunch(target, selected)

  useEffect(() => {
    function onBack() {
      returningHistory.current = false
      setReturning(false)
      ownsHistory.current = false
      copyAttempt.current++
      if (dialog.current?.open) dialog.current.close()
    }
    window.addEventListener('popstate', onBack)
    return () => window.removeEventListener('popstate', onBack)
  }, [])

  useEffect(() => {
    if (currentCopy?.failed) {
      manualCopy.current?.focus()
      manualCopy.current?.select()
    } else if (currentCopy) {
      const timer = window.setTimeout(() => setCopy(undefined), 2000)
      return () => window.clearTimeout(timer)
    }
  }, [currentCopy])

  function close() {
    copyAttempt.current++
    dialog.current?.close()
    if (ownsHistory.current && window.location.hash === '#run-process') {
      returningHistory.current = true
      setReturning(true)
      window.history.back()
    }
    ownsHistory.current = false
  }

  async function copyPrompt(text = prompt) {
    const attempt = ++copyAttempt.current
    try {
      await navigator.clipboard.writeText(text)
      if (attempt === copyAttempt.current) setCopy({ text, failed: false })
    } catch {
      if (attempt === copyAttempt.current) setCopy({ text, failed: true })
    }
  }

  return <div className={className}>
    <button ref={trigger} type="button" onClick={() => {
      if (dialog.current?.open || returningHistory.current) return
      copyAttempt.current++
      setCopy(undefined)
      setSelected('claude')
      window.history.pushState(window.history.state, '', '#run-process')
      ownsHistory.current = true
      dialog.current?.showModal()
    }} aria-haspopup="dialog" aria-disabled={returning || undefined} className={triggerClassName}>
      {label}
    </button>
    <dialog ref={dialog} aria-labelledby={heading} onKeyDown={event => {
      if (event.key !== 'Tab') return
      const items = event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:checked, textarea')
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }} onCancel={event => { event.preventDefault(); close() }} onClose={() => trigger.current?.focus()} onClick={event => { if (event.target === event.currentTarget) close() }} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl border border-zinc-700 bg-zinc-950 p-0 text-zinc-100 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm">
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div><h2 id={heading} className="font-display text-2xl font-semibold tracking-tight">Choose your agent</h2><p className="mt-2 text-zinc-400">{target.title}</p></div>
          <button type="button" onClick={close} aria-label="Close agent picker" className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl text-zinc-400 hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300">×</button>
        </div>
        <fieldset className="mt-6 grid grid-cols-2 gap-3">
          <legend className="sr-only">Agent</legend>
          {START_METHODS.map(method => <label key={method.id} className="relative min-w-0 cursor-pointer">
            <input type="radio" name={choices} value={method.id} checked={selected === method.id} onChange={() => {
              copyAttempt.current++
              setCopy(undefined)
              setSelected(method.id)
              // The CLI has no verified launch URL, so selecting it used to leave the modal
              // visibly inert. Copy the handoff prompt on selection instead (founder 2026-10-08).
              if (method.id === 'cli') void copyPrompt(startPrompt(target, region?.selected, 'cli'))
            }} className="peer sr-only" />
            <span className="flex min-h-20 items-center gap-3 rounded-2xl border border-zinc-800 px-3 py-3 transition hover:border-emerald-400/60 hover:bg-emerald-400/5 peer-checked:border-emerald-300 peer-checked:bg-emerald-300/10 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-300 sm:px-4">
              {method.logo ? <Image src={method.logo} width={32} height={32} alt="" className="h-8 w-8 shrink-0 rounded-lg object-contain" /> : <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 font-mono text-lg">&gt;_</span>}
              <span className="font-medium leading-snug">{method.name}</span>
            </span>
          </label>)}
        </fieldset>
        <div className="mt-6 flex flex-col items-center gap-2">
          {launch && <><a href={launch.href} title={launch.description} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="flex min-h-12 w-full items-center justify-center rounded-full bg-emerald-300 px-6 py-3 font-medium text-zinc-950 hover:bg-emerald-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300">{launch.label}</a><span aria-hidden="true" className="text-sm text-zinc-500">or</span></>}
          <button type="button" onClick={() => copyPrompt()} className="min-h-11 rounded-lg px-5 font-medium text-zinc-300 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300">Copy prompt</button>
          {selected === 'cli' && <p className="text-center text-sm text-zinc-400">Runs in your terminal once the CLI is set up. <Link href="/get-started" title="Install Ultrametric — agent prompt, CLI, or MCP" className="font-medium text-emerald-300 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300">Install the CLI →</Link></p>}
        </div>
        <p role="status" className="text-center text-sm text-zinc-400">{currentCopy && (currentCopy.failed ? 'Clipboard unavailable. The prompt is selected; copy it with your keyboard or touch menu.' : 'Copied.')}</p>
        {currentCopy?.failed && <textarea ref={manualCopy} readOnly value={prompt} rows={5} aria-label="Process prompt for manual copy" className="mt-3 block w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-300 focus-visible:outline-2 focus-visible:outline-emerald-300" />}
      </div>
    </dialog>
  </div>
}
