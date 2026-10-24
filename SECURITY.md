# Security policy

- Default-deny authorization; never expose raw shell commands.
- Treat all target data as untrusted.
- No active testing without a reviewed adapter, explicit consent, and enforceable scope.
- Do not submit secrets, cookies, password hashes, or personal data to Telegram or external AI.
- Report defects privately to the project maintainer.

The starter scope checker is a policy layer, not a complete network isolation boundary. Future HTTP clients must pin resolved IPs, validate the peer address, disable or revalidate redirects, and guard against DNS rebinding.
