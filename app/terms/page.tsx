import type { Metadata } from 'next'
import Link from 'next/link'
import { REPO } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Terms of use — Ultrametric',
  description:
    'Ultrametric-specific terms: rankings and process guides are research, not professional advice; accuracy and third-party-link disclaimers; dataset copyright and reuse rules; trademark, dispute, and API terms — on top of the Ultrametric Terms of Service.',
}

// Static page — no data dependency, no dynamic segments. Plain-language terms: this page (plus
// DATA-LICENSE in the repo) is the single place the dataset copyright, reuse rules, watermark
// notice, and liability disclaimer live; footers and exports link here instead of restating.
// Site-specific risk coverage (not-professional-advice, accuracy, trademarks, third-party links,
// warranties/liability, dispute path, scraping/API) layers on top of the Ultrametric base Terms
// of Service at ultrametric.ai/tos. Strengthened to the standard comparison-site exclusions
// (founder 2026-10-02): no professional advice, no accuracy guarantee, no endorsement,
// third-party links, full warranty disclaimer + liability exclusion — in house plain English.
export const dynamic = 'force-static'

const SECTION = 'rounded-xl border border-zinc-800 p-4'
const H2 = 'text-sm font-semibold uppercase tracking-widest text-emerald-400'
const EXT_LINK = 'underline decoration-zinc-700 hover:text-emerald-300'

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-emerald-400">Terms</p>
        <h1 className="font-display leading-[1.1] mt-1 text-3xl font-bold tracking-tight">Terms of use</h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Plain-language terms for the Ultrametric site and datasets. The authoritative data license is{' '}
          <a
            href={`https://github.com/${REPO}/blob/main/DATA-LICENSE`}
            target="_blank"
            rel="noopener noreferrer"
            title="The data license on GitHub"
            className={EXT_LINK}
          >
            DATA-LICENSE
          </a>{' '}
          in the repository. How we handle data about you is on the{' '}
          <Link href="/privacy" className={EXT_LINK}>
            privacy
          </Link>{' '}
          page.
        </p>
      </div>

      <section className={SECTION}>
        <h2 className={H2}>The Ultrametric terms apply</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Ultrametric is a product of Ultrametric, Inc. Your use of it is governed by the{' '}
          <a
            href="https://ultrametric.ai/tos"
            target="_blank"
            rel="noopener noreferrer"
            className={EXT_LINK}
          >
            Ultrametric Terms of Service
          </a>{' '}
          — including its warranty disclaimers, limitation of liability, indemnification, governing law
          (Delaware), and dispute-resolution provisions. This page adds the Ultrametric-specific terms below;
          where the two differ on an Ultrametric-specific point, this page controls for Ultrametric.
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>Research, not professional advice</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Rankings, verdicts, scores, comparisons, and the process and situation guides on Ultrametric are
          research and editorial content: opinions derived from the cited public evidence at a point in time,
          produced by the process described in the{' '}
          <Link href="/methodology" className={EXT_LINK}>
            methodology
          </Link>
          . Nothing on the site or in the repository is professional advice — not legal, tax, accounting,
          financial, investment, immigration, procurement, or security advice. A guide here is not a
          substitute for a qualified professional who knows your facts; for decisions that matter, consult
          one. Before acting, verify against the cited evidence and the vendor&apos;s own documentation.
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>Accuracy: evidence, not guarantees</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Everything here is built from cited evidence, and we show our work — but we do not guarantee that
          anything is accurate, complete, or current. Scores change when evidence changes. Vendors change
          their products, prices, and plans. Government fees, forms, deadlines, and laws change after the
          as-of dates we cite. Products change faster than any dataset. If something looks wrong, flag it —
          the correction path is below.
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>No warranties, no liability</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Everything on Ultrametric is provided &quot;as is&quot; and &quot;as available&quot;, without
          warranties of any kind — express, implied, or statutory — including merchantability, fitness for a
          particular purpose, and non-infringement, to the maximum extent permitted by law. Ultrametric Inc
          accepts no responsibility for decisions — purchasing, procurement, investment, legal, tax, or
          otherwise — made in reliance on rankings, verdicts, scores, guides, or any other Ultrametric
          output. To the maximum extent permitted by law, Ultrametric Inc is not liable for indirect,
          incidental, special, consequential, or punitive damages, or for lost profits, revenue, or data,
          arising from the site or its datasets. The liability limitations and cap in the Ultrametric Terms
          of Service apply to Ultrametric. Some jurisdictions do not allow certain exclusions, so some of the
          above may not apply to you.
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>Trademarks, no endorsement</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Product names, logos, and brands that appear on Ultrametric belong to their respective owners and
          are used only to identify the products being compared. Listing or ranking a product — even at #1 —
          is not an endorsement, and does not imply the vendor&apos;s affiliation with, sponsorship of, or
          endorsement by Ultrametric Inc, or ours of them. Affiliations that do exist are disclosed: the
          standing one (the judge&apos;s own maker has a product in one arena) is in the methodology&apos;s{' '}
          <Link href="/methodology#bias-disclosure" className={EXT_LINK}>
            bias disclosure
          </Link>
          , and if we ever have a commercial relationship with a listed vendor, we disclose it on the
          relevant page.
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>Third-party links and documents</h2>
        <p className="mt-2 text-sm text-zinc-300">
          External links — vendor sites, evidence sources, and the open-documents chips on process steps
          (government forms, filing portals, law-firm resources) — go to third-party content we do not
          control. We link to the canonical source so you can check it yourself, but we are not responsible
          for what is on the other end, and a link is not an endorsement. Third-party sites have their own
          terms and privacy policies.
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>Disputes: flag it</h2>
        <p className="mt-2 text-sm text-zinc-300">
          If you are a vendor (or anyone else) who believes a verdict, score, or evidence record is wrong, the
          remedy is the public correction process: open a prefilled{' '}
          <a
            href={`https://github.com/${REPO}/issues/new?template=flag-verdict.yml`}
            target="_blank"
            rel="noopener noreferrer"
            className={EXT_LINK}
          >
            GitHub issue
          </a>{' '}
          and attach evidence URLs supporting the correction. Flags with evidence are re-judged against the
          same methodology as everything else. For trademark or takedown concerns, email{' '}
          <a href="mailto:legal@ultrametric.ai" className={EXT_LINK}>
            legal@ultrametric.ai
          </a>
          .
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>Copyright</h2>
        <p className="mt-2 text-sm text-zinc-300">
          The Ultrametric datasets — stories, evidence records, verdicts, claims, rankings, proofs, and popularity
          signals — are © 2026 Ultrametric Inc, all rights reserved.
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>What you may do</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Browse and query the data through the site and its public API. Quote individual verdicts, scores, or
          evidence excerpts, with attribution to &quot;Ultrametric by Ultrametric Inc
          (ultrametric.ai)&quot; and a link back. Use the data to evaluate, contest, or contribute
          corrections to Ultrametric.
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>What you may not do</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Bulk copying, republication, or resale of the datasets — or using them to build or train competing
          products or datasets — requires prior written permission from Ultrametric Inc. The same limits apply
          however you get the data: the public API, the published JSON files, the MCP server, or scraping the
          site. Automated access is fine at reasonable, rate-limited volumes for querying and quoting; it is
          not a bulk-export channel, and you may not circumvent rate limits or access controls.
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>Watermark</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Published dataset files carry a provenance watermark: a <code className="text-zinc-400">_provenance</code>{' '}
          object with a cryptographic fingerprint of the file&apos;s exact content. It lets us (and anyone else)
          verify that a republished copy came from Ultrametric — and spot copies that were altered.
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>Changes</h2>
        <p className="mt-2 text-sm text-zinc-300">
          We may update these terms as Ultrametric evolves; material changes show up here and in the
          repository history. Continued use after a change means you accept it. Questions:{' '}
          <a href="mailto:legal@ultrametric.ai" className={EXT_LINK}>
            legal@ultrametric.ai
          </a>
          .
        </p>
      </section>
    </div>
  )
}
