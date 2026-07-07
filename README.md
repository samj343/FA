# BuyerScope — AI-Powered M&A Buyer Discovery

BuyerScope is an agentic workflow for independent financial advisors / M&A advisors. It takes a
target company's materials (pitch deck PDF, website, description, financial notes) and produces a
structured **buyer-discovery packet**: company profile, market map, competitive landscape, a broad
buyer universe, ranked & scored buyers, buyer-specific acquisition theses, directional valuation
logic, outreach drafts, and an exportable report + spreadsheet.

It behaves like an AI junior M&A analyst: **it drafts, you decide.** Every output is editable, every
claim carries a confidence score, facts are separated from assumptions, and no outreach can be
marked "Sent" without explicit human approval. The system never contacts buyers.

## The agent pipeline

Input (deck + website + notes + financials) flows through 12 agents in sequence, with a human
review/approval layer at the end:

1. **Deck Intake Agent** — parses deck text + notes into structured facts (never invents data)
2. **Company Profile Agent** — banker-style executive summary and profile
3. **Financial Analysis Agent** — stage, valuation basis, missing-data flags (never a formal valuation)
4. **Market Mapping Agent** — category, tailwinds/headwinds, buyer categories
5. **Competitive Landscape Agent** — competitors, incumbents, substitutes, defensive acquirers
6. **Buyer Discovery Agent** — broad buyer universe across 7 buyer types (excluded buyers filtered)
7. **Buyer Research Agent** — per-buyer credibility research (batched; web research is pluggable)
8. **Strategic Fit Scoring Agent** — 7-category 1-10 scores; weighted score & tier computed in code from your configurable weights
9. **Valuation & Deal Logic Agent** — deal type, drivers, affordability (directional only)
10. **Synergy Thesis Agent** — buyer-specific acquisition theses for Tier 1/2 buyers
11. **Outreach Strategy Agent** — anonymous teaser, buyer emails, LinkedIn messages, call script, objection handling, follow-up
12. **Report Generation Agent** — deterministic Markdown packet built from your (possibly edited) data
13. **Human Review & Approval Layer** — mandatory; drafts start as `Needs Review`; `Sent` requires prior approval

Every agent receives a role, goal, rules, the shared guardrails (no invented facts, no fabricated
buyer interest, facts-vs-assumptions separation), the confidence rubric (90-100 strong evidence …
<50 speculative), and a strict JSON output schema validated with zod before anything is persisted.

## Stack

- **Next.js 14 (App Router) + React + TypeScript + Tailwind CSS** — full-stack app
- **Prisma + SQLite** — zero-setup local database
- **@anthropic-ai/sdk** — Claude (`claude-opus-4-8` by default) with streaming + adaptive thinking;
  optional live buyer research via Claude's server-side `web_search` tool
- **Mock LLM provider** — deterministic offline analyst so the whole workflow runs end-to-end with no API key (all mock buyer names are fictional and flagged as illustrative)
- **pdf-parse / pdfkit / docx** — deck text extraction and PDF/DOCX report export (all pure JS)
- **Cookie-session auth** — scrypt-hashed passwords, per-deal roles, audit log (no external auth deps)

## Setup

```bash
cp .env.example .env      # defaults work out of the box (mock provider)
npm install               # also runs `prisma generate`
npm run db:push           # create the SQLite database
npm run db:seed           # settings + admin user + demo company + example comps
npm run dev               # http://localhost:3000
```

Sign in with the seeded admin account — `admin@example.com` / `changeme123` (override via
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` before seeding; change the password after first login).

Optional smoke tests:

```bash
npm run analyze:demo           # runs the entire pipeline headlessly
npx tsx scripts/test-resume.ts # simulates a crashed run and verifies resume
```

### Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | SQLite path | `file:./dev.db` |
| `ANTHROPIC_API_KEY` | Enables real Claude analysis | _(empty → mock)_ |
| `LLM_PROVIDER` | Force `anthropic` or `mock` | auto |
| `ANTHROPIC_MODEL` | Model for all agents | `claude-opus-4-8` |
| `WEB_RESEARCH_PROVIDER` | `mock` or `anthropic-web-search` (live, cited buyer research via Claude's server-side web_search tool) | `mock` |
| `UPLOAD_DIR` | Deck storage | `./uploads` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Admin account created by db:seed | `admin@example.com` / `changeme123` |

## Using the app

1. **Sign in** (or register). Deals are private: you only see companies you're a member of.
2. **New Company Analysis** — enter name/website/description, upload a deck PDF, add financial &
   customer notes, list excluded buyers, pick a confidentiality level, click **Run Analysis**.
   Runs are queued and execute one at a time; if a run fails, **Retry from failed step** resumes
   it without re-running (or re-paying for) the completed agents.
3. **Buyer Universe** — review all buyers, exclude any you don't want (they drop from exports/reports).
4. **Scoring** — edit any of the 7 category scores inline; weighted score & tier recompute using
   your weights (editable in **Settings**, which also re-ranks everything).
5. **Theses** — read and edit buyer-specific acquisition theses.
6. **Buyer detail** — manage **contacts** (corp dev / product / CEO) and follow the CRM-style
   **outreach sequence** with a computed next action per buyer.
7. **Outreach** — review drafts, edit inline, assign a contact, **Approve/Reject**, and track
   workflow status (`Needs Review → Approved → Sent → Interested / NDA Requested / Intro Call
   Scheduled …`). Editing an approved draft resets it to `Needs Review`; marking `Sent` without
   approval is blocked. Approvals and edits are written to the **audit log** (Activity tab).
8. **Comparable Deals** — maintain your comps library; sector-matched entries are fed to the
   Valuation agent on every run (illustrative entries are labelled in output).
9. **Report** — the full packet with buyer tables; export **PDF**, **DOCX**, **Markdown**,
   **buyer CSV** (Sheets-compatible), and **outreach CSV**.
10. **Activity** — per-deal audit trail plus deal-team management
    (roles: owner / editor / viewer; viewers are read-only, enforced server-side).

## API routes

All routes (except `/api/auth/*`) require a session; company-scoped routes additionally
enforce deal membership (viewer = read, editor = write/approve, owner = manage team).

```
POST  /api/auth/register | /login | /logout           cookie-session auth
GET   /api/auth/me                                    current user
POST  /api/companies                                  create target company (creator = owner)
GET   /api/companies                                  companies you're a member of
GET   /api/companies/:id                              profile + artifacts
POST  /api/companies/:id/upload-deck                  upload pitch deck (PDF)
POST  /api/companies/:id/run-analysis                 queue the pipeline
POST  /api/runs/:runId/retry                          resume a failed run from its failed step
GET   /api/companies/:id/analysis-status              step-by-step progress
GET   /api/companies/:id/buyers                       buyer universe (+research/score/thesis/contacts)
PATCH /api/companies/:id/buyers/:buyerId              edit / exclude buyer
PATCH /api/companies/:id/buyers/:buyerId/score        manual score edit (recomputes tier)
PATCH /api/companies/:id/buyers/:buyerId/thesis       edit thesis
GET/POST/DELETE /api/companies/:id/buyers/:buyerId/contacts   buyer contacts
POST  /api/companies/:id/generate-outreach            (re)draft outreach
GET   /api/companies/:id/outreach-list                list drafts
PATCH /api/outreach/:id/approve | /reject             approval gate (audited)
PATCH /api/outreach/:id                               edit draft / set status / assign contact
GET   /api/companies/:id/report   POST regenerates    final report
GET   /api/companies/:id/export.csv|.md|.pdf|.docx    report + buyer-table exports
GET   /api/companies/:id/export-outreach.csv          outreach CSV
GET/POST/DELETE /api/companies/:id/members            deal team (owner manages)
GET   /api/companies/:id/audit                        audit trail
GET/POST/DELETE /api/comps                            comparable-transactions library
GET/PATCH /api/settings                               weights, tone, exclusions
```

## Project structure

```
prisma/schema.prisma          data model (18 entities incl. users/roles/audit/comps) + seed
scripts/run-demo-analysis.ts  headless end-to-end smoke test
scripts/test-resume.ts        resumable-run smoke test
src/middleware.ts             session gate (redirect pages / 401 APIs)
src/lib/
  agents/schemas.ts           zod output schemas for all 12 agents
  agents/prompts.ts           agent prompt library + shared guardrails
  agents/run.ts               prompt→LLM→parse→validate→retry loop
  llm/                        provider abstraction: anthropic | mock
  research/                   web research: mock | anthropic-web-search (cited)
  orchestrator.ts             queued, resumable pipeline (progress, batching, persistence)
  auth.ts / page-auth.ts      sessions, role guards, audit writer
  scoring.ts                  weighted scoring + tiering (user-editable weights)
  report.ts                   deterministic report builder
  export/                     markdown block model + PDF (pdfkit) + DOCX renderers
  csv.ts                      CSV exports
src/app/                      login/register, dashboard, company tabs (incl. Activity),
                              comps library, settings + API routes
```

## Guardrails baked in

- Prompts forbid invented facts, fabricated metrics/acquisitions, and claims of buyer interest.
- Every agent output includes `facts`, `assumptions`, missing-data lists, and a confidence score.
- The mock provider tags **all** of its output as illustrative, and buyer names it emits are fictional.
- Weighted scores/tiers are computed **in code**, never trusted from the model.
- Outreach: drafts only. Approval is required before a draft can be marked `Sent`; the app has no
  email integration and never contacts anyone.
- Excluded buyers (per-company and global) are filtered at discovery time and again defensively
  after generation.
- Every sensitive action (approvals, rejections, score/thesis edits, exclusions, run starts,
  membership changes) is written to an immutable per-deal audit log.
- Viewers are read-only, enforced in every write route server-side — not just hidden in the UI.
- Comps flagged "illustrative" are labelled as fictional in valuation output and never presented
  as real market data points.

## MVP limitations

- **Live web research quality depends on the provider.** With `WEB_RESEARCH_PROVIDER=
  anthropic-web-search` the Buyer Research agent receives cited, current notes per buyer; results
  should still be verified before outreach. In mock mode all buyer facts are fictional and flagged.
- The job queue is in-process (runs serialize within one server instance). Fine locally; a
  multi-instance deployment should swap `enqueue()` in `orchestrator.ts` for a real queue —
  the seam is one function.
- PDF layout is functional rather than beautiful (pdfkit, built-in fonts); the 14-column appendix
  table renders at a small font. DOCX opens cleanly in Word/Google Docs for restyling.
- Registration is open (anyone who can reach the server can create an account). Lock it behind an
  invite flow before hosting anywhere shared. Sessions are cookie-based without CSRF tokens —
  acceptable for a same-origin local tool, not for public hosting.
- Outreach sequencing derives the next action from statuses; there are no reminders/notifications.

## What to improve next

1. Invite-based registration, CSRF protection, and rate limiting before any shared hosting.
2. Swap the in-process queue for a durable one (DB-polled worker or Redis) with per-agent retries
   and token-usage accounting per run.
3. Follow-up reminders and an email-integration adapter (compose in your mail client via
   `mailto:`/Gmail deep links) — keeping the no-auto-send guarantee.
4. Comps enrichment: import from CSV, dedupe, and per-comp source links surfaced in the report.
5. Report theming (logo, firm name, cover page) for the PDF/DOCX exports.
6. Vector search over past deals/buyers so new analyses reuse prior research.

## Assumptions made

- SQLite + local file storage is acceptable for an MVP run on the advisor's machine.
- `claude-opus-4-8` for every agent (configurable); batching (8 buyers/research call,
  12/scoring call, 4/web-research call) keeps outputs within reliable token limits.
- Mock-mode buyer names must be fictional to honor the "don't invent facts" guardrail —
  real-company suggestions require a real LLM provider.
- Hand-rolled scrypt+cookie auth (no external identity provider) is appropriate for a
  single-team, locally-hosted tool.
