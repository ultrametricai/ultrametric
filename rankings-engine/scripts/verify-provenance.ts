// Verifies the `_provenance` watermark in a rankings JSON file — ours, or a suspected copy of
// our published data found in the wild. Recomputes HMAC(committed key, arena + sha256(content))
// over the file's content (key-order/formatting independent — see lib/provenance.ts) and
// compares it to the embedded fingerprint. A match proves the payload is byte-for-byte the
// data Ultrametric published for that arena; any edit to a score/verdict breaks it.
//
// Usage:
//   pnpm tsx pipeline/scripts/verify-provenance.ts <file.json> [arenaId]
//
// [arenaId] is only needed when the copy stripped or altered `_provenance.arena`.
// Exit 0 = VALID, exit 1 = INVALID or unverifiable.
import fs from 'node:fs'
import { verifyProvenance } from '../../lib/provenance'

const [file, arenaId] = process.argv.slice(2)
if (!file) {
  console.error('usage: pnpm tsx pipeline/scripts/verify-provenance.ts <file.json> [arenaId]')
  process.exit(1)
}

const json: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
const check = verifyProvenance(json, arenaId)

if (check.arena === null) {
  console.log(`UNVERIFIABLE: no _provenance.arena in ${file} and no arenaId argument given`)
  process.exit(1)
}

console.log(`arena:    ${check.arena}`)
console.log(`claimed:  ${check.actual ?? '(no _provenance.fingerprint in file)'}`)
console.log(`expected: ${check.expected}`)
console.log(check.ok ? 'VALID: fingerprint matches — this is Ultrametric-published data.' : 'INVALID: fingerprint does not match this content.')
process.exit(check.ok ? 0 : 1)
