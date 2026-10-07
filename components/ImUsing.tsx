'use client'

import { useEffect } from 'react'
import { takePendingAction, useSignupGate } from '@/components/SignupGate'
import { useMyStackMap } from '@/components/useMyStackMap'
import { isPicked, stackPicks, togglePick, writeStack } from '@/lib/myStack'

// "I'm using" toggle on vendor pages (founder 2026-09-18; multi-vendor 2026-09-22; signup gate
// 2026-09-23): one click records this product as ONE OF the reader's picks for this arena in
// their account stack (lib/myStack.ts). Signed-out clicks no longer write silently to the
// device — they open the SignupGate modal ("sign up or log in to record this"), deep-link
// through login back to this page, and the stashed intent applies automatically on return, so
// the original click is never lost.
export default function ImUsing({ arenaId, productId, productName }: { arenaId: string; productId: string; productName: string }) {
  const stack = useMyStackMap()
  const { requireAuth, modal, session } = useSignupGate()
  const using = isPicked(stack, arenaId, productId)
  const othersCount = stackPicks(stack, arenaId).length - (using ? 1 : 0)

  // Post-login return: apply the click the reader made before they were sent to sign up.
  useEffect(() => {
    if (session.state !== 'authenticated' || using) return
    if (takePendingAction({ kind: 'im-using', arenaId, productId })) {
      writeStack(togglePick(stack, arenaId, productId))
    }
    // stack in deps would re-run on every store change; the one-shot stash makes this idempotent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.state, arenaId, productId, using])

  return (
    <>
      <button
        type="button"
        onClick={() =>
          requireAuth(
            () => writeStack(togglePick(stack, arenaId, productId)),
            { kind: 'im-using', arenaId, productId },
          )
        }
        title={
          session.state === 'authenticated'
            ? using
              ? othersCount > 0
                ? `${productName} is one of your ${othersCount + 1} ${arenaId} picks — click to remove it (your other picks stay). Manage your whole stack at /my-stack.`
                : `${productName} is set as your ${arenaId} pick — click to unset. Manage your whole stack at /my-stack.`
              : `Add ${productName} to YOUR picks for this ranking — you can keep several vendors per function; powers your stack advice and personalized process runs`
            : `Sign up or log in to record that you use ${productName} — your vendors power personalized process runs and stack advice (you'll come straight back here)`
        }
        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs transition ${
          using
            ? 'border-emerald-400/70 bg-emerald-400/15 text-emerald-300'
            : 'border-zinc-700 text-zinc-400 hover:border-emerald-400/50 hover:text-emerald-300'
        }`}
      >
        {using ? (othersCount > 0 ? '✓ one of my picks' : "✓ I'm using this") : "I'm using this"}
      </button>
      {modal}
    </>
  )
}
