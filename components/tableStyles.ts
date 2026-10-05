// The sitewide table idiom (founder 2026-10-05: one table structure everywhere — the
// /processes table is the reference). Every data table shares:
//   - TABLE_SHELL: the scroll wrapper — rounded-2xl border, horizontal scroll inside the
//     shell (never page-level). Compose extras around it (margins, `relative`,
//     `md:overflow-x-visible`) in a template literal; do not fork the core classes.
//   - TABLE_HEADER_ROW: the <thead> row — text-xs sentence case (no uppercase transform),
//     zinc-400 tone, left-aligned. Header cells stay `font-normal` on a px-2/px-3 + py-2
//     padding scale.
// New tables import these so the idiom is inherited, not copy-pasted; the tableIdiom sweep
// test pins both the values and the adopters.
export const TABLE_SHELL = 'overflow-x-auto rounded-2xl border border-zinc-800'
export const TABLE_HEADER_ROW = 'border-b border-zinc-800 text-left text-xs tracking-wide text-zinc-400'
