import type { LocalProbe } from './types'

// First probes for the ai-research-agents arena, added with the Gemini Notebook (NotebookLM)
// bring-up (2026-09-14 LLM-lab families wave). Gemini Notebook has no CLI, no public API, and
// no llms.txt (checked at bring-up — the absences are recorded by the probe stage where they
// are unambiguous); what CAN be proven keylessly is that the vendor's own help center
// documents the capabilities its arena stories rest on, served as crawlable HTML.
export const probes: LocalProbe[] = [
  {
    // The sources help page documents both sides of the product's research loop keylessly:
    // upload-your-own-corpus (file types, per-source caps) and the Deep Research mode that
    // gathers sources from the web into the notebook.
    probeId: 'sources-deep-research-doc',
    productId: 'notebooklm',
    storyIds: ['own-corpus-upload', 'autonomous-research-run'],
    bin: 'curl',
    argv: ['sh', '-c', "curl -sL --max-time 30 -A 'Mozilla/5.0 (compatible; Ultrametric/1.0)' 'https://support.google.com/gemininotebook/answer/16215270?hl=en' | grep -o -i -E 'Deep Research|Fast Research|sources for your notebook' | sort | uniq -c"],
    displayCommand: "curl -sL 'https://support.google.com/gemininotebook/answer/16215270?hl=en' | grep -oiE 'Deep Research|Fast Research|sources for your notebook' | sort | uniq -c",
    expect: /Deep Research[\s\S]*(Fast Research|sources for your notebook)/i,
    timeoutMs: 60_000,
  },
  {
    // Public/featured notebook sharing is the arena's collaboration story; the help page
    // documenting it is live and crawlable without auth.
    probeId: 'public-notebooks-doc',
    productId: 'notebooklm',
    storyIds: ['share-collaborate'],
    bin: 'curl',
    argv: ['sh', '-c', "curl -sL --max-time 30 -A 'Mozilla/5.0 (compatible; Ultrametric/1.0)' 'https://support.google.com/gemininotebook/answer/16322204?hl=en' | grep -o -i -E 'public notebooks?' | sort | uniq -c"],
    displayCommand: "curl -sL 'https://support.google.com/gemininotebook/answer/16322204?hl=en' | grep -oiE 'public notebooks?' | sort | uniq -c",
    expect: /public notebook/i,
    timeoutMs: 60_000,
  },
]
