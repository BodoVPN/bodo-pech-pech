# Protected-file verification — 2026-10-10

This is the **v0.4.0 release snapshot**. For the v0.4.1 brand and monochrome light/dark UI, see [current branding verification](BRANDING-VERIFICATION.md). The v0.4.0 tag and release assets have not been replaced.

The released generic 0.4 HTML is **417,243 bytes (407.5 KiB)**. SHA-256: `fef054f812608398cf0a23681ad0a0bd005db53d4c6d12b7d6011d07a994d4b9`. Each protected export adds exactly 179 ASCII bytes in the inert metadata slot. The generic file has no conversation key or protected envelope. No model, runtime download, server or companion asset is required. The earlier v0.3.0 release remains available unchanged.

## Fresh checks

`npm run check` passed TypeScript, ESLint with zero warnings, **30 protocol/storage tests and 17 browser tests**, with none skipped. Real downloads and offline `file://` reopen were tested in Windows **Chrome 155.0.8059.39** and **Edge 156.0.4314.15**. Observed flows emitted no HTTP requests, page errors or console errors. Tests use disposable passphrases/keys only; downloaded private files are removed from an owned scratch directory after completion.

Message crypto, v1 codec, v2 grammar/parser/tables and byte packing are unchanged from main `b0b85ce`. Frozen v1/v2 fixtures, independent Node AES fixtures, all 30 public profiles, exact Unicode/BOM/whitespace/emoji, arbitrary bytes, bounds and tampered messages still pass. Storage is a separate [BPK1 envelope](KEY-STORAGE.md).

Storage tests cover independent Node PBKDF2/AES-GCM interoperability in both directions, original random-key recovery, fresh salt/nonce, non-extractable runtime keys, wrong passphrases, salt/nonce/ciphertext/tag corruption, NFC-equivalent Unicode passphrases, significant spaces/case/Persian letter variants, lone surrogates and length bounds. Creation-policy tests cover seven/eight-character boundaries after NFC, missing digit/symbol, whitespace/format characters not counting as symbols, Persian/Arabic decimal digits, punctuation/emoji symbols and acceptance without letters/case requirements. Two hundred generated suggestions meet the 16-character alphabet/composition rules; generated protection/unlock succeeds. An independent old-envelope fixture with no digit or symbol still unlocks and recovers its original conversation. Every fixed header byte is mutated; a derivation spy proves unsupported parameters and malformed/oversized envelope strings are rejected **before** KDF work. Legacy migration preserves the exact original key and existing covers.

## Browser behavior

- Actual downloaded protected files unlock with one field/button or Enter. Wrong passphrases remain locked and allow retry. Show/Hide updates type, text and accessible pressed/control relationships in both languages. Submission clears the field; exports contain neither passphrase nor raw BPP1 key/code.
- Setup Generate fills an editable, visible 16-character value and updates Show/Hide state. It causes no download or clipboard write and preserves both selected legacy HTML and entered legacy code. The generated passphrase protects the selected original conversation and unlocks its existing message. Generation during a pending derivation invalidates the stale result. There is no generator in the unlock form.
- Two isolated peers exchange messages and replies; an actual Chrome → Edge → Chrome flow passes. V1/v2 recovery, exact private Unicode and existing cover normalization remain intact.
- Switching tabs/focus/visibility retains unlock. Done clears all message fields and reply context while retaining the key. Reload/reopen requires unlock. Navigate away and Back requires unlock and clears previous plaintext. Explicit pagehide/pageshow coverage exercises the back-forward-cache lifecycle handler as well.
- Delayed native derivation plus an input change cannot open the conversation or create a download. A second submission during the pending operation cannot launch another derivation. Page abandonment invalidates delayed unlock results. Done and delayed clipboard/encryption tests still prevent stale message restoration.
- Legacy HTML is constructed from the actual v0.3.0 artifact using a disposable original key. It is imported via the file control, including inserted script/image traps: neither executes nor requests a resource. Its existing message opens using the protected copy. Legacy BPP1 code migration also recovers old v1/v2 traffic. Old files are not modified or revoked.
- Immutable exports exclude injected draft/result/unrelated DOM state. Removing the encrypted envelope yields the exact generic build; script/style CSP hashes therefore remain identical. Repeated download yields identical protected content. New conversations use independent keys. Wrong-file/tampered/malformed input releases no plaintext.
- Blocked automatic downloads, allocation failures, clipboard denial/manual fallback, unsupported browsers and CRLF-transformed copies retain tested recovery behavior.
- No localStorage, sessionStorage or cookies are created in observed message flows. Source uses no IndexedDB, network, logging or secret-bearing URL persistence. Browser/OS password management, clipboard history, crash recovery and memory are outside this guarantee.

## Unlock latency

Five runs per installed browser, fixed 600,000 PBKDF2-HMAC-SHA-256 iterations, already-open local HTML and networking disabled. Measured with `performance.now()` inside the browser from unlock form submission until conversation visibility changes; includes derivation, unwrap/import and UI application, but excludes file opening/startup and human typing. Browsers ran headless on this Windows desktop. Raw records are generated as ignored `test-results/unlock-timing-*.json`.

| Browser | Runs (ms) | Median |
| --- | --- | --- |
| Chrome 155.0.8059.39 | 71, 75, 73, 72, 70 | 72 ms |
| Edge 156.0.4314.15 | 70, 70, 69, 70, 69 | 70 ms |

These are local observations, not performance guarantees or Android measurements. No cost reduction is made for slow devices. Budget-phone unlock/startup latency and file handling remain unverified.

## Visual and font review

The existing white/gray/charcoal layout and Write/Read/Reply/Done screens remain intact. Necessary additions are the setup passphrase field with Show/Hide and Generate, one unlock screen and old-HTML migration option. No animation or GPU-heavy effect was added. At 320px width and 200% text enlargement, setup/unlock reflow without document overflow; tested buttons, including Generate, retain at least 48px targets. Existing home/write checks continue at 390/320px. This is text enlargement, not native mobile pinch-zoom validation or a full accessibility audit.

The original official Vazirmatn v33.003 variable WOFF2 remains embedded, with its full SIL OFL 1.1 and attribution. Font asset SHA-256 remains `4e3fa217d38fdafc1fea4414ceb58ca5e662cf0ab5fa735a8c8c20e8b42cad92`. Browser tests inspect actual custom rendered glyph fonts in Persian and English for downloaded-file home, starter download and unlock headings while offline. See [font provenance](../assets/fonts/vazirmatn/README.md).

`scripts/capture-ui.mjs` captures 50 offline Chrome/Edge screenshots across 1360×1040 and 390×844, including new empty setup/unlock screens in both languages, daily messaging screens, focus and enlarged text. Temporary private files are deleted; screenshots contain synthetic message text only and are kept outside Git for review.

## Limits and outstanding validation

This is developer verification, not an independent security audit or user study. A predictable passphrase remains vulnerable to offline guessing. The envelope protects the saved random key but does not authenticate the HTML program or provide forward secrecy, sender identity, replay prevention or protection for an unlocked compromised device. Old plaintext files/codes remain usable; migration cannot revoke them. See [SECURITY.md](../SECURITY.md).

No Android device was attached. The previously attempted emulator launch was rejected by automatic approval review with “blocked by policy”; it was not retried. The [real-device checklist](ANDROID-CHECK.md) now includes passphrase entry, unlock timing, messenger switching, reload and legacy migration. Desktop width checks do not verify Galaxy A51-class devices.

The historical 360-run codec comparison and old startup/heap measurements remain in [VERIFICATION-V2.md](VERIFICATION-V2.md). They are not current UI/unlock measurements and were not rerun for unchanged message encoding.
