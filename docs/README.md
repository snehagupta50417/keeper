# Keeper documentation

Reconciled 18 October 2026. Start with [CURRENT_STATE](CURRENT_STATE.md) for implemented behaviour, dated tests and known failures. Requirements follow [ONE_PAGER](../ONE_PAGER.md) → [PRD](../PRD.md) → [LLD](../LLD.md) → [DESIGN](../DESIGN.md). [BRD](../BRD.md) contains business hypotheses; [DECISIONS](../DECISIONS.md) preserves historical decisions.

## Implementation and setup

| Document | Purpose |
| --- | --- |
| [CURRENT_STATE](CURRENT_STATE.md) | Runtime, capability matrix, 315 automated checks, live audit and remaining boundaries |
| [LOCAL_SUPABASE_VALIDATION](LOCAL_SUPABASE_VALIDATION.md) | Local PostgreSQL setup, Windows commands, TLS and persistence |
| [HOSTED_MVP_SETUP](HOSTED_MVP_SETUP.md) | Supabase/Auth configuration, source packaging and hosted acceptance |
| [CLOUD_SETUP](CLOUD_SETUP.md) | Deployment handoff and configuration boundaries |
| [FREE_TIER_PLAN](FREE_TIER_PLAN.md) | Selected services, finite credits, quotas and unverified billing controls |
| [VOICE](VOICE.md) | Input/output fallbacks, current TTS quota failure and device acceptance |
| [CASE_AGENT](CASE_AGENT.md) | Request-driven checkpoints, pause/resume/recheck and human boundaries |
| [EVIDENCE_WORKFLOWS](EVIDENCE_WORKFLOWS.md) | Evidence graph, saved claim review and document-to-claim continuation |

## Pilot governance and research

| Document | Purpose |
| --- | --- |
| [THREAT_MODEL](THREAT_MODEL.md) | Threats, implemented controls and remaining security work |
| [PRIVACY_ASSESSMENT](PRIVACY_ASSESSMENT.md) | Data inventory, processors, proposed retention and open privacy/legal decisions |
| [AI_EVALUATION](AI_EVALUATION.md) | Existing regression coverage and proposed acceptance set |
| [SOURCE_VALIDATION](SOURCE_VALIDATION.md) | Dated source/procedure research, not proof of live integration |
| [FEASIBILITY_AND_COMPLIANCE](FEASIBILITY_AND_COMPLIANCE.md) | Research baseline and unresolved integration/legal questions |

This reconciliation is not a fresh legal, regulatory or source-procedure audit. Research dates, citations and uncertainty remain explicit. Only synthetic data is approved; tests and simulated settlements do not authorise real-data processing or external submission.
