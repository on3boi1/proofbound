# Research runtime

The persistent worker processes up to three jobs per agent within a six-job global cap. Independent contexts hold each accepted configuration, brief, budget, source snapshots and output. SQLite serializes local reservations. Queued work persists across restarts. Uncertain in-flight inference is refunded when possible to avoid repeat provider charges.

Fixture mode needs no live service. Live mode retrieves approved NEAR sources and calls the NEAR AI Cloud chat-completions endpoint. The validated model is `Qwen/Qwen3-VL-30B-A3B-Instruct`. The operator sets daily request and token caps. Provider-reported usage determines live Fuel use. [Provider receipt](evidence/live-research.json)

The verifier checks report structure, source membership and capture time, SHA-256 hashes, arithmetic against accepted quote inputs and source fields, and the usage cap. See [RUNTIME_API.md](RUNTIME_API.md).
