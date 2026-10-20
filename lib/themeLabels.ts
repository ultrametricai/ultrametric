// Display names for theme/group ids — the one user-facing spelling of a kebab-case id.
// Split out of the icon system (docs/repo-split-plan.md) because the open corpus derivations
// (lib/checklist.ts, lib/compare.ts, lib/storyDag.ts) label theme groups too; the emoji/icon
// maps stay with the site. Client-safe and pure (no node builtins, no React).

// Plain-language display overrides for theme/group ids whose literal humanization is jargon
// (founder 2026-09-30: "'action primitives' means nothing to people"). The machine id stays
// everywhere — URLs, schema fields, data files — only the display text changes, and it changes
// in ONE place so every render site (matrix headers, product-page cards, checklists, battles,
// markdown) stays consistent.
const THEME_LABEL_OVERRIDES: Record<string, string> = {
  'action-primitives': 'Agent actions',
}

// 'privacy-posture' → 'Privacy posture' — the ONLY user-facing spelling of a kebab-case
// theme/group id (dashes never reach the UI). First word capitalized, the rest left as-is.
export function humanizeTheme(theme: string): string {
  const override = THEME_LABEL_OVERRIDES[theme]
  if (override !== undefined) return override
  const words = theme.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
