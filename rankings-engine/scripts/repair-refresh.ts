import fs from 'node:fs'
import { repair, type Finding } from '../refresh-repair'
const [head, main, arena, findingsFile, reportFile] = process.argv.slice(2)
if (!head || !main || !arena || !findingsFile || !reportFile) throw new Error('Expected head main arena findings-file report-file')
const findings = JSON.parse(fs.readFileSync(findingsFile, 'utf8')) as Finding[]
repair({ head, main, arena, findings, keyed: Boolean(process.env.ANTHROPIC_API_KEY) }).then(report => {
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n')
}).catch(error => { console.error(error); process.exitCode = 1 })
