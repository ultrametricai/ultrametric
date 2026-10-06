import bindings from './index-icons.json'

// The same stable record IDs as the index artwork, using its original size variants.
// Records without an authored binding keep the text-only header.
export function processIllustration(recordId: string): { desktop: string; mobile: string } | undefined {
  if (!Object.hasOwn(bindings, recordId)) return undefined
  if (recordId === 'form_001') return { desktop: '/process-icons/incorporate.svg', mobile: '/process-icons/incorporate-64.svg' }
  return { desktop: `/process-icons/512/${recordId}.svg`, mobile: `/process-icons/64/${recordId}.svg` }
}
