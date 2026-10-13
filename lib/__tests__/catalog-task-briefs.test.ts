import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, it } from 'vitest'

const root = path.resolve(__dirname, '../..')

describe('authored catalog importer protection', () => {
  it('keeps authored briefs complete, distinct, and linked to valid sources', () => {
    execFileSync('python3', [
      'scripts/shared-processes/test_task_briefs.py', 'TaskBriefContentTests',
    ], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  })

  it('keeps the generated receipt distinct from authored content', () => {
    execFileSync('python3', [
      'scripts/shared-processes/test_task_briefs.py',
      'TaskBriefImportTests.test_formation_receipt_describes_generated_baseline',
    ], {
      cwd: root, encoding: 'utf8', stdio: 'pipe',
    })
  })

  it('is idempotent and rejects all authored source changes without partial writes', () => {
    execFileSync('python3', [
      'scripts/shared-processes/test_task_briefs.py',
      'TaskBriefImportTests.test_full_catalog_is_idempotent_and_all_authored_source_changes_conflict',
    ], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  })
})
