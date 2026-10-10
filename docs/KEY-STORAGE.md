# Protected conversation files (BPK1)

This storage format is separate from the unchanged BPP v1/v2 **message** formats. It wraps the existing random 32-byte AES conversation key, not message text. No server, account, install, WASM, runtime download or recovery service is involved.

## Password derivation policy

The fixed supported KDF is browser-native **PBKDF2-HMAC-SHA-256, 600,000 iterations**, producing a non-extractable AES-256-GCM wrapping key. Each new export uses a fresh random 16-byte salt and 12-byte nonce from `crypto.getRandomValues`. Saving an already-prepared file again reuses the same encrypted envelope, yielding an identical file.

The [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), consulted 2026-10-10, prefers Argon2id or scrypt where available and lists 600,000+ iterations for PBKDF2-HMAC-SHA-256 in its FIPS-related guidance. PBKDF2 is selected here for native, self-contained browser compatibility without adding another cryptographic implementation. This is not a claim of FIPS certification or equivalence to memory-hard guessing resistance. Cost is fixed across devices; there is no silent mobile downgrade. A future KDF/cost requires an explicit supported envelope version/suite and new verification.

Someone holding the HTML can test guesses offline with no UI rate limit. The 16-character setup minimum and rejection of all-number/whitespace input block short PINs, **not predictable passwords**. Recommend at least five unrelated words. A lost passphrase cannot be recovered. Knowledge of it and the file grants the shared conversation capability, including forging either participant's messages.

Passphrases are normalized to **NFC**, then UTF-8 encoded. Case, all spaces, ZWNJ, Persian/Arabic letter differences and other characters remain significant. Canonically equivalent combining sequences are accepted. Reject lone UTF-16 surrogates, more than 1,024 input UTF-16 units, empty normalized input, or more than 1,024 encoded bytes. Creation additionally requires at least 16 Unicode code points and something other than numbers/whitespace. Unlock does not enforce the creation minimum, allowing ordinary wrong guesses to fail authentication. Private message bytes are never normalized by this policy.

## Envelope

The inert `bpp-conversation` metadata value is exactly 179 ASCII characters: `BPK1-` followed by 174 **uppercase** hex characters (87 bytes). Extra whitespace, lowercase, truncation and extra bytes are rejected. The generic artifact's value is empty. The binary packet is:

| Offset | Bytes | Meaning |
| --- | --- | --- |
| 0 | 3 | ASCII BPK (`42 50 4B`) |
| 3 | 1 | Storage version 1 |
| 4 | 1 | KDF suite 1: PBKDF2-HMAC-SHA-256 |
| 5 | 1 | Cipher suite 1: AES-256-GCM |
| 6 | 1 | Passphrase normalization 1: NFC |
| 7 | 4 | Big-endian iteration count, exactly 600000 |
| 11 | 16 | Random salt |
| 27 | 12 | Random wrapping nonce |
| 39 | 32 | Encrypted conversation key |
| 71 | 16 | GCM authentication tag |

All 39 header bytes are authenticated as GCM additional data; tag length is 128 bits. Exact length, magic, version, suites, normalization and cost are validated **before the KDF**. Unsupported/attacker-selected costs are rejected without work, never clamped or honored. After authenticated decryption, require exactly 32 bytes and import as a non-extractable AES-GCM key with encrypt/decrypt usages. No unauthenticated plaintext reaches application state.

The download's eight-hex suffix comes from the public salt, not a key identifier. It is only a convenient filename. Exports change the first metadata slot of the immutable generic shell; never serialize the live DOM. The nested export template, inline code and CSS remain key-free and byte-identical to the generic build. A generic starter has neither a conversation key nor a protected envelope.

## Runtime and migration

Setup takes one passphrase, with Show/Hide and no repeated confirmation. Private files require one unlock after each opening/reload. Success clears the input and retains only the runtime conversation key; no passphrase/cache is persisted. Done clears messages/context but retains unlock. Tab visibility, focus and messenger switching do not lock. Actual pagehide/navigation discards the key, clears inputs/messages and invalidates pending results; a back-forward-cache restoration requires unlock. There is no timed lock.

An input edit invalidates pending key work. Native Web Crypto cannot cancel an in-progress KDF, so its result is discarded and a single-flight guard prevents another key operation until it settles. This also covers page abandonment. Temporary raw key/password byte arrays are overwritten in finally blocks where owned. Strings and browser memory cannot be reliably erased; an unlocked/compromised device is outside the at-rest protection boundary.

Legacy BPP1 codes retain their checksum validation. Old HTML imports are capped at 2 MiB and read using `File.text()` only. The parser recognizes the known metadata prologue within the first 8 KiB before style/script/template/head boundaries, rejects missing/duplicate recognized slots and then validates the BPP1 checksum. No DOM parser, document insertion, script execution or resource loading occurs. The new file wraps the original key, retaining all old v1/v2 messages. The old file is never rewritten or deleted. **Old plaintext copies/codes remain fully usable; protected downloads cannot revoke them.** A compromised old key requires a new conversation, not migration.

Application code writes no passphrases, keys or messages to browser storage, cookies, URLs or logs. Deliberately downloaded protected HTML persists the encrypted envelope. HTML tampering can alter both code and CSP, so authentic distribution remains essential; the envelope is not a signature for the program.
