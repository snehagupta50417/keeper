# Keeper implementation status

Reconciled 18 October 2026. This is a dated implementation and verification snapshot, not a production-readiness certificate. Product scope follows [ONE_PAGER](../ONE_PAGER.md) and [PRD](../PRD.md); technical details follow the code and [LLD](../LLD.md).

## Runtime and ownership

The validated local web app runs at http://localhost:3001 with its API at http://localhost:4001. It uses external Supabase PostgreSQL in the private `keeper` schema, with strict CA/hostname verification. SQLite remains a separate development/test option; its records are not silently migrated. Browser state is a UI cache, not the canonical connected record.

The validated runtime uses `AUTH_MODE=demo` and synthetic session ownership. Supabase Google OAuth/PKCE and account-scoped checks are implemented, but Google sign-in is disabled in the inspected project. The public live demo sets `PUBLIC_DEMO=1`, which turns sign-in off: each browser keeps its own synthetic workspace. Public hosting and production OAuth are being handled separately and were not verified by this local audit. A health response alone does not establish readiness.

## Capability status

| Area | Implemented | Remaining limits |
| --- | --- | --- |
| Conversation | Gemini-backed text/call reasoning, rule fallback, saved conversations, case-derived return briefing and next-record links | Missing credentials or quota can disable AI; browser-only examples remain labelled |
| Voice input | Sarvam STT, same-recording Gemini fallback, browser recognition fallback; explicit permission, stop, retry and transcription states | Actual microphone capture, noise, accents and every listed language are not fully accepted on real devices |
| Voice output | Browser speech plus Gemini TTS, visible failure and preserved text | Latest live Gemini TTS returned **429 RESOURCE_EXHAUSTED**, surfaced by the app as **503**. Browser voices vary. Sarvam TTS worked diagnostically but is **not integrated** into Keeper replies |
| Documents | Byte/size validation, text/PDF/image extraction, local Tesseract OCR, redaction, field review/history | OCR defaults to English + Hindi; current image fixtures exercise English. Extraction is synchronous. Malware scanning and broad handwriting/layout accuracy remain open |
| Document to claim | Reviewed supporting evidence + explicit holding confirmation prepares one draft per holding; an eligible reviewed policy can fill its exact requirement after authority checks; retries preserve review | Never auto-accepts fields, confirms ownership, grants authority, accepts declarations, approves or submits |
| Guided search | Official handoff URLs and dated, scoped, self-reported outcomes with history/idempotency | No automatic portal search, exhaustive discovery or institution-verified ownership |
| Agent work | Persisted case checkpoints, receipts, leases, bounded retries, pause/resume/recheck; saved claim reviews | Case preparation advances while the conversation is open/returns; no always-on monitor. Completion is not settlement |
| Claims | Bank/MF/LIC procedures, versioned packs, hash-bound approval, PDF, official handoff, recorded self-submission and outcomes | Institution decisions and actual submission are external. Financial identity/entitlement providers remain simulated |
| Privacy | Consent controls, redaction, scoped access, activity and deletion of Keeper application records | Deletion does not remove Google/Supabase identities, provider copies or all backups; retention automation and production governance remain open |
| Legacy | Saved family notes, planning gaps, contact-scope previews and in-app follow-up preferences | No live contact sharing/invitations, legacy snapshot export or guaranteed background reminders |

## Verification on 18 October 2026

- **213 backend tests passed:** 207 regression tests plus 6 OCR tests run separately after allowing the free language-data download.
- **75 frontend tests passed.** Total: **315 automated checks**. These are dated observations, not permanent counts or evidence that CI calls live providers.
- Latest full live synthetic journey: **17 checks passed, one failed** (Gemini TTS). A separate synthetic English STT request returned HTTP 200 and the expected speech content.
- The journey covered simulated gates, source review, claim preparation, approval-hash rejection/acceptance, official handoff, self-reported submission, partial/full synthetic settlement, saved conversation/follow-up and agent pause/resume.
- A separate document-continuity run passed **8 checks**, including automatic draft creation, no duplicate draft, no automatic authority/approval/submission and foreign-session rejection.
- Backend typecheck and frontend production build passed during that implementation. Documentation reconciliation changes no executable code.

Real institution integration, actual microphone/acoustic accuracy, all-language quality, production Google sign-in, public deployment, billing tier, remaining credits and a hard zero-cost spending cap are **not established** by these checks.

## Cost and release boundary

Use existing free allowances/credits only. Configured credentials do not prove unlimited free access. Gemini has model-specific quotas, Sarvam offers finite signup credits, and Supabase Free has storage/availability limits. Do not enable paid services or top-ups to make a test pass. See [FREE_TIER_PLAN](FREE_TIER_PLAN.md) and [VOICE](VOICE.md).

Synthetic data only. No automated real financial identity verification, external claim submission, payment or real institution settlement occurred. Pilot entry still requires PRD acceptance and privacy/security review.
