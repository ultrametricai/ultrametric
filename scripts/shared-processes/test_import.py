"""Historical CI entry point for canonical ownership and export regression tests.

Import-based writes are retired. The current tests cover catalog membership,
reference closure, projection drift, immutable definitions and pinned exports.
"""
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
subprocess.run([
    "node", "node_modules/vitest/vitest.mjs", "run", "--maxWorkers=2",
    "lib/__tests__/canonical-projections.test.ts",
    "lib/__tests__/process-catalog.test.ts",
    "lib/__tests__/shared-process-export.test.ts",
], cwd=ROOT, check=True)
