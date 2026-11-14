# Hackathon compliance

Authority: [live HACKATHON.md](https://nearhackathon.com/HACKATHON.md), read in full November 14, 2026, around 01:00 UTC. Also reviewed the official [starter repository](https://github.com/nearai/near-hackathon-prompt-examples), [setup](https://github.com/nearai/near-hackathon-prompt-examples/blob/main/00-setup.md), and [submission checklist](https://github.com/nearai/near-hackathon-prompt-examples/blob/main/SUBMITTING.md). Re-read live rules immediately before submission; this document does not freeze them.

Deadline: **2026-11-14 23:59 UTC**, or **November 15, 00:59 Africa/Lagos**. At recovery (05:32 UTC), 18 hours 27 minutes remained. Publication and submission buffer begins 21:59 UTC.

| Requirement | Current status / evidence |
|---|---|
| Eligible development window; disclose baseline (Q-001–004) | Existing baseline `7ae2207`; implementation isolated on `codex/proofbound-hackathon`. README will identify the development diff. |
| Public source before deadline | Existing public repository [on3boi1/proofbound](https://github.com/on3boi1/proofbound); new implementation is local, push approval pending. |
| Reproducible prototype and judging instructions | Work in progress. Local fixture path plus contract tests; actual commands/results in TEST_RESULTS.md. |
| Libraries, AI assistance, templates disclosed (Q-005) | README and DESIGN_RESEARCH.md. Original application; no copied template assets. |
| Testnet eligible; no mandatory integration (Q-010–011) | NEAR testnet selected. No mainnet dependency or Intents claim. |
| Local-only demo requires video (Q-012) | Recording pending. Screenshots alone cannot satisfy a local-only submission. Hosted demo is not yet deployed. |
| Public X demonstration | Human must publish genuine video/screenshots, mention NEAR HACKATHON, tag @NEARProtocol and #NEARHackathon. Draft prepared after verified demo. No post yet. |
| License and public availability through judging (Q-013–014) | Existing MIT LICENSE preserved; public implementation still awaiting approval. Maintain any hosted demo through November 18, preferably November 25. |
| Separate projects disclosed if applicable (Q-015) | User must confirm whether another submission exists. No team or project facts inferred. |
| One submission; exact human-approved payload | Not submitted. Full payload must be reviewed first. Existing submission status must be confirmed. Corrections use official request-changes, never a duplicate submission. |
| Human identity, email, team size | Not supplied for submission; leave unset. Browser session email is not submission consent. |
| Mainnet payout account | Candidate `proofbound.near`; user confirmation required. Never used for development. |
| Contact notice | Pending verbatim presentation and explicit consent immediately before final payload approval. |
| Track claims supported by completed features | Target agents, nfts, security, business. Final recommendations depend on working evidence. DeFi omitted unless a real qualifying financial extension is completed. |
| Safe secrets and history | Original ignored `.env.local` preserved. Run `npm run check:secrets` before any commit/push; record result. |
| Sensitive operations approved | No push, public deploy, transaction signing, funds spending or submission is currently approved. Local implementation and tests are authorized. |
| API shape and retry discipline | Use only documented fields; generated requestId retained across permitted retries. No `website` field. No payload with personal information committed. |

NEAR AI Builders credits use a separate credited key (Q-000). The existing key is server-only. A capped live smoke receipt is in `docs/evidence/near-ai-smoke.json`; no balance or credit claim is inferred from the normal Cloud dashboard. No Intents fee/JWT/testnet issue (Q-006–007) applies because Intents is not integrated. Testnet funds are not real revenue (Q-008). The architecture separates a persistent worker from frontend hosting (Q-009). Payout schedule and judging process (Q-016–017) do not change implementation claims or human submission control.
