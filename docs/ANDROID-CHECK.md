# Android verification still required

Galaxy A51-class and similar budget Android phones are a design target, not a verified platform. The current artifact contains no model, WASM engine, GPU dependency, server, installer or runtime downloads. Windows measurements are not phone benchmarks. Samsung lists a [4 GB Galaxy A51 variant](https://www.samsung.com/us/business/support/owners/product/galaxy-a51-unlocked/); total RAM is not the memory available to one browser tab.

No Android device was attached through ADB during this iteration. Automatic approval review rejected launching the installed emulator, returning only “blocked by policy”; the launch was not retried or bypassed. An x86 Android emulator would not establish ARM budget-phone performance anyway.

## A short real-device check

1. Record phone model/RAM, Android version, browser name/version and how the file is opened. Start with an actual Galaxy A51 or comparable 4 GB ARM phone; lower-memory devices need their own check.
2. Copy the one `bodo-pech-pech.html` file to Downloads. In the file manager, try **Open with → Chrome**. File-handler choices differ: if only a previewer opens, JavaScript is blocked, or the browser refuses the local/content URI, record that as a failure rather than substituting a server or an installed app.
3. Turn off mobile data and Wi-Fi before opening the saved file again. Verify the **Native encryption ready** message and usable buttons. The messenger transport itself can require a network later.
4. On Windows and Android, set up a disposable test pair using the same generated code and compare fingerprints. Do not use real private messages for this check.
5. Exchange `سلام، فردا ساعت پنج همدیگر را ببینیم.` in both directions, with visible context `چای دم کردم، کیک هم داریم. میای؟`. Confirm exact plaintext, then use **Write a reply**. The reply should continue the tea theme without repeating a greeting.
6. Try a message containing spaces, a newline, Persian/Arabic ی/ي and ک/ك, ZWNJ and an emoji. Copy/paste the complete cover through the intended messenger and verify recovery on both devices. Test a v1 cover too.
7. Change an ordinary word or truncate the cover; verify no plaintext appears. Try a different pair code. Change theme/act controls and verify stale cover output clears immediately.
8. Repeat generation and opening several times. Record elapsed time, responsiveness, browser reloads/tab kills, and any memory warning. Try the 2,048-byte boundary with a disposable message; do not equate a short-message pass with maximum-size support.
9. Clear the session, then reopen/reload the file. Keys, messages and context must be absent. Clear the device clipboard separately.

Pass evidence must include the actual device/browser, successful offline local-file opening, both-direction recovery, messenger transformation results, timing and failures. A 390-pixel desktop screenshot or an Android user-agent string is not Android verification.
