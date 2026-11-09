# Woo Support Toolkit

A small, original, dependency-free offline-first CLI for support staff reviewing WooCommerce REST order JSON exports. It highlights order-status evidence and possible downloadable-product setup issues without contacting a store or copying customer details into its report.

**Version 0.2.0.** This is a local triage aid, not a WooCommerce plugin, payment verifier, permission auditor, or automatic repair tool. It is not affiliated with WooCommerce. No adoption or compatibility certification is claimed.

## Run locally

Requires Node.js 22 or later. No dependency installation, API credentials, network access, or live store data is needed for offline triage and guided learning. Optional AI mode requires your own OpenAI API access.

```sh
node src/cli.js --orders examples/orders.synthetic.json
node src/cli.js --orders examples/orders.synthetic.json --products examples/products.synthetic.json --format json
node src/cli.js --orders - --format json < examples/orders.synthetic.json
node --test
```

All example data is synthetic. Use only exports you are authorized to access. Store actual exports outside this repository; never commit them or paste them into an issue.

## Input contract

- `--orders FILE` accepts one WooCommerce REST order object or an array. Each order must contain a `line_items` array of objects. Use `-` for stdin.
- `--products FILE` optionally accepts one REST product/variation object or an array, with unique positive safe-integer `id` values. A variation response can be included in the same array as product responses. Standard order line items do not contain enough information to establish whether a product is downloadable.
- Matching uses a positive `variation_id` first, otherwise `product_id` when the variation ID is zero or absent. Missing variation snapshots remain unknown even if the parent product is present. Invalid IDs never become output.
- The optional product snapshot's `downloadable` boolean and `downloads` array support basic configuration triage. `listed` means only that the array has entries, not that any file is valid or reachable.
- The tool accepts REST response bodies, not CSV, WordPress XML, database dumps, paginated wrapper objects, or newline-delimited JSON. Combine pages into a JSON array locally if needed.
- Each input is limited to 10 MiB of UTF-8 JSON. Maximums: 1,000 orders, 10,000 products, 1,000 line items per order, and 10,000 line items overall. Files must be regular files (stdin is allowed). Inputs are processed in memory.

Order and item indexes in reports are **1-based positions in the input**, not store IDs. This lets staff find the source record locally without publishing identifying values. Keep the input ordering if correlating a report.

## Output and exit codes

`--format text` is the default; plain triage with `--format json` emits a machine-readable report with `schema_version: 1`. In offline mode, identical inputs produce identical output; no current timestamps, filenames, customer fields, store IDs, money amounts, URLs, or arbitrary source strings are included. Output goes to stdout. Errors go to stderr with fixed error codes only, never parser excerpts or filesystem exception messages.

- Exit `0`: report generated, even if findings exist.
- Exit `2`: invalid options, unreadable/oversized input, invalid JSON/UTF-8, or unsupported input shape.
- Exit `3`: unexpected internal/output failure.
- Exit `4`: AI configuration, service, response, quota, or timeout failure. No advice/report is written to stdout on AI failure; rerun without `--ai` for offline output.

`--help` and `--version` must be used alone. CLI errors and AI transfer/cost notices are plain text on stderr even with `--format json`. Scripts should inspect the exit code before parsing stdout. Partial output is possible if the destination stops accepting writes.

### Interpreting findings

| Code | Interpretation and manual next step |
| --- | --- |
| `ORDER_STATUS_UNKNOWN` | Missing or custom status. Check its meaning in the store; arbitrary statuses are never echoed. |
| `PAYMENT_OR_ORDER_REVIEW_NEEDED` | Pending, on-hold, failed, or draft order. Review payment and order workflow before considering fulfillment. |
| `ORDER_NOT_ACTIVE` | Cancelled or refunded status. Review the intended order/refund outcome. |
| `PAID_DATE_NOT_RECORDED` | Processing/completed snapshot has no recognizable paid date. This does **not** prove nonpayment. Verify payment separately. |
| `PRODUCT_SNAPSHOT_MISSING` | No exact product/variation snapshot match. Downloadability remains unknown. |
| `DOWNLOADABLE_FLAG_UNKNOWN` | Matched snapshot has no boolean downloadable flag. |
| `NO_DOWNLOAD_FILES_LISTED` | Downloadable snapshot lists zero files. This may explain missing downloads; verify current settings. |
| `DOWNLOAD_FILES_UNKNOWN` | Downloadable snapshot has no array of files. |
| `VERIFY_DOWNLOAD_PERMISSIONS_AND_LIMITS` | Manual check needed for per-order permission grants, expiry, remaining downloads, and applicable store access settings. No permission check was performed. |

`paid_date: recorded` means a recognizable timestamp was found in `date_paid_gmt` or `date_paid`; it is not gateway settlement evidence. `not_recorded` includes absent and unrecognized timestamps. Product snapshots may be newer than the order and may not reflect settings at purchase time. No finding proves a root cause.

## Optional direct OpenAI integration

`--ai --model MODEL` explicitly opts in to one request to the fixed OpenAI Responses API endpoint, `https://api.openai.com/v1/responses`. There is no default model, automatic retry, or automatic AI call. You choose a Responses-compatible model available to your account. API usage costs may apply, including when a request times out after the server has started work. The 1,200-output-token cap is not a monetary spending limit; review your model pricing and account controls first.

First run offline and review the minimized report. AI mode sends the report's statuses, counts, positional indexes, evidence flags, and finding codes to OpenAI for educational triage advice, plus fixed instructions and your chosen model ID. It never sends raw exports, customer names, email/address fields, notes, payment tokens, product names, or file URLs. This is data minimization, not guaranteed anonymity; share only data you are authorized to transmit.

Configure `OPENAI_API_KEY` privately in your own environment using your preferred secret manager or secure shell workflow. The CLI does not create, save, print, or accept API keys as command-line arguments, and does not read `.env` files. Do not put credentials in commands, repository files, issue reports, or examples. An environment variable can still be exposed by your OS or other processes. The key is sent only in the HTTPS authorization header to OpenAI.

```sh
# After privately configuring OPENAI_API_KEY and selecting an accessible model:
node src/cli.js --orders examples/orders.synthetic.json --ai --model YOUR_MODEL_ID
```

The request uses `store: false`, no tools, a 30-second timeout covering response reading, a 64 KiB report-input limit, and a 256 KiB response limit. It refuses redirects. These controls do not establish a universal data-retention guarantee; review the provider's applicable data policies. Failed responses are represented by fixed codes such as `AI_KEY_REQUIRED`, `AI_AUTH_FAILED`, `AI_RATE_OR_QUOTA_LIMIT`, `AI_TIMEOUT`, `AI_INPUT_TOO_LARGE`, or `AI_REQUEST_FAILED`; raw remote errors are suppressed.

AI advice is explicitly marked untrusted, is not deterministic, and can contain inaccurate or invented claims. It is never executed and cannot change the store. Control characters and exact key echoes are removed and displayed text is limited to 12,000 characters. **AI prose is not the fixed allowlisted report** and may invent names, links or other details despite instructions; review it before sharing or following it. No automatic redaction system can guarantee safe arbitrary model text.

Implementation follows the [official OpenAI text generation guide](https://developers.openai.com/api/docs/guides/text) and [Responses API reference](https://developers.openai.com/api/reference/resources/responses/methods/create). API behavior is covered by mocked tests only. No live API credential or paid request was used to validate this version; account/model compatibility and real model quality remain unverified.

## Guided learning sessions

```sh
node src/cli.js --learn
node src/cli.js --learn --format json
node src/cli.js --learn --ai --model YOUR_MODEL_ID
node src/cli.js --orders examples/orders.synthetic.json --learn
```

`--learn` provides a guided **self-study** session: four short explanations, practice questions, and answer keys covering payment evidence, download configuration, variations, and privacy. Pause before reading each answer. Without `--orders`, it uses built-in synthetic practice orders and products. No key or network is needed.

With a custom `--orders` file, its triage report appears alongside the same fixed synthetic lesson; the offline lesson is not personalized. `--learn --ai --model MODEL` adds a model-generated lesson requested from the minimized selected report (synthetic by default, custom when supplied). This is a single-request tutor supplement, not an interactive multi-turn chat, persistent learner profile, training/fine-tuning, or certification. Answers/progress are not collected or saved.

Plain triage JSON retains `schema_version: 1`. With `--learn` or `--ai`, JSON uses a `schema_version: 2` envelope containing `report` and optional `learning_session` / `ai_advice`. The nested report retains schema 1. Text output separates report, lesson, and untrusted advice.

## Privacy boundary and limitations

Offline triage reports are constructed from a fixed allowlist of enum values, positional indexes, counts, and finding codes. Billing/shipping data, names, emails, notes, tokens, metadata, payment identifiers, product names and file URLs are ignored and not copied. This is **data minimization, not an anonymity guarantee**: even statuses, counts, and patterns may be sensitive in context. Review any report before sharing it.

The default offline path makes no network requests. Only explicit `--ai` mode contacts OpenAI as described above. The CLI writes no files, has no telemetry, and never mutates the store. Shell redirection can write a report if you request it. Your operating system, terminal logging, backups, or wrapper scripts are outside this guarantee. Raw exports remain sensitive on your computer and are loaded into process memory.

The tool does not inspect order-specific download grants, download logs, expiry dates, download counts, storage permissions, file existence, gateway transactions, email delivery, plugin behavior, historical configuration, or account access. Product export `downloads` entries are counted as present regardless of their contents. Do not grant access, mark orders paid, or issue refunds based solely on a report.

## Development

```sh
npm run check
```

Tests use Node's built-in test runner and synthetic fixtures. They cover conservative diagnostics, variation matching, deterministic output, free-text suppression, invalid shapes, resource limits, UTF-8 errors, CLI files/stdin, and fixed error messages, opt-in-only network behavior, AI response bounds, timeouts, and guided learning. Node 24 is the locally tested runtime; GitHub CI runs on Node 22 and 24. AI tests use mocked fetch responses, not live requests.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and the [MIT license](LICENSE).
