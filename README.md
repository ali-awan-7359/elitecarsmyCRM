# Elite Cars Sales OS

A local research and outreach tool for **Elite Cars** (executive chauffeur and
premium client transport, Berkshire / Surrey / London). It finds real companies
in a fixed set of towns, enriches them with contact details, and sends
personalised B2B email from `ali@elite-cars.co.uk`.

Everything runs on your own machine. Data lives in a local SQLite file. Nothing
is sent anywhere except Companies House, the company websites you research, and
your own SMTP server.

---

## What it actually does

| Stage | What happens |
| --- | --- |
| **Research** | Queries the live [Companies House](https://developer.companieshouse.gov.uk) advanced-search API for registered, active companies in 18 target towns. Scores each one by SIC code for chauffeur relevance and writes a per-segment outreach angle. |
| **Exclusions** | Upload a CSV/XLSX of companies you must never contact. Matches are deleted from the workspace and blocked in all future research and every send. |
| **Enrichment** | Resolves each company's website, then crawls the homepage, contact/about/team pages and `sitemap.xml` to harvest emails and phone numbers. Every address is rated `high` / `medium` / `low` confidence. |
| **Send** | Sends via SMTP in throttled batches with per-recipient status tracking, automatic unsubscribe on both `List-Unsubscribe` headers and a visible link. |

### Target towns

Reading, Caversham, Tilehurst, Woodley, Wokingham, Winnersh, Bracknell, Theale,
Thatcham, Newbury, Crowthorne, Finchampstead, Farnborough, Camberley, High
Wycombe, Marlow, Slough, Basingstoke.

Configured in [`src/lib/target-areas.ts`](src/lib/target-areas.ts) along with the
SIC scoring rules and niche derivation.

---

## Setup

```bash
npm install
cp .env.example .env.local
```

Then fill in `.env.local`:

```bash
# Required — free key from https://developer.companieshouse.gov.uk
#   sign in -> create a LIVE application -> Create new key -> client type "API key"
COMPANIES_HOUSE_API_KEY=

# Required to send. Create an app password with your mail provider.
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=ali@elite-cars.co.uk
SMTP_PASS=

# Optional — Apollo enrichment, tried before website scraping.
# Without it, emails come from scraping and confidence is lower.
APOLLO_API_KEY=

# Public URL of this app, used to build unsubscribe links.
# Set to a real reachable host before sending to live prospects.
APP_URL=http://localhost:3000
```

`.env.local` is gitignored. Only `.env.example` is committed.

Run it:

```bash
npm run dev     # http://localhost:3000
npm run build   # production build
npm start       # serve the production build
```

---

## Email discovery: read this before you send

Companies House holds **no** website or email data. So by default the tool
guesses a company's domain from its name and scrapes it.

That is genuinely unreliable. It resolves large organisations correctly
(`Dominus Hospitality Management` → `hospitality@dominus.co.uk`) but will
sometimes match an unrelated business that owns a more obvious domain, and a
large share of small registered companies have no website at all.

Mitigations already built in:

- parked-domain, placeholder and error-page detection
- DNS pre-check so dead domains are skipped instantly
- company-name identity check against the fetched page
- `high` / `medium` / `low` confidence rating per address
- **the sender refuses `low` confidence rows by default**

If you want reliable data, set `APOLLO_API_KEY`. Apollo matches companies
properly instead of guessing, and everything it returns is rated `high`.
Website scraping then only fills gaps.

---

## Sending safely

Every message:

- identifies Elite Cars and says why it was sent
- carries a visible unsubscribe link plus a `List-Unsubscribe` header for
  one-click unsubscribe
- is checked against the exclusion list and unsubscribe list **at send time**,
  not just when queued

Sending is throttled (default 20 per batch, 2 minutes apart). Do not lower the
delay on a young domain — that is the fastest way to get `elite-cars.co.uk`
flagged. Unsubscribe links are built from `APP_URL`, so set it to something
reachable before your first live send.

UK B2B cold email is permitted under UK GDPR and PECR when you identify
yourself, are honest about why someone is receiving it, and offer a working
opt-out. All three are handled here. Volume judgement is still yours.

---

## Layout

```
src/lib/db.ts               SQLite schema, migrations, connection
src/lib/target-areas.ts     Towns, SIC scoring, niche derivation
src/lib/research.ts         Companies House queries
src/lib/email-discovery.ts  Domain resolution + scraping + confidence
src/lib/exclusions.ts       Exclusion and suppression lists
src/lib/mailer.ts           SMTP transport, throttling, campaign queue
src/app/api/sales/          Research, enrich, upload, send endpoints
src/app/api/leads/          Lead read/edit endpoint
src/app/api/export/         .xlsx and .csv export
src/app/api/unsubscribe/    One-click unsubscribe landing
```

The database is `data/elite-cars.db`, created on first run and gitignored.
Delete it to start over.