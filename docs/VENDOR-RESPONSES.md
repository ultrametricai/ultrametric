# Vendor responses: verified official statements on verdicts

CVE databases let a vendor put an official statement on the record next to a finding about
their product — the finding stands, the statement is published verbatim beside it, and readers
see both. Ultrametric does the same for verdicts. A **vendor response** is a short, verified,
official statement from a product's vendor about one specific (product, story) verdict,
published word-for-word next to that verdict.

The current implementation: `data/<category>/vendor-responses.json` (optional per ranking),
validated by `VendorResponseSchema` in `lib/schemas.ts`, loaded with integrity checks in
`lib/data.ts`, rendered inside the story's expanded row in
`components/StoryVerdictsTable.tsx`, with a count chip in the product page header. Intake is
the [Vendor response](../.github/ISSUE_TEMPLATE/vendor-response.yml) issue form.

## The one non-negotiable

**A vendor response never changes a verdict by itself.** It is speech, not evidence weighting:
publishing it moves no score, flips no tier, edits no rationale. What it *does* do is enter
the evidence pool — see "How responses feed re-judges" below. This rule is stated inline
wherever a response renders, so readers never mistake the vendor's words for ours.

## Verification methods

We publish a response only after verifying that its author actually speaks for the vendor, by
one of three methods (recorded in the response's `verification` field, shown on the site):

| method | what a maintainer verifies |
| --- | --- |
| `domain-email` | The statement (or confirmation of it) arrives from an email address on the product's own domain (`urls.site` in `products.json`) — not a free-mail account, not a lookalike domain. |
| `github-org` | The response arrives as a PR (or issue) authored by a **public member** of the vendor's GitHub org — the org that owns `urls.github`, or the org the vendor's site links as theirs. |
| `dns-txt` | The vendor sets a maintainer-issued one-time token in a DNS TXT record on the product's domain; the maintainer checks it before publishing, then the token is retired. |

The published `verification.evidence` string is a short human-auditable trail (e.g.
"PR #42 from github.com/acme member") so anyone can retrace the check.

## Publication SLA

- A maintainer acknowledges a *Vendor response* issue within **7 days**.
- Once verification completes, the response is published (merged to
  `vendor-responses.json`) within **7 days** — verbatim, or not at all (see below). We never
  sit on a verified response because it is inconvenient for a ranking.
- Publication is not endorsement: a response can flatly disagree with our verdict and still
  ship on schedule.

## Verbatim policy

The `statement` field is the vendor's words, byte-for-byte, capped at **1200 characters**.
Maintainers never edit, trim, paraphrase, or "tone-adjust" a statement. The only grounds for
declining to publish are: verification failed; the text exceeds the cap (the vendor shortens
it, we don't); or it contains abuse, doxxing, legal threats, or secrets. Declining is
all-or-nothing — there is no edited middle ground. A fuller statement can live at the
response's optional `url`, which we link but do not mirror.

## How responses feed re-judges

On the next re-judge of that product (`pnpm pipeline judge --category <cat> --product
<product>`, e.g. triggered by a contest or new evidence), the maintainer adds the response's
statement to the product's evidence file as a **claimed-docs-tier** item carrying a
`vendor-response` marker in its id (convention: `{product}-vendor-response-{issueNumber}`,
excerpt = the statement verbatim, url = the issue or the response's `url`). Claimed-docs is
deliberately the right tier: a vendor response is the vendor's own claim about the vendor's
own product — first-party, on the record, unproven. The judge then weighs it exactly like any
other vendor claim.

**If your response contains reproducible proof, don't use this channel** — a statement saying
"this works, here's the command" is strictly weaker than a recording of the command working.
Submit a proof spec via the *Prove a story* form instead (see
[`docs/PROVE-IT.md`](./PROVE-IT.md)); a passing recording becomes probe-tier evidence, the
strongest we have. A vendor response can, of course, link to a published proof.

## Supersession rules

A response's `status` starts as `standing`. It flips to `superseded` when a later re-judge of
that cell has incorporated the response into its evidence pool — at that point the current
verdict already reflects the statement, so continuing to badge it as a standing objection
would be misleading. Rules:

- Superseded responses are **never deleted**: they stay in `vendor-responses.json` and render
  with a `superseded` label — the public record of what the vendor said and when.
- At most **one `standing` response per (product, story) cell** (enforced by `lib/data.ts`).
  A vendor with something new to say after a re-judge submits a new response; the old one is
  superseded first.
- Flipping `standing` → `superseded` happens in the same PR as the re-judge that incorporated
  it, so the data never claims a response is unaddressed when it isn't.

## Affiliated products

Ultrametric (which operates Ultrametric) also ships products that appear in rankings (e.g.
Foreloop in `software-factory`, disclosed via the product's `affiliation` field). Responses on
our own products follow this exact protocol with no shortcuts — `github-org` verification via
this repository's org, same verbatim cap, same "never moves a verdict" rule — and exist partly
to demonstrate the feature honestly rather than fabricating third-party statements.
