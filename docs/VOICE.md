# Voice implementation and acceptance

Reconciled 18 October 2026. See [CURRENT_STATE](CURRENT_STATE.md) for the dated audit.

## Implemented path

Explicit Call Keeper/microphone action → browser permission → bounded recording → `POST /api/stt` → conversation planning/reply → visible text and speech output. Typed input remains available. Nonempty recordings are not discarded solely because a loudness analyser detected no speech. Permission waiting is bounded and streams arriving after cancellation are released.

Input order: Sarvam `saaras:v3` when configured, then Gemini `gemini-2.5-flash` on the same recording, then browser recognition where supported. Server STT requires AI consent, validates MIME/size and rate-limits requests. Provider timeouts bound retries. Raw audio is not stored by Keeper.

Output uses browser speech and Gemini `gemini-2.5-flash-preview-tts` according to voice availability/configuration. Failed playback retains reply text and visible recovery; a failed sentence must not be silently skipped. Exact language/device voice availability varies. Case/thread changes and cancellation must not apply old replies or actions to a new conversation.

## Latest live results

| Check | Result |
| --- | --- |
| AI conversational reply | HTTP 200 |
| Synthetic English audio to app STT | HTTP 200, expected speech content detected |
| Gemini TTS through app | HTTP 503 on 18 Oct (quota); HTTP 200 on 1 Nov 2026 for English and Hindi |
| Direct diagnostic of configured Gemini TTS | HTTP 429 `RESOURCE_EXHAUSTED` on 18 Oct; quota recovered by 1 Nov |
| Live Cloud Run, 1 Nov 2026: spoken English reply fed back to app STT | HTTP 200, transcript matched exactly |
| Sarvam TTS synthetic fixture generation | HTTP 200; diagnostic only, **not connected to Keeper replies** |
| Browser/OS microphone and audible playback | Not physically accepted in this audit |

Sarvam supplies finite signup credits, not unlimited free speech. Gemini free access depends on model/project quotas. Keys being present does not establish credit balance or zero-cost billing controls. See [FREE_TIER_PLAN](FREE_TIER_PLAN.md).

## Device and language acceptance still required

Test Chrome/Edge and mobile with actual permissions, speech, silence, noise, accents, interruptions, manual stop, revoked permission, network failure, quiet input, case switching and exhausted quotas. Measure transcription and spoken-output quality separately for each advertised language. Do not infer all-language support from English or mocked tests. OCR language packs are independent from speech languages.

Manual transcript correction/typed input is available; call endpointing can send completed turns automatically. Mandatory manual review of every call turn is not implemented. The app is not a full-duplex, always-listening voice service. Voice cannot approve a financial package, establish authority or submit to an institution. Keep synthetic data only under the current provider/privacy policy.
