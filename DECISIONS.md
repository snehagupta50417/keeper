# Decisions

Implementation decisions, newest last. The early entries (M0–M3) followed the hackathon plan `BACKEND_PLAN.md`, which was later folded into LLD §21 and removed (it is in git history).

> **Note (17 Oct 2026):** the tests described under M1–M3 (Vitest route tests with a temporary SQLite DB, `test/live-ai.test.ts`, the Playwright run) were **not committed** — `frontend/test/` does not exist in the repository. Treat those results as unverified until the tests are committed (LLD §19, build step B1). *(Later the same day a new suite was committed — see the entries from issue #31 onward; 106 tests and CI as of the "Free tier only" entry.)*

## M0 — Security cleanup

- **Plan v2 replaces the Phase 1 plan** at `BACKEND_PLAN.md` (same path, so there's one source of truth).
- **Repo visibility:** `tash149/financial-legacy` is **private** (checked 16 Oct 2026).
- **npm, not bun:** `package-lock.json` added; scripts rewritten so Cloud Run buildpacks can run `npm run build` / `npm start`:
  - `build` = `prisma generate && next build`
  - `start` = `prisma db push --skip-generate && next start` (creates the SQLite schema on a fresh instance; `next start` reads `$PORT`)
  - `postinstall` = `prisma generate`
- **`output: "standalone"` removed** from `next.config.ts`. It was only for the sandbox's Caddy + `bun server.js` runtime and conflicts with `next start`.
- **`typescript.ignoreBuildErrors` removed.** `tsc --noEmit` passes. The only errors were in `examples/websocket` (unused sandbox template importing socket.io), now excluded in `tsconfig.json` pending deletion.
- **`*.db` git-ignored**; `.env.example` added and un-ignored.
- **`/api/health`** added (unauthenticated, `{ status: "ok" }`).
- **Known lint errors (not fixed):** 2 `react-hooks/set-state-in-effect` errors in stock shadcn files (`components/ui/carousel.tsx`, `hooks/use-mobile.ts`). The build does not run lint, so they don't block it.
- **`custom.db` is untracked and the sandbox leftovers are removed** (`Caddyfile`, `.zscripts/`, `examples/`, `tests/*-runtime-*.sh`, `tool-results/`, `mini-services/`, `upload/`, `bun.lock`).
- **History purge is not done by the agent.** Rewriting `main` and force-pushing is outside the agent's branch permissions. The owner runs `git filter-repo --path frontend/db/custom.db --invert-paths` on a mirror clone (see the hand-off note).

## M1 — Gemini swap

- **`z-ai-web-dev-sdk` removed; `@google/genai` added.** New layer in `src/server/ai/`: `provider.ts` (interface), `gemini.ts`, `fixture.ts` and `index.ts`. `index.ts` keeps the old `complete` / `completeJson` / `completeWithHistory` API so the routes barely changed.
- **Auth order:** `GEMINI_API_KEY` first, else Vertex AI via `GOOGLE_CLOUD_PROJECT` (ADC on Cloud Run), else "not configured". "Not configured" returns `ok:false`, so the existing graceful degradation applies.
- **Bug 4 fixed:** the system prompt goes in `config.systemInstruction`. JSON calls also set `responseMimeType: application/json`.
- **Vision-ready:** `completeJson(..., { images })` sends inline images on the last user turn (used in M4).
- **Timeout:** `AI_TIMEOUT_MS`, default 45s, through `AbortSignal`.
- **Rate limit:** in-memory fixed window per session (`RATE_LIMIT_AI_PER_MINUTE`, default 20). It covers intake, documents, ask, draft and checklist, and returns 429 `{error}`. It's per instance, which is acceptable for v0.
- **Tests:** vitest with a throwaway SQLite DB (`test/.tmp`); route handlers are called directly.
- **Fallback classifier bug fixed (found by the tests):** `\breject\b` never matched "rejected", so the built-in example "My insurance claim was rejected" was misclassified. Word stems now allow suffixes.
- **Model:** `GEMINI_MODEL` (default `gemini-flash-latest`) plus `GEMINI_FALLBACK_MODELS` (default `gemini-3.5-flash,gemini-flash-lite-latest`). On 16 Oct the `*-latest` aliases often returned 503 "high demand" and `gemini-2.5-flash` returned 404 (retired); `gemini-3.5-flash` answered in about 1s.
- **Retry policy:** transient errors (429/5xx/UNAVAILABLE) get one retry after 800 ms, then the next model; 404 skips straight to the next model; anything else fails fast. All of it stays inside the 45s timeout.
- **Verified live:** `test/live-ai.test.ts` (runs only with `LIVE_AI=1`) passed against the Gemini API for both text and JSON. Normal test runs never call a model.

## M2 — Schema and trust gates

- **Layout:** server-only code moved to `src/server/` (plan §12). `src/lib/` keeps only client-shared code (`types.ts`, `client.ts`, `utils.ts`).
- **Schema:** all §5 models were added in one migration: `DeceasedPerson`, `Claimant`, `Proof`, `Signal`, `Institution`, `ClaimPack`, `Draft`, `QaMessage`, `ResourceVisit`, `InstitutionClaim`, `CheckResult`. Later milestones add no further schema churn. *(Superseded 17 Oct 2026: LLD §5.2 adds `Observation`, per-field review (built as `DocumentField` + `FieldReviewEvent`), `Approval`, `Claim`, `Hold`, `LegacySnapshot`, `TrustedContact`, `User` and `AssetRecord.evidenceStatus` for the PRD MVP.)* Enums are documented in the schema and enforced by Zod at the API.
- **Journey kinds:** `living_individual` and `estate_planning` are **personal**; they need only G1, and the user's own assets are shown in full. `caregiver` needs G1 and then G3, where G3 is the relative's recorded consent (`method: relative_consent`, which also writes a `ConsentRecord`). Everything else, including unclassified `general`, takes the strict G1 → G2 → G3 path.
- **Guard:** `src/server/core/access.ts` (`caseAccess` / `assetAccess` / `documentAccess` with `owner | discovery`).
  - Foreign IDs return 404.
  - Locked gates return **403** `{error, nextGate}`.
  - Frozen cases return **423** `{error, frozen: true}`.
- **What "no asset data below G3" means:**
  - The workspace returns `assets: []` and `documents: []`.
  - Asset and document write routes return 403.
  - AI prompts (ask, draft, checklist) only see the masked, visible view.
  - Intake no longer creates asset clues before discovery; institutions mentioned in chat are appended to `assumptions` ("to be checked once discovery is unlocked").
- **Masking below G4:** the API keeps institution, category, value band, last-4, statuses and confidence. `maskedRef` becomes `••••1234` and `holderName` is hidden. `evidence` has identifiers and exact amounts redacted. `notes` (the user's own text) is kept.
- **Read, extract, forget:**
  - Document `rawText`, extracted field values/excerpts and clue references are passed through `redactIdentifiers` **before storage**.
  - What gets redacted: digit runs of 6+, grouped numbers of 8+ digits, Aadhaar, and PAN.
  - What is kept: dates.
- **PAN:** stored only as an HMAC (`PAN_HASH_SECRET`, required in production).
- **One case per deceased:**
  - The same person means the same PAN hash, or the same DOB plus a name match.
  - A different session's case for the same person freezes **both** cases and links them (`linkedCaseId`). The same session re-submitting does not freeze.
  - **Demo cases are excluded** from cross-session matching; otherwise every visitor replaying the demo persona would freeze everyone else. The impostor story is shown in the Verify console instead (§8).
  - Unfreezing needs a reviewer action. That's not built yet and is planned with the M5 console. *(Updated 17 Oct 2026: unfreezing is an MVP operator action — LLD build step B9 — not part of the Later Verify console.)*
- **Mock providers:**
  - Identity: DigiLocker and passport + selfie, both simulated.
  - Death: the mock DigiLocker looks up a synthetic civil registry in `server/data/death-registry.ts`. Names not in that registry get a clearly-labelled simulated record built from the user's input. Scanned certificates are read by Gemini vision (or local OCR without a key) and compared by code.
  - Relationship: the heir's own document naming the deceased, checked with the name matcher. A legal-heir certificate or relative consent is simulated.
  - Entitlement: a simulated nominee or joint-holder record.
  - Every proof row stores its `provider` and a note saying it was simulated.
- **Name matching:** honorifics are dropped; initials, phonetic folding (sh/s, ee/i, w/v, doubled letters, trailing "a") and abbreviations (Mohd) are handled. A non-match always goes to `needs_review` and is never rejected.
- **Living-person guard:** `livingPersonActivity()` is implemented and tested (person-initiated events only). It gets wired to connector signals in M4.
- **Demos A/B/C** are seeded with their gates passed, using `demo_seed` proofs and a claimant, so they stay fully explorable.
- **Bugs fixed here instead of in their scheduled milestone:**
  - Bug 1 (history leak): history is now per case, and the reply uses the 6 *most recent* turns.
  - Bug 3: document PATCH responses now return parsed `extractedFields`.
  - Bug 5 (demo crash when all tasks are done).
  - Half of bug 7: magic-byte upload validation (`server/core/upload.ts`).
- **Images (Q9):** document uploads accept PNG, JPEG and WebP and are extracted by Gemini vision. Content type comes from sniffing the bytes, not from the client's MIME type.

## M3 — Gate UI

- **`components/fl/gate-panel.tsx`:** a stepper with Identity (DigiLocker, or passport + selfie for NRIs) → Death (DigiLocker fetch, or certificate scan) → Relationship (own document or legal-heir certificate; relative consent for caregivers).
  - Each step shows its latest proof. A review shows a "You entered / Record says" table.
  - Every mock is labelled "Simulated".
- **Workspace:** the gate panel sits above the tabs until discovery is unlocked. The Assets and Documents tabs show a locked state; a frozen case shows a "paused for review" card.
- **Asset cards:** masked assets show "Masked — full details after you prove you may claim this asset" and a **Prove entitlement** dialog (G4).
- **Intake:** the side panel shows the next gate as soon as the case opens.
- **Verified in a browser (Playwright, live Gemini):** intake → G1 → wrong date of death (manual review with a field table) → corrected → relationship via "R. K. Sharma" → discovery unlocked.

## Documentation alignment — 17 Oct 2026

Decisions taken while rewriting the document set (ONE_PAGER → PRD v0.6.2 → BRD v0.3.1 / LLD v0.5.1 → DESIGN v0.3.1):

- **Source of truth:** `ONE_PAGER.md`. The PRD defines product behaviour; the LLD defines how it is built and now describes this Next.js codebase. The old Python/FastAPI LLD and `contracts/` are superseded.
- **Audience:** everyone with Indian financial assets. **Pilot:** bereaved families (PRD D-01). HNI/UHNI/NRI families are a later segment.
- **MVP assets:** bank accounts and FDs, mutual funds, and life insurance. IEPF, shares, EPF, NPS, PPF and lockers are Later.
- **MVP discovery:** uploaded documents plus guided official searches (UDGAM, MITRA/MFCentral, insurer searches, the government common portal). Email, tax-record and SMS connectors are Later; mock connectors only in demos, labelled "Simulated".
- **Verify console:** Later (PRD FL-56); demo-only for the hackathon.
- **G3:** accepts any evidenced claimant role (relative, nominee, legal heir, executor, surviving joint holder) or a living person's consent.
- **Evidence statuses:** four statuses (`SELF_DECLARED`, `POTENTIAL_MATCH`, `DOCUMENT_BACKED`, `INSTITUTION_VERIFIED`) replace the current two fields (LLD §10.1).
- **Full identifiers:** stored as separately encrypted fields, readable only through the G4 guard (LLD §7.3) — to build.
- **Will drafting:** the Estate Planning tab's AI will draft becomes "Notes for your lawyer"; the product does not draft binding wills (PRD §3.3).
- **Claim submission:** the user approves the exact pack and submits it; the product records the receipt. `claim-packs/:id/submit` is replaced by `/approve` plus a receipt.
- **Running without a key:** add `AI_PROVIDER=fixture` so the reference build runs locally without cloud credentials (LLD §17.3).
- **Theme:** the app's current navy/teal theme is the standard (DESIGN §3.1); three contrast fixes are required (teal text on accent, gold as text, input borders).
- **Pre-Pilot documents** added in `docs/`: threat model, privacy (DPDP) assessment, AI evaluation plan, source-by-source validation matrix.
- **Claim rules verified (17 Oct 2026):** bank claims follow RBI Directions 2025 (₹15 lakh / ₹5 lakh simplified thresholds, 15 days, Bank Rate + 4%); mutual fund transmission follows SEBI's 23 Jul 2026 circular (quick ≤ ₹10,000, simplified ≤ ₹10 lakh, 21 days). Mutual funds gain a `quick` claim path (LLD §11.1).

## Platform decisions — 17 Oct 2026

- **Git history:** `frontend/db/custom.db` purged from all history with `git filter-branch`; `main` force-pushed (118 commits kept, current files identical); merged branches deleted. Copies may remain in the fork, in `tash149/financial-legacy`, and in GitHub's stored pull-request refs (GitHub Support must clear those).
- **Voice (D-09):** Google Cloud Speech-to-Text (Chirp) and Text-to-Speech. Launch languages: English (India), Hindi, Hinglish, Tamil. No raw audio retained. *(Superseded twice: by the research revision below, then by the free-tier rule — see "Free tier only".)*
- **Sign-in:** Google Identity Platform — phone OTP as the main method, Google sign-in as an option. `next-auth` not needed. *(Superseded by the free-tier rule: Google sign-in only — see "Free tier only".)*
- **Google Cloud:** existing project for development; a separate production project before the Pilot; region `asia-south1`. Setup in `docs/CLOUD_SETUP.md`.
- **Process:** every PR follows `CONTRIBUTING.md` (tests pass, FL IDs named, docs updated). The MVP build steps are issues #10–#20.

## Non-code files aligned — 17 Oct 2026

- `contracts/` deleted (superseded Python/FastAPI design; still in git history). References removed from PRD, LLD and README.
- Old prototype screenshots (`frontend/scripts/verify-*.png`), `frontend/worklog.md` and `frontend/download/README.md` deleted as sandbox leftovers.
- `BACKEND_PLAN.md` rewritten as v3 to match the one-pager, PRD and LLD: bereaved-family story first, upload + guided search before connectors, Verify and mock connectors labelled as demo-only Later capabilities, approve + receipt instead of "submit", MVP claim-pack templates (bank, mutual fund, LIC) with cited thresholds, bug and milestone status updated.
- `frontend/AGENTS.md` gains project rules for coding agents (outside the auto-generated Next.js block).
- `demo/README.md` rewritten: maps the demo's seven journeys to the PRD's three and lists what differs.

## Repo trimmed to what the product needs — 17 Oct 2026

- Removed `demo/` (standalone hackathon demo, not the product) and `BACKEND_PLAN.md` (hackathon plan; its milestones are summarised in LLD §21). Both remain in git history; to restore the demo locally: `git checkout 7672340 -- demo`.
- Everything else was reviewed and is needed: the documents, `docs/`, `frontend/` app and configuration, the banner and the PR template.

## Feasibility and compliance research — 17 Oct 2026

Four research passes (data protection law, licensing and integrations, official sources, Google Cloud and SMS), written up in `docs/FEASIBILITY_AND_COMPLIANCE.md`:

- **Fee model (PRD D-12):** flat or capped fees only; no percentage of recovered money; the family signs and submits; we never represent them before institutions.
- **Legal advice:** case-specific questions go to an advocate panel (Advocates Act s.33).
- **Identity (G1):** Aadhaar offline verification (UIDAI OVSE), PAN via a licensed KYC vendor, DigiLocker requester once approved. Aadhaar authentication, PAN API, CKYC and V-CIP are not open to us directly.
- **Account Aggregator:** not for deceased persons' data; at most a regulated partner for living users' own assets, Later.
- **Insurance timelines verified:** 15 days from intimation (45 if investigated), Bank Rate + 2% for delay (IRDAI Master Circular, 5 Sep 2024).
- **Data protection:** SPDI Rules apply today; DPDP Rules notified 13 Nov 2025, most duties from ~13 May 2027. Build to the 2027 standard now.
- **Voice (revises the earlier D-09 decision — confirmed by the founder):** Google Speech-to-Text is not available in India; prefer Gemini audio on Vertex AI in Mumbai for recognition, Google TTS in Mumbai for replies; Chirp outside India only as a disclosed fallback. *(Superseded by the free-tier rule: Vertex AI bills.)*
- **Sign-in (revises the earlier decision — confirmed by the founder):** OTP SMS needs TRAI DLT registration; prefer a DLT-registered Indian SMS gateway with our own OTP check (keeps phone numbers in India); Google sign-in stays as an option. *(Superseded by the free-tier rule: Google sign-in only.)*

## Cautious legal positions instead of a lawyer — 17 Oct 2026

No lawyer is available, so for each point the law leaves unclear the product follows the strictest reading (`docs/FEASIBILITY_AND_COMPLIANCE.md` §9, PRD §11.2): deceased persons' data fully protected and processed only with the claimant's consent plus documented authority; fraud checks always consented; the product never contacts co-heirs or nominees; full DPDP compliance by January 2027; institution forms and standard formats only, with legal questions referred out (including free legal aid on 15100 for families who qualify); no representation or claim-linked fees; **the Pilot is free**. A paid legal review is recommended before charging money or partnering with institutions.

## Realistic demo data — 17 Oct 2026 (issue #31)

- **Real public reference data**, fetched by `frontend/scripts/fetch-reference-data.mjs` from free sources and snapshotted in `frontend/src/server/data/reference/` (see its SOURCES.md): AMFI scheme master + mfapi.in NAV history (15 schemes), Razorpay IFSC dataset (~290 branches of 8 banks in 10 cities), India Post pincodes, RBI repo rate and Bank Rate.
- **Synthetic people, always-masked identifiers.** The generator in `frontend/src/server/data/synthetic/` never produces a full PAN, Aadhaar, account, folio or policy number; every document is labelled "SYNTHETIC SAMPLE — not issued by <institution>". A test enforces both.
- **Demo cases A, B, C rebuilt** with the same stories: real branches and IFSCs, fund values computed as units × real NAV on the statement date (with indicative value at today's NAV), scheme names as they were at the time, LIC plan names, and demo B changed from a fictional insurer's rejection to an LIC claim-requirements letter (IRDAI: no rejection for want of documents; delay interest at Bank Rate + 2% computed from the live Bank Rate).
- Added `frontend/test/global-setup.ts` (throwaway SQLite DB) so `npm test` runs; first tests in `test/synthetic-data.test.ts`.
- **Found while doing this:** `frontend/.gitignore` ignored the whole `test` folder, which is why the tests described under M1–M3 were never committed. It now ignores only `/test/.tmp`.

## Frontend round 1 — 17 Oct 2026 (issue #33)

- Product name in the UI is **Financial Legacy** (was "FinLegacy AI"); page title uses the tagline.
- Landing page rewritten to be calm and family-first: three journeys, four steps, five promises, honest official-sources section; investor-pitch sections removed.
- Asset cards show the **four evidence statuses** (derived per LLD §10.1) instead of "User-confirmed" and an AI-confidence bar; masked amounts read "₹ ••••".
- Contrast fixes from DESIGN §3.1 applied (`--accent-foreground` #0b6b6a, `--input` #8a9aab).
- Demo assets now link to their source document, so confirming one shows "Document-backed".
- Mobile: compact case header, sticky tab bar, plainer tab names (Assets, Steps, Planning, Get help), space for the floating Ask button.

## Frontend round 2 — 17 Oct 2026 (issue #35)

- **One route per area** (DESIGN §2.1) replaces the single page's view state. Case pages share `app/(app)/cases/[id]/layout.tsx`, which loads the case once (`GET /api/cases/:id`) and hands it to each area through React context; switching case clears the old one before the new one shows. The `x-session-id` session model is unchanged.
- **Plan or Claims, never both:** chosen from `holderLiving` (deceased holder → Claims). The wrong one redirects to the right one. Claims is an interim list of one card per holding (evidence status, entitlement, next saved step) until the claims screens are built; it never says we submit anything.
- **Per-field review states live in the browser for now.** The API stores one field list and a document-level `userVerified` flag, so the screen keeps Accept / Correct / Reject per field in memory and saves once with the existing `PATCH /api/documents/:id`: rejected values are dropped, corrections replace the value and keep the original source excerpt, and `userVerified` is set only when every field has a decision (Save is disabled until then, so a half-finished review is never saved as reviewed). Consequences until the server has review records (LLD §8): the previous value of a correction and the reason are not kept, a rejected value cannot be restored after saving, and nothing downstream is invalidated (FL-26 not complete).
- **New read-only `GET /api/documents/:id`** returns the stored text for the left-hand panel, re-redacted on the way out, behind the same gate as `PATCH`. Existing routes are unchanged; the workspace payload still carries no document text.
- **"Important" fields** (names, identifiers, ownership, amounts, dates, institution — FL-06) are recognised from the field label by a simple rule in `src/lib/field-review.ts`; the extractor should tag critical fields itself once its schema allows.
- **Mobile:** bottom navigation for Conversation, Records, Plan/Claims and Steps below 768 px; Get help stays one tap away under the case header; the floating assistant is desktop-only and sits inline in Conversation on mobile. Desktop uses tabs under the case header instead of DESIGN's sidebar for now.
- Fixed horizontal overflow at 375 px on the intake, official-portals and assets screens (grid/flex children without `min-w-0`).

## Frontend revamp — 17 Oct 2026 (issue #37)

Full authority to revamp the frontend from the one-pager's vision ("one capable assistant that remembers the case", not a financial dashboard). The PRD/DESIGN rules still bind: four evidence statuses, trust gates, masking, "Simulated" labels, never implying complete discovery or that we submit claims.

- **Six-step journey everywhere.** `src/lib/journey.ts` works out the one-pager's six steps (tell us → verify → discover → check and organise → prepare or claim → track) from saved data only. Discovery is shown as "in progress" with a count, never "done"; possible matches keep "check and organise" open. Shown in the desktop sidebar and, on mobile, inside Conversation.
- **Conversation is the case manager's home.** It opens with a deterministic summary (not an AI call) of where things stand, then action cards from `caseActions()` — while the gate is locked only verification is offered, while frozen only help. The assistant thread is not saved yet (needs `GET /api/cases/:id/messages`), and the UI says so.
- **Desktop sidebar** (DESIGN §2.3) replaces the round-2 tabs; mobile keeps the bottom navigation.
- **Readable by default** (DESIGN §3.2): body 16/17 px, 44 px controls, focus ring, reduced motion. Older screens had their text sizes raised by one mapping (e.g. 11 px → 13 px, 13 px → 15 px). Gold text replaced by `#7a5a1c` (gold fails contrast as text, DESIGN §3.1). The base `Card` no longer adds its own vertical padding, because every card in the app sets its own.
- **Landing starts the conversation.** The hero is a composer with the one-pager's three journeys as one-tap starters; added the six steps, pilot coverage (bank deposits, mutual funds, insurance — one-pager §10) and "What we can and can't do" (one-pager §8). The first message reaches `/start` through `sessionStorage`, read once and deleted, so the person's words never go into the URL.
- **Records** groups holdings by evidence status with possible matches apart (DESIGN §6); buttons say "Yes, this is theirs/mine" and "Not a match". Amounts show the masked band or "No reviewed value", never ₹0.
- **Plan** becomes "Your legacy record": holdings without amounts, a gaps checklist from `legacyGaps()`, a "who should be told" placeholder (not built — would send nothing), and "Notes for your lawyer". **The `will` draft kind is removed from `/api/ai/draft`** (the PRD rules out drafting wills); new kind `lawyer_notes`.
- **My cases** shows subject, goal, state and next step per case; no balances or document previews.
- Removed: `overview-tab.tsx`, `estate-tab.tsx`, the cases dialog.
- **Known limitation, not frontend:** without a model key the intake falls back to rules that classify "make sure my family can find everything" as recover-forgotten-assets.

## Intake fallback follows the three journeys — 17 Oct 2026 (issue #39)

- Without a model key the intake classifies by rules (`src/server/domain/intake-fallback.ts`, moved out of the route so it can be tested). The rules now cover the one-pager's three journeys: a death in the family → `family_death` (holder deceased); "what I have" in the first person → `living_individual` with the user as the living holder; "my family can find everything when I'm gone" → `estate_planning` (holder living). This replaces the known limitation noted under the frontend revamp.
- The person's own future death ("when I'm gone", "after my death") is planning, not a death in the family. "Will" counts only as a document ("my will", "write a will"), never the verb; a reported death now outranks will words. "Executor" moved from the will rule to the nominee rule.
- The holder is assumed to be the user only when no relative or "belonging to" is mentioned; otherwise it stays unknown and the reply still asks whether the holder is living. Follow-up questions match the journey (no death-certificate question for planning).
- The starter prompts live in `src/lib/starters.ts`, used by the landing page, the intake starters and the FL-01 test, so the test runs the exact words people send.

## OCR for photos and scanned PDFs — 17 Oct 2026 (issue #41)

- Photos and scanned PDFs are read on our own server with Tesseract (`tesseract.js`, WASM — no extra cloud service, no new data processor). Scanned PDF pages are rendered with unpdf + `@napi-rs/canvas` (first 5 pages, `OCR_MAX_PDF_PAGES`). Languages: English + Hindi by default; Tamil is `OCR_LANGS=eng+hin+tam`. Language data is downloaded once from the tesseract.js CDN and cached in the temp folder.
- With a Gemini key, photos still go to Gemini vision first (it reads Indian documents better); OCR is the fallback when there is no key or the model fails. Text from OCR is then structured by Gemini when available.
- Without AI, basic text rules pull out only clearly labelled facts: institution (known banks, fund houses, insurers, RTAs, depositories), account / policy / folio numbers (last 4 only), IFSC, names after labels like "Account Holder Name" or "Life Assured", balances, dates and nominee. Quality is never "good", every value carries a warning to check it, and an asset clue needs an institution plus a reference or balance — the same evidence rule the AI follows.
- OCR misreads digits (0→D, 1→I, 2→Z). Number-like tokens are cleaned before anything else so `redactIdentifiers` still masks them; stored text keeps only the last 4 digits as before.
- Known limits: handwriting, stamps and low-light photos read poorly; Hindi rules only cover Devanagari headings like मृत्यु प्रमाण. The family checks every field either way (FL-06).

## Grounded case assistant (RAG) — 17 Oct 2026 (issue #43)

- The case assistant now answers from retrieved sources with numbered citations instead of the model's memory. Two sources: a curated **procedure library** (`src/server/knowledge/library.ts`) written from docs/SOURCE_VALIDATION.md with each link and check date, and the case's own **document text** (only after the discovery gate, redacted). A procedure question with no source gets "I don't have a source for that", not a guess.
- **Hybrid search, no new service.** BM25 keyword search always runs; Gemini embeddings (`gemini-embedding-001`, 768 dims) add semantic matching when a key is set, merged by reciprocal-rank fusion. Vectors live in a `KnowledgeChunk` table as JSON on SQLite (the corpus is small — tens of passages plus a case's documents); on Cloud SQL the column becomes pgvector. Chosen over a hosted vector database to avoid a new data processor and keep tests offline.
- Embedding a case's redacted document text sends it to the same Gemini service already used for extraction — no new processor; synthetic data only until the Pilot (FL-46).
- "No nominee" and "nominee" lead to different procedures, so negations become their own search token and count double. The evaluation set found this; it is a test — each question must find its passage in the top 3, and top-1 accuracy must stay at or above 75%.
- Without a key the assistant returns the best-matching passages (with links) instead of failing. Citations to sources that weren't retrieved are removed by code; answers with no citation are flagged in the panel. Answers are now saved to `QaMessage` (reloading the thread is still to do).
- The library must change together with SOURCE_VALIDATION.md. A content hash per passage makes the stored copy update itself on the next question.

## Evidence statuses, field review, dated amounts and honest totals — 17 Oct 2026 (issue #14)

- **One status per holding, set only by code.** `AssetRecord.evidenceStatus` holds the PRD's four labels in lowercase (`self_declared`, `potential_match`, `document_backed`, `institution_verified`), matching the UI's existing names rather than the LLD's upper-case sketch. `rules/evidence.ts` re-derives it after every review or action; routes never set it.
- **Document-backed means confirmed *and* reviewed.** A clue stays a potential match until the family confirms it, and becomes document-backed only once the linked document's critical fields all have a decision and its account/policy/folio reference wasn't rejected. Demo holdings now start as potential matches, so the demo shows this flow honestly instead of pre-labelling them.
- **Per-field review lives on the server.** `DocumentField` holds each value's decision; `FieldReviewEvent` keeps every change (who, when, why, previous value). The page still lets people decide value by value and save, but now saves part-way too. The old PATCH that rewrote a document's whole field list is refused — it lost history.
- **Amounts are append-only observations.** Accepted or corrected money fields become dated observations (decimal strings, BigInt paise). A correction supersedes the old observation; nothing is overwritten or deleted. When one document lists several holdings (a CAS), an amount attaches only when its row or sibling row names the holding; otherwise it is left unattached rather than guessed.
- **"Cr" is credit, not crore.** Found on the synthetic PNB statement ("₹1,25,728.00 Cr"). Only spelled-out lakh / crore scale a number; "Dr" marks a debit.
- **Totals say why.** `rules/totals.ts` counts one latest dated balance or value per holding and lists every exclusion with a reason; no eligible amount means "Unknown", not ₹0. Below G4 amounts are hidden *and* left out of that person's total, so the total never leaks a hidden figure.
- **Duplicates are reviewed, never merged automatically.** Same institution + type family + last 4 digits creates a candidate. Merging is undoable and keeps the duplicate's evidence (it counts for the survivor). This replaces the old merge-by-name-prefix on upload.
- Old rows are upgraded on first read (`backfillCase`); `verificationStatus` stays in the schema for those rows only.

## Claims: procedures, paths, packs, approval and tracking — 17 Oct 2026 (issue #16)

- **Procedures are reference data with versions.** `src/server/procedures/procedures.ts` holds the bank (RBI Directions 2025), mutual fund (SEBI, 23 Jul 2026) and LIC (LIC + IRDAI master circular) procedures, written from docs/SOURCE_VALIDATION.md §3. Only what the source lists is "required"; what an institution *may* ask for is a note. A procedure older than 180 days or suspended sends claims to review. Insurers other than LIC have no procedure yet, so their claims go to review rather than borrowing LIC's.
- **Code picks the path; the family answers questions.** `rules/claim-path.ts` asks one question at a time (nominee, joint holder, rough amount, relationship) and prefers a checked, dated amount over an estimate. Disputes go to a person. The AI is not involved.
- **Approval is bound to a fingerprint.** The pack is hashed (SHA-256 over canonical JSON). An approval names that hash, the recipient, the channel ("submitted by you") and the purpose, and lasts 15 minutes. Any change — even a corrected document field the pack uses — makes a new version and cancels the approval. Drafts nobody approved are updated in place so the history only keeps versions that mattered (found when the first browser run produced six versions from six ticks).
- **Packs only at G4.** The pack shows names and amounts, so it is returned only once the person is entitled to that holding.
- **The PDF is a checklist and summary, not a form.** pdf-lib (MIT, pure JS) with standard fonts: "₹" is written "Rs." because the standard fonts lack the glyph. Full account numbers are never in it — the family writes them on the institution's form.
- **Submission is the family's act, and idempotent.** No receipt = "not sure it was received — check before re-sending". The due date is the submission date plus the procedure's days. Pre-submission steps are owned by the family without a due date: there is no external deadline to invent. A rejection is never counted as money recovered; a partial settlement keeps tracking the rest; reopening keeps earlier packs and events.
- **Nominee information on holdings.** `nomineeStatus` / `jointHolderStatus` come from the family's answers, the entitlement check, or a reviewed "Nominee" field (e.g. "Not registered" on the CAS marks that folio as having none).
- The journey rail counts claims: "Prepare claims" is current once a claim starts and done when every claimable holding's claim is submitted; "Track to the end" follows submitted claims to their outcomes.

## Free tier only, and a clean-up — 17 Oct 2026

- **Rule (founder):** use only free tiers and the free credits we already have; AI through a Gemini API key; deploy on Google Cloud. Written up, with each service's free limit and sources, in `docs/FREE_TIER_PLAN.md`; `docs/CLOUD_SETUP.md` rewritten to match.
- **Dropped because they bill:** Cloud SQL (no free tier; one 30-day trial only), Vertex AI (per use), Memorystore, phone OTP (SMS billed beyond 10 a day; DLT costs), Speech-to-Text beyond 60 free minutes, Cloud Storage outside US regions. The Vertex code path stays, unused, for a future paid setup; its default region is now `asia-south1`.
- **Sign-in:** Google sign-in through Identity Platform / Firebase Authentication — free up to 50,000 monthly users. Supersedes the phone-OTP decisions above.
- **AI data:** the unpaid Gemini tier lets Google use prompts to improve products, allows human review and forbids personal information. So: synthetic data only. Real cases either run with AI off (the app already works without a key) or wait for an approved paid tier — that would change this rule.
- **Database — open:** SQLite on Cloud Run is wiped on restart. Free options (a US-only `e2-micro` VM with Postgres, a free external Postgres, Firestore with a data-layer rewrite) each have a cost in residency, limits or work. B2 is on hold until the founder chooses.
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) runs type-check, lint, tests and a production build on every PR and push to main. Free within 2,000 minutes a month for a private repo. No secrets needed. The two remaining lint errors (shadcn `carousel.tsx`, `use-mobile.ts`) were fixed so lint can gate PRs.
- **Removed (unused):** the "Hello, world" API route; models `UserProfile`, `Signal`, `Institution`, `Draft`, `ResourceVisit`, `InstitutionClaim`, `CheckResult`; holding fields `verificationStatus`, `sourceSignalIds`, `institutionId`; packages `next-auth`, `next-intl`; env vars for connectors, the console key, demo mode and log level. Each returns with the feature that needs it. Package renamed `financial-legacy`.
- **Docs brought up to date** with what is built (OCR, RAG, B4, B6, tests, CI): LLD (v0.6), README, PRD (v0.6.3, new D-14), privacy assessment, threat model, feasibility, BRD and the factual lines in DESIGN.

## Keeper: new name and a conversation-first web app — 17 Oct 2026

- **The product is Keeper** (wordmark `keeper`). The old Financial Legacy screens (`src/app/(app)`, `src/components/fl`) were replaced; the backend, `src/lib` and all server code are untouched.
- **Self-contained prototype first.** The app runs on a client-side engine (`src/keeper/`) with synthetic data kept in `localStorage` (a display name and demo progress only — never real files or credentials). Reasons: it needs no paid API or key, every flow is testable offline, and the three journeys, case switching, resume and reset could be finished and verified in one pass. **Next step: wire it to the backend** (gates, evidence, claims, RAG, OCR), replacing the engine's in-browser state with API calls.
- **Deterministic demo assistant, labelled.** The assistant is rules, not AI, and says so ("Demo assistant"). It asks one question at a time, extracts what was already said (institutions, relationship, "but not his investments"), and never asks again for something confirmed. Facts keep a value, source (You said / Keeper inferred / Document / Sample record), date and one of seven states; "I don't know" becomes a follow-up task instead of a blocker.
- **Reuse, don't re-invent.** Claim paths, requirements and sources use the backend's pure `choosePath` rules and cited, versioned procedures, so Keeper never invents a requirement. Instead of importing the backend's pack hash (it uses Node crypto) the prototype fingerprints its own package; any change after approval cancels it.
- **Three journeys, three record types.** Discover and Prepare belong to "My financial record"; After-a-death opens a separate "Estate of …" record the moment it starts, so information is never mixed. Assets can be started on a claim directly, without searching first.
- **Honest labelling.** Guided searches are never shown as connections ("Connected sources: Unavailable"); a no-match result is scoped to that source; trusted contacts see nothing until chosen, with a preview, and release after death is not built; only synthetic sample documents are accepted; sign-in is mocked and says so.
- **Voice** uses the browser's own speech recognition: explicit start, disclosure before first use, editable transcript, clear denied/unsupported states, text fallback, spoken replies opt-in. No audio is stored by Keeper. Free, in line with the free-tier rule.
- **Imagery:** drawn illustrations instead of photographs (none could be licensed here). Swap in real photography later.
- Tests: `test/keeper.test.ts` drives the three flows and the cross-cutting rules through the reducer (14 tests); the old `case-nav` test went with the old UI.


## Backend integration through the original Keeper UI — 18 Oct 2026

- Preserve the original frontend. The separate replacement workspace was removed. `src/keeper/backend.ts` adapts existing API responses to Keeper state; the store queues server actions while the existing shell, conversation, voice, views and panels render them. Explore a sample keeps its offline engine.
- Server gates, evidence, masking, claim paths, packs and approval hashes are authoritative. UI draft metadata is owner-scoped and cannot authorize access or approve claims. No new dependency or paid service. *(The saved-state storage was changed the same day — see "Keeper saved state moved off the audit table" below.)*
- Added conversation resume and draft persistence endpoints, case fact correction, and owner/nomination fields on the existing asset editor endpoint. Synthetic upload uses the original paperclip. Original family drafts persist, but no invitation or real sharing is claimed.
- Existing FL-01, FL-03, FL-06–FL-09, FL-12–FL-16, FL-26–FL-29 and FL-36–FL-37 apply. Prototype authentication, simulated verification and synthetic-only data restrictions remain.


## Targeted Keeper refinement — 18 Oct 2026

- Preserve all landing sections, branding, illustrations, routes, shell and responsive layouts. Reduce repeated copy and status badges; share the actual chat-bubble component with the landing preview. Add compact record provenance, actual claim-stage, duplicate-comparison and access-preview visuals inside existing views. Listening motion appears only during active recognition and stops under reduced motion.
- Reuse the existing interviewer for one-question turns with saved context and volunteered details. Backend workspace data is refreshed before a response; only gated APIs can create holdings, evidence or claims. Unknown and skipped answers retain their state, and follow-up tasks persist independently of messages. Corrected family-preparation fallback classification.
- Preserve drafts, reading position and user-selected attachments. Selected files are stored locally in IndexedDB until upload succeeds or the user removes them. Retries stay bound to the original conversation. Signing out removes queued files. No new dependency, framework, provider, auth system, deployment or cloud configuration.
- Personal records contain no fixture-loading controls. The separate example workspace is identified once in the case selector; reference providers remain available for tests but the UI does not present them as live identity verification. Example submission previews have no invented reference or follow-up date.
- Model generation, semantic retrieval and image extraction require explicit processing permission through existing consent records and Settings. Keyword search and local extraction still work without permission. Approval uses the server package hash; self-reported submissions collect the date and any genuine receipt, and outcome evidence can be recorded.

## Keeper saved state moved off the audit table — 18 Oct 2026

- **Problem found in review:** the first backend wiring stored Keeper's conversation and draft state as JSON in a `CaseEvent` row that was overwritten on every save. That broke two documented rules: `CaseEvent` is the append-only audit trail, and identifiers are redacted before anything is stored (a full account number typed into the chat was kept verbatim). The workspace API also sent the whole blob back to the browser in `events`, relying on the client to hide it.
- **Fix:** one nullable column, `LegacyCase.keeperUi` (applied with `prisma db push`), owned by `src/server/domain/keeper-ui.ts`. Saving redacts identifiers in every free-text field (messages, facts, tasks, family instructions, plan notes), downgrades any `verified` / `document_supported` state and any `Document` / `Sample record` source (draft state is self-reported), and writes nothing to `CaseEvent`. The workspace `events` filter out `keeper_ui` rows; any old row is redacted, moved into the column and deleted on first read.
- **Same redaction applied to the other logs that kept raw text:** `IntakeMessage` (the model still sees the original in memory; only the stored copy is redacted) and `QaMessage` (question and answer).
- Tests: `test/keeper-ui-state.test.ts` (9) covers redaction before storage, stripped verification, no `CaseEvent` writes, events filtering, migration of old rows, ownership (404/401) and malformed input.

## Voice-first agent loop — 18 Oct 2026

- **What it is:** a full-screen "Talk to Keeper" screen that runs a loop: listen, understand (Gemini plans), act, confirm, speak, listen again, until the person is done, then close with a summary (what changed, one next step). It replaces the old dictation dialog; typing works on the same screen.
- **The model plans, code decides.** `POST /api/ai/agent` returns a spoken reply and at most four proposed actions from a fixed list (`remember`, `open`, `look_up`, `add_asset`, `confirm_asset`, `start_claim`, `complete_task`). `src/server/ai/agent.ts` validates every proposal: unknown actions and bad arguments are dropped, ids must exist in this case, holding actions are dropped while identity checks are incomplete (and the reply says so), free text is redacted, and a reply that claims a claim was submitted, filed or approved is replaced. Anything that changes the record is marked `confirm` and runs only after the person says or taps yes. Approving and sending a claim are never agent actions.
- **Factual questions are not answered from the model's memory.** `look_up` calls the existing cited RAG route, so answers still carry sources.
- **Free tier, no extra key.** Speech in and out use the browser's own Web Speech API (free, no key, disclosed before first use). The only key is the existing `GEMINI_API_KEY`, used server-side; the browser never sees it. Gemini Live was not used because it would put the key in the browser or need a streaming server.
- **Works without AI.** Not signed in, no AI opt-in, no key or a model outage: the same loop runs on the built-in interviewer, and `GET /api/ai/agent` lets the screen say honestly which mode it is in ("Gemini agent" or "Built-in guide"). The thread records each turn through the new `agent.turn` action (messages only; saved redacted via `keeperUi`).
- **Robustness:** speech output has a watchdog so a browser without a voice cannot stall the loop; a silent room returns to "tap to talk" instead of looping; the turn is sent after 1.4 s of silence; tapping the orb interrupts Keeper.
- Tests: `test/agent.test.ts` (21) covers vetting, consent, gates, redaction before the model, honesty guard, fallbacks, availability and the engine action. Not covered by automated tests: the microphone and spoken output (browser APIs).

## Backend split into its own service — 18 Oct 2026

- **Why:** the API lived inside the Next.js app (`src/app/api` + `src/server`), so the repository looked frontend-only and the two could not be built, scaled or deployed apart. LLD §21 M9 had reserved this move; it is now done.
- **Layout:** `backend/` (API: Hono, Prisma, Gemini, OCR; own `package.json`, tests and Prisma schema), `frontend/` (Next.js pages only), `shared/` (types and pure claim rules both use). Files were moved with `git mv`, so history follows them.
- **No rewrite of the handlers.** Route files are still standard `Request → Response` functions under `backend/src/api/**/route.ts`; `backend/src/app.ts` maps them to URLs (`[id]` → `:id`) and `src/index.ts` listens on `$PORT` (default 4000). The only change inside them was replacing `NextRequest` with the standard `Request`.
- **Frontend → backend:** the browser still calls same-origin `/api/*`; `frontend/next.config.ts` rewrites it to `BACKEND_URL` (default `http://localhost:4000`). No CORS, and `x-session-id` passes through. `BACKEND_URL` is fixed at build time.
- **Shared contract:** `shared/contracts.ts` holds `ClaimView` and the voice-agent action types, so the frontend no longer imports backend source (it used to reach into `@/server/...`). `shared/` imports nothing from either service. Path aliases: `@server`, `@api`, `@shared` (backend), `@`, `@shared` (frontend).
- **Tests:** 136 in `backend/test`, 23 in `frontend/test`. The Keeper adapter and refinement tests stay in `frontend/test/integration` because they exercise both sides; their config aliases the backend's route handlers and use a throwaway database.
- **Deploy:** two Cloud Run services from source (backend first, then the frontend built with `BACKEND_URL`). Both fit the free tier, but each API call is a request to both services, so the 2M monthly requests last about half as long (docs/CLOUD_SETUP.md).
- **Open:** the backend is public (as the API was); restricting it to the web app, and a shared store for rate limits, are still to decide. The backend has no ESLint yet; `tsc` covers it.
- Also: ESLint now ignores the git-ignored `frontend/artifacts/`.

## Guided example and a calmer first run — 18 Oct 2026

- **Problem:** "Explore an example" opened a fully loaded workspace (two cases, counts, a details panel with facts, family and next steps) with no orientation. It read as a dashboard, not as an assistant, and a new person had nothing to hold on to.
- **Guided example (`/welcome`):** "Explore an example" now opens "See how Keeper works". The person picks a situation (a family member has died, lost track of accounts, preparing for family) and watches one turn of Keeper's loop with fictional people, one screen per beat: the person speaks, Keeper understands, acts, asks before anything that matters, then closes the loop with what changed and one next step. The five beats are the same rail the voice agent screen uses, so the first thing a person learns is how the real product behaves. Content is scripted data in `src/keeper/tour.ts`, labelled "Example · fictional people", skippable at any time, keyboard and screen-reader friendly, reduced-motion aware, with optional read-aloud (browser voice, off by default). It ends in the example workspace, "Watch another", or "Start with my own".
- **Honesty rules held in the script:** nothing is called verified, Keeper never sends or submits for the family, guided searches are run by the person, and each story closes by saying what was not done. `test/tour.test.ts` guards this (order of beats, a real "no", no verification or sending claims, no real identifiers, no em dash).
- **Calmer workspace:** the details panel is closed until the person asks (a Details button at every size, remembered), and a brand-new conversation is a single welcome (mic, greeting, three situations) instead of a chat log plus a prompt list.
- No backend change. The sample workspace itself is unchanged and still offline.

## Demo data everywhere — 18 Oct 2026

- **Problem:** the example workspace was thin (three holdings, one document, two events, and an empty Claims page on its default record), and a real account started completely blank with no way to see what the product does.
- **Example workspace, rebuilt** (`frontend/src/keeper/sample.ts`, offline, synthetic): it now opens on the estate record and shows the whole product at once. Five holdings across bank, insurance, fund and provident fund, at three evidence levels (self-declared, potential match, document-backed; never "institution-verified"). Documents in different states (two reviewed, one with details left to check, one unreadable scan). Three claims at three stages: settled, with the bank and awaiting follow-up, and still missing papers. A month of dated activity (newest first), open follow-ups, a discovery plan, a family record with contacts who can see different things, and a real conversation (one spoken turn). The built-in example is versioned (`SAMPLE_VERSION`), so a copy saved by an older version is rebuilt instead of shown.
- **Demo data for real accounts** (backend, already existed as `POST /api/demo`, now reachable): three scenarios (a family after a loss, a delayed insurance claim, organising my own estate), generated from real public reference data with made-up people. Every empty page (Assets, Documents, Claims, Activity, a new conversation) offers "Fill with demo data", and Settings lists all three. Demo cases are labelled "(demo)" and carry the people and holdings through the real backend, so the AI agent, grounded answers and claims can be tried on them. Re-adding a scenario replaces its earlier copy.
- **Removal:** `DELETE /api/cases/:id` removes a case only if it is a demo case and the caller owns it (403 for a real case, 404 for someone else's). "Remove demo cases" in Settings uses it. Real cases can still never be deleted through the API.
- **Honesty:** demo data is always labelled as such; amounts are dated; claims in the example say "Nothing was sent". Empty pages now explain what the page is for.
- Tests: `backend/test/demo-data.test.ts` (5) and `frontend/test/sample.test.ts` (7). The expectations in `keeper.test.ts` changed with the new example (it opens on the estate record).

## One command runs both services — 18 Oct 2026

- A root `package.json` (`concurrently`, `wait-on`; dev tooling only) adds `npm run dev`, which starts `backend/` on :4000, waits for `/api/health`, then starts `frontend/` on :3000, plus `setup`, `typecheck`, `test` and `build` that cover both. The services stay separate packages; the connection between them is still the frontend's `/api/*` rewrite to `BACKEND_URL`.

## Personas for the demo data — 18 Oct 2026

- **Problem:** the demo data had no owner. The example was "Asha" with a father called "Ramesh Iyer", the backend demos were about "Rajesh Kumar Sharma", "Sunita Devi" and "You", and nothing said whose records you were looking at or why they were there.
- **Three fictional personas** (`frontend/src/keeper/personas.ts`), each tied to one backend demo case (same family, city and institutions): **Arjun Sharma**, 38, Delhi, a son settling his father's affairs (`demo-a`); **Sunita Devi**, 44, Lucknow, a daughter whose LIC death claim has stalled (`demo-b`); **Rahul Deshmukh**, 52, Pune, organising his own estate (`demo-c`). Each has a situation, a goal and things to try.
- **Used everywhere the demo data appears:** the guided tour opens with "Who would you like to follow?" and tells that person's story, with their name in every beat; "Explore an example" opens that person's workspace, one world at a time (no more two mixed cases); a persona chip in the sidebar (and an avatar on mobile) always shows whose records these are, and opens a card with their story, things to try and a way to switch person; demo cases added to a real account show the same chip and persona cards in Settings and on the empty pages. Persona is stored in the session (`persona`), each example saves separately, and reset keeps the persona.
- **Data now matches the story:** Arjun has claims at three stages (settled, with the bank, missing papers); Sunita has an LIC claim with an overdue follow-up (now flagged "Follow-up overdue since ...") and escalation steps, plus a duplicate document; Rahul has a family record where one contact sees documents and the other does not, and a fund with no nominee. The delayed-claim demo case is now named for the policyholder's estate instead of "Claimant (policyholder: Deceased)".
- Everyone is made up; `test/personas.test.ts`, `test/sample.test.ts` and `test/tour.test.ts` check names against the backend data, per-persona content, and that no real identifiers appear.

## Keeper is a call, with a person behind it — 18 Oct 2026

- **The call is the front door.** `/app` now opens on a call screen (a mic orb, "Call Keeper", three starting topics). The written chat is one small icon away, in the header of the call screen and inside the call; the choice is remembered. Starting a call rings for a moment, then Keeper picks up, speaks and listens in a loop; the person gets mute, speaker, type, "Person" and end-call buttons and a timer. The written conversation and a log of what Keeper did open from the chat icon, so the call itself stays calm. Ending the call closes the loop with a summary: what changed and the one next step.
- **Keeper's voice:** Gemini text to speech on the same free key (`POST /api/ai/speak`, WAV, redacted, same AI opt-in and rate limit as other model calls; `GEMINI_TTS_MODEL`, `GEMINI_TTS_VOICE`). If it is unavailable or over quota the browser's own voice takes over for the rest of the call, so a call never goes silent. Listening still uses the browser's speech recognition. A true streaming voice-to-voice model (Gemini Live) was not used: it needs an ephemeral-token flow and audio worklets that cannot be tested without a live key and microphone, so it stays a later step.
- **Bringing in a person:** `POST/GET /api/cases/:id/handoff` and a `HandoffRequest` table. It saves why (person asked, Keeper unsure, sensitive), an optional note and the last turns of the conversation, all redacted, logs it on the case, allows one open request at a time and is limited to five a minute. The person can ask in words ("I want to talk to a real person"), with the Person button, or Keeper offers it: the planner returns `handoff: true` when it still cannot tell what the problem is after two tries, or for a legal, dispute or distressing matter, and the built-in guide offers it after two replies that did not help.
- **Honesty:** there is no reviewer console and no telephony yet, so a request simply waits with the case. The screen says exactly that ("Nobody has picked it up yet, and Keeper can't say when someone will"); the example workspace says nobody is on the other end. Keeper is told never to pretend a person is on the line or promise a response time.
- **First call without AI help:** one tap on the call screen allows AI processing (the same consent record as Settings) instead of sending a first-time caller away.
- **Key handling:** the Gemini key lives only in `backend/.env` (git-ignored). `npm run set-key` stores it from a hidden prompt, checks that Google accepts it, and never prints it. A key pasted into chat or a screenshot should be rotated afterwards.
- Tests: `backend/test/call.test.ts` (10) and `frontend/test/voice.test.ts` (4). Not testable here, and not tested: real microphone input, the sound of Gemini's voice, and a live Gemini planner turn.

## Speech in Indian languages (Sarvam) — 18 Oct 2026

- **What:** calls can understand Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Odia, Punjabi and Indian English. The browser records one spoken turn, `POST /api/stt` sends it to Sarvam's speech model (`SARVAM_API_KEY`, `SARVAM_STT_MODEL`, default `saarika:v2.5`, language `unknown` so it detects per turn) and returns the transcript and detected language. The key is server-side only; the browser never sees it.
- **Keeper answers in the same language.** The detected language goes to `POST /api/ai/agent`, which adds one line to the planner's prompt (reply in that language, simple words, keep institution names and numbers as they are). Spoken replies use Gemini's voice (it follows the text's language) or, as a fallback, the browser voice set to that language.
- **Choosing the recogniser:** `GET /api/ai/agent` now says `stt: "sarvam" | "browser"` (Sarvam only when its key is set and the person has opted in). If Sarvam fails or is over quota mid-call, the call falls back to the browser's recogniser and says so. Without a key nothing changes.
- **Privacy:** the audio of each spoken turn goes to Sarvam, so it needs the same AI opt-in (the consent text now names Sarvam), is rate-limited, is never logged or stored by Keeper, and the synthetic-data-only rule applies until Sarvam's terms and data location are checked (FREE_TIER_PLAN, PRIVACY_ASSESSMENT updated). Free tier: it runs on the credits already on the account, no paid plan.
- **A gap closed on the way:** digits written in Indian scripts (for example १२३४५६७८९०१२) are converted to 0-9 before redaction, so a spoken account number that arrives as Devanagari or Tamil digits is masked like any other. Words ("one two three") are not caught, and are noted as a known limit.
- **Key handling:** `npm run set-sarvam-key` (and `npm run set-key` for Gemini) store a key from a hidden prompt in the git-ignored `backend/.env` and never print it. A key pasted into chat should be rotated.
- Tests: `backend/test/sarvam.test.ts` (13) with a stubbed Sarvam; `frontend/test/endpointer.test.ts`. Not testable here, and not tested: a real Sarvam call, real microphone recording and the model name (`saarika:v2.5`) still being current.

## Say when Keeper is only following a script — 18 Oct 2026

- **Problem:** a call with no Gemini key silently ran the built-in scripted guide (fixed questions, buttons), which is not a conversation. Nothing on screen said why, so it looked like a broken assistant.
- **In the call:** a card says plainly that Keeper is in basic mode and why (no key set up: run `npm run set-key`; the example workspace: it follows a script by design; AI help not yet allowed: one-tap card as before).
- **At startup:** `npm run dev` now prints whether the Gemini and Sarvam keys are set (never the keys), with the exact command to fix it (`scripts/check-keys.mjs`).
- **Style of the AI's replies:** the planner is told to sound like a person on a phone call: react to what was said first, contractions and everyday words, turns under 35 words, exactly one question at a time, use the person's situation back to them, answer small utterances briefly, acknowledge worry before practical steps, never greet twice, at most two options in a sentence. Covered by a prompt test; the sound and feel of a live conversation can only be judged with a key and a microphone.

## Talking first, demo data tucked away — 18 Oct 2026

- **Decision:** a new person's path is "Continue to Keeper" then "Call Keeper", and Keeper builds their record from the conversation (holdings appear on screen as they are mentioned). Demo data stays, but it is no longer pushed.
- **Removed:** the "Fill with demo data" buttons on the empty Assets, Documents, Claims and Activity pages and on the new-conversation screen. Empty pages now say what talking will fill in. They invited people to mix made-up cases into a real account.
- **Kept:** "Explore an example" on the sign-in page (Arjun, Sunita and Rahul, with the guided tour) for people who are not ready to share and for demonstrations; the demo cases and "Remove demo cases" in Settings; the example workspace and all its data.
- **Added:** a plain note before the first call, on the call home, in the call and on the sign-in page: use made-up details for now. Gemini and Sarvam run on free tiers whose terms let the provider keep prompts and audio and have people review them, and the project rule is synthetic data only until a paid, no-training setup (or a provider with suitable terms) is approved. Real people telling real stories needs that decision first; it is not made here.

## Making calls feel live: latency and listening — 18 Oct 2026

- **What was wrong:** a turn took 10 to 20 seconds of silence. Gemini's planner took 7 to 13 s (extended thinking, and a model that had used its free daily quota so each turn wasted time retrying it), Gemini's voice took another 4 to 6 s, and a new person's first turn also waited for two slow model calls to open their record, then was answered by the script anyway.
- **Planner:** live turns (`fast: true`) ask for no extended thinking and a short reply, and start with a light model (`GEMINI_AGENT_MODEL`, default `gemini-flash-lite-latest`). A model that rejects the thinking setting (it comes back as a bare 400) is retried plain and remembered; a model that is out of quota is skipped at once for five minutes instead of retried every turn. Measured against the real key: 7 to 13 s per turn became about 1 s (seven turns, average 1.1 s, worst 1.8 s).
- **First turn:** a new person's saved case is opened from their first sentence before the AI answers (`case.ensure`), using the quick rule-based intake (`fast` on `/api/intake`: no classification call and no reply call), 6 s down to 0.3 s. The AI, not the script, now answers turn one.
- **Voice:** the browser voice is the default because it starts at once; Gemini's voice is a choice ("Natural voice" in the call header) because it needs at least 2.5 s even for three words. When chosen, the first sentence is requested alone and the rest alongside it. Voice and speech requests have their own, higher rate limits (a call makes many small requests), and saving the turn to the record no longer delays the spoken reply.
- **Listening (Sarvam):** the recogniser used for the first turn could differ from the one watched (a timer from before the engine was chosen); it now looks up the current one when it fires. The audio context is woken explicitly, the loudness threshold adapts to the room (a quiet laptop mic is heard, a steady noisy room is not mistaken for speech), the call shows live level bars and says "I can hear you", a turn where nothing was heard retries itself twice and says so, and a Sarvam failure falls straight back to listening with the browser's recogniser.
- **Guard wording:** when the AI promises something the gates do not allow yet, its reply is replaced instead of having a contradicting sentence tacked on.
- Tests: `backend/test/gemini-chain.test.ts` (6), more endpointer and voice tests. A dev probe, `backend/scripts/probe-model.mjs` (`node --env-file=.env scripts/probe-model.mjs <model>`), prints what a model says to a tiny request, without printing the key. Not tested: real microphone capture and how the voices sound.


## Conversational turn reliability (FL-01, FL-02) — 18 Oct 2026

- Reproduced intermittent `ai_unusable` responses during a three-turn synthetic conversation. The planner now requests a JSON Schema envelope and repairs an invalid response once within the original timeout. Runtime validation, ownership, consent, redaction and action gates still apply to every response.
- Calls initialise their bounded history from the current saved thread. History accepts the same 800-character limit as an utterance, avoiding a valid long turn breaking the next request.
- A transient failure preserves the user's words with an honest failure reply and tries AI on the next turn. It no longer disables AI for the call or sends the failed turn into the scripted interviewer. Repeated failures offer a human handoff. A reply arriving after the call ended does not execute its actions.
- Validation: backend and frontend type checks; 31 focused backend planner/provider tests using an empty database created from the existing schema (Prisma's schema-engine startup fails in this sandbox); five consecutive live synthetic API turns passed with contextual recall. Browser verification after refresh also recalled records from a reopened call and answered the next turn naturally. The broader backend suite was stopped after remaining unresponsive; it is not claimed as passing. Microphone capture and audio quality require device testing.


## Natural multilingual conversation (FL-01, FL-02) — 18 Oct 2026

- Calls and signed-in written chat use the same conversational planner, with saved context and confirmation buttons for consequential actions. The prompt respects a wish to talk without a checklist, avoids repeated questions and formulaic apologies, and follows explicit language changes, mixed language and the latest script.
- Shared speech-language catalogue: 22 Indian languages plus English. Sarvam Saaras v3 uses codemix mode and automatic detection per turn; manual language choices reach the recogniser. Additional world-language choices use browser speech, whose availability varies. Sources: https://docs.sarvam.ai/api-reference/speech-to-text/transcribe and https://docs.sarvam.ai/api/getting-started/models/saaras . Existing Saarika configuration was updated locally; credentials are untouched.
- The planner returns the reply language; browser voice selection and Gemini speech requests use it. When a matching browser voice is absent, the opted-in call attempts Gemini speech. Automatic speech support is not promised for every world language. Explicit short yes/no confirmations work in multiple scripts; longer ambiguous responses still require clarification.
- Validation includes catalogue and transcript-language tests for all 23 speech codes, script/confirmation regressions, and live synthetic language-switching conversations. Actual microphone accuracy and native-speaker speech quality still require device testing; UI labels and error messages remain English.

- Final focused checks: 47 backend tests plus 9 frontend tests pass; both type checks and frontend lint pass. Live synthetic text checks exercised Hindi, Hinglish, Tamil, Telugu, Gujarati, Marathi, Bengali, Urdu and Spanish, with normal-chat browser verification in Hindi and Tamil. Native-script output, short language-code normalisation and a larger structured-reply token allowance address failures found during these checks. The development API needed an entry-point refresh to load dynamically imported route edits; the running API was refreshed. No claim is made that all world languages or all microphone/voice combinations have been tested.


## Hosted synthetic MVP foundations — 18 Oct 2026 (FL-02, FL-10, FL-19, FL-23, FL-45)

Supabase Free is the selected implementation target for PostgreSQL and Google sign-in. No external project, paid plan or deployment was created. Google OAuth uses Supabase's PKCE exchange; user tokens remain in HttpOnly cookies, and the backend verifies the user rather than trusting the browser ID. Google profile names/emails are not inserted into synthetic financial prompts.

Search outcomes now have canonical dated, scoped history and idempotent request IDs, separate from editable UI notes and institutional verification. Deletion removes current-account application records and local drafts/attachments after confirmation, without pretending to delete Google identities or third-party copies. Production startup rejects ephemeral databases and unfinished auth configuration. Source staging preserves shared/ while excluding secrets and local data.

Local schema/database files were preserved. The derived PostgreSQL schema validates, but connection, restore, hosted OAuth and Cloud Run checks remain blocked on Supabase project setup and the Google Cloud project ID. See docs/HOSTED_MVP_SETUP.md for concrete setup and acceptance checks.

- Validation: 17 backend files / 182 tests passed with OCR excluded, followed by 12 focused hosted-MVP tests after the final ownership/deletion changes; all 10 frontend files / 60 tests passed, including the real-handler guided-search round trip. Both type checks, frontend lint and the production Next build passed. The PostgreSQL schema passes Prisma validation. Tests used fresh empty SQLite databases created from schema-only metadata to work around this sandbox's Prisma schema-engine startup error; no live financial data was copied. Real PostgreSQL and Google provider checks remain pending.
- Live local HTTP probe used a separate synthetic test session: readiness true; first search save 201; retry 200 with one stored result; delete returned true; zero cases remained for that test session. Existing browser cases were not deleted. The OCR-download test was not run.


### 2026-10-18: Conversation workspace (FL-01, FL-02, FL-10; MVP issues #10–#20)

Use the existing case store, document review panels and guarded dispatch for conversational memory and contextual review. Show provenance rather than invented confidence percentages. Key the agent workspace by case and thread to isolate transient state. Default to text with an optional call, and show execution receipts separately from model prose. No new provider or dependency.


### 2026-10-18: Refine the shared frontend design

Use scoped workspace styles and existing fonts/icons for a consistent visual hierarchy across navigation, conversation and structured record screens. Preserve source/evidence labels and all guarded actions. No decorative external imagery or new dependencies.


### 2026-10-18: Landing page animation

Use CSS transforms/opacity and IntersectionObserver with progressive enhancement. Finite decorative animation avoids continuous motion controls; each section reveals once. Keep the preview explicitly simulated and retain all coverage and approval disclosures. No animation dependency.


### 2026-10-18: Official handoffs and opt-in continuity

Keep external search and submission user-controlled. Reuse curated source URLs; add verified SBI and LIC instructions as explicit handoff destinations, never automatic submission endpoints. Store per-item follow-up preference and review date in validated case UI state; no entitlement or claim status can be changed by this preference. Use canonical outcome controls for closure and surface active follow-ups in the conversation. In-app review dates do not imply background monitoring or notifications.


### 2026-10-18: Bind agent execution and report durable results

Guard conversational dispatch at invocation and again when queued work starts. Preserve the user’s selection when in-flight writes complete. Invalidate unmounted agent instances, and key the conversation by its stable thread ID so initial server case creation does not interrupt turn one. Await turn persistence and retain unsaved replies for explicit retry without re-running actions. Replace model prose when tool execution fails. Bind server history to the requested case-owned thread and supply validated saved follow-ups as data, respecting discovery visibility.


### 2026-10-18: Motion tied to actual UI state

Use CSS transforms/opacity for route, panel and new-message entrances. Remember the message IDs present at mount so old transcripts do not animate again. The existing request phase drives thinking indicators; execution state drives completion feedback. Modern details-content transitions are progressive enhancement with a simple open animation fallback. No dependency, new timer or network request.


### 2026-10-18: Evidence provenance and durable review

Build the evidence map from canonical records, not model-generated relationships. Add a small database-backed claim-review worker with checkpoint/lease fencing, explicit restart and bounded failure recovery. Keep human authority, approval and external submission outside automatic work. Use the existing database and no paid queue or new service. Local timers support development; request-driven advancement supports free-tier hosts without guaranteed idle CPU.


Voice recovery: guard transcription fallback by active conversation, microphone choice and browser support; explicitly request repetition of lost audio, preserve selected language, detach obsolete recognition handlers, and replay failed playback sentences through browser speech. No new provider or paid service.


STT recovery uses the existing Gemini API-key account after Sarvam failure, reusing request-memory audio under existing AI consent and rate limits. Each provider has an independent 12-second timeout; request cancellation suppresses backup. No paid provider, new key, audio persistence or raw provider error logging.


Example mode now supports consented AI conversation via an isolated conversation-only endpoint. It never hydrates demo holdings into canonical cases or executes model actions. Existing signed-in case-agent access gates remain unchanged.


Regular-call output now chooses server speech when the browser has no voices even before language detection. Browser playback errors and startup timeout report an explicit visible notice, while preserving the reply text.


Microphone capture no longer discards nonempty recordings based on analyser loudness. Suspended AudioContext and quiet-input recordings are sent to STT for actual speech detection; manual stop preserves audio. Permission wait is bounded at 15 seconds with late-stream cleanup; pending permission/transcription are visible.


`npm run dev` now checks local setup before starting anything: a missing `backend/.env`, an ungenerated Prisma client or a missing local SQLite file stops it with the exact fix, instead of the API crashing with "@prisma/client did not initialize yet" and the web app timing out after 60 seconds. It only reads files; it never creates the database itself.

PostgreSQL now uses a separately generated Prisma client so local Supabase validation does not overwrite the SQLite client or database. Local synthetic runtime uses its own ignored env and API port, retaining existing auth policy. Explicit microphone retry can return from a failed browser recognizer to server recording.
Supabase PostgreSQL uses the Prisma 6 Node driver adapter with a separately generated client and the dashboard-provided public root CA. This avoids the restricted Windows native TLS failure while retaining strict CA/hostname verification and explicitly selecting the private keeper schema.


Conversation continuity now derives a return briefing and call greeting from the active saved case, counts only open claims/nonduplicate holdings and pending field reviews, and links to the actual next record. Live activity shows execution steps and completed counts rather than generic thinking; no autonomous monitoring or submission is implied.


Bounded case preparation uses a persisted CaseAgentRun with leased checkpoints, bounded retries, explicit pause/recheck and request-driven recovery. Only existing claim drafts are refreshed. Human evidence review, financial authority, approval, external submission and outcomes remain outside autonomous execution.

End-to-end verification caught guided-search provenance being omitted from evidence maps because the query selected only discovery events. Read both guided_search and legacy discovery event types; preserve self-reported status and never upgrade ownership. Added a regression test.


Reviewed document evidence plus explicit holding confirmation now prepares one idempotent claim draft for death cases. Only a reviewed policy linked to that holding can fill its exact policy requirement after authority checks. No fields, ownership, authority, declarations, approval or submission are accepted automatically. Document progress and saved conversation receipts explain the next required review; transient preparation failure preserves the canonical review.
The live HTTP adapter exposed a Response-constructor mismatch in access-denial detection. Recognize Response-shaped denials across constructor realms so all shared document/asset/claim access guards remain effective under the Node adapter. Added a regression and live foreign-session check.

### Documentation reconciliation — 18 October 2026

Reconciled README, product/design/technical specifications and setup/privacy/security/evaluation guides against the synthetic Keeper app. Added docs/CURRENT_STATE.md as the dated implementation audit and docs/VOICE.md for provider/device acceptance. Replaced obsolete routes/theme/browser-only persistence and open-database statements; removed superseded deployment instructions. Product vision, business hypotheses, source/legal research dates and earlier decisions are retained without implying renewed validation.

Latest audit: 213 backend tests (207 regression + six OCR separately), 75 frontend tests, 17 passing live full-journey checks and one Gemini TTS failure (provider 429, app 503); separate English STT and eight document-continuity checks passed. These are dated observations, not complete device/language, institution, OAuth, deployment, billing or production acceptance. This documentation task changes no service, account, billing setting or executable code.

### Verify claims console demo — 19 October 2026

Built the FL-56 demo as a separate console (`/verify`, `/api/console/*`) with its own tables and a passwordless demo sign-in (`x-console-id`), enabled only when real sign-in is not required and `CONSOLE_DEMO` is not `0`. Four checks (consistency, authenticity signals, duplicate, completeness) and the risk ladder are deterministic code in `shared/verify-rules.ts` and `backend/src/server/rules/verify-checks.ts`; no model is involved, and an unfinished check shows "Couldn't complete, review manually" and never counts as a pass. Authenticity signals are planted fixture metadata, not image forensics. The duplicate check only counts earlier-received claims, so the first claim is not marked as a duplicate of the later one. Decisions are always a person's: the server requires a rating before approval, acknowledgement plus a written reason to approve High risk or escalate Low risk, and records requests for documents as simulated. All four claims share one demo desk; the institution choice sets the reviewer identity only. The heir-side claim panel now says, once the heir has submitted it themselves, that a package can arrive pre-checked if the institution uses Verify; Keeper still sends nothing and never submits for the family.

### Verify public demo — 27 October 2026

The Verify console was local only. To let hackathon judges see the institution side on the hosted link, hosted deployments can now run it when `CONSOLE_DEMO=public` is set explicitly; the default for hosted stays off and `CONSOLE_DEMO=0` always wins. It holds synthetic data only and no real account is involved. Each visitor gets a private desk (still keyed by an unguessable `x-console-id`); desks expire after 24 hours, at most 200 exist (a returning desk can always come back, a new one gets "demo busy"), and sign-ins are limited to 12 a minute per caller. The rule that Verify never touches an heir's private case is unchanged. Added the MIT licence.

## 2026-10-29: Public demo has no sign-in

The hosted demo is for people to explore, and Google sign-in could not be finished in time and gets in the way of judges and reviewers. `PUBLIC_DEMO=1` turns hosted authentication off: `authRequired()` is false, sessions use the browser's `x-session-id` like local mode, and the Verify console opens with it. Everything is synthetic. Supabase sign-in code stays and is the default whenever the flag is unset. Trade-off: anyone can spend the free AI quota, so provider fallbacks and per-caller limits remain the guard.
