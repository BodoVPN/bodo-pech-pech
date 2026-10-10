# BodoPechPech v0.5.0 UI verification — 2026-10-10

Every screen is rebuilt in React with genuine shadcn/ui Radix Nova components installed from the official registry using CLI 4.21.4. The interface uses Field/FieldGroup, InputGroup, Input, Textarea, Button, Alert, Collapsible and Spinner components. An unboxed working column replaces stacked cards and decorative badges. Compact task headings, aligned Done actions and one primary action make each screen direct; advanced migration and version information live inside About. Shared neutral tokens and comfortable controls support Persian/English layouts. This replaces the former static markup and imperative screen controller.

The compact persistent header has a visible **sun/moon** control on setup, download, unlock, home, writing, reading and results. Its accessible name, screen-reader label and tooltip describe the destination mode. The initial theme tracks the system until the user chooses; that choice lasts for the tab until reload/close, including later OS changes. No browser preference is stored. Theme/language changes preserve drafts, results and the unlocked session.

Setup and unlock use one shadcn InputGroup with aligned Show/Hide controls. Password focus uses one visible 2px inset outline around the group, with the nested input outline removed; Show/Hide has its own keyboard focus indicator. Errors use a monochrome Alert and invalid Field/control semantics. Saved-file opening, legacy migration and help use keyboard-operable Radix disclosures; legacy migration is inside About. Buttons change color without animating geometry during text resizing.

## Offline build and privacy boundaries

Tailwind CSS v4 is compiled with PostCSS, and esbuild bundles production React, Radix primitives and Lucide icons into one HTML file. The font, CSS, JavaScript and third-party notices are embedded. The HTML is **796,098 bytes (777.4 KiB)**, SHA-256 `afa708b68f21881462ceed2d5f30370eea93b976425bcb98f36a6e1976e4ec95`.

The build retains SHA-256 script/style CSP hashes, `connect-src 'none'`, and no `unsafe-inline` or `unsafe-eval` policy. Exports still use the immutable build-time shell. React owns screen/status state; passphrases and messages are uncontrolled fields/results, and keys and operation tokens stay in ephemeral refs. No secret state is serialized into exports or persistent storage.

The crypto, codec, dialogue, packing, key-storage and personal-file modules are byte-for-byte unchanged from v0.4.3. v1/v2 reading, v2 writing, BPK1 protection, BPP1 migration, passphrase rules and full-brand private filenames are preserved. Async revision guards and the non-concurrent KDF latch survive edits, Done and page abandonment. Pagehide clears secrets and synchronously locks the UI before bfcache; reopening a downloaded file still starts locked. Clipboard denial and stale-result fallbacks remain covered.

The local saved-file reader still reads bounded metadata as text without executing the selected attachment or modifying it. Existing saved HTML retains its embedded interface; use the latest starter's **Open saved conversation** to use the new UI with an old protected conversation and its original passphrase.

## Validation

TypeScript, ESLint with zero warnings, **31 protocol/storage tests and 25 browser tests** pass with none skipped. Application browser contexts are offline in isolated Windows Chrome **155.0.8059.39** and Edge **156.0.4314.15**. The dependency audit reports zero vulnerabilities.

- Actual downloads, repeat downloads, independent conversations, wrong-password recovery, exact Unicode messages, cross-browser replies, old protected attachments, legacy migration and reload/navigation lock behavior pass.
- Export tampering checks, CRLF/CSP portability, rejected metadata, simulated download/allocation failure, KDF interruption/concurrency, and denied/stale clipboard operations pass.
- Both browsers verify system/manual themes, keyboard controls, storage getters that throw, zero storage access, empty cookies, and preserved drafts/results when changing theme.
- All screens reflow in both languages/themes at **1360, 390, 360 and 320px**, with normal and **200% text**. Assertions cover overflow, header overlap, touch targets, password alignment, one solid group focus outline without an inner outline, errors and Generate placement in the field heading. Expanded saved-file, legacy and help disclosures also pass at 390/320px and 200% text using Enter/Space.
- Separate 200% CSS zoom probes cover setup in both languages/themes. These test browser-engine scaling, not a physical device or operating-system zoom.
- Seventy-six unedited screenshots cover setup/focus/errors, download, unlock, home, write, cover, read and message in both languages/themes at desktop and 360px, plus the zoom probes. Five additional candidate images show focused/unfocused mobile fields and the desktop Persian home. Six README screenshots are refreshed from this exact HTML; see [provenance](assets/README.md). All capture files and credentials are synthetic.
- Rendered custom-font glyph checks confirm embedded Vazirmatn for Persian and English. Selected normal text contrast is at least 4.5:1 and field border contrast at least 3:1. This is targeted validation, not a complete accessibility audit.

No user Chrome windows or personal private files were controlled or modified. iOS/Telegram attachment opening remains unsupported/unresolved, and Android hardware remains unverified. No hosting, installation, AI, emulator retry or platform-security change was introduced. See [platform limitations](OPENING-FILES.md).
