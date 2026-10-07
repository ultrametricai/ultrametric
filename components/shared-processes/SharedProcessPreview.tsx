import { buildComposedReceipts } from '@/lib/shared-processes/step-receipts'
import ProcessCompatibilityBridge from './ProcessCompatibilityBridge'
import SelectionSummary from './SelectionSummary'
import { processAnchorContract } from '@/lib/shared-processes/compatibility'
import { processSelectionContract } from '@/lib/shared-processes/page-compatibility'
import { notFound } from 'next/navigation'
import { RegionalCoverageNote } from './RegionalVariant'
import SharedProcessReader from './SharedProcessReader'
import { findSharedRecord, readSharedCatalog } from '@/lib/shared-processes/reader'
import { loadProcesses } from '@/lib/processes'
import ProcessLeaderboard from '@/components/ProcessLeaderboard'
import { buildComposedComparisons } from '@/lib/shared-processes/composed-preview'
import { buildProcessProviderChoice } from '@/lib/shared-processes/provider-choice'
import { buildVendorPreview } from '@/lib/shared-processes/vendor-preview'

export default function SharedProcessPreview({ id }: { id: string }) {
  const records = readSharedCatalog()
  const record = findSharedRecord(records, id)
  if (!record) notFound()
  // Existing vendor coverage stays supplementary. It supplies no content or edges to the reader.
  const coverage = loadProcesses().find(task => task.id === record.id)
  const comparisons = buildComposedComparisons(record, records)
  const vendorPreview = buildVendorPreview(record)
  const processChoice = buildProcessProviderChoice(record, comparisons)
  const anchors = processAnchorContract(record, records, coverage)
  const choices = processSelectionContract(record, records, comparisons, processChoice, vendorPreview)
  return <SharedProcessReader
    record={record}
    records={records}
    vendorPreview={vendorPreview}
    comparisons={comparisons}
    receipts={buildComposedReceipts(record, records)}
    processChoice={processChoice}
    stepAnchorAliases={anchors.aliases}
    compatibility={<ProcessCompatibilityBridge recordId={record.id} anchors={anchors} choices={choices} />}
    selectionSummary={<SelectionSummary recordId={record.id} choices={choices} />}
    supplementary={coverage ? <ProcessLeaderboard task={coverage} scopeNote={<RegionalCoverageNote />} /> : undefined}
  />
}
