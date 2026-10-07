import type { Metadata } from 'next'
import Link from 'next/link'
import { REPO } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Methodology — Ultrametric',
  description: 'Evidence tiers, judging, scoring, the Overall score, story provenance, and bias disclosure — full writeup on GitHub.',
}

// Static page — no data dependency, no dynamic segments.
export const dynamic = 'force-static'

const PILL = 'rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-400'
const CODE = 'text-zinc-500'

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-sm uppercase tracking-widest text-emerald-400">Methodology</p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">How Ultrametric scores products</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Evidence in, rankings out. Every claim traces back to a cited evidence item — vendor docs, GitHub, an
          independent community source, or a hands-on probe — and an LLM judge scores every product user story (each product × user story pair)
          from that evidence alone, never outside knowledge.
        </p>
      </div>

      <a
        href={`https://github.com/${REPO}/blob/main/METHODOLOGY.md`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-400 bg-emerald-400/10 px-6 py-4 text-center text-lg font-semibold text-emerald-300 transition hover:bg-emerald-400/20"
      >
        Read the full methodology on GitHub ★
      </a>

      <div className="grid gap-3 sm:grid-cols-2">
        <div id="evidence-tiers" className={`scroll-mt-16 ${PILL}`}>
          <p className="font-semibold text-zinc-300">Evidence tiers</p>
          <p className="mt-1">
            <span className={CODE}>probe</span> (tested) &gt; <span className={CODE}>github</span> (code) &gt;{' '}
            <span className={CODE}>community</span> (independent) &gt; <span className={CODE}>claimed-docs</span>{' '}
            (vendor claim)
          </p>
          <p className="mt-1">
            <span className={CODE}>⚿ auth-gated</span>: a probe reached the live endpoint and hit a vendor sign-in
            wall (HTTP 401/403, OAuth) — verified reachable, untestable keylessly. Proof of life, never evidence of
            absence; the marker never changes a verdict or score.
          </p>
        </div>
        <div id="verdicts" className={`scroll-mt-16 ${PILL}`}>
          <p className="font-semibold text-zinc-300">Verdicts</p>
          <p className="mt-1">
            <span className={CODE}>full</span> / <span className={CODE}>partial</span> /{' '}
            <span className={CODE}>disputed</span> / <span className={CODE}>none</span> /{' '}
            <span className={CODE}>na</span>, each with a 0–10 quality score and cited evidence ids.
          </p>
        </div>
        <div className={PILL}>
          <p className="font-semibold text-zinc-300">Scoring</p>
          <p className="mt-1">
            <span className={CODE}>score = story.weight × quality × verdictFactor</span>, summed over applicable
            (non-<span className={CODE}>na</span>) product user stories only.
          </p>
        </div>
        {/* Anchored: /terms ("Trademarks, no endorsement") deep-links here as THE standing
            affiliation disclosure (founder liability pass 2026-10-02). */}
        <div id="bias-disclosure" className={`scroll-mt-16 ${PILL}`}>
          <p className="font-semibold text-zinc-300">Bias disclosure</p>
          <p className="mt-1">
            The judge is <span className={CODE}>claude-opus-5-5</span>, made by Anthropic; the{' '}
            <span className={CODE}>ai-coding</span> ranking includes its own product (migrated from{' '}
            <span className={CODE}>claude-sonnet-5</span> 2026-09-30 with every favorable own-product flip
            adversarially audited). Full audit writeups on GitHub.
          </p>
        </div>
        <div className={PILL}>
          <p className="font-semibold text-zinc-300">Popularity (not scored)</p>
          <p className="mt-1">
            GitHub stars/npm/PyPI downloads, shown as a survival signal only — measures adoption, not AI-readiness,
            so it&apos;s never part of the Overall score or rankings.
          </p>
        </div>
        <div id="story-tiers" className={`scroll-mt-16 ${PILL}`}>
          <p className="font-semibold text-zinc-300">Pricing tiers (not scored)</p>
          <p className="mt-1">
            Delivered stories (<span className={CODE}>full</span>/<span className={CODE}>partial</span>) carry a{' '}
            <span className={CODE}>free</span> / <span className={CODE}>paid</span> /{' '}
            <span className={CODE}>enterprise</span> chip when the verdict&apos;s cited evidence or the vendor&apos;s
            own pricing evidence states which plan the capability needs — each chip quotes that gating evidence
            (e.g. &ldquo;SSO on Enterprise plan only&rdquo;).
          </p>
          <p className="mt-1">
            <span className={CODE}>unknown</span> means the evidence never states gating — we never infer a tier
            from reputation or vibes, and silence is never rendered as &ldquo;free&rdquo;. An annotation layer only:
            it never moves a verdict, quality, or any score.
          </p>
        </div>
      </div>

      <section id="ai-era" className="rounded-xl border border-zinc-800 p-5">
        <h2 id="arena-score" className="scroll-mt-16 font-display leading-[1.1] text-lg font-semibold">The Overall score</h2>
        <p className="mt-1 text-sm text-zinc-500">Formerly displayed as the &quot;Arena Score&quot; (and before that the &quot;AI-Era Index&quot;) — same formula, new name.</p>
        <p className="mt-3 max-w-2xl text-sm text-zinc-400">
          Every leaderboard entry carries a Overall score (0–100, <span className={CODE}>aiEra</span> internally) — a
          weighted, renormalized blend of five components:
        </p>
        <table className="mt-3 w-full max-w-2xl border-collapse text-sm">
          <tbody className="divide-y divide-zinc-800/70">
            <tr><td className="py-1.5 pr-3 text-zinc-500">agent-ready</td><td className="py-1.5 text-zinc-300">×0.30 — can an agent reach the product</td></tr>
            <tr><td className="py-1.5 pr-3 text-zinc-500">API quality</td><td className="py-1.5 text-zinc-300">×0.20 — how good is that API surface</td></tr>
            <tr><td className="py-1.5 pr-3 text-zinc-500">openness</td><td className="py-1.5 text-zinc-300">×0.20 — self-host, export, read the source</td></tr>
            <tr><td className="py-1.5 pr-3 text-zinc-500">agentic app</td><td className="py-1.5 text-zinc-300">×0.15 — does the product act agentically itself</td></tr>
            <tr><td className="py-1.5 pr-3 text-zinc-500">automation</td><td className="py-1.5 text-zinc-300">×0.15 — how deep rules, scheduling, and bulk automation go</td></tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-zinc-400">
          n/a components are excluded and weights renormalized over the rest. See the full methodology (link above)
          for the exact formula and the case for leading with this number over raw coverage.
        </p>
      </section>

      <section id="confidence" className="scroll-mt-16 rounded-xl border border-zinc-800 p-5">
        <h2 className="font-display leading-[1.1] text-lg font-semibold">Confidence grades (A–D)</h2>
        <p className="mt-3 max-w-2xl text-sm text-zinc-400">
          The letter next to a Overall score says how much of that score rests on evidence we tested
          ourselves versus evidence the vendor merely claims. It grades the receipts, not the
          product — a great product can carry a C simply because we haven&apos;t probed it deeply yet.
        </p>
        <table className="mt-3 w-full max-w-2xl border-collapse text-sm">
          <tbody className="divide-y divide-zinc-800/70">
            <tr><td className="py-1.5 pr-3 font-mono text-emerald-300">A</td><td className="py-1.5 text-zinc-300">broad story coverage and a high share of probe/community-tested verdicts</td></tr>
            <tr><td className="py-1.5 pr-3 font-mono text-emerald-400/80">B</td><td className="py-1.5 text-zinc-300">solid coverage, mostly tested — a few product user stories still rest on vendor docs alone</td></tr>
            <tr><td className="py-1.5 pr-3 font-mono text-amber-400/90">C</td><td className="py-1.5 text-zinc-300">meaningful gaps: thin coverage or verdicts leaning on claimed docs</td></tr>
            <tr><td className="py-1.5 pr-3 font-mono text-red-400/90">D</td><td className="py-1.5 text-zinc-300">treat the score as provisional — little tested evidence behind it yet</td></tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-zinc-400">
          Computed from story coverage × tested-evidence share (<span className={CODE}>lib/confidence.ts</span>).
          Grades move as probes land — the fastest way to raise one is to submit reproducible evidence.
        </p>
      </section>

      <section id="claims-integrity" className="scroll-mt-16 rounded-xl border border-zinc-800 p-5">
        <h2 className="font-display leading-[1.1] text-lg font-semibold">Claims integrity</h2>
        <p className="mt-3 max-w-2xl text-sm text-zinc-400">
          One number per product for &quot;does the vendor&apos;s website deliver what it
          promises?&quot;: we extract capability claims from the vendor&apos;s own docs/GitHub
          materials, map each onto this ranking&apos;s stories, and reconcile them against our
          judge&apos;s independent verdicts.
        </p>
        <p className="mt-3 max-w-2xl font-mono text-xs text-zinc-300">
          testable = verified + unverified + contradicted
          <br />
          integrity = 100 × max(0, verified − 2 × contradicted) / testable
        </p>
        <table className="mt-3 w-full max-w-2xl border-collapse text-sm">
          <tbody className="divide-y divide-zinc-800/70">
            <tr><td className="py-1.5 pr-3 text-emerald-400">verified</td><td className="py-1.5 text-zinc-300">claim maps to a story with a probed/community-backed full or partial verdict — counts fully</td></tr>
            <tr><td className="py-1.5 pr-3 text-zinc-400">unverified</td><td className="py-1.5 text-zinc-300">full/partial verdict, but only the vendor&apos;s own claim backs it — inflates the denominator only</td></tr>
            <tr><td className="py-1.5 pr-3 text-red-400">contradicted</td><td className="py-1.5 text-zinc-300">our judge found disputed/none/na — each one cancels two verified claims (overpromising is worse than staying silent); the score is clamped at 0</td></tr>
            <tr><td className="py-1.5 pr-3 text-zinc-500">untestable</td><td className="py-1.5 text-zinc-300">outside this ranking&apos;s story taxonomy — excluded from both numerator and denominator (a taxonomy gap is never a mark for or against the product)</td></tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-zinc-400">
          Products with no testable claims are unscored (null, never a fabricated 0) and sort last
          in the <Link href="/rankings/claims-integrity" className="underline decoration-zinc-700 hover:text-emerald-300">claims-vs-reality ranking</Link>.
          Computed in <span className={CODE}>lib/claimsIntegrity.ts</span>; each product page&apos;s
          &quot;Claims vs evidence&quot; section shows the claim-by-claim breakdown.
        </p>
      </section>

      <a
        href={`https://github.com/${REPO}/blob/main/docs/SCORING.md`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-6 py-3 text-center text-sm font-medium text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300"
      >
        New here? Read the plain-language scoring guide →
      </a>

      <p className="text-xs text-zinc-500">
        Rankings, verdicts, and scores are research outputs derived from cited evidence at a point in time, provided
        &quot;as is&quot; — verify against the evidence before acting on them. See{' '}
        <Link href="/terms" className="underline decoration-zinc-700 hover:text-emerald-300">
          terms of use
        </Link>
        .
      </p>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/llms.txt" className="underline decoration-zinc-700 hover:text-emerald-300">
          /llms.txt
        </Link>
        <Link href="/openapi.json" className="underline decoration-zinc-700 hover:text-emerald-300">
          /openapi.json
        </Link>
        <a href={`https://github.com/${REPO}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noopener noreferrer" title="Contribution guide on GitHub" className="underline decoration-zinc-700 hover:text-emerald-300">
          CONTRIBUTING.md
        </a>
      </div>
    </div>
  )
}
