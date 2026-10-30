import { normalizeArenaEvidence } from '../refresh-repair'
const arena = process.argv[2]
if (!arena) throw new Error('Expected arena ID')
normalizeArenaEvidence(arena)
