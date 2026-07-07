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
- **@anthropic-ai/sdk** — Claude (`claude-opus-4-8` by default) with streaming + adaptive thinking
- **Mock LLM provider** — deterministic offline analyst so the whole workflow runs end-to-end with no API key (all mock buyer names are fictional and flagged as illustrative)
- **pdf-parse** — pitch deck text extraction

## Setup

```bash
cp .env.example .env      # defaults work out of the box (mock provider)
npm install               # also runs `prisma generate`
npm run db:push           # create the SQLite database
npm run db:seed           # default settings + "ExampleAI" demo company
npm run dev               # http://localhost:3000
```

Optional smoke test (runs the entire pipeline headlessly and prints a summary):

```bash
npm run analyze:demo
```

### Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | SQLite path | `file:./dev.db` |
| `ANTHROPIC_API_KEY` | Enables real Claude analysis | _(empty → mock)_ |
| `LLM_PROVIDER` | Force `anthropic` or `mock` | auto |
| `ANTHROPIC_MODEL` | Model for all agents | `claude-opus-4-8` |
| `WEB_RESEARCH_PROVIDER` | Buyer research source | `mock` |
| `UPLOAD_DIR` | Deck storage | `./uploads` |

## Using the app

1. **New Company Analysis** — enter name/website/description, upload a deck PDF, add financial &
   customer notes, list excluded buyers, pick a confidentiality level, click **Run Analysis**.
2. Watch the pipeline progress step by step; you're redirected to the **company profile** when done.
3. **Buyer Universe** — review all buyers, exclude any you don't want (they drop from exports/reports).
4. **Scoring** — edit any of the 7 category scores inline; weighted score & tier recompute using
   your weights (editable in **Settings**, which also re-ranks everything).
5. **Theses** — read and edit buyer-specific acquisition theses.
6. **Outreach** — review drafts, edit inline, **Approve/Reject**, and track workflow status
   (`Needs Review → Approved → Sent → Interested / NDA Requested / Intro Call Scheduled …`).
   Editing an approved draft resets it to `Needs Review`; marking `Sent` without approval is blocked.
7. **Report** — the full packet with buyer tables; export **Markdown**, **buyer CSV**
   (Sheets-compatible), and **outreach CSV**.

## API routes

```
POST  /api/companies                                  create target company
GET   /api/companies                                  list companies
GET   /api/companies/:id                              profile + artifacts
POST  /api/companies/:id/upload-deck                  upload pitch deck (PDF)
POST  /api/companies/:id/run-analysis                 start the pipeline (async)
GET   /api/companies/:id/analysis-status              step-by-step progress
GET   /api/companies/:id/buyers                       buyer universe (+research/score/thesis)
PATCH /api/companies/:id/buyers/:buyerId              edit / exclude buyer
PATCH /api/companies/:id/buyers/:buyerId/score        manual score edit (recomputes tier)
PATCH /api/companies/:id/buyers/:buyerId/thesis       edit thesis
POST  /api/companies/:id/generate-outreach            (re)draft outreach
GET   /api/companies/:id/outreach-list                list drafts
PATCH /api/outreach/:id/approve | /reject             approval gate
PATCH /api/outreach/:id                               edit draft / set status
GET   /api/companies/:id/report   POST regenerates    final report
GET   /api/companies/:id/export.csv                   ranked buyer CSV
GET   /api/companies/:id/export.md                    report Markdown
GET   /api/companies/:id/export-outreach.csv          outreach CSV
GET/PATCH /api/settings                               weights, tone, exclusions
```

## Project structure

```
prisma/schema.prisma          data model (13 entities) + seed
scripts/run-demo-analysis.ts  headless end-to-end smoke test
src/lib/
  agents/schemas.ts           zod output schemas for all 12 agents
  agents/prompts.ts           agent prompt library + shared guardrails
  agents/run.ts               prompt→LLM→parse→validate→retry loop
  llm/                        provider abstraction: anthropic | mock
  research/                   pluggable web-research service (mock default)
  orchestrator.ts             the pipeline (progress tracking, batching, persistence)
  scoring.ts                  weighted scoring + tiering (user-editable weights)
  report.ts                   deterministic report builder
  csv.ts                      CSV exports
src/app/                      dashboard, new-analysis, company tabs, settings + API routes
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

## MVP limitations

- **Buyer research is not live.** Without an API key everything is mock; with a key, research is
  model-knowledge only — the `WebResearchService` interface is where a real web-search integration
  (e.g. Claude's server-side `web_search` tool or a search API) plugs in. Until then, all buyer
  facts must be externally verified (the UI and prompts say so).
- PDF export is not implemented (Markdown + CSV are); print-to-PDF from the report page works.
- Single-user, no auth — intended to run locally.
- Long analyses run inside the Next.js server process; a job queue would be the production upgrade.
- Contacts are modeled but there's no UI to manage them yet.

## What to improve next

1. Real web research provider (Claude `web_search_20260209` tool) with cited evidence per buyer.
2. Background job queue + resumable runs (retry a single failed agent).
3. PDF/DOCX export via headless Chromium or pandoc.
4. Contact management + CRM-style outreach sequencing per buyer.
5. Comparable-transactions database for the valuation agent.
6. Multi-user auth, audit log of approvals, and per-deal permissions.

## Assumptions made

- SQLite + local file storage is acceptable for an MVP run on the advisor's machine.
- `claude-opus-4-8` for every agent (configurable); batching (8 buyers/research call,
  12/scoring call) keeps outputs within reliable token limits.
- Mock-mode buyer names must be fictional to honor the "don't invent facts" guardrail —
  real-company suggestions require a real LLM provider.
