# Security policy

## Supported scope

This project is an early 0.1.x offline command-line tool. Only the latest 0.1.x release is intended to receive fixes. There is no guaranteed response time or independent security audit.

It treats exported JSON as untrusted data, caps input sizes and record counts, performs no network requests, and constructs reports from fixed enums and positional counts. It does not sandbox the Node runtime or protect exports from local users, malware, swap, terminal capture, or backup software. Keep Node patched and only run trusted project code.

## Report a vulnerability

Do not post customer exports, credentials, payment tokens, or sensitive report contents in public issues. If the hosting repository has private vulnerability reporting enabled, use its Security tab to report privately. No private reporting endpoint is configured in this source package. If that option is unavailable, open a minimal issue requesting a private contact route without disclosing exploit details or sensitive data. Use fabricated reproductions only.

Potential security issues include private input appearing in output/errors, unsafe file handling, uncontrolled resource usage within documented input limits, or unintended network/store actions. Include the tool version, Node version, operating system, and a small synthetic reproducer through an appropriate private route.

## Handling real exports

Keep them outside source control in a restricted local directory. The included ignore rules are only a backstop, not a secret scanner. Inspect reports before sharing: data minimization does not guarantee anonymity. This project does not verify payment, access rights, or refund eligibility.
