# Design research

The four requested Framer Marketplace listings and their actual previews were inspected in Chrome on November 14, 2026. Desktop and 390×844 responsive layouts were checked. The research was bounded to these four candidates. No template was purchased, remixed, exported, or copied. All PROOFBOUND components, marks, diagrams and styling are original implementation.

| Reference and preview | Observed strengths | Observed limitations |
|---|---|---|
| [Orqen](https://www.framer.com/marketplace/templates/orqen/) · [preview](https://vivacious-parsnip-195177.framer.app/) | Clear source-to-result workflow, evidence tables, approval and audit panels; mobile navigation and stacked actions | Animated entrance initially conceals the hero; dark glow-heavy styling is less suitable for long reports; some visible preview text remains unfinished |
| [Envoy](https://www.framer.com/marketplace/templates/envoy/) · [preview](https://envoy.framer.website/) | Strong asymmetric editorial headline, readable execution receipt, clear agent directory, warm light surfaces | Marketing-only screens; decorative shader and demonstration traction/testimonials do not transfer to our product; compact mobile receipt needs careful scaling |
| [Parley Agent](https://www.framer.com/marketplace/templates/parley-agent/) · [preview](https://parley.framer.ai/) | Warm color, confident typography, substantial spacing, good stacked mobile hero | Illustration dominates the first screen instead of explaining operational evidence; less useful for a financial dashboard |
| [AIwork Automation](https://www.framer.com/marketplace/templates/aiwork-automation/) · [preview](https://aiwork.framer.website/) | Light product-dashboard direction, straightforward hierarchy and mobile menu | Dashboard shrinks into a thumbnail on mobile; fairly generic cards and blue styling; demonstration reviews and metrics must not be adopted |

Scores are design judgments, 1–5. Maintainability evaluates the visible component approach; proprietary source code was not inspected. Feasibility scores refer to implementing an original system inspired by broad principles, not rights to copy a template.

| Candidate | Visual 25% | Marketplace 20% | Dashboard 20% | Responsive 15% | Components 10% | Feasibility 10% | Weighted / 5 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Orqen | 4.0 | 4.5 | 4.5 | 4.0 | 4.0 | 4.0 | 4.20 |
| Envoy | 4.8 | 4.5 | 4.4 | 4.0 | 4.0 | 4.0 | 4.39 |
| Parley Agent | 4.6 | 3.1 | 2.8 | 4.3 | 4.0 | 4.0 | 3.77 |
| AIwork Automation | 3.7 | 3.8 | 4.0 | 3.5 | 3.8 | 4.0 | 3.79 |

Selected direction: Envoy's editorial hierarchy and readable receipts, informed by Orqen's evidence presentation. PROOFBOUND uses a distinct forest, paper and lime identity with a custom geometric ownership mark. It does not use any reference's proprietary imagery, copy, fonts-as-assets, code or fabricated proof.

## Design system

- Locally bundled Manrope variable for interface and headings; Instrument Serif italic for restrained editorial emphasis. Fontsource packages supply the fonts under their bundled open font licenses. No remote font request is needed during a build.
- Paper `#f7f8f4`, ink `#17251e`, forest `#165647`, lime `#d6f27b`, white surfaces and quiet gray-green rules. CSS tokens in the application are authoritative.
- Generous marketing composition; compact but readable operational tables. Monospaced hashes and tabular financial figures, with full values available in evidence views.
- The landing-page Agent Passport is visibly labeled a capability preview. Product counters come from persisted records. Empty states invite the next real action.
- A consistent application shell contains agents, marketplace, jobs, Fuel, passport and security. Context tabs keep one agent's work, configuration and evidence together.
- Desktop supports side-by-side work and evidence. Tablet reduces columns. Mobile stacks forms and receipts, uses an explicit menu, and scrolls wide financial tables within their own region.
- Focus indicators, semantic headings, labeled inputs, error messages, disabled pending actions, reduced-motion handling and visible fixture/testnet labels are required.

Third-party assets: Lucide icons (ISC), the two bundled font families (their package font licenses), and NEAR connector UI supplied by its dependency. No paid Framer assets are included. Actual implementation screenshots and responsive findings are recorded in DEMO_EVIDENCE.md after browser QA.
