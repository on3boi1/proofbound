# Release review

GitHub reports that `on3boi1/proofbound` is public. Remote `main` points to `7ae2207a034bcaa4fec6e6c6a0a02b797c389e7c`. GitHub rejected the authorized push of `176672c` with `GH007` because the unpublished commit metadata uses a private email address. The remote hackathon branch was absent before the push and the server declined to create it.

The local branch `codex/proofbound-public-review` carries identical trees, messages and timestamps for all nine unpublished commits, with the repository owner's GitHub no-reply email in author and committer metadata. Its tip `e4ff6ed2cc97161f41d97f5df13222639b730b43` has the same tree as `176672c`. The new commit IDs require approval for this exact push.

```sh
git push origin e4ff6ed2cc97161f41d97f5df13222639b730b43:refs/heads/codex/proofbound-hackathon
```

Verify the public branch opens and GitHub shows the intended commit and evidence files. Use the direct branch link in the demo and confirm the exact repository URL for submission.

| Target | Settings to apply after approval |
|---|---|
| Vercel frontend | Repo `on3boi1/proofbound`, branch `codex/proofbound-hackathon`, root `apps/web`, Next.js preset, and workspace files outside the root enabled. Use Vercel's npm workspace install from the root lockfile and run `npm run build` in `apps/web`. Select Node.js 24.x where the project settings permit. Check the resolved build version because an applicable `engines.node` range can override the project setting. Set server-only `PROOFBOUND_WORKER_URL` to the deployed worker's HTTPS URL. |
| Persistent worker | Proposed host is a single paid Render Web Service from the same commit, with repository root as root directory, Node 24.15.0, build `npm ci --include=dev`, start `node --import tsx apps/worker/src/index.ts`, health path `/api/health`, and 1 GB persistent disk mounted at `/var/data/proofbound`. Set auto deploy off and confirm the displayed price before creating the service. |
| Worker environment | `PROOFBOUND_HOST=0.0.0.0`, `PROOFBOUND_PORT=10000`, `PROOFBOUND_DB_PATH=/var/data/proofbound/proofbound.sqlite`, `PROOFBOUND_WEB_ORIGIN` equal to the exact Vercel origin, `PROOFBOUND_MODE=testnet`, `NEAR_CONTRACT_ID=contract.proofbound-dev-2026.testnet`, `NEAR_RPC_URL=https://rpc.testnet.near.org`, `PROOFBOUND_PROVIDER=fixture`, `PROOFBOUND_ALLOW_CHAIN_WRITES=0`. |

An existing Vercel project with a prior deployment can build a preview from the hackathon branch before a merge. Vercel classifies a new project's first deployment as Production even when it comes from a development branch. No project link is present in the checkout. Verify the target project and its deployment history before selecting the environment. Use one stable deployment hostname as the worker origin. Test preview visibility in a signed-out browser before distributing the URL to judges. [Vercel deployment environments](https://vercel.com/docs/deployments/environments#first-deployment) · [Vercel monorepos](https://vercel.com/docs/monorepos) · [Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

The proposed Render service lists 512 MB compute at **US$7 per month** and 1 GB persistent disk at **US$0.25 per month**, for **US$7.25 per month** before tax, workspace fees, and usage overages. Start with service writes disabled and fixture inference selected. The public preview uses no wallet, signing, or provider credentials. Atlas is now active in Hybrid mode and discoverable from a fresh worker. Public history stored only in the local SQLite database becomes available on a separate worker after the relevant public records are migrated. [Render pricing](https://render.com/pricing) · [Render persistent disks](https://render.com/docs/disks)

After release, open the production `/`, `/explore`, `/dashboard` and `/demo` in Chrome, check titles, favicon and mobile navigation, verify the testnet bootstrap and deployed contract address, and check Meteor handoff at the production origin. Restart the worker once and verify the SQLite file survives the restart. Treat a signed-in wallet session and real paid jobs as separate evidence.

The official deadline is **November 14 at 23:59 UTC**. The human publishes the demo on X. Submit once after the human confirms the exact JSON, verified public repository link and public X link. The submission needs the team lead, contact email, team size, tracks, verified mainnet payout ID, description and the required contact consent. [Official rules](https://nearhackathon.com/HACKATHON.md)
