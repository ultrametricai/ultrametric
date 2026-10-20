# Startup lore

The famous episodes and war stories of startup history, curated as sourced records — the
complement to `open-law/LAWS.md`: where a law is a recurring principle, a lore entry is the episode
that taught it. Every retelling is tight and factual; every entry carries at least one source
with a note saying exactly what it supports; and every entry is graded for **veracity** —
`first-person` (a participant told it on the record), `documented` (contemporaneous records),
`reported` (secondhand journalism), or `legend` (famous but unverifiable or known-embellished,
recorded AS legend, never asserted as fact). Disputes stay in the text: the eBay Pez story is
recorded as the fabrication it was, the Apple garage carries Wozniak's own debunk, and the
Blockbuster near-laughter is attributed to the one participant who tells it that way.

The grammar is machine-checked by `lib/lore.ts` and `__tests__/lore.test.ts`: unique ids,
valid veracity grades, non-empty lessons, HTTPS sources, law numbers resolving against
`open-law/LAWS.md`, and process ids resolving against `open-processes/catalog.json`.

## Founding and origin stories

### 1. Traf-O-Data loses $3,494 and builds Microsoft

Id: `traf-o-data`
Era: 1972-1982
Companies: Traf-O-Data, Microsoft
People: Paul Allen, Bill Gates

In 1972, teenagers Paul Allen and Bill Gates built Traf-O-Data, a machine to read roadside
traffic-counter tapes on the Intel 8008 and sell reports to municipalities. At the famous
home demo for Seattle-area officials the machine failed, and Gates begged, "Mother, mother,
would you come out here and tell them that it worked?" — a telling that comes from Bill
Gates Sr., who was there. The venture never took off; Allen recorded its net losses from
1974 to 1980 as exactly $3,494. But simulating the 8008 on a mainframe to build it sparked
the approach that produced Altair BASIC, and Allen called Traf-O-Data "a good idea with a
flawed business model" and the keystone for the creation of Microsoft.

Lesson: A cheap failure that teaches you the technology is tuition, not waste.
Veracity: first-person
Sources:
- [My Favorite Mistake: Paul Allen (Newsweek, 2011-04-24)](https://www.newsweek.com/my-favorite-mistake-paul-allen-66489) — Allen first-person: the $3,494 figure, "a good idea with a flawed business model," and "keystone for the creation of Microsoft."
- [Bill Gates' first product demo (Computerworld, 2009)](https://www.computerworld.com/article/2523490/bill-gates--first-product-demo---mom--come-and-tell-them-it-worked--.html) — the failed-demo anecdote as told by Bill Gates Sr. in "Showing Up for Life" (2009).
Related laws: `1`

### 2. The traitorous eight put in $500 each

Id: `fairchild-traitorous-eight`
Era: 1957-1968
Companies: Shockley Semiconductor, Fairchild Semiconductor, Intel
People: Robert Noyce, Gordon Moore, Eugene Kleiner, Jean Hoerni, Jay Last, Julius Blank, Victor Grinich, Sheldon Roberts, Arthur Rock

In September 1957 eight scientists and engineers — six of them PhDs — quit William
Shockley's lab together, each putting in $500, about a month's salary, for 100 founders'
shares. Arthur Rock and Bud Coyle of Hayden, Stone shopped the group to roughly thirty
companies before Sherman Fairchild's Fairchild Camera and Instrument agreed to back them
with about $1.38 million, structured as a loan with an option to buy the founders out.
Fairchild exercised that option in 1959 for roughly $300,000 per founder — and the
"Fairchildren" who felt the equity clawed back went on to found Intel, AMD, Kleiner Perkins,
and much of Silicon Valley. The episode established both founder equity and the defection
culture that redistributes it.

Lesson: Founder equity built Silicon Valley — and clawing it back built the rest of it.
Veracity: first-person
Sources:
- [An Evening with Legendary Venture Capitalist Arthur Rock (Computer History Museum, 2012)](https://archive.computerhistory.org/resources/access/text/2012/05/102658253-05-01-acc.pdf) — Rock first-person on the defection, shopping ~30 companies, and Fairchild Camera's backing.
- [The Traitorous Eight and the rise of Fairchild Semiconductor (All About Circuits)](https://www.allaboutcircuits.com/news/the-traitorous-eight-and-the-rise-of-fairchild-semiconductor/) — the $500-per-founder detail, the 1957 timeline, and the Fairchild buyout.
Related laws: `19`
Related processes: `form_001`

### 3. Y Combinator invents batch funding

Id: `yc-founding`
Era: 2005
Companies: Y Combinator
People: Paul Graham, Jessica Livingston, Robert Morris, Trevor Blackwell

In March 2005 Paul Graham, Jessica Livingston, Robert Morris, and Trevor Blackwell announced
the Summer Founders Program: seed funding on standardized terms, for many startups at once.
Graham's own account says they set out to be "a standard source of seed funding" and that
the most important idea arrived almost by accident — "funding startups synchronously,
instead of asynchronously as it had always been done before," two batches a year. They
viewed the first batch's cost as part educational expense, part charitable donation; the
batch model turned angel investing from a favor into an institution and was copied worldwide.

Lesson: Standardize the terms and synchronize the process, and seed funding becomes an institution instead of a favor.
Veracity: first-person
Sources:
- [How Y Combinator Started (Paul Graham, 2012-03)](https://paulgraham.com/ycstart.html) — pg first-person: standardized terms, synchronous batches, the Summer Founders Program announcement.
Related laws: `21`
Related processes: `fund_007`

### 4. eBay's Pez story was invented by PR

Id: `ebay-pez-legend`
Era: 1995-2002
Companies: eBay
People: Pierre Omidyar, Pam Wesley, Mary Lou Song

The most famous founding story in e-commerce — that Pierre Omidyar built eBay so his fiancée
could trade Pez dispensers — was invented in 1997 by PR manager Mary Lou Song, because
reporters found the real story boring. Omidyar actually launched AuctionWeb in September
1995 as an experiment in perfect markets; his fiancée Pam Wesley really did collect Pez
dispensers, but that never motivated the site. The real first sale was a broken laser
pointer for $14.83, to a buyer who explained, "I'm a collector of broken laser pointers."
Adam Cohen's 2002 book "The Perfect Store" exposed the fabrication, and eBay conceded the
tale had been "slightly blown out of proportion."

Lesson: The press-release version of a founding story is often marketing — verify before you repeat it.
Veracity: legend
Sources:
- [eBay's early days weren't about PEZ dispensers after all (AP via Berkeley Daily Planet, 2002-06-27)](https://www.berkeleydailyplanet.com/issue/2002-06-27/article/12996?headline=eBay-s-early-days-weren-t-about-PEZ-dispensers-after-all) — contemporaneous coverage of Cohen's revelation: Song invented the Pez narrative; eBay's "blown out of proportion" quote.
- [Business creation myths (CNNMoney, 2011)](https://money.cnn.com/galleries/2011/smallbusiness/1103/gallery.business_creation_myths/index.html) — secondary recap of the fabrication and the broken-laser-pointer first sale.

### 5. The Apple garage, per Wozniak, is "a bit of a myth"

Id: `apple-garage-legend`
Era: 1976
Companies: Apple, Hewlett-Packard
People: Steve Wozniak, Steve Jobs

The garage at 2066 Crist Drive is the shrine of the founding-in-a-garage legend — and Steve
Wozniak, who did the engineering, debunked it on the record in 2014: "The garage is a bit of
a myth. We did no designs there, no breadboarding, no prototyping, no planning of products.
We did no manufacturing there." The real Apple I engineering happened at Wozniak's Hewlett-
Packard cubicle; the garage was where finished units were driven for final assembly and
testing, and where the young company felt like home. The legend survives because it
romanticizes well, not because it is accurate.

Lesson: Origin myths romanticize the room and erase the work — the engineering happened where the engineer already was.
Veracity: legend
Sources:
- [Wozniak on the early days with Jobs (MacRumors, 2014-12-04)](https://www.macrumors.com/2014/12/04/wozniak-early-days-jobs/) — carries the verbatim debunk quote from Woz's Bloomberg Businessweek interview.
- [Steve Wozniak on what really happened in Jobs' garage (Bloomberg video, 2014-12-05)](https://www.bloomberg.com/news/videos/2014-12-05/steve-wozniak-on-what-really-happened-in-jobs-garage) — the recorded first-person telling.

## Do things that don't scale

### 6. Obama O's and Cap'n McCain's fund Airbnb

Id: `airbnb-cereal-boxes`
Era: 2008
Companies: Airbnb
People: Brian Chesky, Joe Gebbia, Nathan Blecharczyk

In late 2008, with the site not growing and the founders deep in credit-card debt, the
Airbnb founders designed and hand-assembled election-themed cereal — 500 numbered boxes each
of Obama O's and Cap'n McCain's — and sold them at $40 a box, clearing roughly $30,000 to
keep the company alive. Joe Gebbia has told the story on the record, and it was corroborated
contemporaneously: Paul Graham's 2009 email to Fred Wilson urged him to "ask about how they
funded themselves with breakfast cereal," and a box of Obama O's has sat in Union Square
Ventures' conference room ever since the founders pitched there. The cereal didn't just buy
runway — it convinced YC that founders this resourceful were worth backing.

Lesson: If you can sell a $4 box of cereal for $40, you can find the first $25,000 some way or another.
Veracity: first-person
Sources:
- [Airbnb (Fred Wilson, AVC, 2011-03-16)](https://avc.com/2011/03/airbnb/) — Wilson first-person: the cereal box in USV's conference room and the story he tells with it.
- [Airbnb email exchange (Paul Graham, 2009, published 2011)](https://paulgraham.com/airbnb.html) — pg's contemporaneous email: "ask about how they funded themselves with breakfast cereal."
- [Gebbia's HIBT telling, summarized (Inc., 2016)](https://www.inc.com/tess-townsend/airbnb-gebbia-trough-of-sorrow-npr.html) — Joe Gebbia first-person on NPR's How I Built This: 500 boxes each at $40.
Related laws: `32`

### 7. The Collison installation

Id: `stripe-collison-installation`
Era: 2010-2011
Companies: Stripe
People: Patrick Collison, John Collison

When early users agreed to try Stripe, the Collison brothers did not send a link and wait.
As Paul Graham recorded it, they'd say "Right then, give me your laptop" and set the user up
on the spot — a technique so distinctive that inside Y Combinator it earned its own name,
the Collison installation. The move collapsed the gap between "sure, I'll try it" and an
integrated, paying user, at a per-user cost that could never scale and never needed to.
Graham published the story in the essay that made hand-recruiting users doctrine.

Lesson: Close the gap between "I'll try it" and "it's running" yourself, one user at a time.
Veracity: documented
Sources:
- [Do Things That Don't Scale (Paul Graham, 2013-07)](https://paulgraham.com/ds.html) — the passage that recounts and names the Collison installation; contemporaneous YC-insider account.
Related laws: `13`

### 8. DoorDash is four founders, one Google Voice number, and Find My Friends

Id: `doordash-founders-deliver`
Era: 2013
Companies: DoorDash, Square
People: Tony Xu, Stanley Tang, Andy Fang, Evan Moore

In January 2013, Stanford students Tony Xu, Stanley Tang, Andy Fang, and Evan Moore built
paloaltodelivery.com — by Xu's telling, "in 45 minutes we built a website with eight PDF
menus" and a phone number. The four founders were the only drivers, tracking each other with
the consumer Find My Friends app as a dispatch system and taking payments on Square readers
left over from Xu's internship there. They did the deliveries themselves for months,
learning the unit economics firsthand before writing dispatch software, and entered
Y Combinator that summer as DoorDash.

Lesson: Run the whole service by hand first — the operational truth you learn is the product spec.
Veracity: first-person
Sources:
- [Tony Xu on In Good Company, transcript (2023)](https://podcasts.happyscribe.com/in-good-company-with-nicolai-tangen/doordash-co-founder-ceo-food-delivery-first-order-and-hard-work) — Xu first-person: the 45-minute site, eight PDF menus, Find My Friends dispatch, Square readers.
- [Crucible Moments: DoorDash (Sequoia, 2023)](https://sequoiacap.com/podcast/crucible-moments-doordash) — Xu first-person on the Stanford origin and talking to small businesses first.
Related laws: `12`, `13`
Related processes: `startup_001`

### 9. Silbermann's Apple-store homepage trick

Id: `pinterest-apple-store`
Era: 2010
Companies: Pinterest
People: Ben Silbermann

Pinterest's launch was a flop by Ben Silbermann's own telling — he emailed all his friends
and "no one really got it." So on his walk home he would stop at the Apple store, change
every display computer's browser to Pinterest, then stand in the back saying, "Wow, this
Pinterest thing, it's really blowing up." He also noticed the earliest users were design
enthusiasts and went to a design-bloggers conference to recruit more, the detail Paul Graham
recorded. The Apple-store story is Silbermann's own comic self-telling, on stage and on
tape, with no independent witness — retellings that inflate it to "stores across the Bay
Area" are embellishment.

Lesson: When nobody comes to the product, carry the product to where people already stand.
Veracity: first-person
Sources:
- [Ben Silbermann at Startup School (Y Combinator, 2016-11-08)](https://www.ycombinator.com/blog/ben-silbermann-at-startup-school/) — transcript excerpt of his 2012 Startup School talk with the verbatim Apple-store quote.
- [Do Things That Don't Scale (Paul Graham, 2013-07)](https://paulgraham.com/ds.html) — the design-bloggers-conference recruiting detail.
Related laws: `13`

### 10. Reddit's first users were the founders, many times over

Id: `reddit-fake-accounts`
Era: 2005
Companies: Reddit
People: Steve Huffman, Alexis Ohanian

When reddit launched in June 2005, Steve Huffman and Alexis Ohanian filled the empty site
themselves: the admin submission form had an extra field that registered a brand-new fake
username with each link, so the front page looked like a community long before one existed.
Huffman explained the mechanism on the record in his own web-development course — the fake
accounts "set the tone" for the content they wanted, and the puppets were retired once real
users carried the site. The often-paired Ohanian line that "99% of submissions" were the two
of them circulates with a less clean primary source; the mechanism itself is Huffman's own
telling.

Lesson: Seed the community you want to exist, then get out of its way the moment it is real.
Veracity: first-person
Sources:
- [How Reddit Got Huge: Tons of Fake Accounts (Vice/Motherboard, 2012-06-21)](https://www.vice.com/en/article/how-reddit-got-huge-tons-of-fake-accounts-2/) — quotes Huffman's own Udacity course telling: the hidden username field and tone-setting.
- [How Reddit's cofounders built Reddit with an army of fake accounts (Daily Dot, 2012-06)](https://www.dailydot.com/parsec/steve-huffman-built-reddit-fake-accounts/) — corroborating record of the same first-person lecture.
Related laws: `12`, `13`

### 11. Zappos ships shoes it doesn't own

Id: `zappos-shoe-store-test`
Era: 1999
Companies: Zappos, Venture Frogs
People: Nick Swinmurn, Tony Hsieh

Before building any inventory, Nick Swinmurn tested whether anyone would buy shoes online by
walking into local shoe stores, photographing the stock, and posting the photos on
ShoeSite.com; when an order came in, he bought the pair at full retail and shipped it
himself. The test proved demand at zero inventory risk and became the canonical minimum
viable product in Eric Ries's "The Lean Startup." Swinmurn's voicemail pitch — a $40 billion
US footwear market with 5% already sold by mail order — landed Tony Hsieh's Venture Frogs
investment, and ShoeSite became Zappos. Hsieh joined after the test; the test itself is
Swinmurn's own story.

Lesson: Prove people will buy before you buy inventory — losing money per order is the cheapest market research there is.
Veracity: first-person
Sources:
- [Zappos Milestone: Q&A With Nick Swinmurn (Footwear News/WWD, 2009)](https://wwd.com/footwear-news/shoe-industry-news/zappos-milestone-qa-with-nick-swinmurn-1237699700/) — Swinmurn first-person on the photograph-and-buy-at-retail test.
- [The Lean Startup, Chapter 4 "Experiment" — recap](https://lancechen.tw/book-recap-the-lean-startup-chapter-4-experiment/) — locator for Ries's canonical retelling of the test (book: Crown, 2011, ch. 4).
Related laws: `4`, `13`
Related processes: `startup_001`

### 12. Two Dropbox videos, one 15x waitlist

Id: `dropbox-demo-video`
Era: 2007-2008
Companies: Dropbox
People: Drew Houston

Dropbox was demoed before it could safely be used. In April 2007 Drew Houston posted a
screencast to Hacker News as "My YC app: Dropbox — Throw away your USB drive," and the
thread's feedback shaped the early product. In March 2008 he made a second video, aimed at
Digg, salted with about a dozen easter eggs for that audience — Tay Zonday, Office Space,
XKCD — and by Houston's own account, "our beta waiting list went from 5,000 people to 75,000
people literally overnight." The product couldn't onboard them yet; the video validated
demand for a product whose hardest work was still invisible.

Lesson: When the product is hard to build, ship a honest demonstration of it and measure who signs up.
Veracity: first-person
Sources:
- [My YC app: Dropbox (Hacker News, 2007-04-04)](https://news.ycombinator.com/item?id=8863) — the original screencast thread, submitted by dhouston.
- [How DropBox Started As A Minimal Viable Product (TechCrunch/Eric Ries, 2011-10-19)](https://techcrunch.com/2011/10/19/dropbox-minimal-viable-product/) — quotes Houston first-person: the Digg easter eggs and the 5,000-to-75,000 overnight jump.
Related laws: `12`
Related processes: `startup_001`

## Pivots

### 13. Flickr is the photo feature of a dead game

Id: `flickr-from-game-neverending`
Era: 2002-2005
Companies: Ludicorp, Flickr, Yahoo
People: Stewart Butterfield, Caterina Fake

Ludicorp, founded in Vancouver in 2002, was building a whimsical MMO called Game
Neverending when the post-crash funding market closed on it — the game never commercially
launched. What survived was the game's photo-sharing and instant-messaging feature, which
the team cut loose and launched as Flickr in February 2004. Yahoo acquired it in March 2005
for a price never officially confirmed (widely reported in the low twenties of millions).
Both founders have told the story on the record, and it set up the strangest repeat in
startup history — Butterfield did the same thing again with his next failed game.

Lesson: When the product dies, check whether its best feature is a company.
Veracity: first-person
Sources:
- [Founders at Work — Caterina Fake chapter (Livingston, 2007)](https://archive.org/details/foundersatworkst00livi) — Fake first-person on Game Neverending running out of road and Flickr emerging from it.
- [Masters of Scale: Stewart Butterfield, The Big Pivot](https://mastersofscale.com/stewart-butterfield-the-big-pivot/) — Butterfield's recorded first-person telling of both game-to-product pivots.
Related laws: `2`

### 14. Twitter escapes Odeo, and Ev buys back the wreckage

Id: `twitter-from-odeo`
Era: 2005-2006
Companies: Odeo, Obvious Corp, Twitter
People: Evan Williams, Jack Dorsey, Biz Stone, Noah Glass

When Apple added podcasts to iTunes in mid-2005, Odeo's podcasting product lost its reason
to exist — and by Ev Williams's own admission the founders weren't podcast users themselves.
At a February 2006 hack day, Jack Dorsey's status-update idea became twttr, championed and
named by Noah Glass, launched publicly in July 2006 while still inside Odeo. That October,
Williams's Obvious Corp bought Odeo's assets — Twitter included — back from investors, who
were made whole on roughly $5 million; TechCrunch recorded the buyback at the time, noting
it was "much too early to tell" what Twitter was worth. The common retelling erases Glass,
who left with a modest gain.

Lesson: A dying product can still be bought back honestly — and the side project inside it may be the company.
Veracity: first-person
Sources:
- [Odeo Bought Back From Investors (TechCrunch, 2006-10-25)](https://techcrunch.com/2006/10/25/odeo-bought-back-from-investors/) — contemporaneous record of the buyback, investors made whole, Twitter among the assets, Glass's stake.
- [Ev Williams on The Tim Ferriss Show #800, transcript (2025-03-21)](https://tim.blog/2025/03/21/ev-williams-transcript/) — Williams first-person: iTunes blindside, the hack-day origin, the buyback.
Related laws: `2`

### 15. Instagram is Burbn minus everything

Id: `instagram-from-burbn`
Era: 2010
Companies: Instagram, Burbn
People: Kevin Systrom, Mike Krieger

Kevin Systrom's night-coding project Burbn — his own description: elements of Foursquare
check-ins crossed with Mafia Wars, hence the bourbon name — was an HTML5 check-in app that
raised $500,000 from Baseline and Andreessen Horowitz. After Mike Krieger joined, the two
stepped back, saw users ignoring the check-ins and using the photos, and cut everything
else: photos, comments, and likes stayed. "What remained was Instagram," Systrom wrote in
his own genesis account, noting the app "only took 8 weeks to build and ship, but was a
product of over a year of work." It hit number one free photography app within hours of its
October 2010 launch.

Lesson: Watch what users actually do in your product, then delete the rest of it.
Veracity: first-person
Sources:
- [What is the genesis of Instagram? (Kevin Systrom on Quora, c. 2011-01)](https://www.quora.com/What-is-the-genesis-of-Instagram) — Systrom's own written first-person account (login-gated; full text mirrored widely).
- [Inspiring insights by Kevin Systrom (Forbes, 2012-04-09)](https://www.forbes.com/sites/limyunghui/2012/04/09/inspiring-insights-by-instagram-ceo-kevin-systrom-the-man-who-built-a-1-billion-startup/) — openly readable secondary carrying the same quotes.
Related laws: `1`

### 16. Slack is Glitch's chat tool, and the memo said so

Id: `slack-from-glitch`
Era: 2012-2014
Companies: Tiny Speck, Slack
People: Stewart Butterfield

Tiny Speck announced the shutdown of its game Glitch in November 2012 — Stewart
Butterfield's second failed game — and kept the IRC-based internal chat tooling the team had
built to make itself. In July 2013, two weeks before the preview release, Butterfield sent
the team the memo later published verbatim as "We Don't Sell Saddles Here": Slack would sell
the dream ("the business of selling the dream of horseback riding"), organizational
transformation, not a feature list. Slack launched publicly in February 2014 and became the
fastest-growing business application of its era. The memo survives as a primary document of
how to position a pivot.

Lesson: Sell the transformation the tool enables, not the tool — and write that down for the team before launch.
Veracity: first-person
Sources:
- [We Don't Sell Saddles Here (Stewart Butterfield, Medium, 2014-02-17)](https://medium.com/@stewart/we-dont-sell-saddles-here-4c59524d650d) — the internal memo published verbatim; sent to the team July 2013, two weeks before Slack's preview release.
- [After Flickr, Startup Guru Smells The Sweet Success Of Failure (NPR, 2014-06-17)](https://www.npr.org/2014/06/17/322603410/after-flickr-startup-guru-smells-the-sweet-success-of-failure) — Butterfield first-person on the Glitch shutdown and pivot.
Related laws: `3`
Related processes: `shutdown_001`

### 17. Twitch is Justin.tv's fastest-growing category

Id: `twitch-from-justin-tv`
Era: 2007-2014
Companies: Justin.tv, Twitch, Amazon
People: Justin Kan, Emmett Shear, Michael Seibel, Kyle Vogt

Justin.tv began in 2007 as literal lifecasting — Justin Kan with a camera strapped to his
head — broadened into general live video, and plateaued. The founders bet the company on the
category that kept growing anyway: gaming, spun out as TwitchTV on June 6, 2011, with Emmett
Shear leading it. The Justin.tv brand was shut down in August 2014, weeks before Amazon
acquired Twitch for an announced $970 million in cash. Both Kan and Shear have told the arc
on the record: the plateau, the vertical bet, and the decision to put the whole company
behind the part of it that worked.

Lesson: When growth stalls, find the segment still growing despite you and bet the company on it.
Veracity: first-person
Sources:
- [How I Built This: Twitch — Emmett Shear (NPR/Wondery, 2022-07-18)](https://podcasts.apple.com/us/podcast/twitch-emmett-shear/id1150510297?i=1000569313324) — Shear first-person: the plateau, the gaming bet, the Amazon sale.
- [Justin Kan on when to pivot (Inc.)](https://www.inc.com/bryan-elliott/justin-kan-talks-twitch-startups-when-to-pivot-or-cut-bait-on-your-idea.html) — Kan first-person on the Justin.tv-to-Twitch decision.
Related laws: `17`

### 18. Grove and Moore fire themselves and walk back in

Id: `intel-exits-memory`
Era: 1985
Companies: Intel
People: Andy Grove, Gordon Moore

In mid-1985, with Japanese manufacturers destroying Intel's memory-chip business, Andy Grove
asked Gordon Moore: "If we got kicked out and the board brought in a new CEO, what do you
think he would do?" Moore answered without hesitating: "He would get us out of memories."
Grove: "Why don't you and I walk out the door, come back in and do it ourselves?" Intel
announced its exit from the memory business that October and completed the wrenching
transition to microprocessors over the following year — the episode Grove built his
"strategic inflection point" doctrine around, told in his own memoir.

Lesson: Make the decision a new CEO would make — you can be that outsider without losing the company's memory.
Veracity: first-person
Sources:
- [Only the Paranoid Survive (Andrew S. Grove, 1996), ch. 5 "Why Not Do It Ourselves?"](https://archive.org/details/onlyparanoidsurv00grov) — Grove's own account of the exchange and the exit.
- [Looking at problems from an outsider's perspective (Right Attitudes, 2017-03-28)](https://www.rightattitudes.com/2017/03/28/outsider-perspective/) — quotes the exchange verbatim with the book citation.
Related laws: `5`

## Near-death and survival

### 19. Airbnb's binder of maxed-out credit cards

Id: `airbnb-ramen-profitable`
Era: 2008-2009
Companies: Airbnb, Y Combinator
People: Brian Chesky, Joe Gebbia, Nathan Blecharczyk, Paul Graham

By the time Airbnb reached Y Combinator's winter 2009 batch, the founders had been funding
the company with a binder full of maxed-out credit cards. Paul Graham's own account records
what happened next: about three weeks into the batch their door-to-door work with New York
hosts started showing results, and on February 22, 2009 Brian Chesky emailed that they were
ramen profitable — which for the Airbnbs meant exactly $4,000 a month, $3,500 for rent and
$500 for food. Graham's congratulation drew a seven-word reply: "We are not going to slow
down." The famous "cockroaches" compliment attributed to Graham appears only in founder
retellings, not in his own writing.

Lesson: Ramen profitability is a number you can name — reach it and nobody can kill the company but you.
Veracity: first-person
Sources:
- [The Airbnbs (Paul Graham, 2020-12)](https://paulgraham.com/airbnbs.html) — pg first-person: the credit-card binder, the $4,000/month figure, the February 22 email, the seven-word reply.
Related laws: `18`, `23`, `30`
Related processes: `fund_007`, `qs_050`

### 20. Christmas Eve 2008, 6pm: Tesla closes with three days of cash

Id: `tesla-spacex-christmas-2008`
Era: 2008
Companies: Tesla, SpaceX, NASA
People: Elon Musk

In 2008 Elon Musk's two companies were dying at once. SpaceX's first three Falcon 1 launches
had failed, exhausting the money set aside for the program, before the fourth reached orbit
on September 28, 2008; on December 23, NASA announced SpaceX's roughly $1.6 billion
commercial resupply contract. Tesla's rescue financing — about $40 million of debt and
equity from existing investors, Musk included — closed, by his own telling, "at 6pm
Christmas Eve 2008. Last hour of last day possible, as investors were leaving town that
night & we were 3 days away from bankruptcy." He put in the last of his own money and
borrowed from friends to pay rent. The personal-finance details rest on Musk's telling; the
launch and contract dates are contemporaneous record.

Lesson: Survival can come down to one launch and one wire transfer — keep both companies alive until the calendar turns.
Veracity: first-person
Sources:
- [NASA awards CRS contracts to SpaceX and Orbital (NASA release C08-069 via SpaceRef, 2008-12-23)](https://www.spaceref.com/press-release/nasa-awards-space-station-commercial-resupply-services-contracts-to-spacex-and-orbital/) — contemporaneous record of the December 23, 2008 award (~$1.6B, 12 flights).
- [Musk's own account of the Christmas Eve close (Tesmanian, 2020-11)](https://www.tesmanian.com/blogs/tesmanian-blog/elon-musk-all-in-tesla-12-years-ago-from-an-almost-bankrupt-startup-to-the-most-valuable-automaker) — quotes Musk's November 2020 tweets: 6pm Christmas Eve, three days from bankruptcy, borrowing rent money.
Related laws: `18`, `30`
Related processes: `qs_050`

### 21. Pandora's 50 employees work two years unpaid

Id: `pandora-salary-deferrals`
Era: 2001-2004
Companies: Pandora
People: Tim Westergren

After the dot-com crash stranded Pandora (then Savage Beast Technologies), Tim Westergren
persuaded roughly fifty employees to defer their salaries — for some, close to two and a
half years, totaling roughly $1.5-2 million — while he pitched investors and was rejected,
by his own count, 347 times. The 348th pitch closed an approximately $8 million round in
March 2004, and the deferred pay was repaid first. Westergren acknowledges the scheme
violated California labor law and that he was threatened with penalties over it; the figures
all originate in his own retellings and have drifted between tellings, which is why they are
stated as ranges.

Lesson: Conviction can carry a team past any rational stopping point — know that salary deferral is also illegal, and pay it back first.
Veracity: first-person
Sources:
- [Founder of Pandora on lessons from near dot-com bust to billion-dollar IPO (First Round Review, 2015-02-03)](https://review.firstround.com/founder-of-pandora-on-lessons-from-near-dot-com-bust-to-billion-dollar-ipo/) — Westergren first-person: ~50 employees, ~2.5 years unpaid, eleven maxed credit cards.
- [How Pandora's founder convinced 50 early employees to work 2 years without pay (The Hustle)](https://thehustle.co/how-pandoras-founder-convinced-50-early-employees-to-work-2-years-without-pay) — built on his Hustle Con 2015 talk, with the recorded pitch to employees.
Related laws: `30`, `32`
Related processes: `qs_063`

### 22. PayPal names its fraud tool after the fraudster

Id: `paypal-fraud-war`
Era: 2000-2001
Companies: PayPal
People: Max Levchin, Peter Thiel, David Gausebeck

In 2000-2001 organized fraud nearly killed PayPal — by Max Levchin's telling, the company
"is being defrauded to the tune of over $10 million a month at one point," a retrospective
figure, not an SEC-documented one. One taunting Eastern European fraudster who went by Igor
emailed, "You try to rename form names in HTML and confuse me. My scripts are not confused.
I create 20,000 accounts today" — so PayPal named its fraud-monitoring tool Igor after him.
Levchin's team built statistical models with human review and the Gausebeck-Levchin test,
one of the first commercial CAPTCHAs; by the IPO, fraud was down to about 19 basis points,
and the tooling had become the moat competitors couldn't cross.

Lesson: The crisis that nearly kills you, instrumented and solved, becomes the moat.
Veracity: first-person
Sources:
- [Crucible Moments: PayPal (Sequoia, 2023)](https://sequoiacap.com/podcast/crucible-moments-paypal) — Levchin first-person: the $10M/month figure, the Igor email, 19 basis points by IPO.
- [Founders at Work, ch. 1: Max Levchin (Livingston, 2007)](https://archive.org/details/foundersatworkst00livi) — Levchin's book-length first-person account of the fraud war and the tooling.
Related laws: `32`

## Rejections and misses

### 23. Blockbuster declines to buy Netflix for $50 million

Id: `netflix-blockbuster-offer`
Era: 2000
Companies: Netflix, Blockbuster
People: Reed Hastings, Marc Randolph, Barry McCarthy, John Antioco

In September 2000, with the dot-com bust under way, Reed Hastings, Marc Randolph, and CFO
Barry McCarthy flew to Dallas and proposed that Blockbuster buy Netflix for $50 million and
run it as Blockbuster's online arm. By Randolph's account, when Hastings named the figure he
watched CEO John Antioco's mouth turn up at the corner: "John Antioco was struggling not to
laugh." Antioco disputes the telling — he says he only stopped by to greet the guests and
that no serious discussions took place — though both Netflix founders document the offer and
the decline in their books. Blockbuster filed for bankruptcy in 2010; Netflix outlived the
category it couldn't sell itself into.

Lesson: Incumbents will decline to buy you for less than they later lose to you — their laughter is not a valuation.
Veracity: first-person
Sources:
- [We Pitched Netflix to Blockbuster. They Laughed Us Out of the Building. (Built In excerpt of "That Will Never Work", 2019)](https://builtin.com/corporate-innovation/netflix-blockbuster-buyout) — Randolph's first-person prologue account of the Dallas meeting.
- [Fact check: Did Blockbuster turn down buying Netflix for $50 million? (Newsweek, 2021-03-11)](https://www.newsweek.com/fact-check-did-blockbuster-turn-down-chance-buy-netflix-50-million-1575557) — ruling "True," with Antioco's on-record denial of the meeting's seriousness.
Related laws: `30`

### 24. Excite passes on buying Google

Id: `excite-passes-on-google`
Era: 1999
Companies: Excite, Google
People: Larry Page, Sergey Brin, George Bell, Vinod Khosla

In 1999 Larry Page and Sergey Brin, wanting to return to Stanford, offered their search
engine to Excite, with backer Vinod Khosla brokering: the canonical telling (John Battelle's
"The Search") has them asking around $1 million and Khosla negotiating toward $750,000, and
CEO George Bell passing. Bell's own later account recalls different numbers and a different
dealbreaker — he says Page conditioned the deal on Excite ripping out its own search
technology and replacing it with Google's, which he judged culturally impossible. The fact
of the offer and the pass is attested by multiple participants; the exact price and the
decisive reason are disputed among witnesses recalling events six to fifteen years later, so
the figures should be treated as a range, not a fact.

Lesson: The most expensive pass in history was over integration pride, not price — and even its witnesses can't agree on the number.
Veracity: reported
Sources:
- [The real reason Excite turned down buying Google (Internet History Podcast, 2014-11-17)](https://www.internethistorypodcast.com/2014/11/the-real-reason-excite-turned-down-buying-google-for-750000-in-1999/) — Bell's first-person (self-interested) telling: the rip-out-Excite-search condition.
- [Why I passed on buying Google (CNBC, 2015-03-02)](https://www.cnbc.com/2015/03/02/dotcom-bubble-ceo-why-i-passed-on-buying-google.html) — Bell interview with yet different recalled figures, evidencing the dispute.

### 25. USV passes on Airbnb and keeps the cereal box

Id: `usv-passes-on-airbnb`
Era: 2009-2011
Companies: Union Square Ventures, Airbnb
People: Fred Wilson, Paul Graham

In 2009 Paul Graham lobbied Fred Wilson by email to fund Airbnb — "So invest in them!
They're very capital efficient" — and Union Square Ventures still passed. Wilson published
the mea culpa himself in 2011: "We couldn't wrap our heads around air mattresses on the
living room floors as the next hotel room," calling it "the classic mistake that all
investors make. We focused too much on what they were doing at the time and not enough on
what they could do, would do, and did do." The founders' box of Obama O's has sat in USV's
conference room ever since, and Wilson walks founders over to it whenever one says they
can't figure out how to raise their first $25,000.

Lesson: Investors price what you are doing; back yourself on what you could do — even great investors admit they miss it.
Veracity: first-person
Sources:
- [Airbnb (Fred Wilson, AVC, 2011-03-16)](https://avc.com/2011/03/airbnb/) — Wilson's own mea culpa with all quoted lines and the cereal-box ritual.
- [Airbnb email exchange (Paul Graham, 2009, published 2011)](https://paulgraham.com/airbnb.html) — the actual 2009 pg-Wilson emails.
Related laws: `32`
Related processes: `fund_001`

### 26. Facebook turns down Brian Acton, then pays $19 billion

Id: `acton-rejected-by-facebook`
Era: 2009-2014
Companies: Facebook, Twitter, WhatsApp
People: Brian Acton, Jan Koum

In the summer of 2009 Brian Acton, a former Yahoo engineer, was rejected by both companies
he applied to. May 23: "Got denied by Twitter HQ. That's ok. Would have been a long
commute." August 3: "Facebook turned me down. It was a great opportunity to connect with
some fantastic people. Looking forward to life's next adventure." The next adventure was
joining Jan Koum to build WhatsApp. On February 19, 2014 — four and a half years after the
tweet — Facebook bought WhatsApp for approximately $19 billion, the largest acquisition of a
venture-backed startup to that date. The tweets are still the primary record, preserved at
their original URLs and in the 2014 coverage.

Lesson: A rejection is a routing decision, not a verdict — answer it with grace and keep moving.
Veracity: documented
Sources:
- [WhatsApp co-founder got turned down for a job by Facebook (Slate, 2014-02-20)](https://slate.com/technology/2014/02/whatsapp-co-founder-brian-acton-got-turned-down-for-a-job-by-facebook.html) — quotes and links both contemporaneous tweets (statuses 1895942068 and 3109544383).
- [He wanted a job. Facebook said no, in a $19 billion mistake (Forbes, 2014-02-19)](https://www.forbes.com/sites/georgeanders/2014/02/19/he-wanted-a-job-facebook-said-no-in-a-3-billion-mistake/) — contemporaneous-to-the-deal coverage with the full tweet text.

## Ethos and culture

### 27. "No Ads! No Games! No Gimmicks!"

Id: `whatsapp-no-ads`
Era: 2009-2014
Companies: WhatsApp
People: Jan Koum, Brian Acton

WhatsApp's founding ethos is preserved in its own June 18, 2012 blog post "Why we don't sell
ads," which opens with Fight Club's Tyler Durden and argues that "when advertising is
involved you the user are the product" — at WhatsApp, engineers would spend their days on
messaging, and "your data isn't even in the picture." The company charged $1 a year instead.
The companion artifact — Brian Acton's note "No Ads! No Games! No Gimmicks!" taped at Jan
Koum's desk since around 2009 — traces to Parmy Olson's 2014 Forbes profile rather than a
founder's own post, so that detail rides on access journalism; the blog post itself is a
live primary document.

Lesson: Write the ethos down where users and employees can both see it — a business model is a promise about whose side you're on.
Veracity: documented
Sources:
- [Why we don't sell ads (WhatsApp blog, 2012-06-18)](https://blog.whatsapp.com/why-we-don-t-sell-ads) — the primary document, still live, with the quoted lines.
- [The rags-to-riches tale of how Jan Koum built WhatsApp (Forbes, 2014-02-19)](https://www.forbes.com/sites/parmyolson/2014/02/19/exclusive-inside-story-how-jan-koum-built-whatsapp-into-facebooks-new-19-billion-baby/) — Olson's profile, source of the desk-note detail (reported, not first-person).
Related laws: `16`

### 28. Amazon's desks are doors on 4x4s

Id: `amazon-door-desks`
Era: 1995
Companies: Amazon
People: Jeff Bezos, Nico Lovejoy

In the summer of 1995, early Amazon needed desks and was across the street from a Home
Depot; employee number five, Nico Lovejoy, recalls: "the doors were a lot cheaper, so we
decided to buy a door and put some legs on it." The door desk became Amazon's deliberate
symbol of frugality rather than a poverty necessity — Bezos had capital, and framed it
himself: "It's a symbol of spending money on things that matter to customers and not
spending money on things that don't." The company still gives a Door Desk Award for
well-built ideas that save money, and skeptics have noted the cheaper-than-desks math was
partly myth-making even as the artifact culture is real and observable.

Lesson: Pick a visible, physical symbol of what the company refuses to spend money on.
Veracity: first-person
Sources:
- [How a door became a desk, and a symbol of Amazon (About Amazon)](https://www.aboutamazon.co.uk/news/working-at-amazon/how-a-door-became-a-desk-and-a-symbol-of-amazon) — Amazon's own telling with Lovejoy's first-person quotes and the Door Desk Award.
- [Jeff Bezos' first desk at Amazon was made of a wooden door (CNBC, 2018-01-23)](https://www.cnbc.com/2018/01/23/jeff-bezos-first-desk-at-amazon-was-made-of-a-wooden-door.html) — Bezos's own framing of the symbol.
Related laws: `26`

## Cautionary arcs

### 29. Friendster's 40-second page loads

Id: `friendster-collapse`
Era: 2002-2009
Companies: Friendster, Google, MySpace
People: Jonathan Abrams

Friendster launched publicly in March 2003, got to millions of users first, and in late 2003
— at its investors' urging — declined Google's acquisition offer of roughly $30 million in
pre-IPO Google stock. Then the site buckled: the New York Times' board-level post-mortem
records pages taking "as long as 40 seconds to download" while the board debated new
features like internet calling instead of fixing performance, and users decamped to the
faster MySpace. Founder Jonathan Abrams has said on the record that assembling an all-star
board and investor group "was the curse of death." Friendster lost the US race by 2006,
refocused on Southeast Asia, and was sold to MOL Global in December 2009.

Lesson: Users leave over seconds, not features — a slow product loses to a worse, faster one.
Veracity: reported
Sources:
- [Wallflower at the Web Party (Gary Rivlin, The New York Times, 2006-10-15)](https://www.nytimes.com/2006/10/15/business/yourmoney/15friend.html) — the deeply sourced post-mortem: the Google offer, the 40-second pages, the feature-chasing board.
- [How to Kill a Great Idea! (Inc., 2007-06)](https://www.inc.com/magazine/20070601/features-how-to-kill-a-great-idea.html) — Abrams first-person on the "all-star team... curse of death."
Related laws: `1`

### 30. MySpace: $580 million in, $35 million out

Id: `myspace-arc`
Era: 2005-2011
Companies: MySpace, Intermix Media, News Corp, Specific Media, Facebook
People: Rupert Murdoch, Chris DeWolfe, Tom Anderson

In July 2005 News Corp bought Intermix Media, MySpace's parent, for $580 million, acquiring
the world's dominant social network at the moment of its dominance. Six years later, having
lost the product race to Facebook while being managed for ad-revenue targets, MySpace was
sold to Specific Media in June 2011 for approximately $35 million — largely in Specific
Media stock rather than cash — with about half its remaining 1,100 staff cut in the same
breath. Both transactions are contemporaneously documented; the arc is the canonical
demonstration that market leadership in a network business is rented, not owned.

Lesson: Being acquired is not winning — a social product managed for extraction loses to one managed for users.
Veracity: documented
Sources:
- [News Corp. to buy MySpace.com owner for $580 million (AP via RBJ, 2005-07-18)](https://rbj.net/2005/07/18/news-corp-to-buy-myspace-com-owner-for-580-million/) — contemporaneous record of the Intermix purchase.
- [MySpace goes to Specific Media for $35M (TechCrunch, 2011-06-29)](https://techcrunch.com/2011/06/29/myspace-goes-to-specific-media-for-35m-ceo-is-out-press-release/) — contemporaneous record of the sale and layoffs.
Related laws: `1`

### 31. Webvan commits $1 billion to Bechtel before proving one market

Id: `webvan-collapse`
Era: 1999-2001
Companies: Webvan, Bechtel
People: Louis Borders, George Shaheen

Webvan raised roughly $400 million in venture capital and another $375 million in its
November 1999 IPO — and had already, in July 1999, signed an agreement with Bechtel for up
to 26 automated distribution centers at expenditures its own SEC filing estimated at
"approximately $1.0 billion," before the model was profitable in even one city. It expanded
to many metros simultaneously, burned through the capital, and shut down on July 9, 2001,
firing 2,000 workers with about $830 million lost. The Bechtel commitment is preserved in
Webvan's own S-4: the scaling decision predates not just profitability but the IPO itself.

Lesson: Scaling is a reward for a proven unit economic, never a substitute for one.
Veracity: documented
Sources:
- [Webvan Form S-4 (SEC EDGAR, 2000)](https://www.sec.gov/Archives/edgar/data/0001092657/000109581100002103/s-4.txt) — the primary record of the July 1999 Bechtel agreement: up to 26 DCs, ~$1.0 billion estimated.
- [Webvan goes under (San Francisco Chronicle/SFGate, 2001-07-10)](https://www.sfgate.com/news/article/Webvan-goes-under-Online-grocer-shuts-down-2901586.php) — contemporaneous shutdown report: $830 million lost, 2,000 workers fired.
Related laws: `13`, `26`

### 32. Theranos runs the tests on other people's machines

Id: `theranos-fraud`
Era: 2003-2018
Companies: Theranos
People: Elizabeth Holmes, Ramesh Balwani, John Carreyrou, Tyler Shultz, Erika Cheung

Theranos publicly claimed its Edison device could run some 240 tests from a finger-prick of
blood; in reality the Edison handled only a dozen or so immunoassays, and most tests ran on
modified commercial analyzers with diluted samples. John Carreyrou's October 15, 2015 Wall
Street Journal investigation, built on whistleblowers Tyler Shultz and Erika Cheung, exposed
it. The SEC charged Holmes and president Ramesh Balwani in March 2018 with "massive fraud"
that raised more than $700 million — Holmes settled without admitting or denying the
findings — and a jury convicted her on January 3, 2022 on four counts of investor fraud; she
was sentenced to 11.25 years. The company dissolved in September 2018.

Lesson: Fake-it-till-you-make-it ends where other people's health and money begin — demos must be the product, not a hope.
Veracity: documented
Sources:
- [SEC press release 2018-41 (2018-03-14)](https://www.sec.gov/news/press-release/2018-41) — "Theranos, CEO Holmes, and Former President Balwani Charged With Massive Fraud"; the >$700M figure and settlement terms (sec.gov blocks non-browser fetches; verified via its search index).
- [Theranos founder Elizabeth Holmes found guilty of investor fraud (DOJ NDCA, 2022-01)](https://www.justice.gov/usao-ndca/pr/theranos-founder-elizabeth-holmes-found-guilty-investor-fraud) — the conviction record.
- [The original WSJ expose, Polk Award archive PDF (2015-10-15)](https://www.liu.edu/~/media/RedesignFiles/LIU%20Main%20Page/Polk/2015_Finance_TheWallStreetJournal.pdf) — openly readable copy of Carreyrou's contemporaneous investigation.
Related laws: `1`
