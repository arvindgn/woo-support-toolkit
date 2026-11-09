# Woo Support Toolkit

A small, original, dependency-free offline CLI for support staff reviewing WooCommerce REST order JSON exports. It highlights order-status evidence and possible downloadable-product setup issues without contacting a store or copying customer details into its report.

**Version 0.1.0.** This is a local triage aid, not a WooCommerce plugin, payment verifier, permission auditor, or automatic repair tool. It is not affiliated with WooCommerce. No adoption or compatibility certification is claimed.

## Run locally

Requires Node.js 22 or later. No dependency installation, API credentials, network access, or live store data is needed to try it.

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

`--format text` is the default; `--format json` emits a machine-readable report with `schema_version: 1`. Identical inputs produce identical output; no current timestamps, filenames, customer fields, store IDs, money amounts, URLs, or arbitrary source strings are included. Output goes to stdout. Errors go to stderr with fixed error codes only, never parser excerpts or filesystem exception messages.

- Exit `0`: report generated, even if findings exist.
- Exit `2`: invalid options, unreadable/oversized input, invalid JSON/UTF-8, or unsupported input shape.
- Exit `3`: unexpected internal/output failure.

`--help` and `--version` must be used alone. CLI errors are plain text even with `--format json`. Scripts should inspect the exit code before parsing stdout. Partial output is possible if the destination stops accepting writes.

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

## AI-assisted support workflows

A support team can review this tool's deterministic report before choosing to share it with an AI assistant for help explaining findings or planning manual checks. Review the report for sensitive context and follow your organization's data-sharing policy first; never send raw customer exports or credentials. AI suggestions still need human verification against the store's actual configuration.

The CLI itself contains no AI model, makes no network calls, and has no AI service integration. It prepares a limited, structured triage report; it does not automate an AI workflow or guarantee anonymity.

## Privacy boundary and limitations

Reports are constructed from a fixed allowlist of enum values, positional indexes, counts, and finding codes. Billing/shipping data, names, emails, notes, tokens, metadata, payment identifiers, product names and file URLs are ignored and not copied. This is **data minimization, not an anonymity guarantee**: even statuses, counts, and patterns may be sensitive in context. Review any report before sharing it.

The CLI itself makes no network requests, writes no files, has no telemetry, and never mutates the store. Shell redirection can write a report if you request it. Your operating system, terminal logging, backups, or wrapper scripts are outside this guarantee. Raw exports remain sensitive on your computer and are loaded into process memory.

The tool does not inspect order-specific download grants, download logs, expiry dates, download counts, storage permissions, file existence, gateway transactions, email delivery, plugin behavior, historical configuration, or account access. Product export `downloads` entries are counted as present regardless of their contents. Do not grant access, mark orders paid, or issue refunds based solely on a report.

## Development

```sh
npm run check
```

Tests use Node's built-in test runner and synthetic fixtures. They cover conservative diagnostics, variation matching, deterministic output, free-text suppression, invalid shapes, resource limits, UTF-8 errors, CLI files/stdin, and fixed error messages. Node 24 is the locally tested runtime; other supported Node versions should be tested before deployment.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and the [MIT license](LICENSE).
