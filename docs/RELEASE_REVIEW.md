# Release review

## Public testnet demo

The [public site](https://tryproofbound.pages.dev/) uses Cloudflare Pages Free, project `tryproofbound`. It serves the Next.js App Router through vinext and reads finalized NEAR testnet data directly. Atlas #1, its profile and Passport work with the Windows frontend and tunnel stopped. Public execution, authenticated worker sessions and transactions are offline. [Production checks and deployment ID](evidence/cloudflare-frontend-deployment.json)

The [original hackathon commit](https://github.com/on3boi1/proofbound/tree/be6a2193daa01c998647660741ef4418d6e34e72) remains available for review. The Pages move is a post-deadline hosting update. The [original demo post](https://x.com/on3boi_1/status/2121754200661262588) and [historical tunnel evidence](evidence/public-demo-deployment.json) document the earlier release.

### Reproduce the Pages build

Run `npm ci` from the repository root, followed by:

```sh
npm run pages:build --workspace @proofbound/web
npm run pages:preview --workspace @proofbound/web -- --ip 127.0.0.1
```

The build stages the frontend Worker and static files under `.data/cloudflare-pages/output`. The config in `apps/web/cloudflare-pages/wrangler.jsonc` fixes the public origin and read-only mode in the artifact. The public site uses same-origin `/api` reads and public NEAR testnet RPC. Cloudflare requires only the public configuration in the Pages build. After a reviewed release and deploy approval, publish with `npm run pages:deploy --workspace @proofbound/web -- --project-name tryproofbound --branch codex/proofbound-hackathon`.

## Publication record

The initial hackathon publication used GitHub's no-reply address and published `be6a2193daa01c998647660741ef4418d6e34e72`. The repository started at `7ae2207a034bcaa4fec6e6c6a0a02b797c389e7c`. Open the [hackathon branch](https://github.com/on3boi1/proofbound/tree/codex/proofbound-hackathon) for the implementation.

## Optional hosted configuration under review

The configuration below was evaluated for a separate authenticated execution deployment. The current Pages release uses only public testnet reads.

| Target | Settings to apply after approval |
|---|---|
| Vercel frontend | Hobby personal project for the non-commercial testnet demo. Repo `on3boi1/proofbound`, branch `codex/proofbound-hackathon`, root `apps/web`, Next.js preset, shared workspace files enabled. Use the root npm lockfile and run `npm run build` in `apps/web`. Select Node.js 24.x and verify the resolved build version. Use the included `vercel.app` hostname. |
| Windows worker | Run `scripts/start-tunnel-worker.ps1` from the existing checkout with Node.js 24 and the existing `.data/proofbound-atlas-testnet.sqlite`. It listens at `127.0.0.1:4311`, uses the deployed NEAR testnet contract, and starts with transaction submission paused. |
| Cloudflare Quick Tunnel | Run `cloudflared tunnel --url http://127.0.0.1:4311` with the official Windows binary once approved. Use the generated HTTPS hostname as the Vercel API's upstream. No account, domain or interactive email gate is required for the server-to-server connection. |

Render Free discards local SQLite on restart, idle spin-down and redeploy. SQLite holds job inputs, operation IDs, verification evidence and inference limits while funds sit on testnet. The paid Render proposal is canceled. Scope Vercel Hobby to a personal non-commercial demo with test tokens. Vercel defines commercial use broadly and its published terms give no explicit exception for a prize-linked deployment. Confirm Hobby eligibility for the intended contest use before deploying. [Render Free limits](https://render.com/docs/free#local-files-lost-on-redeploy) · [Vercel Hobby terms](https://vercel.com/legal/terms) · [Vercel Fair Use](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage)

Vercel can build a Git branch preview without a merge if the project already has a deployment. Its first deployment in a new project is classified as Production. Use the exact stable frontend origin for both worker and frontend. Verify access when signed out of Vercel before publishing a link. [Vercel deployment environments](https://vercel.com/docs/deployments/environments#first-deployment) · [Vercel monorepos](https://vercel.com/docs/monorepos)

### Hosted frontend and worker runbook

Use these steps only after a hosted deployment is approved. For judging, use the published demo link or the local fixture workflow in the [README](../README.md).

1. After approval, select the exact public Vercel origin. Stop the existing Atlas worker cleanly before starting the replacement on the same port and database. Preserve the SQLite file and its WAL state. Make a local SQLite backup before the demo if copying files while the service runs.
2. Generate a random 32-byte proxy secret in a password manager as 64 lowercase hexadecimal characters. Store it in the Vercel project as the server-only `PROOFBOUND_WORKER_PROXY_TOKEN` and enter it through the masked prompt for the Windows worker.

   ```powershell
   $pbProxySecret = Read-Host 'PROOFBOUND server proxy token' -AsSecureString
   .\scripts\start-tunnel-worker.ps1 -WebOrigin 'https://YOUR-PROJECT.vercel.app' -ProxyToken $pbProxySecret
   ```

3. Start the approved Quick Tunnel. Set Vercel's server-only `PROOFBOUND_WORKER_URL` to the generated `https://….trycloudflare.com` URL and `PROOFBOUND_WEB_ORIGIN` to the exact public site origin. Keep these variables in the deployment environment used by the project. The browser uses same-origin `/api` calls. The route sends the proxy token over HTTPS and forwards only allowlisted app methods and paths. The worker checks the token, origin, rate limits, wallet identity and per-operation authority. The worker's health and local identity endpoints stay off the public route list.
4. Enable the reviewed NEAR testnet jobs only after approval and verification of an existing NEAR AI key that cannot draw on paid billing or auto-recharge. Check SQLite for queued or unfinished jobs before enabling recovery and execution. Run the Windows script with `-EnableApprovedJobs` to load the executor and verifier keys from Windows DPAPI into the worker process. It enables existing-credit inference with a persistent cap of two requests and 16,000 reserved tokens. The worker rejects further escrow once that budget is reached and pauses new research on a provider authentication or billing rejection. Keep the NEAR AI and NEAR signing keys on this PC. Vercel receives only the proxy token and the non-secret URLs.
5. From the existing Chrome profile, verify Meteor sign-in using its off-chain message. From an independent signed-out browser session, verify the landing page, marketplace listing, favicon and safe public proof reads. Confirm that the bare tunnel URL rejects direct requests. Stop the tunnel briefly outside active jobs and verify the public app stays online and reports the worker unavailable. Restore the tunnel and verify recovery. Run the approved escrow and settlement workflow through the public frontend and retain the transaction receipts.

Quick Tunnels are for temporary testing and development. They have no uptime guarantee, cap requests at 200 in flight, and assign a new URL each time the connector starts. Update the Vercel worker URL and redeploy when it changes. The frontend remains available when the Windows PC sleeps or goes offline. Wallet sessions, new work, and evidence that lives in SQLite require a running worker. If the PC goes down mid-job, preserve the database and inspect the chain before resuming. Customers can expire unsettled jobs after the onchain deadline under the contract's refund rules. [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)

The original deadline was **November 14 at 23:59 UTC**. The [demo is published on X](https://x.com/on3boi_1/status/2121754200661262588). Updates to an existing submission go through the organizer's [change request form](https://nearhackathon.com/request-changes). Published code and demo evidence are listed in the [submission review](SUBMISSION_REVIEW.md).
