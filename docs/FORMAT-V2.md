# Format v2: bounded Persian dialogue

V2 is a deterministic grammar, not AI. The two receivers need the same wire tables and ordinary integer/string operations. No neural inference, floating-point probabilities, hidden conversation history, installation, server, GPU, model download, or companion file is involved.

## Encrypted envelope

Pair codes, fingerprints, AES-256-GCM, random 12-byte nonces, 16-byte tags, and the five-byte authenticated header retain the v1 construction. The header is now `42 50 50 02 P`, where `P = theme * 5 + act`. Themes are ordered in `TOPICS`, acts in `ACTS`, in `src/dialogue-data.ts`. There are six themes and five acts, so valid profiles are 0–29. The entire header remains GCM additional authenticated data.

The public opening determines `P`. Its two wordings are equivalent representations of the same profile. A receiver reconstructs the header from that opening; substituting a different act cannot authenticate, even if the remainder still parses. A different theme normally fails parsing as well. Version changes cannot authenticate either.

The plaintext given to AES is the byte representation below, followed by no extra metadata. This changes serialization, not the cipher or pairing protocol. New files read v1 and v2. Old v1 files cannot read v2 messages; both senders should use the new file. Existing BPP1 pair codes still work.

## Exact byte packing

Original messages remain limited to 1–2,048 bytes. There is no Unicode normalization, lossy substitution, or shared compression state. `src/packing.ts` defines an ordered alphabet of common Persian/Arabic characters, variants, digits, punctuation, and ZWNJ. Each entry stands for its exact UTF-8 byte sequence. Arabic and Persian variants have separate entries.

- Mode `00`: all remaining bytes are the original bytes.
- Mode `01`: ASCII bytes 0–127 represent themselves; byte `128 + i` represents alphabet entry `i`; `FF x` represents literal byte `x`. Other symbols and an incomplete escape are invalid.
- The encoder greedily matches table entries, escaping other non-ASCII bytes. It uses mode 1 only when shorter than mode 0. Raw mode therefore adds at most one byte.
- The receiver authenticates first, then unpacks. Empty output, an invalid mode/symbol/escape, or expansion beyond 2,048 bytes is rejected.

This is a fixed byte substitution intended to reduce Persian UTF-8 overhead. It is not encryption and provides no semantic understanding. Packed length is public; message contents remain encrypted. Maximum v2 packet size is 2,082 bytes; v1 keeps its original 2,081-byte limit.

## Cover frame

Let `N` be the 12-byte nonce, `L` the complete encrypted packet length, and `CT` ciphertext plus tag. The grammar carries:

`N[0] || uint16_be(L) || N[1..11] || CT`

Its size is `L - 3` bytes. The fixed magic/version/profile bytes are reconstructed rather than repeated in the body. Starting with a random nonce byte varies the initial sentence. Putting length immediately afterward makes it available before the first discourse-stage transition. Cover length remains visible; this is not length hiding.

The opening is `PROFILE_OPENERS[P][N[0] & 1]`. Either opening for the same profile is accepted; wording, spaces and punctuation are not authenticated as literal text. The encoded bytes and profile are authenticated.

## Stateful grammar

The frame is read most-significant bit first. `STAGES` contains three stages with nine structures each:

1. Observations about the selected theme.
2. The speaker's preferences and habits.
3. Tentative next steps or continuation.

At the start of each sentence, stage is `min(2, floor(consumedBits * 3 / totalFrameBits))`. The decoder uses stage 0 until the first 24 bits reveal the frame length. Even the shortest frame cannot reach stage 1 that early. Both sides then use exactly the same integer schedule.

The previous structure index starts at 8. Remove that index from `[0..8]`; three bits select among the remaining eight indices, and the selected index becomes the previous one. Thus the same structure index does not repeat immediately. A stage transition changes the available clause trees while retaining this public decoding state.

Each theme has 33 noun phrases. The previous subject index starts at 32. Remove it from `[0..32]`; five bits select one of the remaining 32. Update the previous index after every subject, including both subjects of a compound sentence. Adjacent subjects cannot repeat. Other slots have eight or sixteen choices, carrying three or four bits. Singular and plural clauses have separate predicates. Tea/snack and music endings use action pools compatible with those noun types.

Public context never selects payload bytes. Within one theme, the encoded bits select wording. Arrays and their order are wire-format constants; changing them after release requires a new version.

The final sentence is completed with zero bits if needed. A sentence carries at most 21 bits, so padding is at most 20 bits. Decoding stops only after completing the sentence that reaches the declared bit length. All trailing padding must be zero and all normalized input must be consumed. The length and authentication tag provide independent checks on altered content.

Paragraph breaks occur at stage changes and after four body sentences. They carry no bits. The opener recognizes a public conversation act; the body makes no attempt to answer arbitrary questions, invent factual answers, maintain a dialogue model, or understand negation generally.

## Context and parsing

Automatic theme selection counts whole-word matches in the visible context, using the later match to break a tie. Automatic acts inspect the last nonempty visible line for a small set of invitation/greeting/question/acknowledgement cues. Already recognized v1/v2 covers preserve the theme and continue it rather than echoing the previous greeting. Explicit theme and act controls override these heuristics. No private-message text is passed to this logic.

The receiver recognizes the opening and follows the grammar using only the received cover. Every choice pool and every stage's structure prefixes is prefix-free after normalization; tests assert this. Therefore spaces and punctuation can be removed without introducing ambiguous slot boundaries.

V2 uses the same cover-only normalization as [v1](FORMAT.md#copypaste-normalization): NFKC, Arabic/Persian yeh and kaf compatibility, and removal of specified spacing, punctuation, diacritics and format marks. It does not use invisible characters as a payload channel. Unknown words, truncation, appended text, malformed length, nonzero padding and failed authentication are rejected. Input is bounded to 180,000 UTF-16 code units.

## Deliberate limits

Six bounded themes and hand-authored grammar do not provide arbitrary conversation understanding. Long outputs still repeat opinions and qualifiers, some combinations sound strained, and there is no proof of linguistic or statistical undetectability. This version improves compactness, grammatical agreement, theme boundaries and progression; it does not make every cover sound like a person's ordinary message. Review the complete generated text and regenerate if needed; manual rewording destroys recovery.
