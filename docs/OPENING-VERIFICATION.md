# BodoPechPech v0.4.2 verification — 2026-10-10

The patch fixes generated names to `bodo-pech-pech-private-xxxxxxxx.html` and adds **Open saved conversation** to the public starter. It reads a protected attachment's metadata as bounded text and unlocks the original key. It neither executes nor rewrites the selected attachment. The passphrase policy, PBKDF2 cost, AES-GCM, BPK1 envelope, BPP1 domain-separation string, and v1/v2 message formats are unchanged.

The generic HTML is **428,130 bytes (418.1 KiB)**, SHA-256 `48bf65ba8cdb4e3f6580cfdac34914b5f833fb1c48df9479825dca23b22d2ba1`. No runtime network dependency or hosted delivery was added.

## Checks

After `npm ci`, fresh `npm run check` passed TypeScript, ESLint with zero warnings, **31 protocol/storage tests and 22 browser tests**, none skipped. Windows Chrome **155.0.8059.39** and Edge **156.0.4314.15** were tested headlessly with networking disabled in the app contexts.

- Actual browser download events assert the full filename, download attribute and full page title. Generated and legacy-migrated exports both use that helper.
- A synthetic protected attachment based on the exact v0.4.1 shell is marked `ZoneId=4` in its NTFS alternate stream. Both installed browsers select/read it with the real File API, reject a wrong passphrase, recover a previous message exactly, and return a reply the old key decrypts. The original file bytes and zone stream are asserted unchanged. Extra attachment scripts/resources are not executed or requested.
- Parser checks reject missing/duplicate metadata, unsupported envelope parameters, metadata hidden in comments or after scripts/templates, and oversized input. No selected HTML enters the DOM.
- Invalid-file recovery, reload returning to a blank starter, a static bilingual message with JavaScript disabled, and the existing export-leak, wrong-key, stale-operation, clipboard, cross-browser, theme, typography, accessibility and legacy-format checks pass.

The previous tests opened `file://` URLs through browser automation. They did not exercise Windows Explorer's attachment launch checks, which is why the original OS dialog escaped coverage. The new tests establish the local reader path, **not** a change to Windows shell policy or Chrome download-zone assignment.

## Reported Windows file

Read-only inspection confirmed that the reported file's application code is byte-identical to the v0.4.1 public release after removing its one protected envelope. Its security stream has `ZoneId=4` and a file-origin HostUrl, consistent with the launch-blocking Windows dialog and restricted-zone policy. The public release file has `ZoneId=3`. See [opening help and primary sources](OPENING-FILES.md).

The original conversation file, key envelope, filename and security stream were preserved. No password, raw key, private message or conversation envelope was included in this repository or uploaded. Desktop Chrome verification was interrupted by the user's physical Escape key before opening that file, and Windows UI control stopped. Opening the user's exact file in their external Chrome window is therefore **not claimed as verified**; the complete new reader flow was verified with disposable fixtures instead.

## Brand audit and limits

The audit covered source, generated HTML, browser tests, build/capture helpers, current README/support documentation, screenshots, package/build filenames and new release labels. Besides the download generator, it corrected the test that had explicitly expected the shortened filename, the test scratch-directory name and font probe, and two spaced English brand error messages. Git ignores both current and legacy private filenames.

The historical `Bodo Pech Pech setup v1\0` cryptographic domain string and its specification deliberately remain unchanged. Existing wire identifiers and old release/tag assets remain compatible and untouched. Earlier branding verification now acknowledges the missed filename and Windows test gap. Current screenshots were recaptured from this exact artifact, without personal data.

The expanded local reader also fits 320px in Persian/English, both themes, at normal and 200% text sizes. These are desktop layout checks.

**iOS is unresolved.** Telegram's source uses Apple Quick Look for document preview, but the affected iPhone's exact failure has not been established and no iPhone execution/unlock/message recovery was tested. The static explanation is not an iOS fix. An HTTPS/offline-install or native-container delivery decision would need separate approval and actual device validation. Android remains unverified; no denied emulator action was retried. [Platform findings and next evidence needed](OPENING-FILES.md#iphone-and-ipad-telegram-attachment-previews).
