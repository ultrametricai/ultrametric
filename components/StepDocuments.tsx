import { openDocumentById } from '@/lib/documents'
import ExternalLinkMark from './shared-processes/ExternalLinkMark'

/** The existing ProcessDag document chips, shared with the preview cards. */
export default function StepDocuments({ documents, squareExternalLinks = false, readable = false, column = false }: { documents: string[]; squareExternalLinks?: boolean; readable?: boolean; column?: boolean }) {
  if (!documents.length) return null
  return <div className={`${column ? 'flex min-w-0 flex-col items-start gap-2' : 'mt-2 flex flex-wrap items-center gap-1.5'} ${readable ? 'text-sm' : 'text-[11px]'}`}>
    <span className={column ? 'text-sm font-normal text-zinc-400' : `${readable ? 'text-sm' : 'text-[10px]'} uppercase tracking-wide text-zinc-500`} title="The canonical open documents this step is done on — each chip opens the publisher's live page">open docs:</span>
    {documents.map(id => { const doc = openDocumentById(id); return <a key={id} href={doc.url} target="_blank" rel="noopener noreferrer" title={`${doc.name} — ${doc.publisher}, checked ${doc.checked_on} (external site)`} className={column ? 'min-w-0 max-w-full break-words text-sm font-normal text-zinc-300 underline decoration-zinc-700 decoration-1 underline-offset-2 hover:text-zinc-100 hover:decoration-zinc-400 focus-visible:outline-2 focus-visible:outline-zinc-300 [overflow-wrap:anywhere]' : `inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-zinc-700/80 px-1.5 py-0.5 ${readable ? 'text-sm' : 'text-[10px]'} text-zinc-300 transition hover:border-emerald-400/60 hover:text-emerald-300`}>{doc.name}{squareExternalLinks ? <ExternalLinkMark href={doc.url} label={doc.name} /> : ' ↗'}</a> })}
  </div>
}
