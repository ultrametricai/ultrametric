#!/usr/bin/env python3
# Startup-immigration arena bring-up (2026-10-02): append jurisdictions/vendor-geo.json rows.
#
# Semantics for THIS arena (US-inbound services, per the lane brief: "geo = origin-country
# support where published"): the US row records the vendor's US-immigration practice itself;
# non-US rows record what the vendor PUBLISHES for founders from — or destination moves into —
# that country. Every sourceUrl was crawl-verified live with the pipeline UA on 2026-10-02
# (same pass as the roster corpus check) and every note quotes or paraphrases only what that
# page actually says. No row is fabricated for a country a vendor never mentions (that is why
# most vendors carry only a US row — the honest sparse finding), and the one honest partial
# (Lighthouse/IN) comes from the vendor's own treaty-country list.
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P = os.path.join(ROOT, 'jurisdictions', 'vendor-geo.json')
A = 'startup-immigration'
C = '2026-10-02'

rows = json.load(open(P))
existing = {(r['productId'], r['country']) for r in rows}

NEW = [
    ('alma', 'US', 'available', 'https://www.tryalma.com/pricing',
     'US work-visa petitions are the product: published flat legal fees per US petition type (O-1 $8,000, H-1B $3,500, EB-2 NIW $10,000), RFE/NOID responses included.'),
    ('alma', 'IN', 'available', 'https://www.tryalma.com/learn/best-visa-options-startup-founders-india',
     'Publishes a dedicated guide for startup founders from India — O-1A, EB-1A, and EB-2 NIW strategies against the H-1B lottery and the India green-card backlog.'),
    ('lighthouse', 'US', 'available', 'https://www.lighthousehq.com/pricing',
     'US visa and green-card petitions with a published flat-fee menu (O-1A $10,000, H-1B $4,500, EB-1A/EB-2 NIW $15,000); no additional fees for RFE responses.'),
    ('lighthouse', 'UK', 'available', 'https://www.lighthousehq.com/blog/e2-treaty-countries',
     'Its own treaty-country guide documents UK nationals qualify for the E-2 investor route (treaty in force since 1815); nationality-neutral routes (O-1A, EB-1A, NIW) also offered.'),
    ('lighthouse', 'DE', 'available', 'https://www.lighthousehq.com/blog/e2-treaty-countries',
     'Germany is on Lighthouse’s published E-2 treaty-country list, alongside the nationality-neutral O-1/EB routes.'),
    ('lighthouse', 'FR', 'available', 'https://www.lighthousehq.com/blog/e2-treaty-countries',
     'France is on Lighthouse’s published E-2 treaty-country list, alongside the nationality-neutral O-1/EB routes.'),
    ('lighthouse', 'IN', 'partial', 'https://www.lighthousehq.com/blog/e2-treaty-countries',
     'Honest limit from its own pages: India is not an E-2 treaty country ("major economies such as India, China, Brazil, and Vietnam are not included"); Indian founders are served through the nationality-neutral O-1A/EB-1A/NIW routes instead.'),
    ('founder-law', 'US', 'available', 'https://founder.law/pricing/',
     'Silicon Valley founder-immigration practice (formerly Alcorn Immigration Law) with published flat packages: Strategy Session $1,500, Founder Visa $15,000, Talent Green Card $30,000.'),
    ('deel-immigration', 'US', 'available', 'https://www.deel.com/hr-services/employee-immigration/founders/',
     'Dedicated founders track for relocating to the US; absorbed Legalpad’s US visa processing (legalpad.io itself is offline).'),
    ('deel-immigration', 'FR', 'available', 'https://www.deel.com/blog/legalpad-joins-deel/',
     'Beyond US-inbound: Deel’s own announcement says it processes "more visas in more countries like France, Germany, the Netherlands, and Singapore" — destination-country immigration no other roster vendor offers.'),
    ('deel-immigration', 'DE', 'available', 'https://www.deel.com/blog/legalpad-joins-deel/',
     'Germany named in Deel’s own visa-processing expansion announcement; destination-country sponsorship through Deel entities.'),
    ('deel-immigration', 'IN', 'available', 'https://www.deel.com/blog/business-immigration-law-enterprises/',
     'Deel’s own blog: "processed thousands of visas across 50 countries — including our most recent openings in India, Argentina, and Uruguay" (destination-country support).'),
    ('plymouth-street', 'US', 'available', 'https://www.plymouthstreet.com/products',
     'US founder visas (O-1A, TN, H-1B, L-1, E-2) and green cards (EB-1A, NIW); claims 25% of Forbes’ 2025 Top 50 AI startups as customers.'),
    ('casium', 'US', 'available', 'https://www.casium.com/for-individuals',
     'US work visas and green cards (H-1B, O-1, L-1, TN; EB-1A/B/C, NIW) with a free visa assessment for individuals.'),
    ('legalos', 'US', 'available', 'https://www.legalos.ai/persona/legalos-for-startups',
     'US employment visas and green cards for startups (H-1B, O-1, TN; EB-1A, NIW) with free public tools: an O-1A eligibility checker and a USCIS fee calculator.'),
    ('siskind-susser', 'US', 'available', 'https://www.visalaw.com/our-practice-areas/startups-entrepreneurs/',
     'Dedicated Startups & Entrepreneurs practice area at a national US immigration firm (est. 1994); its lawyers literally wrote the book "Immigration for Startups".'),
    ('ellis-porter', 'US', 'available', 'https://www.ellisporter.com/high-skilled-immigration/',
     'US high-skilled immigration practice centered on self-petition routes — O-1, EB-1A/EB-1B, and NIW — from Michigan offices.'),
    ('daryanani-law', 'US', 'available', 'https://dlgvisa.com/what-we-do',
     'NYC boutique (since 1993) for talent-based US work visas across tech, media, and creative industries; publishes entrepreneur visa-options guidance.'),
    ('green-and-spiegel', 'US', 'available', 'https://gands.com/en-us/u-s-immigration/business-immigration/small-business-and-start-ups/',
     'Explicit Small Business and Start-ups practice in its US division; immigration-only firm for 60+ years. Also runs a Canadian Start-up Visa practice (outside this five-country set) — the only roster firm with a published non-US founder-visa program.'),
]

added = 0
for pid, country, status, src, note in NEW:
    if (pid, country) in existing:
        print(f'skip existing: {pid}/{country}')
        continue
    rows.append({'productId': pid, 'arenaId': A, 'country': country, 'status': status,
                 'sourceUrl': src, 'note': note, 'checkedAt': C})
    added += 1

# ensure_ascii=True matches the file's committed house format (build-vendor-geo.py wrote it
# with escaped non-ASCII); keeping it avoids a 189-row re-escaping diff.
with open(P, 'w') as f:
    json.dump(rows, f, indent=2, ensure_ascii=True)
    f.write('\n')
print(f'appended {added} rows; total {len(rows)}')
