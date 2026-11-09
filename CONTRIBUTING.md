# Contributing

Contributions should keep this tool small, offline-first, and useful for support triage.

1. Explain the problem with synthetic input and expected output. Never attach customer exports or credentials.
2. Make a focused change, with tests, and run `npm run check` on Node 22 or newer. No dependency installation is needed.
3. Preserve deterministic offline output and the fixed triage report allowlist. Keep AI prose clearly separate and untrusted. Never echo arbitrary input, exception text, paths, IDs, names, emails, metadata, URLs, or secrets.
4. Label evidence and possible causes accurately. Do not claim payment, file availability, or download permissions were verified from a snapshot.
5. Document input/output changes and consider schema version compatibility. New input support needs malformed-input and privacy regression tests.

No live-store tests, production credentials, paid API test calls, or dependency additions are expected. Mock OpenAI requests in tests; do not enable network access by default or weaken the explicit opt-in requirement. Discuss scope changes before implementing them. Contributions must be original or have a compatible license and documented provenance; do not copy proprietary store/plugin source. By contributing, you agree that your contribution is provided under this project's MIT license.
