# Agent Passport

The public passport follows the NFT across ownership epochs. Each job references the accepted configuration and ownership epoch. The worker exposes public hashes and redacted outcomes. Private job access remains with original participants after transfer.

NEAR stores lifetime, current-configuration and current-epoch counters. The worker records events it observes in SQLite. Independent chain observers can inspect contract receipts. The MVP has no separate full-chain indexer. Duplicate outputs and repeat credit for one customer in an ownership epoch are excluded from independent reputation.
