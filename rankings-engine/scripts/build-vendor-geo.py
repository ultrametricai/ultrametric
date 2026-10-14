# One-off (2026-09-28 GEO lane 2/2): write jurisdictions/vendor-geo.json — per-country region
# availability EVIDENCE for the top vendors of the six most geo-sensitive arenas
# (startup-banking, payroll, legal-ops, tax-automation, payments, accounting).
#
# Method (depth-wave precedent, evidence-first): every sourceUrl was crawl-verified live on
# 2026-09-28 (curl, browser UA where the site gates non-browser clients) and every note is
# grounded in what that page actually says — vendor help-center/docs pages preferred over
# marketing. Honest negatives are recorded ('unavailable'), and NO geo score is derived —
# this file documents availability, it never moves a judged number.
#
# Crawl notes (why some obvious sources are absent):
#   - mercury/justworks/airwallex help centers are Zendesk: content verified via their public
#     help-center JSON API (the html_url pages themselves serve 403 to non-browser clients).
#   - gusto.com and support.gusto.com hard-403 all non-browser clients; the crawlable Gusto
#     source is docs.gusto.com (the embedded-payroll developer docs), which carry the same
#     US-federal/state framing.
#   - quickbooks.intuit.com and intuit.com were unreachable to curl (timeout / 429) — QuickBooks
#     Online is deliberately ABSENT rather than carrying an unverifiable source (the
#     Northwest-registered-agent precedent: no unverifiable URL is fabricated).
#   - adyen.com exposes no crawlable availability statement — absent for the same reason.
import json

CHECKED = '2026-09-28'

ROWS = []

def add(arena, pid, src, entries):
    for country, status, note in entries:
        ROWS.append({
            'productId': pid, 'arenaId': arena, 'country': country, 'status': status,
            'sourceUrl': src if isinstance(src, str) else src.get(country, src['*']),
            'note': note, 'checkedAt': CHECKED,
        })

# --- startup-banking -------------------------------------------------------------------
MERCURY = 'https://support.mercury.com/hc/en-us/articles/28770467511060-Eligibility-and-requirements-for-opening-a-Mercury-account'
mercury_no = 'US entities only: "your company must be formed and registered in the United States or a U.S. territory" — international founders are supported, but only through a US entity.'
add('startup-banking', 'mercury', MERCURY, [
    ('US', 'available', 'Requires a company formed and registered in the United States or a U.S. territory; founders can live anywhere.'),
    ('UK', 'unavailable', mercury_no), ('IN', 'unavailable', mercury_no),
    ('DE', 'unavailable', mercury_no), ('FR', 'unavailable', mercury_no),
])

RAMP = 'https://support.ramp.com/get-started-with-ramp/apply-to-ramp'
ramp_no = 'No onboarding path for non-North-American entities: the help center\'s apply section covers "Qualifications to apply for Ramp (U.S. based)" and "Applying for Ramp as a Canadian business" only.'
add('startup-banking', 'ramp', RAMP, [
    ('US', 'available', 'The primary apply path: "Qualifications to apply for Ramp (U.S. based)".'),
    ('UK', 'unavailable', ramp_no), ('IN', 'unavailable', ramp_no),
    ('DE', 'unavailable', ramp_no), ('FR', 'unavailable', ramp_no),
])

BREX = 'https://www.brex.com/support/brex-account-requirements'
brex_no = 'US entities only: "All Brex applicants are required to have a US EIN issued by the IRS, a valid US incorporation, US operations, and a US physical address."'
add('startup-banking', 'brex', BREX, [
    ('US', 'available', 'Requires a US EIN, a valid US incorporation, US operations, and a US physical address.'),
    ('UK', 'unavailable', brex_no), ('IN', 'unavailable', brex_no),
    ('DE', 'unavailable', brex_no), ('FR', 'unavailable', brex_no),
])

RELAY = 'https://relayfi.com/faqs'
relay_no = 'US entities only: Relay serves "U.S. corporations, LLCs, general partnerships and sole proprietors" — owners can reside in 200+ countries, but the business needs a US operating presence.'
add('startup-banking', 'relay', RELAY, [
    ('US', 'available', 'Serves U.S. corporations, LLCs, general partnerships and sole proprietors; owners can be citizens/residents of 200+ countries.'),
    ('UK', 'unavailable', relay_no), ('IN', 'unavailable', relay_no),
    ('DE', 'unavailable', relay_no), ('FR', 'unavailable', relay_no),
])

WISE = 'https://wise.com/help/articles/2978049'
add('startup-banking', 'wise', WISE, [
    ('US', 'available', '"You can register and send money with Wise from most countries around the world" — US businesses fully served.'),
    ('UK', 'available', 'Fully served (Wise is UK-based); registration and business accounts available.'),
    ('DE', 'available', 'Fully served in the EEA via Wise Europe; registration and business accounts available.'),
    ('FR', 'available', 'Fully served in the EEA via Wise Europe; registration and business accounts available.'),
])
add('startup-banking', 'wise', 'https://wise.com/in/business/', [
    ('IN', 'partial', 'The India-facing business offering is "receive money from abroad" for freelancers and exporters — not the full multi-currency Wise Business account.'),
])

AIRWALLEX = 'https://help.airwallex.com/hc/en-gb/articles/4411298079129-What-features-and-products-are-available-in-my-registered-business-location'
add('startup-banking', 'airwallex', AIRWALLEX, [
    ('US', 'available', 'United States is a supported registered-business location (Global Accounts, FX & transfers, cards, payments).'),
    ('UK', 'available', 'United Kingdom is a supported registered-business location with the full product table.'),
    ('DE', 'available', 'Served via the "Europe" entity (EEA countries and Switzerland) with the full product table.'),
    ('FR', 'available', 'Served via the "Europe" entity (EEA countries and Switzerland) with the full product table.'),
    ('IN', 'unavailable', 'India is not among the registered-business locations Airwallex onboards (Australia, Hong Kong, UK, Europe/EEA+CH, US, Canada, Singapore, NZ, Malaysia, Israel).'),
])

# --- payroll ---------------------------------------------------------------------------
GUSTO = 'https://docs.gusto.com/embedded-payroll/docs/platform-overview'
gusto_no = 'US-only payroll: the platform and API are built around US federal, state, and local filings and the FEIN — no UK PAYE/RTI, EU, or India payroll.'
add('payroll', 'gusto', GUSTO, [
    ('US', 'available', 'Payroll with "all associated federal, state, and local filings and payments", including multi-state tax requirements.'),
    ('UK', 'unavailable', gusto_no), ('IN', 'unavailable', gusto_no),
    ('DE', 'unavailable', gusto_no), ('FR', 'unavailable', gusto_no),
])

DEEL = 'https://www.deel.com/'
deel_yes = '"Hire, pay, and manage teams in 150+ countries" — EOR plus native global payroll.'
add('payroll', 'deel', DEEL, [
    ('US', 'available', deel_yes), ('UK', 'available', deel_yes), ('IN', 'available', deel_yes),
    ('DE', 'available', deel_yes), ('FR', 'available', deel_yes),
])

RIPPLING = 'https://www.rippling.com/global-payroll'
rippling_yes = 'Global payroll — "pay employees and contractors around the world in a single system", with dedicated country-hiring pages (India, France, …).'
add('payroll', 'rippling', RIPPLING, [
    ('US', 'available', 'Home market; full payroll, HR, and IT platform.'),
    ('UK', 'available', rippling_yes + ' A localized en-GB site serves the UK.'),
    ('IN', 'available', rippling_yes), ('DE', 'available', rippling_yes), ('FR', 'available', rippling_yes),
])

JUSTWORKS = 'https://help.justworks.com/hc/en-us/articles/18040350606619-International-Contractors'
jw_partial = 'Contractors only: international contractor payments in 60+ countries (this one listed) — "International Contractors is not equivalent to Employer of Record"; local employees are not supported on the PEO.'
add('payroll', 'justworks', JUSTWORKS, [
    ('US', 'available', 'US PEO — payroll, benefits, and compliance for US employees.'),
    ('UK', 'partial', jw_partial), ('IN', 'partial', jw_partial),
    ('DE', 'partial', jw_partial), ('FR', 'partial', jw_partial),
])

# --- legal-ops -------------------------------------------------------------------------
CLERKY = 'https://www.clerky.com/'
clerky_no = 'US paperwork only: Clerky is "startup legal paperwork, including Delaware C corporation incorporation" — it does not form or maintain local entities elsewhere.'
add('legal-ops', 'clerky', CLERKY, [
    ('US', 'available', 'Delaware C corporation formation and startup legal paperwork, "designed exclusively for startups".'),
    ('UK', 'unavailable', clerky_no), ('IN', 'unavailable', clerky_no),
    ('DE', 'unavailable', clerky_no), ('FR', 'unavailable', clerky_no),
])

ATLAS = 'https://stripe.com/atlas'
atlas_partial = 'Usable FROM this country — but it only forms US Delaware entities ("a simple, powerful way to incorporate a US company"), never a local company.'
add('legal-ops', 'stripe-atlas', ATLAS, [
    ('US', 'available', '"Incorporate your startup in Delaware: C corp or LLC" — the product\'s home path.'),
    ('UK', 'partial', atlas_partial), ('IN', 'partial', atlas_partial),
    ('DE', 'partial', atlas_partial), ('FR', 'partial', atlas_partial),
])

DOCUSIGN_BASE = 'https://www.docusign.com/products/electronic-signature/legality/'
add('legal-ops', 'docusign', {'US': DOCUSIGN_BASE + 'united-states', 'UK': DOCUSIGN_BASE + 'the-united-kingdom', 'IN': DOCUSIGN_BASE + 'india', 'DE': DOCUSIGN_BASE + 'germany', 'FR': DOCUSIGN_BASE + 'france', '*': DOCUSIGN_BASE}, [
    ('US', 'available', 'Home market; ESIGN/UETA e-signature legality documented in DocuSign\'s own legality guide.'),
    ('UK', 'available', 'Available, with a dedicated UK e-signature legality guide (post-Brexit UK eIDAS).'),
    ('IN', 'available', 'Available, with a dedicated India legality guide: e-signatures recognized under the Information Technology Act, 2000.'),
    ('DE', 'available', 'Available, with a dedicated Germany legality guide (EU eIDAS; qualified signatures for the strictest use cases).'),
    ('FR', 'available', 'Available, with a dedicated France legality guide (EU eIDAS).'),
])

BEGLAUBIGT = 'https://beglaubigt.de/'
beg_no = 'Germany-only by design: online notarization and certification under German (and EU) law — the mirror image of the US-locked pattern.'
add('legal-ops', 'beglaubigt', BEGLAUBIGT, [
    ('DE', 'available', 'German online notarization/certification — "Wir bedienen jede Branche in Deutschland" — built on German and EU legal procedure.'),
    ('US', 'unavailable', beg_no), ('UK', 'unavailable', beg_no),
])

# --- tax-automation --------------------------------------------------------------------
AVALARA = 'https://www.avalara.com/in/en/products.html'
add('tax-automation', 'avalara', AVALARA, [
    ('US', 'available', 'Home market: US sales & use tax calculation, returns, and registrations.'),
    ('UK', 'available', 'AvaTax calculates "sales and use tax, VAT, GST and customs duties"; VAT returns & reporting products cover the UK.'),
    ('DE', 'available', 'VAT calculation and returns coverage; Avalara runs localized German-market pages (hreflang de).'),
    ('FR', 'available', 'VAT calculation and returns coverage; Avalara runs localized French-market pages (hreflang fr).'),
    ('IN', 'available', 'Avalara maintains a dedicated India site whose product catalog includes GST and cross-border ("Classification, VAT, GST, and customs management").'),
])

STRIPE_TAX = 'https://docs.stripe.com/tax/supported-countries'
add('tax-automation', 'stripe-tax', STRIPE_TAX, [
    ('US', 'available', 'Supported for US sales tax across the states.'),
    ('UK', 'available', 'United Kingdom supported: VAT, all product tax codes.'),
    ('DE', 'available', 'Germany supported via the EU VAT coverage in the supported-countries table.'),
    ('FR', 'available', 'France supported via the EU VAT coverage in the supported-countries table.'),
    ('IN', 'partial', 'India appears in the supported-countries data flagged beta ({"code":"IN","beta":true}) — not yet generally available.'),
])

ANROK = 'https://www.anrok.com/product/global-vat-gst'
anrok_yes = '"Digital-first tax coverage in 100+ countries" — registration, calculation, filing, remittance for VAT/GST.'
add('tax-automation', 'anrok', ANROK, [
    ('US', 'available', 'Home market: US SaaS sales tax across the states.'),
    ('UK', 'available', anrok_yes), ('DE', 'available', anrok_yes), ('FR', 'available', anrok_yes),
    ('IN', 'partial', 'GST coverage is claimed under the 100+ countries umbrella, but Anrok publishes no India-specific product page.'),
])

TAXJAR = 'https://developers.taxjar.com/api/reference/'
taxjar_no = 'Closed to new international use: "TaxJar has limited functionality for international calculations and it is only supported for users who have this feature currently implemented. If you need a global tax solution, you should consider Stripe Tax."'
add('tax-automation', 'taxjar', TAXJAR, [
    ('US', 'available', 'US sales tax compliance is the product ("sales tax compliance for more than 20,000 businesses").'),
    ('UK', 'unavailable', taxjar_no), ('IN', 'unavailable', taxjar_no),
    ('DE', 'unavailable', taxjar_no), ('FR', 'unavailable', taxjar_no),
])

# --- payments --------------------------------------------------------------------------
STRIPE = 'https://stripe.com/global'
add('payments', 'stripe', STRIPE, [
    ('US', 'available', 'Fully supported; direct signup.'),
    ('UK', 'available', 'Fully supported; direct signup.'),
    ('DE', 'available', 'Fully supported; direct signup.'),
    ('FR', 'available', 'Fully supported; direct signup.'),
    ('IN', 'partial', 'India is badged "Preview" on Stripe\'s global availability page — not generally available to new Indian businesses.'),
])

SQUARE = 'https://squareup.com/help/us/en/article/4956-international-availability'
square_no = 'Not supported: "Card payment acceptance with the Square app is currently available in the US, Canada, Australia, Japan, the United Kingdom, Republic of Ireland, France and Spain. We currently don\'t support payment card processing outside of these countries."'
add('payments', 'square', SQUARE, [
    ('US', 'available', 'Home market; full availability.'),
    ('UK', 'available', 'The United Kingdom is one of Square\'s eight supported countries.'),
    ('FR', 'available', 'France is one of Square\'s eight supported countries.'),
    ('DE', 'unavailable', square_no),
    ('IN', 'unavailable', square_no),
])

PAYPAL = 'https://www.paypal.com/us/webapps/mpp/country-worldwide'
add('payments', 'paypal', PAYPAL, [
    ('US', 'available', 'Home market; full business availability.'),
    ('UK', 'available', 'Listed with a full local PayPal site on the worldwide availability page.'),
    ('DE', 'available', 'Listed with a full local PayPal site on the worldwide availability page.'),
    ('FR', 'available', 'Listed with a full local PayPal site on the worldwide availability page.'),
])
add('payments', 'paypal', 'https://www.paypal.com/in/business', [
    ('IN', 'partial', 'PayPal India for business is positioned around international/export selling ("You can\'t do international business online without PayPal"), not domestic Indian payments.'),
])

PADDLE = 'https://www.paddle.com/'
paddle_yes = 'Merchant-of-record model: "Paddle manages payments, tax, compliance, and billing across 300+ markets" — Paddle is the seller of record, so local tax registration is theirs.'
add('payments', 'paddle', PADDLE, [
    ('US', 'available', paddle_yes), ('UK', 'available', paddle_yes + ' Paddle is UK-based.'),
    ('DE', 'available', paddle_yes), ('FR', 'available', paddle_yes),
])

# --- accounting ------------------------------------------------------------------------
add('accounting', 'xero', 'https://www.xero.com/us/', [
    ('US', 'available', 'Dedicated US edition.'),
])
add('accounting', 'xero', 'https://www.xero.com/uk/', [
    ('UK', 'available', 'Dedicated UK edition: "Xero is HMRC-recognised and MTD-compliant software".'),
])
ZOHO = 'https://www.zoho.com/books/'
add('accounting', 'zoho-books', {'US': 'https://www.zoho.com/us/books/', 'UK': 'https://www.zoho.com/uk/books/', 'IN': 'https://www.zoho.com/in/books/', 'DE': 'https://www.zoho.com/de/books/', 'FR': 'https://www.zoho.com/fr/books/', '*': ZOHO}, [
    ('US', 'available', 'Dedicated US edition.'),
    ('UK', 'available', 'Dedicated UK edition.'),
    ('IN', 'available', 'Dedicated India GST edition — "Manage GST, invoicing, expenses & more … India\'s trusted online accounting software".'),
    ('DE', 'available', 'Dedicated German edition.'),
    ('FR', 'available', 'Dedicated French edition.'),
])

ORDER = {'US': 0, 'UK': 1, 'IN': 2, 'DE': 3, 'FR': 4}
ROWS.sort(key=lambda r: (r['arenaId'], r['productId'], ORDER[r['country']]))

from collections import Counter
print('rows:', len(ROWS), '| products:', len({r['productId'] for r in ROWS}))
print('status:', Counter(r['status'] for r in ROWS))
print('by country:', Counter(r['country'] for r in ROWS))

with open('jurisdictions/vendor-geo.json', 'w') as f:
    json.dump(ROWS, f, indent=2)
    f.write('\n')
