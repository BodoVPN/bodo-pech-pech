# BodoPechPech v0.4.3 UI verification — 2026-10-10

The header now includes a labeled **Light mode / Dark mode** button on setup, unlock, home, write, read and result screens, in both Persian and English. Its visible label and accessible name describe the destination mode. It works with pointer, touch, Enter and Space. It has a minimum 48px touch target and wraps with the language control beneath the brand on narrow screens.

The initial theme follows `prefers-color-scheme`, including live OS changes until the user chooses a mode. An explicit choice stays for that page session and survives language changes, screen changes and later OS changes. Reload/close returns to the system default. No localStorage, sessionStorage, IndexedDB, cookie or other persistent preference is used. The immutable exported HTML does not inherit the current theme or live form values; its own control works on reopen.

Setup and unlock use one bordered password group with Show/Hide aligned inside it. Both controls stretch to equal height. Generate is a separate control with 16px of space below the field. Focus uses one 2px inset outline instead of a border plus detached outline. Message textareas use the same inset focus treatment. Persian/English direction, helper text, errors, grayscale colors and embedded Vazirmatn are preserved.

The self-contained HTML is **434,325 bytes (424.1 KiB)**, SHA-256 `d371ef63e39b1bb187364516b0adc82cbbb1bcea40e9d5e3712dba3e8a5d429b`. Password rules, generation, one-step unlock, conversation keys, message formats, Windows local reader and full-brand filenames are unchanged. Existing HTML files retain their embedded old UI; the current starter can read their protected conversation without changing the key.

## Validation

After `npm ci`, `npm run check` passed TypeScript, ESLint with zero warnings, **31 protocol/storage tests and 24 browser tests**, none skipped. Tests run in isolated Windows Chrome **155.0.8059.39** and Edge **156.0.4314.15**, offline in the application contexts.

- Real theme-button actions, keyboard operation, Persian/English labels, default system tracking, explicit override of later OS changes, reload reset and actual downloaded private-file reopening pass in both browsers.
- Storage getters are forced to throw; the complete manual theme/message flow passes and records zero attempts to access storage. Context cookies remain empty.
- Theme changes preserve a written draft, encoded cover, decoded exact message and unlocked key. Existing export-leak, protected-file, migration and cross-browser recovery tests pass.
- The layout matrix checks setup, unlock, home, write, cover, read and message result in both themes/directions at **1360, 390, 360 and 320px**, with normal and **200% text**. It asserts no horizontal overflow or header overlap, readable control bounds, touch sizes, Show/Hide inside the password group, equal control heights, Generate spacing and the single focus outline. Long setup/unlock errors are included.
- A separate **200% CSS zoom** probe checks the setup in both languages/themes at 1360px. This is browser-engine scaling, not a claim of physical-device or operating-system zoom testing.
- Sixty-eight unedited screenshots cover the actual generic and saved private HTML across setup/focus/error, unlock, home, write, cover, read and result at desktop and 360px, plus the zoom probes. Representative screenshots from every screen were visually inspected. All capture data is synthetic; no user-provided screenshot or passphrase was copied into fixtures or the repository.
- The six README screenshots were recaptured from this exact artifact. See [screenshot provenance](assets/README.md).

All color tokens remain monochrome. Existing checks verify rendered embedded font glyphs, selected normal-text contrast of at least 4.5:1 and field-border contrast of at least 3:1. This is targeted validation, not a complete accessibility audit.

No user Chrome windows were controlled. iOS/Telegram attachment opening is still unresolved and Android hardware remains unverified. No hosting, installation, AI, emulator attempt or change to platform security settings was introduced. See [platform limitations](OPENING-FILES.md).
