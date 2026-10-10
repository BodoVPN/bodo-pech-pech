# Bodo Pech Pech

An experimental **single offline HTML file** for two people to send private messages inside reversible Persian cover text. No AI, account, installation, server, runtime download or external API.

Everyday use has two large Persian buttons: **نوشتن پیام** (Write a message) and **خواندن پیام** (Read a message). An English button changes the language. No setup codes, fingerprints, confirmations or technical controls appear in the daily flow.

## Prepare once

1. Open a trusted copy of [bodo-pech-pech.html](bodo-pech-pech.html) in Chrome or Edge. On GitHub, use **Download raw file**, then open the saved file in the full browser.
2. Choose **Make & save conversation file**. The browser starts downloading a private `pech-pech-private-….html` file. If nothing downloads, choose **Save the file again**. Browser save prompts and Downloads remain outside the page's control.
3. Open the downloaded private file. Keep a copy and give **the same file** to the other person in person or through another trusted confidential channel. A trusted helper can do this once for both people. Do not create two different files independently.

**The private file contains the conversation's secret. Anyone who gets it can read old and new messages and write messages as either person. Hand it over privately, never through a monitored messenger.** Keep it out of shared/synced folders. The generic repository file contains no conversation secret. Each new setup creates an independent random 256-bit key; there is no master key or password.

The old fingerprint/confirmation ritual is replaced by reliance on a trusted handover of the same unmodified file. Private handover is still necessary. If the file is lost or exposed, create a new conversation with the generic starter and hand it over privately; old traffic remains exposed to the old file.

## Everyday use

- **Send:** open your private file → **Write a message** → write → **Prepare message** → **Copy text**, then paste the entire result into your messenger. Do not edit or shorten the cover.
- **Read:** open the same private file → **Read a message** → paste the received text → **Read message**. **Write a reply** continues the visible conversation automatically.
- **Done · clear messages** clears message fields and returns to the two buttons. Pairing survives Done, closing and reopening because the secret stays in the private file.

Only the current step is shown. Denied clipboard access falls back to text selection or input focus with short manual instructions. Messages are never added to private downloads, and no browser storage is used. Browser/OS clipboard history is separate. Clearing drops references; it does not guarantee memory erasure.

## Existing conversations

The starter's collapsed **Already have an old setup code?** option converts a generated BPP1 code into a private file for the same conversation. Both v1 and v2 covers remain readable; new covers use v2. Both people need a v2-capable file to receive new messages. Leave old working tabs alone until you have retained their codes/messages.

## What to expect

The unchanged v2 deterministic grammar and lossless byte packing use six bounded themes and staged sentences. Covers still can be long, repetitive and detectable. Even a tiny secret makes a long cover. This is **not an audited secure messenger or a guarantee of natural conversation/undetectability**.

Private messages allow 1–2,048 original UTF-8 bytes. Exact Unicode, whitespace, emoji and Persian/Arabic variants are preserved; textarea line endings follow the browser's LF behavior. Messenger limits may require shorter messages. The parser tolerates only documented spacing/punctuation/letter variations; paraphrasing, missing words, names and timestamps can prevent opening.

AES-256-GCM, random nonces and authenticated format/profile headers are unchanged. There is no forward secrecy, replay protection, sender identity proof, compromised-device protection or recovery service. See [SECURITY.md](SECURITY.md), [v2 format](docs/FORMAT-V2.md) and [v1 format](docs/FORMAT.md).

## Support and verification

The self-contained file is about **90 KiB**, including the clean export template, CSS, script and grammar. Generic and private copies require no network requests or companion files. The existing messenger supplies transport and may require its own network.

Actual downloaded private files were reopened offline under `file://` in Windows **Chrome and Edge**, including exchange and reply between them. Tests cover separate conversation keys, clean exports, v1/v2 recovery, tampering, download/clipboard failures, clearing, reopening, narrow layouts and enlarged text. See [current verification](docs/VERIFICATION.md).

Galaxy A51-class and similar budget Android phones are targets, **not verified devices**. File-manager handling, download/reopen behavior, clipboard and performance still need the [real-device Android check](docs/ANDROID-CHECK.md). A desktop viewport is not Android validation.

## Build and check

Developers need Node.js 24+ and npm; users need only the finished HTML.

```sh
npm ci
npm run check
```

`npm run build` writes the committed generic `bodo-pech-pech.html`. Do not distribute unbundled `src/index.html`. There are no application runtime dependencies. Browser tests use installed Chrome and Edge; missing requested browsers fail. `BROWSER_CHANNELS=chrome` is available locally but does not replace a full run. Downloaded test files use disposable keys and are removed from an owned workspace scratch directory afterward. Never commit a personal keyed file.

The build embeds an immutable empty UI shell. Private exports reuse that shell and the original bootstrap script, changing only one inert metadata key slot; they never serialize the live UI. Script/style hashes stay identical. The generic artifact contains no conversation key.

`node scripts/compare.mjs` reproduces the **historical v1 versus v2 codec comparison** using both pinned artifacts from Git, not today's UI. Those measurements and covers remain in [VERIFICATION-V2.md](docs/VERIFICATION-V2.md); they are not fresh timing/memory measurements of 0.3. No new benchmark is claimed for the unchanged codec.

No project license has been chosen. Earlier model investigation was stopped; [MODEL-NOTE.md](docs/MODEL-NOTE.md) records the limited results. No AI is shipped.
