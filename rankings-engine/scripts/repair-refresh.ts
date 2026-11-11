import fs from 'node:fs'
import { repair, type Finding } from '../refresh-repair'
const [head, main, arena, findingsFile, reportFile, mode, trusted, at, snapshot, ...extra] = process.argv.slice(2)
if (!head || !main || !arena || !findingsFile || !reportFile) throw new Error('Expected head main arena findings-file report-file')
if (mode !== undefined && (!['--replay', '--replay-historical'].includes(mode) || !trusted || !at || extra.length
    || (mode === '--replay' ? snapshot !== undefined : !snapshot))) throw new Error('Invalid replay arguments')
const findings = JSON.parse(fs.readFileSync(findingsFile, 'utf8')) as Finding[]
repair({ head, main, arena, findings, keyed: Boolean(process.env.ANTHROPIC_API_KEY), ...(mode ? { replay: { trusted, at, ...(snapshot ? { snapshot } : {}) } } : {}) }).then(report => {
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n')
}).catch(error => { console.error(error); process.exitCode = 1 })
