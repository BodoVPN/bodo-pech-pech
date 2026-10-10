# Bodo Pech Pech · پچ‌پچ

**[Download the HTML / دریافت فایل](https://github.com/BodoVPN/bodo-pech-pech/releases/latest/download/bodo-pech-pech.html)** · [Latest release / آخرین نسخه](https://github.com/BodoVPN/bodo-pech-pech/releases/latest)

One offline file for exchanging messages through Persian cover text. No account or installation. / یک فایل آفلاین برای فرستادن پیام با پوشش متن فارسی؛ بدون حساب یا نصب.

## شروع سریع

1. فایل بالا را دانلود کنید و در **Chrome** باز کنید.
2. **یک نفر** رمز انتخاب کند (یا «ساخت خودکار» را بزند)، سپس **ساخت و ذخیرهٔ فایل گفت‌وگو** را بزند.
3. **همان فایل تازه ذخیره‌شده** را خصوصی به نفر دوم بدهید؛ رمز را جداگانه برسانید. هر دو باید نسخه‌ای از **همان فایل** داشته باشید، نه دو گفت‌وگوی جدا.
4. فایل خصوصی را باز کنید و رمز را وارد کنید. **نوشتن پیام** متن فارسی می‌سازد؛ همهٔ آن را در پیام‌رسان کپی کنید. برای دریافت، **خواندن پیام** را بزنید و متن دریافتی را بچسبانید.

فراموشی رمز ممکن است باعث از دست رفتن دسترسی شود. برای فایل قدیمی، «محافظت از گفت‌وگوی قبلی» را بزنید؛ نسخه‌های قدیمیِ بدون محافظت با این کار امن یا باطل نمی‌شوند.

## Quick start

1. Download the HTML above and open it in **Chrome** (Edge works too).
2. **One person** chooses a password or clicks **Generate**, then **Make & save conversation file**.
3. Privately give the other person **that same newly saved file**, and tell them the password separately. Both people must use copies of **the same file**, not create two conversations.
4. Open your private file and **Unlock**. **Write a message** makes Persian text to copy into your messenger. **Read a message** opens the received text you paste in.

Forgetting the password can lose access. For an old file/code, choose **Protect an older conversation**; this does not secure or revoke old unprotected copies.

Experimental, not independently audited. / آزمایشی؛ بررسی امنیتی مستقل نشده است. **[Security limits / محدودیت‌های امنیتی](SECURITY.md)**

## A few useful details

- Passwords need at least **8 characters, one number and one symbol**. Persian/Arabic digits work. **Generate** chooses a random editable 16-character value; it does not submit or copy it.
- Both people keep their private file. Unlock once after opening/reloading; switching to a messenger and **Done · clear messages** keep it unlocked. Done clears messages/context.
- Copy the entire generated text without changing it. **Write a reply** continues the conversation. If automatic copy/paste is blocked, use your browser's normal copy/paste.
- Existing protected files still accept their original passwords. Protecting an old file/code preserves v1/v2 message compatibility.

## What to expect

The unchanged v2 deterministic grammar and lossless byte packing use six bounded themes and staged sentences. Covers still can be long, repetitive and detectable. Even a tiny secret makes a long cover. This is **not an audited secure messenger or a guarantee of natural conversation/undetectability**.

Private messages allow 1–2,048 original UTF-8 bytes. Exact Unicode, whitespace, emoji and Persian/Arabic variants are preserved; textarea line endings follow the browser's LF behavior. Messenger limits may require shorter messages. The parser tolerates only documented spacing/punctuation/letter variations; paraphrasing, missing words, names and timestamps can prevent opening.

For protocol details, see [v2 format](docs/FORMAT-V2.md), [v1 format](docs/FORMAT.md) and [protected key storage](docs/KEY-STORAGE.md).

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
