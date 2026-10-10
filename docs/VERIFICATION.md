# Simple private-file interface verification — 2026-10-10

The generic 0.3 HTML is **92,490 bytes (90.3 KiB)**. SHA-256: `2df0b956ad700b7fe106761daa5b53a7c62abca0375b07c24a24849c642d5bb4`. Each private export adds exactly 76 ASCII bytes in the inert conversation metadata slot. The generic tracked file has no embedded conversation key. No model, runtime download, server or companion asset is needed.

## Fresh checks

`npm run check` passed TypeScript, ESLint with zero warnings, **22 protocol tests and 11 browser tests**. No tests were skipped. Saved generic and downloaded private files were exercised under `file://` in Windows **Chrome 155.0.8059.39** and **Edge 156.0.4314.15**, with networking disabled before loading. Observed pages emitted no HTTP requests, page errors or console errors.

The crypto, v1 codec, v2 grammar tables, dialogue parser and byte packing source files are unchanged from `c859a3b`. Fresh protocol tests still cover frozen v1/v2 fixtures, independent Node AES fixtures, all 30 public profiles, arbitrary bytes and Unicode, size boundaries, normalization, malformed covers, wrong keys and mutations of authenticated packet bytes/profile/version.

Browser flows cover:

- Creating a file with the generic starter, observing the real download, saving it, and reopening it offline. Download retry yields byte-identical content for the same conversation. Both Chrome and Edge complete this flow.
- Two isolated peers using the same downloaded file, exact Unicode/BOM/whitespace/emoji/HTML-like text, normalized Persian covers, automatic reply context, and actual Chrome-to-Edge-to-Chrome exchange.
- Done clearing all message fields and reply context while preserving pairing; reload and closing/reopening still recover old messages with the private file.
- Injecting synthetic draft, pasted/result text and unrelated DOM state into the live page before export. None appears in the download. Removing the single key value makes the exported bytes identical to the known generic artifact. The script and style are unchanged, so their CSP hashes still match.
- Independent new conversations generating distinct random keys; navigating from one conversation file to another cannot recover the first conversation's cover with the second file. Wrong-key failures expose no plaintext.
- Legacy BPP1 conversion, existing v1 and v2 messages, truncated/altered/malformed covers, invalid/injection-shaped setup input, and a damaged private key field.
- Done invalidating an in-flight encryption result; a delayed clipboard paste cannot restore cleared text. Clipboard success and denial paths include full-text selection and manual paste instructions.
- Blocked automatic download retried through the visible link; a simulated file-allocation failure can also be retried. A ready-file message is not a claim that the user's browser has saved it.
- Unsupported browser behavior and Windows CRLF conversion retaining the hashed CSP in a downloaded private file.
- Persian/English direction and labels, focused results/errors, 48+ pixel tested targets, 390- and 320-pixel layouts, and 200% text enlargement without horizontal document overflow. Setup, home and enlarged-write screenshots were visually reviewed.

Disposable keyed test files are saved outside the output repository in an owned workspace scratch directory and deleted after the test suite. No real conversation keys or personal files are committed. Test screenshots are ignored under `test-results/`.

## Security and usability boundaries

Everyday use has two actions and no code/fingerprint/confirmation screens. The key is deliberately stored **unencrypted in the private HTML**. Anyone with it can read past/future messages or forge messages for either person; a trusted helper also has that access. The one-time handover must still be confidential and authenticated. There is no sender identity proof, forward secrecy, replay prevention, recovery service or independent audit. See [SECURITY.md](../SECURITY.md).

Exports use an immutable shell embedded at build time plus the original bootstrap script. They do not serialize the rendered page. There is no browser storage or key cache shared across files. Application clearing cannot erase downloaded files, OS/browser history, clipboard contents or all memory.

This is developer verification, not a usability study with older adults or proof of universal browser/download compatibility. The browser still owns file-save prompts and the user must open the downloaded file. Persian covers retain their prior length, artificiality and detectability limitations.

Android remains unverified. No device was attached; automatic approval review rejected emulator launch with only “blocked by policy.” It was not retried. The [real-device checklist](ANDROID-CHECK.md) now includes private-file creation, download, reopening and handover in addition to exchange/clipboard/performance. Desktop viewport and enlarged-text checks are not Android or native pinch-zoom tests.

## Historical measurements

The 360-run codec comparison, cover samples and old startup/heap timings are retained in [VERIFICATION-V2.md](VERIFICATION-V2.md). The historical script now loads both pinned Git artifacts, because its interface selectors describe those builds. Those numbers are not measurements of the redesigned 0.3 UI; the unchanged protocol did not warrant rerunning the extensive benchmark.
