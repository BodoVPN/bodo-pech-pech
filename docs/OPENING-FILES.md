# Opening a BodoPechPech conversation

## Windows: the private attachment will not open

Use the current public `bodo-pech-pech.html` starter in Chrome or Edge:

1. Choose **Open saved conversation**.
2. Select the private HTML you already have, then **Open conversation**.
3. Enter that file's original passphrase.

This reads the protected conversation envelope locally as text. It does not execute the selected HTML, upload anything, rewrite the file, replace the conversation key, or remove Windows security metadata. Existing messages and replies use the same key. Reloading the public starter requires selecting the private file again. Keep both files, and do not make a new conversation to recover an old one.

New private downloads are named `bodo-pech-pech-private-xxxxxxxx.html`. Earlier names remain readable; renaming is not required. Older **unprotected** HTML and BPP1 setup codes belong under **About → Protect an older conversation** instead.

### Why Windows can block a valid HTML attachment

The reported private file matched the released v0.4.1 application after removing only its protected envelope. Its NTFS `Zone.Identifier` stream contained `ZoneId=4` and `HostUrl=file:///`, whereas the public starter had `ZoneId=3`. Zone 4 is Restricted Sites; the machine's zone-4 launch policy was set to disallow. This explains the Windows Security launch dialog, rather than an app passphrase failure. See Microsoft's [zone and policy definitions](https://learn.microsoft.com/en-us/previous-versions/troubleshoot/browsers/security-privacy/ie-security-zones-registry-entries).

The app creates a browser Blob download; it does not write NTFS security streams. Chromium [reduces a Blob URL to its origin](https://github.com/chromium/chromium/blob/main/components/services/quarantine/common.cc) and [passes source information to Windows Attachment Services](https://github.com/chromium/chromium/blob/main/components/services/quarantine/quarantine_win.cc). That path is consistent with the observed file-origin marker. The interrupted desktop reproduction did not establish exactly which component wrote this particular marker. The patch therefore provides the local data-opening route above; it does **not** claim that every future Blob download will receive a different zone or that Explorer will launch it.

No registry edits, security-zone lowering, SmartScreen changes, or attachment-unblocking instructions are required for the local reader. If the public starter itself cannot be opened, stop and report the specific browser/OS error; do not disable security protections.

## iPhone and iPad: Telegram attachment previews

**This release does not support opening the private app through an iPhone/iPad attachment preview. No working iOS path has been verified.** Sending an HTML file through Telegram does not establish that its recipient can run its JavaScript and cryptography.

Telegram's iOS [document-preview implementation](https://github.com/TelegramMessenger/Telegram-iOS/blob/f1dd7a2dbd02cbbf513e75d5695d8d36d1cf5838/submodules/TelegramUI/Sources/DocumentPreviewController.swift) uses `QLPreviewController`. Apple describes it as a [file preview controller](https://developer.apple.com/documentation/quicklook/qlpreviewcontroller), with supported types that can vary by OS release. That is evidence about the preview path, not proof of the recipient's exact screen or a universal statement that all iOS WebViews disable JavaScript.

BodoPechPech needs executable JavaScript and Web Crypto. A view-only attachment cannot be repaired by changing code that the viewer never runs. If JavaScript does run but required encryption APIs are unavailable, the app stops with a capability error; it does not downgrade encryption. [`SubtleCrypto` requires a secure context](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto), while [file URLs can be trustworthy browser contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts). A file URL alone does not prove a Web Crypto failure. The affected iPhone's actual failure point is still unconfirmed.

The file includes a bilingual explanation that remains visible when its script cannot start. This improves the failure message; it is **not an iOS fix**. Desktop Chromium, desktop WebKit and phone-size screenshots are not substitutes for iPhone testing.

### What an iOS delivery change would require

One candidate is a trusted **HTTPS public starter** opened in Safari, with private files selected locally as data. Only the key-free application would be hosted. Reliable offline reuse would also require an explicitly designed and tested offline installation/cache path. This changes the current no-hosting, open-one-file delivery model and introduces an initial network visit plus trust in the delivered starter. Another candidate is an installed, reviewed native container. Neither is included or claimed to work in this release, and private conversation HTML must not be uploaded to an HTML-preview service.

Before choosing or shipping either path, test on a real iPhone: record the model, iOS and Telegram versions, exact opening route and symptom; then verify interactive JavaScript, encryption self-test, unlock, exact Unicode message recovery and reply with Windows, offline reopen, and actual messenger copy/paste. Use synthetic conversations only. The product decision and device evidence are still outstanding.

## Android

Android remains a target, not a verified platform. The actual file/content-URI route and phone-side creation, unlock and messaging must pass the [real-device checklist](ANDROID-CHECK.md). No mobile support claim is inferred from the Windows fix.
