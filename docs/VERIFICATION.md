# Prototype verification — 2026-10-10

Environment: Windows, Node.js 24.19.0, npm 12.0.2. The generated deliverable is **33,873 bytes**, with no runtime dependencies or external assets.

## Completed checks

`npm run check` passed: TypeScript checking, ESLint with zero warnings, 11 protocol tests, the production build, and 5 browser tests. Dependency installation reported zero known vulnerabilities at that time.

Protocol coverage includes an independent Node AES-GCM interoperability fixture, a frozen v1 codec fixture, generated/imported key agreement, non-extractability, Unicode and BOM preservation, all byte values, random lengths, the maximum size, documented normalization, every single-byte mutation of an encrypted packet, wrong keys, malformed/truncated/duplicated text, and a syntactically valid phrase substitution that fails authentication.

| Real installed browser | Origin | Network state | Result |
| --- | --- | --- | --- |
| Chrome 155.0.8059.39 | `file://` | Offline before first load | Pass |
| Edge 156.0.4314.15 | `file://` | Offline before first load | Pass |

The browser tests open the actual generated `bodo-pech-pech.html` in isolated contexts for two peers. Each browser completed setup, comparison/confirmation, Unicode encryption, Persian copy/paste normalization, exact decryption, a context-carrying reply, wrong-key rejection, truncated-cover rejection, result invalidation on edits, clearing, and reload. Both recorded **zero HTTP requests and zero page/console errors**. Local/session storage remained empty. At 390 CSS pixels wide, neither layout overflowed horizontally; desktop and phone-width screenshots were visually inspected.

Additional browser tests cover clearing during a delayed real encryption result, fail-closed behavior under a simulated unavailable secure context, the manual-selection fallback when the clipboard API is deliberately unavailable, and loading a CRLF-converted copy of the HTML without breaking the CSP hashes. Those adverse-condition simulations are separate from the unmodified native-crypto offline exchanges.

## Cover-size measurement

Ten independently encrypted food-topic covers were measured per input. Random ciphertext changes the selected phrases, so these are observations, not universal bounds.

| Input | UTF-8 bytes | Observed cover characters |
| --- | ---: | ---: |
| `سلام` | 8 | 1,252–1,323 |
| `سلام، فردا ساعت پنج همدیگر را ببینیم.` | 67 | 2,964–3,027 |
| 2,048 ASCII `a` characters | 2,048 | 60,442–60,878 |

The amount of expansion is a major limitation of this first codec. The UI reports actual cover character count; no automatic splitting, messenger-limit detection, or compression is implemented.

## Self-review

Reviewed key lifetime, authentication before text display, input bounds, phrase-table ambiguity, framing/padding, Unicode handling, stale async results after clearing, DOM insertion, offline packaging, and distribution instructions. User-controlled plaintext is assigned with `textContent`, never HTML interpretation. No network/storage/eval/HTML-injection APIs were found in application code. Review identified and fixed the Windows line-ending/CSP hash portability issue, with a regression test. No known blocking correctness issue remains within the documented prototype scope; this is not an independent audit.

## Not established by these checks

- Android/iOS local-file usability, Safari/Firefox, or other operating systems. A narrow desktop viewport is not a mobile-device test.
- Transfer through a real third-party messenger, including its text limits, transformations, forwarding, and clipboard integration on phones.
- Linguistic naturalness assessed by external Persian speakers, undetectability, or model quality/performance. The template text is visibly repetitive.
- Independent security review, forward secrecy, replay resistance, individual sender authentication, endpoint security, or reliable memory erasure.

See [SECURITY.md](../SECURITY.md) for the actual boundaries and [FORMAT.md](FORMAT.md) for the versioned format and design rationale.
