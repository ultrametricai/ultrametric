import type { ArenaMenuItem } from '@/components/ArenaMenu'
import { MOBILE_NAV_ICONS } from '@/lib/arenaIcons'

// The header's Objects dropdown (founder 2026-10-08): one menu for the site's object
// registries — the reactive situation records, the artifact registry, and the open-documents
// registry. Situations moved here from its own top-level slot; the dropdown replaced it.
// Single source of truth for BOTH mounts: the desktop ArenaMenu in app/layout.tsx and the
// labeled group in the ☰ panel (components/MobileNav.tsx) render this same list, so the two
// menus can never drift. The label is this one constant.
export const OBJECTS_LABEL = 'Objects'

export const OBJECTS_ITEMS: ArenaMenuItem[] = [
  // Reactive, trigger-driven records (founder 2026-10-02) — the siren it wears in the ☰ menu.
  { id: 'situations', name: 'Situations', label: 'records', href: '/situations', icon: MOBILE_NAV_ICONS['/situations'] },
  // The artifact registry (founder 2026-10-05): the typed business things the processes
  // produce and consume (processes/artifacts.json).
  { id: 'artifacts', name: 'Artifacts', label: 'registry', href: '/artifacts', icon: MOBILE_NAV_ICONS['/artifacts'] },
  // The open-documents registry (founder 2026-10-03): canonical startup legal documents as
  // dated, link-only records (open-documents/registry.json).
  { id: 'open-documents', name: 'Open documents', label: 'registry', href: '/open-documents', icon: MOBILE_NAV_ICONS['/open-documents'] },
]
