# Hackathon compliance

Authority: [live HACKATHON.md](https://nearhackathon.com/HACKATHON.md), read in full November 14, 2026, around 01:00 UTC. Also reviewed the official [starter repository](https://github.com/nearai/near-hackathon-prompt-examples), [setup](https://github.com/nearai/near-hackathon-prompt-examples/blob/main/00-setup.md), and [submission checklist](https://github.com/nearai/near-hackathon-prompt-examples/blob/main/SUBMITTING.md). Re-read live rules immediately before submission; this document does not freeze them.

Deadline is **2026-11-14 23:59 UTC**, or **November 15, 00:59 Africa/Lagos**.

| Requirement | Current status / evidence |
|---|---|
| Eligible development window and disclosed baseline (Q-001–004) | Baseline `7ae2207`. The [README](../README.md) links the hackathon branch diff. |
| Public source before deadline | Commit `be6a2193daa01c998647660741ef4418d6e34e72` is available on the [public hackathon branch](https://github.com/on3boi1/proofbound/tree/codex/proofbound-hackathon). |
| Reproducible prototype and judging instructions | Local fixtures, contract tests, and commands are documented. [Tests and evidence](TEST_RESULTS.md) |
| Libraries, AI assistance, templates disclosed (Q-005) | README and DESIGN_RESEARCH.md. Original application; no copied template assets. |
| Testnet eligible; no mandatory integration (Q-010–011) | NEAR testnet selected. No mainnet dependency or Intents claim. |
| Demo availability (Q-012) | The branded Cloudflare Pages site was verified after the deadline as a hosting update. It reads finalized testnet data with the local frontend offline. [Public demo](https://tryproofbound.pages.dev/) · [Deployment evidence](evidence/cloudflare-frontend-deployment.json) |
| Public X demonstration | The published first post includes the narrated demo, NEAR HACKATHON, @NEARProtocol and #NEARHackathon. [Official demo post](https://x.com/on3boi_1/status/2121754200661262588) |
| License and public availability through judging (Q-013–014) | MIT license retained and implementation public. Official hosting guidance asks for availability through November 18, ideally November 25. The reproducible local workflow remains available on GitHub. |
| Separate projects disclosed if applicable (Q-015) | User must confirm whether another submission exists. No team or project facts inferred. |
| One submission and approved corrections | Submission status requires confirmation from the project owner. The organizers manually review changes to existing entries. [Request changes](https://nearhackathon.com/request-changes) |
| Human identity, email, team size | Not supplied for submission; leave unset. Browser session email is not submission consent. |
| Mainnet payout account | Candidate `proofbound.near`; user confirmation required. Never used for development. |
| Contact notice | Pending verbatim presentation and explicit consent immediately before final payload approval. |
| Track claims supported by completed features | Candidates `agents`, `nfts`, `security` and `business`. Public testnet evidence covers ownership, activation and restricted roles. Paid research, settlement and transfer are demonstrated locally. Team confirmation is pending. |
| Safe secrets and history | Published history and working tree passed the repository scanner. Environment files, service keys and SQLite stay out of Git. |
| Sensitive operations approved | Original branch push, the approved testnet transactions and the free Pages frontend release are recorded in the evidence. GitHub publication of the hosting update, further chain transactions, X replies and submission corrections require approval. |
| API shape and retry discipline | Use only documented fields; generated requestId retained across permitted retries. No `website` field. No payload with personal information committed. |

NEAR AI Builders credits use a separate credited key (Q-000). The existing key is server-only. A capped live smoke receipt is in `docs/evidence/near-ai-smoke.json`; no balance or credit claim is inferred from the normal Cloud dashboard. No Intents fee/JWT/testnet issue (Q-006–007) applies because Intents is not integrated. Testnet funds are not real revenue (Q-008). The architecture separates a persistent worker from frontend hosting (Q-009). Payout schedule and judging process (Q-016–017) do not change implementation claims or human submission control.
