# Changelog

## 0.2.0

- Add an explicit opt-in direct OpenAI Responses API adapter, configurable model, environment-only API key, fixed endpoint, no redirects/retries, bounded input/response, timeout and fixed errors.
- Keep offline operation as default. Only minimized reports are transmitted in AI mode; generated advice is labeled untrusted and never executed.
- Add guided self-study lessons with synthetic practice questions and answer keys; optional AI tutor requests a lesson based on the selected minimized report.
- Retain schema 1 for plain triage; add schema 2 envelope for learning/AI output.
- Add mocked API and CLI tests. No live API request or real key used; actual account/model operation remains unverified.

## 0.1.0

- Initial original offline triage CLI, optional product snapshots, allowlisted JSON/text reports, input limits, synthetic examples, tests and MIT license.
