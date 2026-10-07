'use client'

import Link from 'next/link'
import { useProcessLens } from '@/lib/processLens'
import { loginUrl, useSession } from '@/lib/session'
import { SITE_URL } from '@/lib/site'
import type { SelectionContract } from '@/lib/shared-processes/selection-compatibility'
import { useVendorSelection } from './VendorSelection'
import { useRegionalVariant } from './RegionalVariant'

export default function SelectionSummary({ recordId, choices }: { recordId: string; choices: SelectionContract }) {
  const selection = useVendorSelection()
  const region = useRegionalVariant()
  const { lens, clearLens } = useProcessLens(recordId)
  const session = useSession()
  if (!selection) return null
  const count = choices.steps.filter(step => {
    const selected = Object.hasOwn(selection.overrides, step.scope) ? selection.overrides[step.scope]
      : step.choiceScope ? selection.picks[step.choiceScope] : undefined
    return selected && step.candidates.includes(selected)
  }).length
  if (!count && !Object.keys(lens.picks).length) return null
  const href = session.state === 'authenticated' ? '/account/vendors' : loginUrl(`${SITE_URL}/account/vendors`)
  return <div data-selection-summary className="space-y-2 text-sm text-zinc-400">
    <p>Selected vendors have assessed coverage for {count} of {choices.steps.length} default-scope steps.{region?.selected !== 'default' && ' This does not assess the selected regional variant.'}</p>
    <p>Arena choices are included in this page’s URL. Per-step overrides and open methods are saved with this tab’s history, including on refresh.</p>
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      <button type="button" onClick={clearLens} className="text-zinc-300 underline underline-offset-4">Clear vendor choices</button>
      <Link href={href} className="text-zinc-300 underline underline-offset-4">Save vendors to your stack</Link>
    </div>
  </div>
}
