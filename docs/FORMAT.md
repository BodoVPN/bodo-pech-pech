# Legacy format v1 and shared setup

This page preserves the v1 wire specification. New messages use [format v2](FORMAT-V2.md), with a stateful dialogue grammar, authenticated theme/act profile, and exact byte packing. New files automatically read both formats. V1 tables remain unchanged.

## Architecture

Version 0.4 stores conversation keys using the separate authenticated [BPK1 protected-file envelope](KEY-STORAGE.md). It does not alter either message wire format or the original BPP1 code used for legacy migration.

`src/crypto.ts` owns legacy key import and authenticated message encryption. `src/codec.ts` preserves the v1 phrase codec. `src/dialogue.ts` and `src/dialogue-data.ts` implement v2, and `src/packing.ts` provides its reversible byte representation. `src/main.ts` owns UI state. `src/key-storage.ts` wraps/unwraps the random key and validates legacy HTML data. `src/personal-file.ts` exports an immutable build-time shell with a strictly validated encrypted envelope in one inert metadata field. Done clears only message state; reopening requires unlock. None uses a network API. `scripts/build.mjs` bundles the code into an IIFE, inlines styles, and hashes both blocks into a restrictive CSP. The output is one HTML file without module imports, fetched assets, a service worker, or a server.

The platform decision is a portable local HTML file. Standard Web Crypto avoids shipping another cipher implementation. A shared random secret with explicit trusted setup is the smallest defensible setup for this prototype; it is not a substitute for a reviewed asynchronous messaging protocol.

## Setup code

Let `K` be 32 cryptographically random bytes. Let `D = SHA-256(UTF8("Bodo Pech Pech setup v1\0") || K)`.

- Code: `BPP1-`, then 64 uppercase hexadecimal key digits in eight groups of eight separated by `-`, then `-` and the first eight hexadecimal digits of `D`.
- Checksum: first four digest bytes, for transcription errors, not a MAC or password strength check.
- Fingerprint: first twelve digest bytes, rendered as six groups of four hex digits (96 bits).
- Import accepts lowercase letters, whitespace, and omitted hyphens. Prefix, length, hex alphabet, and checksum must match. Input limit: 256 UTF-16 code units.
- Key import uses `AES-GCM`, `extractable: false`, and encrypt/decrypt usages. Raw temporary buffers are cleared; string erasure cannot be guaranteed.

## Encrypted packet

The packet is `H || N || C || T`:

| Offset | Size | Meaning |
| --- | --- | --- |
| 0 | 3 bytes | ASCII `BPP` (`42 50 50` hex) |
| 3 | 1 byte | Version `01` |
| 4 | 1 byte | Topic: `00` everyday, `01` food, `02` outdoors |
| 5 | 12 bytes | Random nonce `N`, freshly generated each time |
| 17 | 1–2,048 bytes | Ciphertext `C` |
| Final 16 bytes | 16 bytes | Authentication tag `T` |

`AES-256-GCM(K, N, plaintext, AAD=H, tagLength=128)` produces `C || T` through Web Crypto. Total overhead is 33 bytes. Decoders reject wrong magic, unsupported version/topic, and out-of-range sizes, then require authentication before interpreting plaintext.

Text uses UTF-8 without trimming, normalization, or compression. Lone UTF-16 surrogates are rejected rather than replaced. Fatal UTF-8 decoding with `ignoreBOM: true` retains an original BOM as content. Textareas normalize newlines to LF before the app receives them; the byte API itself preserves arbitrary bytes, including CR/LF and nulls.

## Persian cover encoding

1. Prepend packet byte length as a **two-byte big-endian integer**.
2. Append exactly one zero byte if packet length is odd, making the frame even-sized.
3. Emit the topic's opening phrase.
4. Read two frame bytes at a time, high nibble first. Four nibbles index four 16-entry tables: sentence start, topic-specific subject, predicate, closing clause. Join these as one sentence.
5. Separate sentences with `. ` and the predicate/closing with `؛ `.

Each sentence carries 16 bits; there are `ceil((packetBytes + 2) / 2)` data sentences plus the opening. Tables in `src/codec.ts` are ordered wire-format constants. Never edit/reorder them without a new format version. Tests pin a serialization fixture and check normalized uniqueness and prefix-freedom within each slot.

The opener selects the subject table and must match the authenticated packet topic. Decoding follows the slot grammar. No inference, fuzzy matching, or paraphrase recovery is used. Declared length, exact padding, full input consumption, and bounds are checked before authentication. The framing length is redundant with actual size and cannot create an accepted modified plaintext.

### Copy/paste normalization

Only cover text is normalized, never the private message:

- Apply Unicode NFKC, including compatible Arabic presentation forms.
- Map Arabic yeh `ي` to Persian `ی`, and Arabic kaf `ك` to Persian `ک`.
- Remove whitespace, Unicode punctuation, tatweel U+0640, and Arabic marks U+064B–U+065F and U+0670.
- Remove U+200B–U+200F (zero-width spaces/joiners and direction marks), U+202A–U+202E, U+2066–U+2069, and U+FEFF.

No other characters/words are discarded. Space/punctuation removal is unambiguous because each slot's phrase table is prefix-free after normalization. Added sender names, emoji, translated words, missing clauses, truncation, duplicated sentences, bad padding, and malformed lengths fail. A valid alternate phrase may decode to changed ciphertext; GCM rejects it. Cover input is capped at 180,000 UTF-16 code units before normalization.

## Legacy reply context and limitations

Context stays on-device. Recognized cover openers preserve the topic on replies. Otherwise, Persian keywords choose food/tea or outdoors, defaulting to everyday life. Explicit topic selection overrides the heuristic. Context is not in the encrypted payload and is not required for decoding. It influences only the public topic; private message content is never used to select a topic.

The current direction is fully non-AI. Earlier model experiments were stopped at the user's request; see the short [developer note](MODEL-NOTE.md). No model or model runtime is included in the application.

The original fixed phrase codec demonstrated reversibility in a small file. Its weaknesses are long, repetitive, detectable cover and shallow context use. V2 improves compactness and bounded dialogue structure while retaining explicit limits on naturalness and detectability.

## Primary documentation consulted

- [W3C Web Crypto: AES-GCM](https://www.w3.org/TR/2017/REC-WebCryptoAPI-20170126/#aes-gcm)
- [MDN AES-GCM parameters](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams) and [key import](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey)
- [MDN secure contexts, including local files](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts)
- [esbuild build API](https://esbuild.github.io/api/)
- [Transformers.js WebGPU](https://huggingface.co/docs/transformers.js/guides/webgpu) and [quantization](https://huggingface.co/docs/transformers.js/guides/dtypes)
- [Playwright contexts](https://playwright.dev/docs/api/class-browsercontext) and [browser channels](https://playwright.dev/docs/browsers)
