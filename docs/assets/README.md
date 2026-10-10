# README screenshots

These are unedited page screenshots of **BodoPechPech v0.5.0**, captured on 2026-10-10 in Windows Chrome 155.0.8059.39 with networking disabled. The captured HTML has SHA-256 `afa708b68f21881462ceed2d5f30370eea93b976425bcb98f36a6e1976e4ec95`. Earlier releases keep their original appearance and binaries. There is no browser chrome, personal tab content, visible password, conversation key, clipboard content or message text in the images.

| Image | Actual state | Viewport (full-page capture) |
| --- | --- | --- |
| `home-fa-light.png`, `home-fa-dark.png` | Unlocked Persian Write/Read home | 960 × 760 |
| `unlock-en-light.png`, `unlock-en-dark.png` | English unlock screen, empty field | 390 × 720 |
| `home-en-light.png`, `home-en-dark.png` | Unlocked English Write/Read home | 390 × 720 |

Private files used for capture were generated using the app's own Generate/save flow with disposable random credentials, then deleted. No app controls or pixels were altered for screenshots. The React/shadcn interface, header theme button and grouped password controls are part of the actual saved HTML.

Narrow screenshots are desktop browser views, **not Android validation**. Font pixels come from the app's embedded, licensed Vazirmatn face; see [font provenance](../../assets/fonts/vazirmatn/README.md).

README pictures select their light/dark variant using the system preference. Inside the app, a manual choice overrides the system for that tab until reload/close. Diagrams are editable monochrome Mermaid source, rendered by GitHub. Shading and dashed outlines distinguish local operations from transported/saved data without relying on accent colors. Diagrams illustrate the implementation; they are not app screens or an independent security audit.
