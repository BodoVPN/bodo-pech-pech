# Android verification still required

Galaxy A51-class and similar budget Android phones are a target, not a verified platform. No model, WASM engine, GPU dependency, server, installer or runtime download is involved. Windows tests do not establish phone behavior or performance.

No Android device was attached. Automatic approval review rejected emulator launch with only “blocked by policy”; it was not retried or bypassed. An x86 emulator would not establish ARM budget-phone performance anyway.

## Real-device check

1. Record model/RAM, Android version, browser name/version and file-opening method. Begin with an actual Galaxy A51-class or comparable 4 GB ARM phone; lower-memory devices need their own checks.
2. Copy the generic `bodo-pech-pech.html` to Downloads. Turn off Wi-Fi/mobile data. Try **Open with → Chrome** in the file manager. If only a previewer opens, JavaScript is blocked or the local/content URI is refused, record a failure; do not substitute a server or installed app.
3. Choose **Make & save conversation file** using disposable test data only. Check that the browser downloads the private HTML. Test cancelling a save or denying an automatic download, then **Save the file again**. The retry must represent the same conversation. Confirm the user can find and reopen the downloaded private file offline, directly into Write/Read. File-handler and download behavior are essential acceptance checks, not incidental setup.
4. Copy that same private test file securely to Windows. Also test a file created/downloaded on Windows and transferred to the phone. A helper preparing the file on Windows may be the practical handover route, but do not claim phone-side creation works if it failed.
5. Exchange `سلام، فردا ساعت پنج همدیگر را ببینیم.` in both directions. Use **Write a reply** and confirm exact recovery. Test Persian/Arabic variants, spaces, newline, ZWNJ, emoji and a legacy v1 cover with the same key.
6. Copy/paste the entire cover through the intended messenger. Test the visible copy/paste buttons and manual long-press fallback when permission is refused. Record any messenger truncation or transformation.
7. Change a word, truncate the cover and use a different conversation file. No plaintext should appear. A different private file must never silently retain the previous file's pairing.
8. Choose **Done · clear messages**. Drafts, received/outgoing covers, plaintext and reply context must clear. Close/reopen the private file: pairing should remain, and old valid covers should still open. Reload the generic starter: it must have no conversation key. Clear clipboard history separately.
9. Test Persian and English, device font enlargement, pinch zoom, keyboard focus/visibility and touch targets. Observe responsiveness over repeated exchanges and a 2,048-byte boundary case. Record elapsed times, tab kills/reloads and memory warnings. Do not infer maximum-message support from a short-message pass.

Pass evidence must name the actual device/browser and include offline file opening, private-file download/reopen, Windows exchange/reply, clipboard/messenger results, clearing/reopening, timings and failures. Desktop viewport or font-size checks are not Android verification. Remove disposable private test files when finished; keep real conversation files private and outside shared/synced folders.
