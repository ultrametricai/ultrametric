# Author automerge

The `Author automerge` workflow merges ready pull requests into `main` from exactly
these GitHub accounts:

| Account | Immutable GitHub user ID |
| --- | --- |
| `judegomila` | `666306` |
| `tylerlastovich` | `10182232` |

Both the ID and login must match. A renamed account requires a reviewed code change.
The head branch must belong to this repository. Bots and outside contributors are
excluded, including PRs from forks owned by either maintainer.

## Merge policy

The controller requires `ci`, `validation`, `Greptile Review`, and `review-findings`
to retain their existing required-check App bindings. CI and Greptile checks must
explicitly succeed on the current PR head. The CI jobs must come from one successful,
registered pull-request workflow run. The findings status must point to a successful
CI or Review findings gate run. A fresh review-thread query also checks for unresolved
Greptile findings. Human and Greptile requests for changes block merging; the existing
Foreloop exclusion is preserved.

Drafts, conflicts, unknown mergeability, incomplete metadata, and the labels
`automerge-hold`, `do-not-merge`, `hold`, or `manual-merge` block automation.
Changes under `.github/` or `scripts/config/`, to `scripts/author-automerge.*`, or to
`scripts/docs-fast-path.mjs` require manual merging. Renames check the old path too.
PRs with existing native auto-merge enrollment remain under their existing control.

Only PRs created strictly after the configured activation timestamp qualify. The
controller repeats all eligibility checks and reads PR metadata again immediately
before submitting a normal REST merge with the expected head SHA. GitHub enforces
branch protections on that request. There is no admin bypass, approval submission,
branch update, or deferred native auto-merge enrollment. Check completion and PR events
trigger reevaluation; a periodic sweep catches missed events and resolved threads.

The final metadata read narrows races with holds and review activity. GitHub's merge
API atomically checks the head SHA and repository protections; it does not atomically
lock labels or review-thread metadata. Apply holds before a PR becomes mergeable.

## Activation

The workflow is disabled until `AUTHOR_AUTOMERGE_ENABLED` is exactly `true`.
Merging this implementation does not configure credentials, enroll existing PRs,
or change repository protections. This implementation PR requires a manual merge.

After explicit maintainer approval:

1. Install a dedicated GitHub App on `ultrametricai/ultrametric` only, with Contents
   and Pull requests read/write. Give it no ruleset bypass and no administration,
   Actions write, checks write, or statuses write permission. Keep it separate from
   content-refresh automation.
2. Add secrets `AUTOMERGE_BOT_APP_ID` (the App's client ID, for the token action's
   `client-id` input) and `AUTOMERGE_BOT_PRIVATE_KEY`. Set variable
   `AUTOMERGE_BOT_LOGIN` to its exact `<slug>[bot]` login. The controller verifies the
   minted token action's App slug against this login.
3. Keep `AUTHOR_AUTOMERGE_ENABLED=false`. Set `AUTHOR_AUTOMERGE_NOT_BEFORE` to the
   current UTC activation cutoff, formatted `YYYY-MM-DDTHH:MM:SSZ`. Create a new,
   ordinary canary PR authored by one of the two accounts after that time. Set
   `AUTHOR_AUTOMERGE_CANARY_PR` to its PR number.
4. Set `AUTHOR_AUTOMERGE_ENABLED=true`. Confirm the canary waits for every required
   check, merges the reviewed head, and creates the normal push-triggered main CI run.
   An unresolved finding or a hold must block it. Retain the workflow run and merge
   receipt as activation evidence.
5. After the canary is verified and general activation is approved, clear
   `AUTHOR_AUTOMERGE_CANARY_PR`. Keep the original cutoff to exclude preexisting PRs.

To pause new attempts, set `AUTHOR_AUTOMERGE_ENABLED=false` and cancel any running
Author automerge job. For an individual PR, use a hold label or convert it to draft.
This controller creates no pending auto-merge enrollment to cancel.

The workflow checks out only trusted `main`, with checkout credentials disabled. It
installs no PR dependencies and executes no PR code. Its default `GITHUB_TOKEN` has
read permissions only; a repository-scoped App token is minted only after eligibility
passes. The App token is used only for the final merge request. This preserves normal
main CI: GitHub suppresses push-triggered workflow runs for changes made with the
default workflow token. See [GitHub token event behavior](https://docs.github.com/en/actions/concepts/security/github_token)
and [the SHA-conditional merge endpoint](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request).

## Validation

Run `node --test scripts/author-automerge.test.mjs` and
`actionlint .github/workflows/author-automerge.yml .github/workflows/ci.yml`.
CI runs the controller tests on every PR, including the docs fast path. For a local
read-only inspection, set the configuration variables and `TARGET_PR`, and leave
`AUTOMERGE_TOKEN` unset. Missing credentials cannot trigger a merge.
