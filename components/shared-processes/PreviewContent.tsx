'use client'
import type { ReactNode } from 'react'
import type { PreviewContext } from '@/lib/shared-processes/preview-context'
import { useRegionalVariant } from './RegionalVariant'
import { selectedVendor, useVendorSelection } from './VendorSelection'

export function PreviewScope({ context, recordScope, children }: { context?: PreviewContext; recordScope: string; children: ReactNode }) {
  const region = useRegionalVariant()
  if (context && region?.decision?.scope === `${recordScope}:${context.decision}` && region.selected !== context.option) return null
  return <>{children}</>
}

export function PreviewGuidance({ guidance, briefs = [], scope, choiceScope, parentChoiceScope }: { guidance: string | null; briefs?: Array<{ candidateId: string; guidance: string }>; scope: string; choiceScope?: string; parentChoiceScope?: string }) {
  const selection = useVendorSelection()
  const provider = selection && Object.hasOwn(selection.overrides, scope) ? selection.overrides[scope]
    : choiceScope ? selectedVendor(selection, choiceScope, parentChoiceScope) : undefined
  const text = briefs.find(brief => brief.candidateId === provider)?.guidance ?? guidance
  return text ? <p className="whitespace-pre-line break-words text-base leading-relaxed text-zinc-400">{text}</p> : null
}

export function ProviderScope({ candidateId, choiceScope, parentChoiceScope, children }: { candidateId: string; choiceScope?: string; parentChoiceScope?: string; children: ReactNode }) {
  const selection = useVendorSelection()
  return choiceScope && selectedVendor(selection, choiceScope, parentChoiceScope) === candidateId ? <>{children}</> : null
}
