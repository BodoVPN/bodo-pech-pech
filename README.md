# Bodo Pech Pech

An experimental **single offline HTML file** for two people to send private messages inside reversible Persian cover text. No AI, account, installation, server, runtime download or external API.

Everyday use has two large Persian buttons: **نوشتن پیام** (Write a message) and **خواندن پیام** (Read a message). An English button changes the language. No setup codes, fingerprints, confirmations or technical controls appear in the daily flow.

## Prepare once

1. Open a trusted copy of [bodo-pech-pech.html](bodo-pech-pech.html) in Chrome or Edge. On GitHub, use **Download raw file**, then open the saved file in the full browser.
2. Enter a passphrase with **at least 8 characters, one number and one symbol**, or choose **Generate** for a random 16-character suggestion. Persian/Arabic digits work; spaces do not count as symbols. Generate fills and shows the editable field without saving or copying anything. Show/Hide helps check it without a second confirmation field. Choose **Make & save conversation file**. If no download appears, choose **Save the file again**. Browser save prompts and Downloads remain outside the page's control.
3. Open the downloaded private `pech-pech-private-….html` file and **Unlock** with that passphrase. Give **the same file** and passphrase to the other person privately; keep the passphrase separate from the file when sending it. Do not create two different files independently.

**The saved conversation key is encrypted with your passphrase.** Someone holding the file can try passphrase guesses offline; eight characters plus composition is an acceptance minimum, not a strength guarantee. The generated value is recommended. Keep it safe: there is no reset or recovery. Anyone with the file and passphrase can read old/new messages and write as either person. The generic file has no conversation secret. Each new setup creates an independent random 256-bit key; the passphrase protects that key rather than replacing it.

Trust still depends on an authentic, unmodified HTML file and private handover. A helper who creates the file knows its passphrase. If the key or passphrase is exposed, create a new conversation and hand it over privately; changing storage protection cannot secure already-exposed traffic.

## Everyday use

- **Unlock once:** opening or reloading asks for the passphrase. Enter submits. Switching to your messenger and returning keeps the tab unlocked. Existing protected files still accept their original passphrases, even without a number or symbol; the new rules apply only when creating/protecting a file.
- **Send:** **Write a message** → write → **Prepare message** → **Copy text**, then paste the entire result into your messenger. Do not edit or shorten the cover.
- **Read:** **Read a message** → paste the received text → **Read message**. **Write a reply** continues the visible conversation automatically.
- **Done · clear messages** clears message fields/context and returns to the two buttons, keeping the tab unlocked. Closing, reloading or navigating away drops the runtime key. Reopening requires the passphrase and retains the same conversation.

Only the current step is shown. Denied clipboard access falls back to text selection or input focus with short manual instructions. Messages are never added to private downloads, and no browser storage is used. Browser/OS clipboard history is separate. Clearing drops references; it does not guarantee memory erasure.

## Existing conversations

Enter a new passphrase in the starter, then open **Protect an older conversation**. Choose the old private HTML file **or** paste its BPP1 setup code, then save a protected copy. The old HTML is read as text, never executed or opened as a document. The original conversation key is preserved, so existing v1/v2 covers remain readable and replies still use v2. **Old plaintext files/codes still work and cannot be revoked by this conversion.** Keep them safe or delete retained copies/backups; deletion cannot be guaranteed. Migration is not recovery from an already-compromised key.

## What to expect

The unchanged v2 deterministic grammar and lossless byte packing use six bounded themes and staged sentences. Covers still can be long, repetitive and detectable. Even a tiny secret makes a long cover. This is **not an audited secure messenger or a guarantee of natural conversation/undetectability**.

Private messages allow 1–2,048 original UTF-8 bytes. Exact Unicode, whitespace, emoji and Persian/Arabic variants are preserved; textarea line endings follow the browser's LF behavior. Messenger limits may require shorter messages. The parser tolerates only documented spacing/punctuation/letter variations; paraphrasing, missing words, names and timestamps can prevent opening.

AES-256-GCM, random nonces and authenticated format/profile headers are unchanged. There is no forward secrecy, replay protection, sender identity proof, compromised-device protection or recovery service. See [SECURITY.md](SECURITY.md), [v2 format](docs/FORMAT-V2.md) and [v1 format](docs/FORMAT.md).

## Support and verification

The self-contained file is about **407 KiB**, including the embedded Persian/Latin font, clean export template, CSS, script and grammar. Generic and private copies require no network requests or companion files. The existing messenger supplies transport and may require its own network.

The minimal visual design uses Vazirmatn v33.003 by Saber Rastikerdar: an original variable WOFF2 from the [official project](https://github.com/rastikerdar/vazirmatn/tree/v33.003), including its Latin glyphs. The full SIL Open Font License 1.1 and copyright notice are embedded in the HTML and private exports. Font assets and provenance are in [assets/fonts/vazirmatn](assets/fonts/vazirmatn/README.md). Nothing is fetched from a font CDN, and no Apple font is redistributed. Setup, unlock and migration add the required controls; the daily messaging UI remains the same.

Actual downloaded private files were reopened offline under `file://` in Windows **Chrome and Edge**, including exchange and reply between them. Tests cover separate conversation keys, clean exports, v1/v2 recovery, tampering, download/clipboard failures, clearing, reopening, narrow layouts and enlarged text. See [current verification](docs/VERIFICATION.md).

Galaxy A51-class and similar budget Android phones are targets, **not verified devices**. File-manager handling, download/reopen behavior, clipboard and performance still need the [real-device Android check](docs/ANDROID-CHECK.md). A desktop viewport is not Android validation.

## Build and check

Developers need Node.js 24+ and npm; users need only the finished HTML.

```sh
npm ci
npm run check
```

`npm run build` writes the committed generic `bodo-pech-pech.html`. Do not distribute unbundled `src/index.html`. There are no application runtime dependencies. Browser tests use installed Chrome and Edge; missing requested browsers fail. `BROWSER_CHANNELS=chrome` is available locally but does not replace a full run. Downloaded test files use disposable keys and are removed from an owned workspace scratch directory afterward. Never commit a personal keyed file.

The build embeds an immutable empty UI shell. Private exports reuse that shell and the original bootstrap script, changing only one inert metadata slot with a versioned encrypted envelope; they never serialize the live UI. Script/style hashes stay identical. No passphrase, raw key, BPP1 code or message enters new exports. See [key storage](docs/KEY-STORAGE.md) for PBKDF2-HMAC-SHA-256 at 600,000 iterations, AES-256-GCM, bounds and tradeoffs.

`node scripts/capture-ui.mjs` creates offline Chrome/Edge screenshots of the saved generic and downloaded private file at desktop and phone widths, including English, keyboard focus and enlarged text. Its default output is ignored `work/ui-preview`; an explicit output directory may be passed. Only synthetic demonstration text is used, and temporary keyed files are deleted. Screenshots are review outputs, not committed product assets.

`node scripts/compare.mjs` reproduces the **historical v1 versus v2 codec comparison** using both pinned artifacts from Git, not today's UI. Those measurements and covers remain in [VERIFICATION-V2.md](docs/VERIFICATION-V2.md); they are not measurements of 0.4. Current verification measures desktop unlock separately. No new benchmark is claimed for the unchanged codec.

No project license has been chosen. Earlier model investigation was stopped; [MODEL-NOTE.md](docs/MODEL-NOTE.md) records the limited results. No AI is shipped.
