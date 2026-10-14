// Terminals arena bring-up (2026-09-04), na/none harmonization — the documented judge-v3
// weakness (na/none boundary instability) showed up as like products getting different
// wrong-axis calls on the SAME story. Deterministic rule, mirroring the judge SYSTEM prompt's
// own na-vs-none ladder:
//
//   For each story where (a) at least one product holds a positive verdict (full/partial/
//   disputed) — proving a terminal emulator can conceivably ship the capability, so the axis
//   applies to the KIND — and (b) the non-positive products SPLIT between "none" and "na",
//   flip the "na" cells to "none" (lack of evidence for an applicable axis is always none).
//
//   Stories where every non-positive product agreed on "na" are left alone: per the prompt's
//   step-4 boundary (and the ai-coding agentic-mcp-server precedent), a single product's
//   evidence-backed positive makes the axis apply to THAT product without making the question
//   fair for the kind (e.g. Warp's cloud-platform AI features vs pure local emulators).
//
// Plus one explicit case from the judge prompt's own boundary text: agentic-mcp-server for
// products that are NOT themselves agents ("publishing an official MCP server is plausible, so
// the axis APPLIES and absence of one in evidence is 'none'") — alacritty/wezterm/kitty na →
// none, joining ghostty/iterm2 which were already judged none. Warp KEEPS its na: Warp is
// itself an agent product (Agent Mode / Warp Agent CLI), the same role ruling as cursor/
// gemini-cli/github-copilot in pipeline/scripts/apply-mcp-server-na.ts.
//
// Same documented cache-edit mechanism as apply-mcp-server-na.ts: hand-write the verdict and
// stamp the cache file with the CURRENT cellHash so `pnpm pipeline judge` treats it as already
// judged. Score impact is strictly conservative: every flip turns a denominator-excluded na
// into a scoring none (quality 0), removing the null-renormalization windfall for products
// with no evidence on applicable axes.
//
// Usage: pnpm exec tsx pipeline/scripts/terminals-na-harmonize.ts [--write]
import fs from 'node:fs'
import path from 'node:path'
import { EvidenceSchema, StorySchema, VerdictBaseSchema, type Verdict } from '../../lib/schemas'
import { categoryDir, readJson } from '../paths'
import { cellHash, PROMPT_VERSION, validateVerdictRules } from '../stages/judge'

const WRITE = process.argv.includes('--write')
const CATEGORY = 'terminals'

const RATIONALE =
  'The axis applies to terminal emulators as a kind (peer products hold positive or none verdicts on this story), so lack of evidence for an applicable capability is "none", never "na". (na/none harmonized at arena bring-up — see pipeline/scripts/terminals-na-harmonize.ts.)'

const MCP_SERVER_RATIONALE =
  'This product is not itself an agent, so publishing an official MCP server is plausible and the axis applies; no first-party MCP server appears in the evidence. (na/none harmonized at arena bring-up — see pipeline/scripts/terminals-na-harmonize.ts.)'

function main(): void {
  const dataDir = categoryDir(CATEGORY)
  const stories = readJson(StorySchema.array(), path.join(dataDir, 'stories.json'))
  const verdicts = readJson(VerdictBaseSchema.array(), path.join(dataDir, 'verdicts.json'))

  const byStory = new Map<string, typeof verdicts>()
  for (const v of verdicts) {
    const arr = byStory.get(v.storyId) ?? []
    arr.push(v)
    byStory.set(v.storyId, arr)
  }

  const flips: { productId: string; storyId: string; rationale: string }[] = []
  for (const [storyId, arr] of byStory) {
    const positives = arr.filter((v) => v.verdict === 'full' || v.verdict === 'partial' || v.verdict === 'disputed')
    const nas = arr.filter((v) => v.verdict === 'na')
    const nones = arr.filter((v) => v.verdict === 'none')
    if (positives.length > 0 && nas.length > 0 && nones.length > 0) {
      for (const v of nas) flips.push({ productId: v.productId, storyId, rationale: RATIONALE })
    }
  }
  // Explicit v3-boundary case (no positive exists in-arena, so the split rule can't see it):
  // non-agent products' agentic-mcp-server na → none. Warp (agent role) is deliberately absent.
  for (const productId of ['alacritty', 'wezterm', 'kitty']) {
    const v = verdicts.find((x) => x.productId === productId && x.storyId === 'agentic-mcp-server')
    if (v?.verdict === 'na') flips.push({ productId, storyId: 'agentic-mcp-server', rationale: MCP_SERVER_RATIONALE })
  }

  for (const flip of flips) {
    const story = stories.find((s) => s.id === flip.storyId)
    if (!story) throw new Error(`story ${flip.storyId} not found`)
    const evidence = readJson(EvidenceSchema.array(), path.join(dataDir, 'evidence', `${flip.productId}.json`))
    const hash = cellHash(story, evidence, PROMPT_VERSION)
    const verdict: Verdict = {
      verdict: 'none',
      quality: 0,
      confidence: 'high',
      rationale: flip.rationale,
      evidenceIds: [],
      productId: flip.productId,
      storyId: flip.storyId,
    }
    const violation = validateVerdictRules(verdict, evidence)
    if (violation) throw new Error(`${flip.productId}:${flip.storyId} violates rules: ${violation}`)
    const cacheFile = path.join('pipeline', 'cache', 'judge', CATEGORY, flip.productId, `${flip.storyId}.json`)
    console.log(`${WRITE ? 'WRITE' : 'DRY RUN'}: ${flip.productId}:${flip.storyId} na -> none (hash ${hash.slice(0, 12)}...)`)
    if (WRITE) {
      fs.writeFileSync(cacheFile, JSON.stringify({ hash, verdict }, null, 2) + '\n')
    }
  }
  console.log(`${flips.length} cells ${WRITE ? 'written' : 'planned'}; re-run \`pnpm pipeline judge --category terminals\` to reassemble verdicts.json`)
  if (!WRITE) console.log('Dry run only — pass --write to apply.')
}

main()
