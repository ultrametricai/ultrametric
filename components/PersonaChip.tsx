// Tiny muted chip naming the persona a user story is told from — the "As a {persona}," frame
// that lib/storyText.ts's parseStoryPersona splits off the title so lists lead with the action
// instead of repeating the frame on every row. Same visual family as StoryVerdictsTable's
// [G]/[C]/[P] ScopeChip: bordered, zinc-toned, deliberately quieter than the action text (body
// font since the 2026-09-30 mono sweep — persona names are words; the ScopeChip's bracketed
// tokens keep mono).
// Server-safe (no hooks, no client APIs); a null persona renders nothing so callers can
// pass parseStoryPersona(...).persona straight through.
export default function PersonaChip({ persona, className = '' }: { persona: string | null; className?: string }) {
  if (!persona) return null
  return (
    <span
      title="Told from this persona's perspective"
      className={`um-persona-chip ${className}`}
    >
      <span className="truncate">{persona}</span>
    </span>
  )
}
