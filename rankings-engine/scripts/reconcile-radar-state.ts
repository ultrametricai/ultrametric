// Local git reads only. Workflows fetch both producer families before invoking this script.
// Carry source reports with discoveries; importing a legacy key proves no completed work.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { ROOT } from '../paths'
import { importLegacyLedger, loadSeenEntries, sha256, writeImmutable } from '../radar-state'

const PATHS = ['rankings-engine/radar-seen.json', 'rankings-engine/radar-discoveries',
  'reports/vendor-radar', 'reports/launch-watch', 'reports/radar-imports']

export function reconcileRadarState(refs: string[], root = ROOT): void {
  const git = (args: string[]) => execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 })
  // Most reports are shared by many branch tips. Read each blob once per reconciliation.
  const blobs = new Map<string, Buffer>()
  for (const ref of [...refs].sort()) {
    // Resolve to an object ID once, so an advancing ref cannot mix snapshots.
    const commit = git(['rev-parse', '--verify', `${ref}^{commit}`]).toString().trim()
    const files = git(['ls-tree', '-r', '-z', commit, '--', ...PATHS]).toString().split('\0').filter(Boolean)
    const imported: { source: string; retained: string; sha256: string }[] = []
    for (const row of files) {
      const tab = row.indexOf('\t')
      const [, type, object] = row.slice(0, tab).split(' ')
      const file = row.slice(tab + 1)
      if (type !== 'blob') throw new Error(`radar: unsupported git entry: ${file}`)
      let data = blobs.get(object)
      if (!data) {
        data = git(['cat-file', 'blob', object])
        blobs.set(object, data)
      }
      let retained = file
      if (file === 'rankings-engine/radar-seen.json') {
        const local = path.join(root, file)
        if (fs.existsSync(local) && fs.readFileSync(local).equals(data)) continue
        retained = importLegacyLedger(data, root)
      } else if (/^reports\/(vendor-radar|launch-watch)\//.test(file) && !file.includes('/runs/')) {
        // Date-only legacy reports can disagree across branches. Preserve every byte/version
        // under its content hash, with original path + commit recorded in the import manifest.
        // Do this even when a ledger's keys have already reached main.
        const local = path.join(root, file)
        if (fs.existsSync(local) && fs.readFileSync(local).equals(data)) continue
        retained = `reports/radar-imports/files/${sha256(data)}/${file}`
        writeImmutable(path.join(root, retained), data)
      } else {
        writeImmutable(path.join(root, file), data)
      }
      // Existing manifests already describe earlier imports; avoid nesting their provenance.
      if (!file.startsWith('reports/radar-imports/')) imported.push({ source: file, retained, sha256: sha256(data) })
    }
    if (imported.length) {
      const manifest = JSON.stringify({ schemaVersion: 1, sourceCommit: commit, files: imported }, null, 2) + '\n'
      writeImmutable(path.join(root, 'reports/radar-imports/manifests', `${sha256(manifest)}.json`), manifest)
    }
  }
  // All referenced reports must be present and unchanged before any scan can suppress keys.
  loadSeenEntries(root)
}

if (require.main === module) {
  const refs = execFileSync('git', ['for-each-ref', '--format=%(refname)',
    'refs/remotes/origin/vendor-radar/', 'refs/remotes/origin/launch-watch/'], { cwd: ROOT })
    .toString().trim().split('\n').filter(Boolean)
  reconcileRadarState(refs)
}
