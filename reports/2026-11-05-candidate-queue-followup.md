# Candidate queue follow-up

This review advances the unresolved candidates from #571, #603 and #607 and records
current source observations for #601. The adjacent JSON preserves proposed product identities,
source receipts, limitations and the remaining decisions. It does not alter ranking inputs.

## #571: Mastra follow-ups

The ten skipped nominations from the [merged review](https://github.com/ultrametricai/ultrametric/pull/588)
remain unchanged. The two remaining product identities now have usable documentation:

- [Mastra Code](https://code.mastra.ai/) is an installable terminal coding agent;
  [headless usage](https://code.mastra.ai/headless) documents CLI and Node automation.
  Prepare `mastra-code` in `ai-coding`, rather than copying the generic framework identity.
- [Mastra Knowledge](https://mastra.ai/docs/knowledge/overview) has a public alpha
  [release](https://mastra.ai/blog/introducing-knowledge) with installation, persistent storage,
  and agent search/read/write tools. This new source resolves the earlier design-partner-only
  access concern. Prepare `mastra-knowledge` in `ai-memory`. The alpha explicitly lacks a
  scope-isolation guarantee, built-in importers and retention; retain those limitations.

These qualify for evidence collection and evaluation. Neither is a published roster addition.
Keep #571 open until the scoped evaluation can publish under the chosen rubric, or a maintainer
explicitly accepts triage completion separately from bring-up.

## #607: StaysPrivate

Read-only submission intake returned `needs-human` because it found no homepage docs link.
Manual review verified the supplied [llms.txt](https://staysprivate.com/llms.txt),
[tool instructions](https://staysprivate.com/heic-to-png/) and
[library README](https://github.com/staysprivate-wq/staysprivate-core).
The proposed product retains vendor self-submission disclosure, without asserting operator affiliation.
It uses `commercial` for the hosted service, whose open-source libraries cover only part of the product.

Browser conversion is relevant to the arena subject, although the arena description currently
names desktop, CLI and hosted API delivery. Confirm browser-local scope in the bring-up review.
The submitter states no API or CLI. Documentation discovery is sufficient for the policy's
agentic-surface intake criterion, but does not establish programmatic conversion capability.
No conversion, privacy or security test was executed. Keep #607 open until evaluation and
roster publication are complete; do not reject it solely for lacking an API or for self-submission.

## #603: radar decisions

[pixelfx](https://github.com/patch-gg/pixelfx) has a relevant agent skill and documentation.
Its current metadata still triggers the explicit popularity exception. A maintainer must approve
or decline inclusion despite that anomaly. Popularity alone proves neither quality nor abuse.

[ernd's own documentation](https://ernd.ai/llms.txt) supports a corporate card with AI-vendor
rewards, without evidence for developer-first issuing APIs or authorization controls.
Skip the `card-issuing` nomination. The existing #602 correction owns the scan disposition;
this review does not duplicate it. #603 remains open for the pixelfx decision.

## #601: accuracy queue

The rubric review and migration decision remain prerequisites under `docs/ACCURACY.md`.
PR #597 supplies the preview and #605 owns legacy-transition analysis. No paid judge run,
cache migration, score edit or workflow restart is authorized by this follow-up.

The fresh source receipts distinguish HTTP responses from transport failures. Trivy's llms.txt
returned 404, whereas the scan recorded 200; re-verify before claiming a positive flip.
Three previously cited URLs still returned 404. FFmpeg and AIMA requests failed at transport
level, which is inconclusive about availability. The full queue stays open until its keyed
refreshes, source review and publication gates are complete.
