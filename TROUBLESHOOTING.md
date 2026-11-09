# Troubleshooting

Start with the error code printed to stderr. Errors deliberately omit filenames, input excerpts, credentials, and remote response bodies. Do not work around this by posting a raw export or API response in an issue.

## Getting started

- **`node` is not recognized:** install Node.js 22 or later from its official distribution, then reopen your terminal. This repository does not install Node for you.
- **The CLI file cannot be found:** open a terminal in the extracted/cloned project folder containing `package.json`. Paths are relative to your current directory, not the export's directory.
- **A path contains spaces:** quote the complete path. Use `--orders "local exports/orders.json"`, with your own actual path.
- **The command waits after `--orders -`:** the dash means read stdin until end-of-input. If you meant a file, supply its path instead. The default input reader has a byte limit, not an interactive-input timeout.
- **There is no npm package installed:** no installation is needed. Run `node src/cli.js` from the repository as shown in the README.

## Input and usage errors (exit 2)

| Code | What to review |
| --- | --- |
| `INVALID_ARGUMENTS` | Use `--orders FILE` or `--learn`. Each option may appear once. `--ai` requires `--model`; `--model` requires `--ai`. `--products` requires `--orders` and cannot read stdin. `--help` and `--version` must be used alone. |
| `INPUT_READ_FAILED` | Check the local file path and whether your account can read it. Do not broaden unrelated file permissions. |
| `INPUT_MUST_BE_REGULAR_FILE` | Supply a regular file, not a directory or device. Use `--orders -` only when intentionally reading stdin. |
| `INVALID_JSON` | Use an actual JSON response body, not CSV, XML, HTML, a fenced code block, or multiple newline-delimited JSON objects. Do not use a public online validator for customer exports. |
| `INVALID_UTF8` | Re-export or save the JSON as UTF-8 using a trusted local editor. Renaming an extension does not convert the content. |
| `INPUT_TOO_LARGE` | Each file/stdin input is capped at 10 MiB. Create smaller local batches without splitting individual order objects. |
| `INVALID_ORDERS` / `INVALID_PRODUCTS` | Supply one object or an array of objects, not a wrapper such as `{"orders": [...]}`. Limit each batch to 1,000 orders and 10,000 products. |
| `INVALID_LINE_ITEMS` | Each order needs a `line_items` array containing objects, with no more than 1,000 items per order. An empty object is not an order export. |
| `TOO_MANY_ITEMS` | Split orders into batches with no more than 10,000 total line items each. |
| `INVALID_PRODUCT_IDS` | Product/variation snapshot IDs must be unique positive safe integers, not strings. Check that combined export pages do not repeat products. |

Splitting batches restarts positional order/item indexes. Keep each report with the corresponding local input batch so you do not confuse an index with a store order ID.

## Optional AI errors (exit 4)

If AI mode fails, the CLI does not print a partial report or advice to stdout. You can still obtain offline results by removing **both** `--ai` and `--model MODEL` from the command. Keep `--learn` if you want the offline self-study lesson.

| Code | What to review |
| --- | --- |
| `AI_KEY_REQUIRED` | Configure your own valid `OPENAI_API_KEY` privately in the environment used to launch Node. A `.env` file alone is not loaded by this CLI. Never paste the key into an issue or command-line argument. |
| `AI_MODEL_REQUIRED` | Supply a model ID with `--model` together with `--ai`. `YOUR_MODEL_ID` in documentation is a placeholder, not a model recommendation. |
| `AI_AUTH_FAILED` | Check your key's validity and permissions in your own OpenAI account. Do not share the key for debugging. |
| `AI_RATE_OR_QUOTA_LIMIT` | Review rate limits, quota, and billing in your account. Avoid repeated requests; each accepted request may incur cost. |
| `AI_INPUT_TOO_LARGE` | The minimized report exceeds 64 KiB even if the raw input meets its separate limit. Review a smaller authorized batch offline before choosing to send it. |
| `AI_TIMEOUT` | The request exceeded 30 seconds. Server work may already have started, so do not assume no charge or that a repeat is free. Use offline results while investigating. |
| `AI_HTTP_FAILED` / `AI_REQUEST_FAILED` | Check network availability and whether your chosen model supports Responses in your account. The CLI suppresses detailed remote errors and does not accept alternate endpoints. Do not disable TLS verification. |
| `AI_RESPONSE_TOO_LARGE` | The response exceeded 256 KiB; it was rejected rather than printed. Use offline results. |
| `AI_INVALID_RESPONSE` / `AI_INCOMPLETE_OR_INVALID_RESPONSE` / `AI_NO_TEXT` | The reply could not be used, was incomplete/failed, or contained no assistant output text. No model advice is shown. Treat this as a service/compatibility limitation, not a store diagnosis. |

There are no automatic retries. Review costs and the original reason before making another opt-in request. Tests for the integration use mocks; live account/model compatibility has not been verified by this project.

## A report is not the same as a diagnosis

- **Unknown downloadable status:** ordinary order exports omit the product's downloadable flag. Supply the matching product snapshot if available. For a variation, supply that variation's snapshot; the parent is not a substitute.
- **Paid date not recorded:** absence or an unrecognized timestamp is not proof that no payment occurred.
- **Files listed:** an entry in a product's downloads array does not prove file validity, permission grants, or customer access.
- **Exit 0 with findings:** success means the report was generated, not that the order has no issues.
- **Empty `orders` array:** a valid empty export produces a zero-order report, not a failure.
- **JSON shape differs with learning/AI:** plain triage uses schema 1. `--learn` or `--ai` uses a schema 2 envelope; access its nested `report` for triage data.

## Reporting a problem safely

Use the repository's bug-report template. Include the tool version, Node version if known, operating system, fixed error code, and a minimal fabricated reproduction. Replace local paths and model/account-specific details if they are sensitive. Never attach real exports, API keys, payment information, or unscreened terminal logs. For suspected security issues, follow [SECURITY.md](SECURITY.md) rather than posting details publicly.

This guide was written from source inspection. The documentation-only update was not executed or tested.
