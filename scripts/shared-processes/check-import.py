"""Historical CI command for drift between canonical sources and projections.

The canonical catalog replaced import-based authoring. Keep the existing CI
entry point while checking the direction of authority used by current readers.
"""
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
subprocess.run(["node", "--import", "tsx", "scripts/shared-processes/project.ts"],
               cwd=ROOT, check=True)
