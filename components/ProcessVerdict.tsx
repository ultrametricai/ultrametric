import ComputerUseChips from '@/components/ComputerUseChips'
import { IconGlyph } from '@/components/IconChip'
import { verdictGaps, type HumanStepAudit, type VerdictGap } from '@/lib/humanSteps'
import { FEASIBILITY_META, showComputerUseChips } from '@/lib/humanStepsUi'
import type { ProcessCeiling, ProcessTask } from '@/lib/processes'

// The agent-ceiling verdict box: the single honest sentence for a process — how much an agent
// can run today, and exactly which steps still sit with a human or a manual portal. The gaps
// bucket four ways (lib/humanSteps.ts verdictGaps): legally-required signature acts (the
// founder's 2026-09-21 "true human floor" — DagNode.legalSignature, never given a workaround
// or computer-use chips), closable with today's market (an agentic vendor covers the step),
// judgment/identity work ("human or computer use" — presented calmly, never as an error
// state), and no workaround yet (still manual, the market hasn't closed it).
//
// Every NON-SIGNATURE manual step (founder 2026-09-18: "any time 'manual' is seen, see if we
// can do a computer use process for it") additionally surfaces the judged computer-use fleet
// (components/ComputerUseChips.tsx → lib/processRankings.ts computerUseOptions) as "🖥 could
// attempt it today". The step KEEPS its manual routing — the row is honest capability
// evidence, never a claim the step is solved, and it renders nothing where no vendor has
// judged full/partial evidence.

// The per-node "why + can computer use do it" line (founder 2026-09-21: "get to the bottom of
// why, and why computer use can't be used there").
function AuditLine({ audit }: { audit: HumanStepAudit }) {
  const meta = FEASIBILITY_META[audit.computerUse]
  return (
    <span className="text-zinc-500">
      {' '}— {audit.why}{' '}
      <span className="whitespace-nowrap" title={audit.computerUseWhy}>
        {/* The feasibility tier's house glyph (FEASIBILITY_ICONS — founder 2026-10-08 sweep);
            the label beside it carries the concept, the title the audited why. */}
        · <IconGlyph icon={meta.icon} /> {meta.label}
      </span>
    </span>
  )
}

// One bucket row: label, the honest why (audited when available), and — only where honest —
// the judged computer-use fleet. Signature rows suppress the chips entirely.
function GapRow({ gap }: { gap: VerdictGap }) {
  return (
    <li>
      {gap.node.label}{' '}
      {gap.audit ? (
        <AuditLine audit={gap.audit} />
      ) : (
        <span className="text-zinc-500">({gap.why})</span>
      )}
      {showComputerUseChips(gap.audit?.computerUse, gap.node.legalSignature) && (
        <ComputerUseChips taskId={gap.taskId} nodeId={gap.node.id} />
      )}
    </li>
  )
}

export default function ProcessVerdict({ ceiling, tasks }: { ceiling: ProcessCeiling; tasks: ProcessTask[] }) {
  const { agentSteps, totalSteps, approvalGates, gaps } = ceiling
  const { signature, closable, irreducible, unclosed, arenas } = verdictGaps(tasks)

  return (
    <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4 sm:p-5">
      <p className="text-[10px] uppercase tracking-widest text-emerald-400/80">Agentic %</p>
      <p className="mt-1 text-lg font-medium text-zinc-100">
        An agent can run {agentSteps} of {totalSteps} steps
        {approvalGates > 0 && (
          <span className="text-zinc-400">
            {' '}— {approvalGates} of them behind a human approval gate ⏸
          </span>
        )}
      </p>
      {gaps.length === 0 ? (
        <p className="mt-2 text-sm text-emerald-300/90">No gaps — every step of this process is agent-runnable today.</p>
      ) : (
        <details className="mt-2">
          <summary className="cursor-pointer select-none text-sm text-zinc-400 transition hover:text-emerald-300">
            {closable.length > 0 && <span className="mr-3">⚡ {closable.length} closable with today&rsquo;s market</span>}
            {signature.length > 0 && <span className="mr-3 text-violet-300/90">✍ {signature.length} legally human — signature</span>}
            {irreducible.length > 0 && <span className="mr-3 text-sky-300/90">{irreducible.length} human or computer use</span>}
            {unclosed.length > 0 && <span className="text-amber-300/90">{unclosed.length} no workaround yet</span>}
            <span className="ml-1 text-zinc-500">— details</span>
          </summary>
        <div className="mt-2 space-y-2.5 text-sm text-zinc-400">
          {closable.length > 0 && (
            <div>
              <p>
                <span className="text-emerald-300/90">
                  ⚡ Closable with today&rsquo;s market ({closable.length} — via {arenas.join(', ')}):
                </span>
              </p>
              <ul className="mt-1 space-y-1">
                {closable.map((g) => (
                  <li key={`${g.taskId}-${g.node.id}`}>
                    {g.node.label} <span className="text-zinc-500">({g.why})</span>
                    {g.audit && <AuditLine audit={g.audit} />}
                    {showComputerUseChips(g.audit?.computerUse, g.node.legalSignature) && (
                      <ComputerUseChips taskId={g.taskId} nodeId={g.node.id} />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {signature.length > 0 && (
            <div>
              <p>
                {/* Founder 2026-09-21: signatures are the only thing that legally needs a
                    human today — the one bucket no agent, workaround, or computer-use chip
                    ever touches. */}
                <span className="text-violet-300/90">✍ Legally human — signature ({signature.length}):</span>{' '}
                <span className="text-zinc-500">
                  a statute or counterparty requires a human signature or sworn attestation
                  here — the true human floor, never offered a workaround.
                </span>
              </p>
              <ul className="mt-1 space-y-1">
                {signature.map((g) => (
                  <GapRow key={`${g.taskId}-${g.node.id}`} gap={g} />
                ))}
              </ul>
            </div>
          )}
          {irreducible.length > 0 && (
            <div>
              <p>
                {/* Founder 2026-09-21: was red "Human or computer use" — the calm sky tone
                    replaces the negative coloring; human work is not an error state. */}
                <span className="text-sky-300/90">Human or computer use ({irreducible.length}):</span>{' '}
                <span className="text-zinc-500">
                  judgment or identity work — where judged computer-use agents could attempt the
                  mechanical part, they&rsquo;re listed with their verdict-backed scores.
                </span>
              </p>
              <ul className="mt-1 space-y-1">
                {irreducible.map((g) => (
                  <GapRow key={`${g.taskId}-${g.node.id}`} gap={g} />
                ))}
              </ul>
            </div>
          )}
          {unclosed.length > 0 && (
            <div>
              <p>
                <span className="text-amber-300/90">No workaround yet ({unclosed.length}):</span>
              </p>
              <ul className="mt-1 space-y-1">
                {unclosed.map((g) => (
                  <GapRow key={`${g.taskId}-${g.node.id}`} gap={g} />
                ))}
              </ul>
            </div>
          )}
        </div>
        </details>
      )}
    </div>
  )
}
