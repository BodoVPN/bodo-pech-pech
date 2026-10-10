# Bodo Pech Pech

An experimental, offline **single HTML file** for two people to encrypt messages, encode the encrypted bytes into Persian cover text, and exchange that text through an existing messenger.

The first prototype is implemented. It is **not an audited secure messenger**. Its cover uses a fixed phrase grammar: readable but repetitive, sometimes awkward, and readily recognizable. There is no claim of undetectability or human-like conversation.

## Use the saved file

1. Save the [ready-to-use HTML file](bodo-pech-pech.html) from a trusted copy of this repository (use GitHub's **Download raw file**, not the source page). Open it directly in a full browser. No server, account, installation, extension, or internet connection is required.
2. One person selects **Create a new pair code**. Share this secret in person or through an already trusted confidential channel. Do not send it with the cover text or in a channel you assume is being observed.
3. The other person pastes the code and selects **Use this code**. Compare all six fingerprint groups in person or over an authenticated channel, then both confirm setup.
4. Write the real message and optionally paste recent visible Persian conversation. Choose **Make Persian cover text**, then **Copy cover text** and paste the entire result into your messenger.
5. Your partner selects **Open a message**, pastes the complete cover text, and selects **Open private message**. Plaintext appears only after authentication succeeds. **Write a reply** carries the visible cover text into local context.

The code disappears after setup. The key stays only in the tab's memory. Refreshing, closing, or **Clear key and messages** ends the session; both people need the same code again to reopen earlier messages. Keep it in a password manager if retention is needed. This page does not store it for you. Use a different generated code for every pair. Clipboard history and synchronization are outside the page's control.

If automatic copy is unavailable, the page selects the text and asks you to use the browser's Copy command. File previewers may not execute JavaScript; use an actual browser.

## Offline behavior and support

Everything for setup, encryption, encoding, decoding, and decryption is bundled into the HTML. There are no remote fonts, model downloads, analytics, runtime packages, API calls, backend, or service worker. A content security policy also blocks network connections and external resources.

The existing messenger supplies transport and may need a network of its own. Bodo Pech Pech is not a replacement messaging network and cannot make an unavailable messenger work.

Verified under `file://` on Windows with **Chrome 155.0.8059.39** and **Edge 156.0.4314.15**, using isolated browser contexts with networking disabled before initial load. Both passed setup, Unicode exchange, reply, and negative cases with zero HTTP requests. See [verification evidence](docs/VERIFICATION.md). Phone-width layout was tested; Android, iOS, Safari, Firefox, and other operating systems have **not** been verified. Local file opening policies vary. The page checks native crypto support and disables setup when unavailable.

## Limits that matter

- Message size: 1–2,048 UTF-8 bytes. Even short messages create long covers. A measured 67-byte Persian message needed roughly 3,000 cover characters. At the limit, expect roughly 60,000 characters; messenger limits may require shorter messages.
- Reply context uses a local keyword match for everyday life, food/tea, or getting outside. It does not understand conversation. The private message never selects the cover topic.
- Spaces, punctuation, selected formatting marks, and common Persian/Arabic variants can change during copy/paste. Rewording, translating, losing sentences, adding sender names, or truncation will fail. Send the full cover text.
- Native AES-256-GCM protects message bytes with a generated 256-bit pair key, fresh random 96-bit nonce, and 128-bit tag. The phrase codec is reversible encoding, not a cryptographic algorithm.
- No forward secrecy, replay protection, individual sender authentication, secure memory erasure, or protection from compromised devices, browsers, extensions, or altered HTML. A leaked code exposes old/new messages and allows forgery.
- Valid UTF-8 message bytes are preserved without normalization by the protocol. Browser textareas use LF line endings, so UI text is encrypted as supplied by the control, not as an arbitrary binary file. The byte API preserves all bytes.

See [format and design](docs/FORMAT.md) and [security boundaries](SECURITY.md).

## Build and check the source

Developers need Node.js 24+ and npm. Users of the finished HTML do not.

```sh
npm ci
npm run build
```

The output is `bodo-pech-pech.html` at the repository root. This generated file is committed so users can download it directly. Rebuild it when source changes; do not hand-edit it. Double-click it or choose **Open with** your browser; no local web server is needed. Distribute that one file, not the source template in `src/index.html`.

```sh
npm run typecheck
npm run lint
npm test
npm run test:browser
# Or all checks:
npm run check
```

Browser checks use installed Chrome and Edge through Playwright. They fail when a requested browser is missing; they do not silently skip. For Chrome alone, set `BROWSER_CHANNELS=chrome` (PowerShell: `$env:BROWSER_CHANNELS = 'chrome'`) before browser checks. Tests open the generated file directly, never a localhost substitute. Screenshots go to ignored `test-results/`.

The source is plain TypeScript, CSS, and HTML, bundled by esbuild. No application framework is needed. TypeScript 6 is pinned because the installed ESLint TypeScript tooling requires TypeScript below 6.1. No license has been chosen.
