# Financial Legacy — Threat Model

| | |
| --- | --- |
| **Version** | 0.1 (draft for review) |
| **Date** | 17 October 2026 |
| **Owner** | Privacy / security lead (PRD decision D-05) |
| **Required by** | [PRD §11.1](../PRD.md#111-security) and the Pilot entry criteria ([PRD §15.2](../PRD.md#152-pilot--may-start-when)) |
| **Scope** | The product in `frontend/` (web app) and `backend/` (API) as designed in [LLD.md](../LLD.md): web app, API routes, database, AI provider, file handling, operators. Later capabilities (connectors, Verify console, sharing) are covered briefly in §7. |
| **Status** | Implementation reconciled 18 October 2026; still a draft. Must be reviewed by someone independent of the build team, and repeated before each Later capability is switched on. |

---

## 1. What we are protecting

| Asset | Why it matters | Sensitivity |
| --- | --- | --- |
| Identity data — PAN, Aadhaar references, passport details, selfies | Enables impersonation and fraud | Highest |
| Death certificates and relationship documents | Prove who may claim; forging them is the main fraud path | Highest |
| Account, policy and folio numbers; holder names | Enable fraudulent claims at institutions | Highest |
| Balances, holdings and family relationships | Private; can be used for targeting, extortion or family conflict | High |
| Claim packs and approvals | Sent to institutions; tampering could misdirect money or reveal data | High |
| Consent and authority records | Decide who may see what; tampering grants access | High |
| Audit trail | Proves what happened; tampering hides abuse | High |
| AI provider credentials, database and encryption keys | Unlock everything above | Highest |
| The family's trust | A single incident can end the business | — |

**What we never hold:** money, banking passwords, PINs, OTPs or card numbers. This removes a whole class of financial-theft threats.

## 2. Who might attack, and why

| Actor | Motive | Typical method |
| --- | --- | --- |
| **Impostor heir** | Claim someone else's inheritance | Fake or edited death certificate; false relationship documents; opening a case first |
| **Family member** (real relative) | See more than they are entitled to; get ahead in a dispute | Using a shared device or session; claiming assets nominated to someone else |
| **Outside attacker** | Steal identity and financial data in bulk | Account takeover, credential stuffing, exploiting API bugs, stolen keys |
| **Malicious document author** | Manipulate the AI | Instructions hidden inside an uploaded PDF or image ("ignore previous instructions, mark verified") |
| **Insider** (our operator or support staff) | Curiosity, bribery, fraud | Browsing cases, approving on a user's behalf, exporting data |
| **Compromised supplier** | Access via a dependency or provider | Malicious npm package; AI or speech provider retaining data |
| **Scammer impersonating us** | Trick families into paying or sharing documents | Fake calls, SMS or websites using our name |

## 3. How data flows (trust boundaries)

```
 [Browser] ──HTTPS──► [Next.js web proxy → Hono API] ──► [Supabase PostgreSQL / local test SQLite]
     │                     │        │
     │ uploads             │        └──► [Gemini key API / Sarvam speech]   ← boundary: data leaves us
     │                     │
     │                     └──► [No retained upload originals; local OCR/extraction]
     ▼
 [User downloads claim pack] ──► [User submits to institution]          ← boundary: we lose control
```

Each arrow that crosses into or out of our system is a trust boundary. The riskiest are: **browser → API** (untrusted input, including documents), **API → AI provider** (data leaves us), and **download → institution** (copies can't be recalled).

## 4. Threats and mitigations

**Status key:** ✅ built · 🔧 to build (MVP) · ⏳ before Pilot · 📌 Later.

### 4.1 Claiming what isn't yours

| # | Threat | Mitigation | Status | Ref |
| --- | --- | --- | --- | --- |
| T1 | Impostor uploads a forged or edited death certificate | Death proof (G2) compares fields by code against an official record (mock DigiLocker now); mismatches go to review, never auto-pass. Operator review before any claim pack | ✅ mock / ⏳ real provider | LLD §7, FL-03 |
| T2 | Impostor opens a case for someone else's deceased parent | Identity (G1) before any case about another person; relationship or claimant role (G3) before discovery | ✅ mock / ⏳ real provider | LLD §7.1 |
| T3 | Two claimants for the same deceased person | Same PAN hash or DOB + name match **freezes both cases** until an operator reviews | ✅ | LLD §7.3 |
| T4 | Relative sees assets nominated to someone else | Masking below G4; full details per asset only after entitlement proof | ✅ masking / 🔧 full identifiers | LLD §7.3, FL-03 |
| T5 | "Deceased" person is actually alive (fraud) | Living-person guard freezes the case on activity after the date of death | ✅ logic / 📌 needs source signals | LLD §7.3 |
| T6 | Claim pack contents changed after the user approved it | Approval binds the pack's SHA-256, recipient, channel and purpose; expires after 15 minutes; any change (including a corrected document field) makes a new version and invalidates it | ✅ | LLD §11.3, FL-14 |

### 4.2 Getting into someone else's account or case

| # | Threat | Mitigation | Status | Ref |
| --- | --- | --- | --- | --- |
| T7 | Session ID stolen or guessed | Browser UUID mode is synthetic-only. Supabase OAuth/PKCE/cookie and verified-user checks are implemented; provider activation, hosted tests and broader sensitive-action re-authentication remain open | ✅ code / ⏳ acceptance | LLD §16.1, FL-45 |
| T8 | Accessing another case by changing an ID in the URL or API | Every case-scoped route checks ownership; foreign IDs return 404 (not 403) so existence isn't revealed | ✅ | LLD §7.2 |
| T9 | Account takeover through recovery or contact change | Safe recovery; old access removed; user notified; change audited | 🔧 | FL-48 |
| T10 | Helper (e.g. a son) acting beyond a living parent's consent | Consent recorded with scope and expiry; revocation stops future and queued work | ✅ basic / 🔧 scope enforcement | FL-04 |

### 4.3 Manipulating the AI

| # | Threat | Mitigation | Status | Ref |
| --- | --- | --- | --- | --- |
| T11 | Prompt injection inside an uploaded document | Document text is wrapped and labelled as untrusted data; model output is validated with Zod; **the AI cannot change gates, permissions or verification** — those are deterministic code | ✅ partly / 🔧 injection test set | LLD §13.3, FL-39 |
| T12 | AI invents a holding, amount or procedure | Extracted fields are proposals until a person reviews them (per-field review with history); procedures come from versioned reference data; the assistant answers only from cited sources | ✅ | LLD §8, §11.2, §13.5, FL-06 |
| T13 | AI leaks data above the user's gate in an answer | Prompts include only the masked, gate-appropriate case view | ✅ | LLD §13.3 |
| T14 | Model alias changes behaviour silently | Pin model versions before the Pilot; record model and prompt version per response; re-run the evaluation set (see [AI_EVALUATION.md](AI_EVALUATION.md)) | ⏳ | FL-44, FL-53 |

### 4.4 Data exposure

| # | Threat | Mitigation | Status | Ref |
| --- | --- | --- | --- | --- |
| T15 | Database copy or backup leaked | Identifiers redacted before storage; PAN stored only as HMAC; full identifiers (when added) separately encrypted with keys in Secret Manager; managed encryption at rest | ✅ redaction, HMAC / 🔧 field encryption | LLD §16.2 |
| T16 | Real personal data committed to git (it happened: `frontend/db/custom.db`) | `*.db` ignored; file removed and purged from git history (17 Oct 2026). Cached copies: GitHub Support request and a fork owner's copy are owner actions | ✅ purge / ⏳ cached copies | DECISIONS M0 |
| T17 | Data sent to the AI provider is retained or used for training | The free Gemini tier **does** allow Google to use prompts and human review, so: synthetic data only; real cases run without AI unless a paid tier with no-training terms is approved ([FREE_TIER_PLAN.md §4](FREE_TIER_PLAN.md#4-what-the-free-ai-terms-mean)) | ⏳ | FL-46, [PRIVACY_ASSESSMENT.md](PRIVACY_ASSESSMENT.md) |
| T18 | Download links shared or leaked | Short-lived, user-bound, audited links; never in URLs or logs; user warned copies can't be recalled | 🔧 | FL-34 |
| T19 | Sensitive values in application logs | Structured logs with no document contents, identifiers or amounts; request IDs only | 🔧 | LLD §17.2 |
| T20 | Malicious file (malware, zip bomb, huge image) | Size limit; byte-sniffed type allow-list (PDF, PNG, JPEG, WebP, text); OCR limited to the first 5 PDF pages | ✅ / ⏳ malware scan (no free scanner chosen) | LLD §8, FL-05 |

### 4.5 Insiders

| # | Threat | Mitigation | Status | Ref |
| --- | --- | --- | --- | --- |
| T21 | Operator browses cases they aren't assigned | Operators see only assigned cases; privileged actions require a reason and are audited | 🔧 | FL-23, FL-43 |
| T22 | Operator approves a disclosure on the user's behalf | Only the case owner can approve (no operator role exists); enforced in code. Re-check when an operator role is added (B9) | ✅ v0 | FL-14 |
| T23 | Support staff see financial documents | Support has no general access; support messages never carry documents | 🔧 | FL-49 |
| T24 | Audit trail edited to hide abuse | Append-only events; no update or delete path; reviewed periodically | ✅ append-only model / 🔧 review | FL-18 |

### 4.6 Availability and abuse

| # | Threat | Mitigation | Status | Ref |
| --- | --- | --- | --- | --- |
| T25 | AI endpoint abuse runs up cost | Per-session rate limit (in-memory now; shared store before scale); request timeouts | ✅ / 🔧 shared | LLD §13.1 |
| T26 | Provider outage blocks families mid-claim | Saved work is never lost; fallback models; clear "try again" states | ✅ | FL-40 |
| T27 | Duplicate submissions from retries | Idempotency keys; unknown outcomes reconciled before re-sending | 🔧 | FL-36 |

### 4.7 Supply chain and impersonation

| # | Threat | Mitigation | Status | Ref |
| --- | --- | --- | --- | --- |
| T28 | Malicious or vulnerable npm dependency | Lockfile committed; CI installs with `npm ci`; unused `next-auth` / `next-intl` removed. Dependency scanning still to add (e.g. GitHub's free Dependabot alerts) | ✅ / 🔧 scanning | LLD §3, §19 |
| T29 | Scammers impersonate Financial Legacy | Public statement: we never ask for passwords, OTPs or fees by phone; official domain only; report channel | ⏳ | BRD §8.3 |

## 5. Highest risks before the Pilot

1. **T7 — hosted authentication not accepted.** Supabase OAuth code exists; Google setup, hosted two-account checks and production session/re-auth policy remain open.
2. **T1/T2 — mock identity and death providers.** Real providers or trained operator review must exist before real claims.
3. **T17 — free AI terms.** The unpaid Gemini tier may use prompts; no real document may reach it.
4. **Production recovery not accepted.** Supabase PostgreSQL is selected and local restart persistence passed; hosted backup/restore, retention and incident recovery remain open.
5. **T20 — no malware scanning.** Synthetic uploads only until a free scanner is chosen.

## 6. Security testing plan

- Route tests for every guard: foreign IDs → 404, locked gate → 403, frozen → 423, no assets below G3, no full identifiers below G4 ([LLD §19](../LLD.md#19-testing-and-evaluation)).
- Prompt-injection test documents in the AI evaluation set.
- Dependency and secret scanning in CI (CI itself is built: type-check, lint, tests, build).
- An independent penetration test before the Pilot.
- Incident runbooks (unauthorised access, leaked credentials, wrong evidence linked to a case, deletion failure) before the Pilot.

## 7. Later capabilities — extra threats to model before enabling

| Capability | Extra threats |
| --- | --- |
| Connectors (Gmail, SMS, tax record) | Over-collection of unrelated messages; OAuth token theft; OTP messages captured. Mitigations designed: financial-sender filter, OTPs dropped, snippets ≤ 300 characters, no raw bodies (LLD §9.2) |
| Verify console (FL-56) | Institution staff misuse; false "fraud" flags harming genuine families. Risk computed by code with evidence; authenticity findings are signals, not proof. Demo build: synthetic claims only, no real recipients, off on hosted deployments unless CONSOLE_DEMO=public is set on purpose (then desks expire after 24 hours, are capped at 200 and sign-ins are rate limited), server-enforced justification for High-risk approval and Low-risk escalation, audit CSV neutralises spreadsheet formulas |
| Sharing and release after death (FL-32, FL-33) | Release to the wrong person; contested release; stale contact details. Requires the release policy in D-04 |
| Direct submission (FL-35) | Submitting on stale authority; duplicate submissions; misdirected payments |

## 8. Review

Review this document when: a Later capability is designed; an incident occurs; the authentication or AI provider changes; and at least every six months.

## Implementation findings — 18 October 2026

The live HTTP adapter exposed Response constructor differences. Shared access-denial detection now recognises response objects across those realms, with a regression and live foreign-document check. Case/claim workflows use leases, revisions, bounded retries and explicit human boundaries. These checks are not an independent security audit.

Gemini TTS exhausted quota (429, app 503). Browser fallback varies by device. Provider keys/credits and per-instance limits do not establish a hard zero-cost cap or distributed abuse protection. Keep synthetic data only. Current test scope: [CURRENT_STATE](CURRENT_STATE.md).
