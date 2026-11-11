import fs from 'node:fs'
import path from 'node:path'
import { reconcileRefresh, ReconciliationError } from '../refresh-reconciliation'

const args = process.argv.slice(2)
const option = (name: string) => args[args.indexOf(name) + 1]
try {
  if (!args.includes('--category') || !args.includes('--baseline')
      || args.length % 2 || args.some((arg, i) => i % 2 === 0 && !['--category', '--baseline', '--report'].includes(arg))) {
    throw new Error('Usage: reconcile-refresh.ts --category ARENA --baseline SHA [--report PATH]')
  }
  const report = reconcileRefresh({ arena: option('--category'), baseline: option('--baseline') })
  if (args.includes('--report')) {
    fs.mkdirSync(path.dirname(option('--report')), { recursive: true })
    fs.writeFileSync(option('--report'), JSON.stringify(report, null, 2) + '\n')
  }
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  if (args.includes('--report') && option('--report')) {
    fs.mkdirSync(path.dirname(option('--report')), { recursive: true })
    fs.writeFileSync(option('--report'), JSON.stringify(error instanceof ReconciliationError ? error.report : { arena: option('--category'), baseline: option('--baseline'), retained: [], accepted: [], blocked: [{ cell: `${option('--category')}/*`, reason: String(error) }] }, null, 2) + '\n')
  }
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
