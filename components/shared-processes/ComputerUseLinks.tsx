import Link from 'next/link'
import ProductLogoView from '@/components/ProductLogoView'
import { processMetadataLink } from '@/components/processMetadataStyles'
import { hasLogo } from '@/lib/logos'
import type { ComputerUseChoice } from '@/lib/shared-processes/computer-use'

export default function ComputerUseLinks({ options }: { options: ComputerUseChoice[] }) {
  if (!options.length) return null
  return <div data-computer-use className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-zinc-400">
    <span title="Evidence-backed assistance for the mechanical work; required human approvals remain with the user.">Do this with computer use agent:</span>
    {options.map(option => <Link key={`${option.arenaId}/${option.productId}`} href={`/arena/${option.arenaId}/product/${option.productId}`} aria-label={`${option.name} computer-use evidence`} title={`${option.score.toFixed(0)}/100 on this step's mapped computer-use stories`} className={`${processMetadataLink} gap-2 py-1`}>
      <ProductLogoView product={{ id: option.productId, name: option.name }} size={18} hasLogo={hasLogo(option.productId)} />
      {option.name}
    </Link>)}
  </div>
}
