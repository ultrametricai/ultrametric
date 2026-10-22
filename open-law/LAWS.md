# Startup laws

The recurring, near-universal principles distilled from the reading canon — the things
the canon keeps re-teaching every generation of founders. Every law cites the records it
is distilled from by id (`open-lore/library.json`, `open-lore/citations.json`, and the
authorities in `open-law/citations/registry.json`); no law is uncited, and aphorisms are
attributed to their actual origin, not to folklore. The citation lines are machine-checked:
`__tests__/laws.test.ts` fails if a cited id does not resolve, if a law has no citation,
or if the list drifts outside 25–40 laws.

These are compressions of other people's published work, dated by the cited registries'
`checked_on` fields. They are heuristics with strong priors, not statutes — the only entries
here that are literally laws (the 83(b) window, the Delaware franchise tax date) cite primary
sources and carry dated rules in `open-law/`.

## Idea and validation

### 1. Make something people want
Y Combinator's motto, and the criterion every other law serves. Paul Graham's catalog of the
18 ways startups die concludes they are all proxies for this single mistake.
Sources: `ralston-ycs-essential-startup-advice`, `pg-18-mistakes-that-kill-startups`

### 2. The best ideas are noticed, not invented
Live in the future, then build what is missing. Sitting down to "think of a startup idea"
produces plausible-sounding bad ones.
Sources: `pg-how-to-get-startup-ideas`

### 3. Solve a problem you yourself have
You are the user you understand. Organic ideas from your own life beat made-up ideas because
the problem is verified before the company exists.
Sources: `pg-how-to-get-startup-ideas`, `pg-how-to-start-a-startup`

### 4. Get out of the building
The facts live with customers, not inside the office or the pitch deck. Customer development
is fieldwork — Steve Blank's founding observation underneath the whole lean movement.
Sources: `steve-blank`

### 5. Startups are counterintuitive — distrust instincts trained elsewhere
What works in school, big companies, or even other professions actively misleads here. When
canon and gut disagree, test with users before trusting either.
Sources: `pg-before-the-startup`

## Formation and housekeeping

### 6. Incorporate boringly, on standard documents
A Delaware C-corp on well-worn forms is legible to every investor and lawyer you will ever
meet; exotic structure costs more to unwind than it ever saves.
Sources: `stripe-atlas-guides`, `cooleygo-documents`, `de-how-to-form`

### 7. The 83(b) window is a law of nature
Thirty days from the stock transfer to file the election. No extensions, no do-overs, and the
cost of missing it grows with your success. (Law rule: `us-fed.83b-filing-period`.)
Sources: `irs-form-15620`

### 8. Founder stock vests
Four years with a one-year cliff protects every founder from every other founder — and the
company from all of them. Buying stock outright without vesting is how dead equity is made.
Sources: `holloway-equity-compensation`, `cooleygo-documents`

### 9. Get the IP into the company before it exists anywhere else
Every founder, employee, and contractor signs a confidential-information and invention
assignment agreement before writing a line of code. Diligence failures here reprice rounds.
Sources: `cooleygo-documents`, `stripe-atlas-guides`

### 10. Compliance deadlines are cheap to hit and expensive to miss
Delaware's franchise tax and annual report recur every March 1 — and the state's default
authorized-shares bill is usually recomputable far lower under the assumed-par-value method.
Put the calendar in software, not in memory.
Sources: `de-franchise-tax`, `de-code-title8-ch5`

### 11. Don't pay for what the government gives you free
The EIN, formation instructions, and trademark/patent primers are official, current, and free;
intermediaries resell them with markup and lag.
Sources: `irs-ein-online`, `de-how-to-form`, `uspto-trademark-basics`

## Product and first users

### 12. Launch fast
The product teaches you nothing until strangers use it; a launch is the beginning of the
conversation, not the end of the work.
Sources: `pg-startups-in-13-sentences`, `ralston-ycs-essential-startup-advice`

### 13. Do things that don't scale
Recruit users one at a time, by hand, and make them insanely happy. The scalable machine is
built later, out of what the unscalable phase taught you.
Sources: `pg-do-things-that-dont-scale`

### 14. A few users who love you beat many who are indifferent
Dig a deep well, not a shallow lake: intensity of demand is the signal, breadth can be
manufactured later.
Sources: `pg-startups-in-13-sentences`, `pg-how-to-get-startup-ideas`

### 15. Talk to users every week — and watch what they do
Iterate on observed behavior, not on what people say they would do. The build–talk–iterate
loop is the company's engine.
Sources: `ralston-ycs-essential-startup-advice`, `steve-blank`

### 16. Being good is a strategy
Benevolence toward users compounds into growth, morale, and help arriving from unexpected
directions. It is also easier to operate.
Sources: `pg-be-good`

### 17. Startup = growth
A startup is defined by growth, not by industry or newness. Pick a weekly growth rate and let
it make the company's decisions.
Sources: `pg-startup-equals-growth`

## Fundraising and equity

### 18. Know whether you are default alive or default dead
With expenses held constant and current growth, do you reach profitability on the cash you
have? Every other plan is downstream of this answer. (Implemented:
`lib/openstartup/runway.ts`.)
Sources: `pg-default-alive-or-default-dead`

### 19. The equity equation
Give up n% of the company only when the trade makes the remaining (1 − n) worth more than the
whole was before. This prices investors, cofounders, and early hires alike.
Sources: `pg-the-equity-equation`

### 20. Post-money SAFE ownership is transparent — keep the running total
Amount ÷ post-money cap is the ownership sold, and separate SAFEs simply add. Founders who
don't keep the sum discover it at the priced round. (Implemented:
`lib/openstartup/capTable.ts`.)
Sources: `yc-safe-documents`, `yc-safe-overview`

### 21. Raise on standard documents; negotiate the numbers, not the boilerplate
The SAFE, the Series Seed forms, the NVCA suite, and YC's Series A term sheet exist so the
expensive arguments happen only over price, size, and control.
Sources: `yc-safe-documents`, `nvca-model-docs`, `yc-series-a-term-sheet`

### 22. Fundraise breadth-first, in writing, then stop
Talk to investors in parallel weighted by expected value, convert soft interest into signed
commitments, and get back to work — fundraising is an instrument, not progress.
Sources: `pg-how-to-raise-money`

### 23. Ramen profitability changes the game
Covering the founders' living costs from revenue removes the ticking clock and most of the
leverage anyone has over you.
Sources: `pg-ramen-profitable`

### 24. Traction is the pitch
Investors follow growth, not persuasion. The fundraising deck is a chart with commentary.
Sources: `pg-startup-equals-growth`, `pg-how-to-raise-money`

### 25. Options need a defensible strike
Price grants at fair market value under a current 409A valuation — the published convention
in every serious equity-comp guide, and the tax cliff behind it is real. (Law rule:
`us-fed.409a-stock-right-exception`; implemented: `lib/openstartup/equityComp.ts`.)
Sources: `holloway-equity-compensation`, `index-rewarding-talent`

## Growth, people and spending

### 26. Spend little — startups die of overspending
Mostly on people, mostly too early. Cheapness buys iterations, and iterations are the unit of
learning.
Sources: `pg-startups-in-13-sentences`, `pg-18-mistakes-that-kill-startups`

### 27. Hiring is not progress
Headcount is a cost and a commitment, not a KPI. Overhiring is the classic mechanism by which
a default-alive company becomes default dead.
Sources: `pg-default-alive-or-default-dead`

### 28. Equity compensation is a system, not a favor
Benchmark grant sizes, keep bands consistent, and explain value honestly under strike,
dilution, and exit scenarios — the conventions are published; use them.
Sources: `index-rewarding-talent`, `holloway-equity-compensation`

### 29. Founders sell first
No salesperson can be hired to do what the founders have not done themselves; early sales are
product research wearing a different hat.
Sources: `pg-do-things-that-dont-scale`, `firstround-review`

## Survival and the long game

### 30. Startups die by giving up
Rarely in mid-keystroke, and rarely from a single blow: companies die when the founders stop,
or run out of money while too demoralized to fix it.
Sources: `pg-how-not-to-die`

### 31. The Struggle is normal
Every founder passes through the period when nothing works and it feels personal. It is not
evidence that you should quit; it is where the capacity to run something real is forged.
Sources: `a16z-the-struggle`

### 32. Be relentlessly resourceful
The two-word test for founders: the opposite of hapless. When the front door is closed, a
relentlessly resourceful founder has already found two windows.
Sources: `pg-relentlessly-resourceful`

### 33. Execution compounds
An idea is worth little until multiplied by years of consistent execution — great teams
executing a good idea beat good teams admiring a great one.
Sources: `altman-startup-playbook`
