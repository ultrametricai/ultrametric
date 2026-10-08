'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import CopyButton from '@/components/CopyButton'
import {
  buildRunOptions, callResultLines, mcpClientConfig, probeResultLines, replayCharCount, tryResultLines,
  type McpCallResult, type McpProbeResult, type TryItStory, type TryProbeResult,
} from '@/lib/tryitReplay'

// The "Try it" microterminal: a locked-down terminal-styled window on the product page that
// (1) REPLAYS recorded proof transcripts character-paced — clearly labeled as recordings — and
// (2) optionally runs real things against the product's own documented MCP endpoint via the
// worker's /api/mcp-probe (static allowlist server-side — this component only ever sends
// {arena, product} plus tier flags, never a URL, never a tool name):
//   - a live keyless handshake (initialize + tools/list), and, for endpoints with a curated
//     read-only demo call, ONE real tool call ("▶ run a real call");
//   - the BYO-key tier for auth-gated servers: a visitor-pasted credential, held in component
//     state only (this tab's memory), sent per-run to our worker which forwards it once to the
//     vendor and discards it — never logged, never stored (asserted by worker tests);
//   - the sandbox tier when the operator has provisioned a DEMO_CRED_* secret
//     (docs/TRY-IT-DEMO-ACCOUNTS.md).
// A third, visibly disabled tab describes the designed-but-gated full sandbox (docs/TRY-IT.md).
//
// Same hardened-endpoint calling pattern as components/SubmitScan.tsx.
const PROBE_ENDPOINT = 'https://ultrametric.ai/api/mcp-probe'

// "Run live" for recorded stories whose exact command is pure HTTP: the worker re-runs it as a
// fetch of a fixed URL from the committed live-probe manifest and answers with a sanitized
// summary. This component only ever sends the three path ids — never a URL, never a command.
const TRY_ENDPOINT = 'https://ultrametric.ai/api/try'

const LIVE_ID = '__live-mcp__'

interface LiveProbe {
  arena: string
  product: string
  endpoint: string
  /** The vendor's own MCP docs page (lib/tryit.ts mcpDocsUrlFor) — null when none documented. */
  docsUrl: string | null
}

/** Credential tier for one run — memory-only; `token` never leaves component state except in
 *  the per-run request body to our worker. */
interface AuthChoice {
  token?: string
  sandbox?: boolean
}

export default function Microterminal({
  arena,
  product,
  productName,
  stories,
  probe,
}: {
  /** Arena + product ids — with a story's probe id these form the /api/try lookup key. */
  arena: string
  product: string
  productName: string
  stories: TryItStory[]
  probe: LiveProbe | null
}) {
  // The run options come interest-ordered (lib/tryitReplay.ts buildRunOptions, founder
  // 2026-10-08: live capability demos first, passive discovery last); the FIRST option's story
  // starts replaying on mount (its transcript is the initial target; the typing effect below
  // stamps the start time lazily). The live probe NEVER auto-runs — one real request per
  // explicit click, not per page view.
  const options = buildRunOptions(stories)
  const firstId = options[0]?.story.id ?? (probe ? LIVE_ID : null)
  const [activeId, setActiveId] = useState<string | null>(firstId)
  const [target, setTarget] = useState(() => options[0]?.story.transcript ?? '') // text being typed toward
  const [shown, setShown] = useState(0) // how many chars are visible
  const [liveBusy, setLiveBusy] = useState(false)
  const [liveResult, setLiveResult] = useState<McpProbeResult | null>(null) // last completed probe
  const startRef = useRef(0)
  const runRef = useRef(0) // invalidates in-flight probe responses on story switch
  const authRef = useRef<AuthChoice>({}) // the tier the CURRENT liveResult was produced under
  const preRef = useRef<HTMLPreElement>(null)

  const active = stories.find((s) => s.id === activeId) ?? null
  const isLive = activeId === LIVE_ID

  const beginRun = useCallback((text: string) => {
    startRef.current = performance.now()
    setTarget(text)
    setShown(0)
  }, [])

  const postProbe = useCallback((body: Record<string, unknown>) =>
    fetch(PROBE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }), [])

  // One live handshake (initialize + tools/list) under the given tier. Resets the terminal.
  const runProbe = useCallback((auth: AuthChoice) => {
    if (!probe) return
    runRef.current += 1
    const run = runRef.current
    setActiveId(LIVE_ID)
    setLiveBusy(true)
    setLiveResult(null)
    authRef.current = auth
    const authNote = auth.token ? ' (Authorization: your key — sent once, not stored)'
      : auth.sandbox ? ' (Authorization: our sandbox account)' : ''
    beginRun(`$ mcp-probe ${probe.arena}/${probe.product}${auth.token ? ' --auth your-key' : auth.sandbox ? ' --auth sandbox' : ''}\n→ POST ${probe.endpoint}${authNote}\n→ initialize (JSON-RPC 2.0, MCP 2025-06-18) …\n`)
    postProbe({
      arena: probe.arena,
      product: probe.product,
      ...(auth.token ? { token: auth.token } : {}),
      ...(auth.sandbox ? { useSandbox: true } : {}),
    })
      .then(async (resp) => (await resp.json()) as McpProbeResult)
      .catch(() => ({ error: 'could not reach our edge — try again in a moment' }) as McpProbeResult)
      .then((result) => {
        if (runRef.current !== run) return // user switched stories mid-flight
        setLiveBusy(false)
        setLiveResult(result)
        setTarget((prev) => `${prev}${probeResultLines(result).join('\n')}\n`)
      })
  }, [beginRun, postProbe, probe])

  // ONE real curated tool call (worker action: 'call') under the tier the last successful
  // handshake used. Appends to the terminal instead of resetting it — it is a continuation.
  const runDemoCall = useCallback(() => {
    if (!probe || !liveResult?.demoCall) return
    runRef.current += 1
    const run = runRef.current
    const auth = authRef.current
    const { tool, label } = liveResult.demoCall
    setLiveBusy(true)
    setTarget((prev) => `${prev}→ tools/call ${tool} — ${label} …\n`)
    postProbe({
      arena: probe.arena,
      product: probe.product,
      action: 'call',
      ...(auth.token ? { token: auth.token } : {}),
      ...(auth.sandbox ? { useSandbox: true } : {}),
    })
      .then(async (resp) => (await resp.json()) as McpCallResult)
      .catch(() => ({ error: 'could not reach our edge — try again in a moment' }) as McpCallResult)
      .then((result) => {
        if (runRef.current !== run) return
        setLiveBusy(false)
        setTarget((prev) => `${prev}${callResultLines(result).join('\n')}\n`)
      })
  }, [liveResult, postProbe, probe])

  // ONE live re-run of the active recorded story's exact command (worker /api/try — the fixed
  // fetch from the committed manifest). Appends to the replay instead of resetting it, under an
  // explicit LIVE divider so recorded and live lines can never be confused.
  const runLiveTry = useCallback(() => {
    const story = stories.find((s) => s.id === activeId)
    if (!story?.live) return
    runRef.current += 1
    const run = runRef.current
    setLiveBusy(true)
    setTarget((prev) => `${prev.endsWith('\n') || prev === '' ? prev : `${prev}\n`}\n──── LIVE ── re-running this exact probe from our edge, right now ────\n$ ${story.command}\n`)
    fetch(`${TRY_ENDPOINT}/${encodeURIComponent(arena)}/${encodeURIComponent(product)}/${encodeURIComponent(story.id)}`, { method: 'POST' })
      .then(async (resp) => (await resp.json()) as TryProbeResult)
      .catch(() => ({ error: 'could not reach our edge — try again in a moment', reachable: false }) as TryProbeResult)
      .then((result) => {
        if (runRef.current !== run) return // user switched stories mid-flight
        setLiveBusy(false)
        setTarget((prev) => `${prev}${tryResultLines(result).join('\n')}\n`)
      })
  }, [activeId, arena, product, stories])

  // Kick off (or re-run) the active story.
  const runStory = useCallback((id: string) => {
    if (id === LIVE_ID) {
      runProbe({}) // the menu button is always the honest keyless tier; key/sandbox have their own buttons
      return
    }
    runRef.current += 1
    setActiveId(id)
    setLiveBusy(false)
    const story = stories.find((s) => s.id === id)
    beginRun(story?.transcript ?? '')
  }, [beginRun, runProbe, stories])

  // Character-paced typing (~8ms/char, lib/tryitReplay.ts). The 'skip ⏭' fast-forward control
  // and its skippedRef branch were removed with it (founder 2026-10-05) — nothing else read it.
  useEffect(() => {
    if (shown >= target.length) return
    if (startRef.current === 0) startRef.current = performance.now() // mount-time replay start
    const timer = setInterval(() => {
      setShown(replayCharCount(performance.now() - startRef.current, target.length))
    }, 24)
    return () => clearInterval(timer)
  }, [shown, target])

  // Keep the newest output in view while typing.
  useEffect(() => {
    const el = preRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [shown])

  const menuButton = (selected: boolean) =>
    `rounded-full border px-3 py-1 text-left text-xs transition ${
      selected
        ? 'border-emerald-400 bg-emerald-400/10 text-emerald-300'
        : 'border-zinc-800 text-zinc-400 hover:border-emerald-400/60 hover:text-emerald-300'
    }`
  const actionButton =
    'rounded border border-emerald-400/60 bg-emerald-400/10 px-2 py-1 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40'

  const keylessOk = Boolean(liveResult?.handshake && liveResult.auth === 'keyless')
  const authedOk = Boolean(liveResult?.handshake && liveResult.auth && liveResult.auth !== 'keyless')
  const authGated = Boolean(liveResult?.authRequired)

  return (
    <div className="space-y-3">
      {/* Run-type selector (founder 2026-10-05 redesign): one chip per distinct run type with a
          short functional label ("Install locally", "MCP handshake", …) instead of the long
          combined story titles; variants that run the same command path are merged
          (lib/tryitReplay.ts buildRunOptions). The full story title(s) move into the tooltip,
          and live-capable recordings wear a small 'live' badge instead of inline text. What
          runs is unchanged — every chip plays exactly one real recorded story. */}
      <div className="flex flex-wrap items-center gap-2">
        {options.map(({ story, label, titles }) => (
          <button
            key={story.id}
            type="button"
            onClick={() => runStory(story.id)}
            title={story.live ? `Play the recorded proof: ${titles.join(' · ')} — this one can also re-run live from our edge` : `Play the recorded proof: ${titles.join(' · ')}`}
            className={menuButton(activeId === story.id)}
          >
            <span aria-hidden className="mr-1 text-[10px]">▶</span>
            {label}
            {story.live && (
              <span className="ml-1.5 rounded border border-emerald-400/40 px-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-300/80">
                live
              </span>
            )}
          </button>
        ))}
        {probe && (
          <button type="button" onClick={() => runStory(LIVE_ID)} title="Run one real JSON-RPC initialize against the vendor's MCP endpoint, from our edge, right now" className={menuButton(isLive)}>
            <span aria-hidden className="mr-1 text-[10px]">▶</span>
            Live MCP handshake
            <span className="ml-1.5 rounded border border-emerald-400/60 px-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-300">
              live
            </span>
          </button>
        )}
      </div>

      {/* The terminal window. */}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-zinc-800 bg-zinc-900/60 px-3 py-2">
          <span aria-hidden className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          </span>
          <code className="min-w-0 truncate font-mono text-xs text-zinc-300">
            <span className="mr-1.5 select-none text-emerald-400">$</span>
            {isLive ? `mcp-probe → ${probe?.endpoint ?? ''}` : active?.command ?? `try ${productName}`}
          </code>
          {/* Founder 2026-10-02 (second ask): the title-bar ▶ replay/run control is gone.
              Recordings auto-play on mount and re-play on every story-chip click (runStory
              re-runs even the already-selected story); the live handshake runs via its own menu
              chip. The per-line ▶ run-live affordance below stays. */}
          <span className="ml-auto flex shrink-0 items-center gap-2">
            {active?.live && (
              <button
                type="button"
                onClick={runLiveTry}
                disabled={liveBusy}
                title="Re-run this exact command from our edge, right now. The worker fetches the fixed URL from our committed manifest — no user input is involved."
                className="shrink-0 rounded border border-emerald-400/60 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ▶ run live
              </button>
            )}
            {/* Founder 2026-10-02: the per-run 'recorded session — replayed, not live' badge is
                gone. The recorded-vs-live distinction stays visible without it: the provenance
                footer below leads with "recorded <date> · exit <code> · captured verbatim…" on
                every recording, while live output is marked by this badge (live-probe runs) or
                by the LIVE divider inside the transcript (per-story re-runs — the
                'recorded replay + live re-run' caption that used to restate it was removed,
                founder 2026-10-05). */}
            {isLive && (
              <span className="shrink-0 rounded border border-emerald-400/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                live — run just now from our edge
              </span>
            )}
          </span>
        </div>

        <pre
          ref={preRef}
          className="h-72 overflow-auto whitespace-pre-wrap break-words px-3 py-2.5 font-mono text-xs leading-relaxed text-zinc-200"
        >
          {isLive && target === '' && !liveBusy && (
            <span className="text-zinc-500">$ press ▶ Live MCP handshake above to send one JSON-RPC initialize from our edge{'\n'}</span>
          )}
          {target.slice(0, shown)}
          {liveBusy && shown >= target.length && <span className="text-zinc-500">…</span>}
          <span aria-hidden className="animate-pulse text-emerald-400">▋</span>
        </pre>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-zinc-800 px-3 py-1.5 text-[10px] text-zinc-500">
          {/* Founder 2026-10-05: the live-probe caption ("real JSON-RPC against the vendor's
              documented MCP endpoint — read-only, nothing is written") is gone — caption only;
              the probe itself, its result lines, and the recorded provenance footer stay. */}
          {!isLive && active ? (
            <span>
              recorded {active.recordedAt?.slice(0, 10)} · exit {active.exitCode} · captured verbatim by our probe harness, secrets redacted
              {active.live ? ' · pure-HTTP probe — ▶ run live re-runs it from our edge' : ''}
            </span>
          ) : null}
          {/* Founder 2026-10-02: the footer "replay ↺ / run again ▶" button went first, then the
              title-bar ▶ replay/run control it duplicated — the story-menu chips are the one
              play/replay affordance. Founder 2026-10-05: the 'skip ⏭' fast-forward went too;
              replays simply type out. */}
        </div>
      </div>

      {/* Live-probe follow-ups: never leave the visitor at a dead result. */}
      {isLive && probe && liveResult && (
        <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          {/* Honest state badge. */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {keylessOk && (
              <span className="rounded-full border border-emerald-400/60 bg-emerald-400/10 px-2 py-0.5 font-semibold text-emerald-300">
                ✓ keyless handshake OK
                {typeof liveResult.toolCount === 'number' ? ` — ${liveResult.toolCount} tools live` : ''}
              </span>
            )}
            {authedOk && (
              <span className="rounded-full border border-emerald-400/60 bg-emerald-400/10 px-2 py-0.5 font-semibold text-emerald-300">
                ✓ authenticated handshake OK ({liveResult.auth === 'sandbox' ? 'our sandbox account' : 'your key'})
                {typeof liveResult.toolCount === 'number' ? ` — ${liveResult.toolCount} tools live` : ''}
              </span>
            )}
            {authGated && liveResult.auth === 'keyless' && (
              <span
                title="Our probe holds no vendor account — the server answered from its documented endpoint and demanded sign-in; not absence of an MCP server"
                className="rounded-full border border-amber-400/60 bg-amber-400/10 px-2 py-0.5 font-semibold text-amber-300"
              >
                ⚿ verified reachable, auth-gated — untestable keylessly
              </span>
            )}
            {authGated && liveResult.auth !== 'keyless' && (
              <span className="rounded-full border border-amber-400/60 bg-amber-400/10 px-2 py-0.5 font-semibold text-amber-300">
                ⚿ credential rejected — the server is live but did not accept it
              </span>
            )}
            {authGated && liveResult.resourceName && (
              <span className="text-zinc-400">server identifies as &ldquo;{liveResult.resourceName}&rdquo;</span>
            )}
          </div>

          {/* Tier actions. */}
          <div className="flex flex-wrap items-center gap-2">
            {liveResult.handshake && liveResult.demoCall && (
              <button
                type="button"
                onClick={runDemoCall}
                disabled={liveBusy}
                title="Execute one curated read-only tool call against the vendor's server, live — the tool and arguments are fixed server-side"
                className={actionButton}
              >
                ▶ run a real call — {liveResult.demoCall.label}
              </button>
            )}
            {authGated && liveResult.sandboxAvailable && (
              <button
                type="button"
                onClick={() => runProbe({ sandbox: true })}
                disabled={liveBusy}
                title="Re-run the handshake authenticated with Ultrametric's own demo/sandbox account for this vendor (test-mode credentials, provisioned by us)"
                className={actionButton}
              >
                ▶ use our sandbox account
              </button>
            )}
          </div>

          {/* BYO-key form removed (founder 2026-09-23): "it is dangerous to take their keys
              right here." The copy-paste MCP client config below is the supported route for
              authenticated testing — the reader's own client runs the vendor's auth. */}
          {/* Take-it-with-you config: once a probe completes against a live server (auth wall or
              keyless handshake alike), hand them the endpoint as a copy-paste MCP client config —
              their own client runs the vendor's OAuth sign-in, which is exactly the step our
              keyless probe honestly cannot take. */}
          {(liveResult.authRequired || liveResult.handshake) && (
            <>
              <div className="flex items-start gap-2">
                <pre className="min-w-0 flex-1 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-300">
                  {mcpClientConfig(probe.product, probe.endpoint)}
                </pre>
                <CopyButton text={mcpClientConfig(probe.product, probe.endpoint)} label="Copy config" />
              </div>
              <p className="text-[11px] text-zinc-500">
                Paste into your MCP client&rsquo;s config (Claude Code, Cursor, VS Code, …)
                {liveResult.authRequired
                  ? ' — the client walks you through the vendor’s OAuth sign-in on first use'
                  : ' — this server answered keyless from our edge just now'}
                {liveResult.authRequired && liveResult.scopes?.length
                  ? `; it will request: ${liveResult.scopes.join(', ')}`
                  : ''}
                .
                {probe.docsUrl && (
                  <>
                    {' '}
                    <a
                      href={probe.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-300 underline decoration-emerald-300/40 hover:decoration-emerald-300"
                    >
                      vendor&rsquo;s MCP docs →
                    </a>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
