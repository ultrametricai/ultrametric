import { migrateRetentionRoster } from '../refresh-reconciliation'

const args = process.argv.slice(2)
const names = ['--category', '--baseline', '--main']
try {
  if (args.length !== 6 || new Set(args.filter((_, i) => i % 2 === 0)).size !== 3
      || args.some((arg, i) => i % 2 === 0 && !names.includes(arg))) {
    throw new Error('Usage: migrate-retention-roster.ts --category ARENA --baseline SHA --main SHA')
  }
  const option = (name: string) => args[args.indexOf(name) + 1]
  const ledger = migrateRetentionRoster({ arena: option('--category'), baseline: option('--baseline'), main: option('--main') })
  console.log(`Migrated ${ledger.arena} retention identity; preserved ${ledger.retained.length} decisions`)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
