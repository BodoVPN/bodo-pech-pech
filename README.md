# Bodo Pech Pech

An experimental **single offline HTML file** for two people to encrypt messages, carry the encrypted bytes in Persian cover text, and exchange that text through an existing messenger. No AI, model, installation, server, account, runtime download or external API.

V2 uses six bounded themes and a reversible dialogue grammar. It recognizes simple greetings, invitations, questions and acknowledgements; varies sentence structures; avoids adjacent subject/structure repetition; and moves from observations to preferences to tentative continuation. It also packs Persian UTF-8 losslessly before encryption when that saves space. **Long covers still sound artificial and remain detectable. This is not an audited secure messenger.**

## Use the saved file

1. Save [bodo-pech-pech.html](bodo-pech-pech.html) from a trusted copy of this repository. On GitHub, use **Download raw file**. Open that file directly in a full browser.
2. One person chooses **Create a new pair code**. Exchange the code in person or through an already trusted confidential channel, never alongside the cover text.
3. The partner pastes it and chooses **Use this code**. Compare every fingerprint group in person or over an authenticated channel, then both confirm setup.
4. Write the private message. Optionally paste the recent **visible** Persian conversation, or select a theme/reply style. Choose **Make Persian cover text**.
5. Read the result. Generate again if you prefer different wording; do not manually rephrase it. Copy the entire cover into your messenger.
6. Your partner chooses **Open a message**, pastes the complete cover and chooses **Open private message**. Plaintext appears only after authentication. **Write a reply** continues the visible theme without repeating its greeting.

Keys, messages and context stay in the tab's memory. Reloading, closing or **Clear key and messages** ends the session. The pair code disappears after confirmation; keep it in your password manager if you need it again. The application does not save it. Clipboard history/sync is controlled by your device. If automatic copying is unavailable, the page selects the text for manual copying.

Both people should use the new file to exchange v2 messages. Existing BPP1 pair codes work, and **v1 messages still decode**. An old v1 file cannot read v2. Leave a working old tab alone until you have retained any setup code/messages you need.

## Size, speed and support

The deliverable is about **65 KiB**, including all JavaScript, CSS and grammar data. Its hashed content security policy blocks external resources and connections. Runtime behavior does not require a GPU, WASM engine, companion file or internet access. The existing messenger supplies transport and may need its own network.

Fresh Windows measurements reduced the representative 67-byte Persian message from about **3,000 to 1,850 cover characters**. Send/open operations took milliseconds on the tested desktop. These are measured examples, not universal bounds or phone-performance promises. See the [comparison and verification evidence](docs/VERIFICATION.md), including full covers, exact counts, startup and memory metrics.

The actual saved file was exercised offline under `file://` in Windows **Chrome 155.0.8059.39** and **Edge 156.0.4314.15**, including exchanges between those browsers. Galaxy A51-class and similar budget Android phones are the design target, but **Android local-file opening, speed and memory have not been verified on a device**. Follow the [manual Android check](docs/ANDROID-CHECK.md). A narrow desktop screenshot is not phone verification. File previewers may not execute JavaScript; the page checks native crypto support before enabling setup.

## Limits

- Private messages: 1–2,048 original UTF-8 bytes. Even a short message creates a long cover; messenger limits may require shorter messages. ASCII and mixed Unicode usually gain less than Persian from packing.
- Context rules use only visible conversation and explicit controls. They cannot understand arbitrary meaning, factual questions or negation reliably. Supported themes are rest/chat, tea/snacks, a nearby walk, work/study routine, music at home and a short trip.
- Covers tolerate documented punctuation/spacing changes and common Persian/Arabic variants. Added words, sender names, paraphrasing, translation, omission and truncation fail. Public theme/reply-style changes cannot bypass authentication.
- AES-256-GCM uses a generated 256-bit pair key, a fresh 96-bit nonce, a 128-bit tag and authenticated version/profile bytes. The grammar and packing are reversible representations, not cryptography.
- No forward secrecy, replay protection, individual sender identity proof, secure memory erasure or compromised-device protection. A leaked pair code exposes old/new messages and permits forgery.
- The byte APIs preserve exact bytes. Textareas use LF line endings; the UI encrypts the text supplied by the browser control. Packing never normalizes the private message.

See [v2 format](docs/FORMAT-V2.md), [legacy v1 format](docs/FORMAT.md) and [security boundaries](SECURITY.md).

## Build and verify

Developers need Node.js 24+ and npm. Users need only the finished HTML.

```sh
npm ci
npm run build
npm run check
node scripts/compare.mjs
```

The build writes `bodo-pech-pech.html` at the repository root. That generated deliverable is committed; rebuild after source changes. Do not distribute the unbundled `src/index.html`.

Checks run TypeScript, ESLint with zero warnings, protocol tests, and browser tests using installed Chrome and Edge. Missing requested browsers fail. For Chrome-only development checks, set `BROWSER_CHANNELS=chrome`; cross-browser validation then requires a later full run. All browser tests load real saved files, without substituting localhost. The comparison script uses the pinned v1 artifact from Git history and writes fresh measurements under ignored `work/comparison/`. Test screenshots are under ignored `test-results/`.

Source is plain TypeScript/CSS/HTML bundled by esbuild. There are no application runtime dependencies. No project license has been chosen. Earlier model investigation was stopped; a short [developer note](docs/MODEL-NOTE.md) records why no AI is shipped.
