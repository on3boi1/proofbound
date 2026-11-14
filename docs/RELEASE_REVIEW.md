# Release review

GitHub reports that `on3boi1/proofbound` is already public. As checked on November 14, remote `main` points to `7ae2207a034bcaa4fec6e6c6a0a02b797c389e7c`, and the remote hackathon branch is absent. Publish the reviewed local head as a dedicated submission branch after approval.

```sh
git push origin HEAD:refs/heads/codex/proofbound-hackathon
```

Verify the public branch opens and GitHub shows the intended commit and evidence files. Use the direct branch link in the demo and confirm the exact repository URL for submission.

| Target | Settings to apply after approval |
|---|---|
| Vercel frontend | Repo `on3boi1/proofbound`, branch `codex/proofbound-hackathon`, root `apps/web`, Next.js preset, Node.js 24, and workspace files outside the root enabled. Build with the repo lockfile and the Next.js preset. Set server-only `PROOFBOUND_WORKER_URL` to the deployed worker's HTTPS URL. |
| Persistent worker | Proposed host is a single paid Render Web Service from the same commit, with repository root as root directory, Node 24.15.0, build `npm ci --include=dev`, start `node --import tsx apps/worker/src/index.ts`, health path `/api/health`, and 1 GB persistent disk mounted at `/var/data/proofbound`. Set auto deploy off and confirm the displayed price before creating the service. |
| Worker environment | `PROOFBOUND_HOST=0.0.0.0`, `PROOFBOUND_PORT=10000`, `PROOFBOUND_DB_PATH=/var/data/proofbound/proofbound.sqlite`, `PROOFBOUND_WEB_ORIGIN` equal to the exact Vercel origin, `PROOFBOUND_MODE=testnet`, `NEAR_CONTRACT_ID=contract.proofbound-dev-2026.testnet`, `NEAR_RPC_URL=https://rpc.testnet.near.org`, `PROOFBOUND_PROVIDER=fixture`, `PROOFBOUND_ALLOW_CHAIN_WRITES=0`. |

Start the public preview with service writes disabled and fixture inference selected. Keep wallet, signer and provider credentials out of Vercel and the public preview. Atlas #1 is finalized on testnet and can be read by the owner. The marketplace can list it once Hybrid activation finalizes. Public history stored only in the local demo SQLite database becomes available on a separate deployed worker after the relevant public records are migrated. Verify that the deployed worker and frontend use the same origin and show their current capabilities accurately. [Vercel monorepos](https://vercel.com/docs/monorepos) · [Render web services](https://render.com/docs/web-services) · [Render persistent disks](https://render.com/docs/disks)

After release, open the production `/`, `/explore`, `/dashboard` and `/demo` in Chrome, check titles, favicon and mobile navigation, verify the testnet bootstrap and deployed contract address, and check Meteor handoff at the production origin. Restart the worker once and verify the SQLite file survives the restart. Treat a signed-in wallet session and real paid jobs as separate evidence.

The official deadline is **November 14 at 23:59 UTC**. The human publishes the demo on X. Submit once after the human confirms the exact JSON, verified public repository link and public X link. The submission needs the team lead, contact email, team size, tracks, verified mainnet payout ID, description and the required contact consent. [Official rules](https://nearhackathon.com/HACKATHON.md)
