# BodoPechPech branding verification — 2026-10-10

The current main-branch build uses the full **BodoPechPech / بدو پچ پچ** brand, a paired-conversation mark, and grayscale light/dark themes driven by the system preference. No theme control, saved preference, runtime dependency or additional setup step was introduced. Setup, one-step unlock, Write/Read/Reply and Done retain their existing behavior. Crypto, passphrase policy, formats and identifiers are unchanged.

The generic HTML is **420,394 bytes (410.5 KiB)**, SHA-256 `418729b1c57250988a4ea273e7f53e846b431555730f2ce4e7b978b83eac594e`. This is a main-branch update, not a new tagged release. **v0.4.0 remains unchanged** at 417,243 bytes with SHA-256 `fef054f812608398cf0a23681ad0a0bd005db53d4c6d12b7d6011d07a994d4b9`.

## Application checks

Fresh `npm run check` passed TypeScript, ESLint with zero warnings, **30 protocol/storage tests and 19 browser tests**, none skipped. Actual offline `file://` downloads and reopen were exercised in Windows Chrome 155.0.8059.39 and Edge 156.0.4314.15.

The new browser checks cover both initial system themes, generic setup, the real downloaded private HTML, blank unlock, successful unlock, message exchange, and live system-theme switching without losing the runtime key. Full brand labels/title, monochrome computed colors, embedded rendered Vazirmatn glyphs, visible input focus, and alert text with a strong border are verified. Selected body, muted, primary-button and error text pairs exceed 4.5:1 contrast; field borders exceed 3:1. These are targeted checks, not a full accessibility audit.

Both themes and languages reflow at 390px/320px, including 200% text enlargement. Existing export-leak, passphrase, legacy migration, wrong-key, stale-operation, clipboard, Done/reload and cross-browser tests continue to pass. No Android device or emulator was tested; the prior emulator denial was not retried.

## Documentation visuals

Six blank-state, unedited app screenshots show the current build in light/dark themes, at desktop and narrow widths. They contain no visible passwords, keys or message content. Temporary private capture files were deleted. See [screenshot provenance](assets/README.md).

The README explains the separate roles of passwords, random conversation keys and public Persian encoding. It includes two editable Mermaid diagrams, brief Persian/English instructions, a genuinely RTL Persian section, source/specification links and compact security limits. App screenshots follow the system theme. Neither the diagrams nor release publication imply a security audit.
