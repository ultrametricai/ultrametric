# Partial website trial evidence

The control began from “build a website for our business” and wrote a local static site before a confirmed output-cap interruption. UM did not start. This bundle preserves a partial attempt and supports no paired quality claim.

Read the [independent artifact review](independent-outcome-review.md), [checks](independent-checks.json), [metadata](metadata.json), [source facts](independent-source-checks.json) and [curated transcript](transcript.json). The metadata records actual workload, the reactive cap overshoot and the unstarted UM arm. Missing final verification followed harness termination and is not evidence of a guide defect.

All original bytes are preserved with [manifest reconstruction paths](artifact-manifest.json). HTML and scripts use inert `.txt` suffixes. To inspect behavior, reconstruct the `without-um` tree in a disposable directory, inspect the archived code, restore the reviewer probe's `.mjs` filename, then run `node reviewer-module-probes.mjs /absolute/path/to/reconstructed/site`. The probe imports only local pure modules and opens no links or browser. [Public reconstruction checks](public-reconstruction-checks.json) record this replay. Browser rendering, DOM interaction, local HTTP delivery and deployment remain unverified.
