#!/usr/bin/env python3
# PR #561 review (Greptile finding, accuracy queue 2026-10-28, issue #508): the kushki
# re-judge flipped payments/kushki:webhook-delivery-reliability none/q0 -> partial/q3 on a
# single new citation (kushki-docs-34), but that row is only the heading "Webhooks para
# tarjeta presente" on the relaunched docs index: it shows card-present webhooks exist and
# nothing about signing, retries, delivery logs or replay — the substance the story grades.
# The cell's own rationale concedes every one of those gaps, so the flip is judge re-roll
# churn on a non-substantive citation, not new capability evidence.
#
# Settle rule applied per-cell (settle-churn-vs-ref.py / revert-churn-*-wave.ts precedent):
# restore the baseline verdict and patch the judge cache in place (same hash + keyVersion,
# restored verdict) so the next judge run does not resurrect the churn.
#
# Usage: python3 rankings-engine/scripts/revert-kushki-webhook-churn-2026-11-01.py <baseline-ref>
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
ARENA, PID, STORY = "payments", "kushki", "webhook-delivery-reliability"
REF = sys.argv[1] if len(sys.argv) > 1 else "origin/main"


def main() -> None:
    old_verdicts = json.loads(
        subprocess.run(
            ["git", "show", f"{REF}:open-rankings/{ARENA}/verdicts.json"],
            capture_output=True, text=True, check=True, cwd=ROOT,
        ).stdout
    )
    old = next(v for v in old_verdicts if v["productId"] == PID and v["storyId"] == STORY)
    assert old["verdict"] == "none" and old["quality"] == 0, old

    verdicts_path = ROOT / "open-rankings" / ARENA / "verdicts.json"
    verdicts = json.loads(verdicts_path.read_text())
    out = []
    reverted = False
    for v in verdicts:
        if v["productId"] == PID and v["storyId"] == STORY:
            if v == old:
                print("nothing to do — cell already matches the baseline verdict")
                return
            print(f"REVERT {ARENA}/{PID}:{STORY} {v['verdict']}/q{v['quality']} -> "
                  f"{old['verdict']}/q{old['quality']} (non-substantive citation, PR #561 review)")
            out.append(old)
            reverted = True
        else:
            out.append(v)
    assert reverted
    verdicts_path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")

    cache_file = ROOT / "rankings-engine" / "cache" / "judge" / ARENA / PID / f"{STORY}.json"
    cached = json.loads(cache_file.read_text())
    cache_file.write_text(
        json.dumps({**cached, "verdict": old}, indent=2, ensure_ascii=False) + "\n"
    )
    print(f"patched judge cache {cache_file.relative_to(ROOT)} (hash kept, verdict restored)")


if __name__ == "__main__":
    main()
