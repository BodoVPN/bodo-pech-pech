# Historical v2 codec verification — 2026-10-10

This records the 0.2 interface at commit `c859a3badb2b193ff4e930fa9361b23a1ebf4cd2`. The 0.3 private-file redesign changes the UI, file size and key persistence; its fresh checks are in [VERIFICATION.md](VERIFICATION.md). These historical timings and memory values do not describe the current interface.

The historical self-contained HTML is **66,523 bytes** (65.0 KiB). SHA-256: `ba08e3b3e9fe89f8ed88ae6503f99e2f053560dbeb357115d185cae5a66f2ad7`. No AI/model/runtime assets are included.

## Checks and method

`npm run check` passed: TypeScript, ESLint with zero warnings, 22 protocol tests and 6 browser tests. The actual saved file was exercised under `file://` with networking disabled before first load, in Windows Chrome 155.0.8059.39 and Edge 156.0.4314.15. Tests include isolated peer setup, Chrome-to-Edge and Edge-to-Chrome exchange, legacy v1 recovery, exact Unicode, reply context, changed public context/version, wrong keys, malformed/truncated/tampered content, stale result cancellation, clear/reload, manual clipboard fallback, unsupported-crypto behavior and CRLF/CSP portability. Both browsers reported zero HTTP requests and zero page/console errors. A 390-pixel viewport was visually checked; that is not Android testing.

The reproducible comparison is `node scripts/compare.mjs`. It loads the pinned v1 HTML from commit `bd94d30eaeb161713d46e16ee37f5c95416325e4` and the pinned v2 HTML from commit `c859a3badb2b193ff4e930fa9361b23a1ebf4cd2` in fresh offline browser contexts. Nine scenarios × ten independent encryptions × two formats × two browsers produced **360 authenticated exact round-trips**. No secrets or pair codes are stored in the report. Raw observations and artifact hashes are in [measurements.json](measurements.json). Full first-run covers for all seven normal-size scenarios are in [COVER-SAMPLES.md](COVER-SAMPLES.md). Maximum-size cases are synthetic boundary probes, not conversational samples.

Hardware: Windows, Intel Core i9-12900K, 32 GB installed RAM; Node.js 24.19.0 / npm 12.0.2. This is a fast desktop, not representative phone hardware. No CPU/GPU model inference is involved.

## Visible length

Lengths count JavaScript UTF-16 code units, the same counter shown by the UI. Means below combine 20 runs per format across both browsers. Fresh nonces change word choices.

| Scenario | Private UTF-8 bytes | V1 mean chars | V2 mean chars | Reduction | V2 observed range |
| --- | ---: | ---: | ---: | ---: | ---: |
| Greeting | 8 | 1,380 | 1,027 | 25.5% | 979–1,072 |
| Tea invitation / 67-byte reference | 67 | 2,980 | 1,868 | 37.3% | 1,828–1,935 |
| Walk invitation | 46 | 2,469 | 1,613 | 34.7% | 1,560–1,668 |
| Work question | 52 | 2,779 | 1,705 | 38.6% | 1,660–1,795 |
| Music question | 47 | 2,596 | 1,673 | 35.6% | 1,604–1,768 |
| Travel continuation | 50 | 2,592 | 1,693 | 34.7% | 1,595–1,768 |
| Mixed exact Unicode | 40 | 2,386 | 2,037 | 14.6% | 1,971–2,110 |
| Maximum ASCII | 2048 | 60,633 | 56,101 | 7.5% | 55,819–56,287 |
| Maximum Persian bytes | 2048 | 60,654 | 28,510 | 53.0% | 28,391–28,641 |

The 67-byte reference is `سلام، فردا ساعت پنج همدیگر را ببینیم.`. V2 packs its exact UTF-8 from 67 bytes to 38 bytes including the mode byte; the AES packet becomes 71 bytes instead of 100. Size gains combine byte packing and the different grammar. The synthetic maximum-Persian case is 1,024 copies of س; fixed substitution benefits those letters, but there is no run-length/adaptive compression. ASCII gains are substantially smaller. Even “سلام” still needs about a thousand visible characters because nonce/tag/framing overhead dominates.

## Latency and memory

Timing measures form submission to the authenticated result/cover DOM update inside the browser, excluding Playwright command latency, text entry, clipboard/messenger transfer and painting. Sub-millisecond values have limited precision. Startup is one fresh-context observation per build and includes polling overhead; OS disk cache was not forced cold. Do not infer a startup speedup from one v1/v2 observation.

| Browser / format | Startup observation (ms) | Normal-case send median range (ms) | Largest send observation (ms) | Largest open observation (ms) | JS heap after workload (MiB) | JS heap after clear + test-only GC (MiB) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| chrome / v1 | 156.9 | 0.3–0.4 | 0.9 | 3.6 | 15.52 | 2.30 |
| chrome / v2 | 78.0 | 0.4–0.5 | 3.1 | 5.6 | 10.67 | 2.45 |
| msedge / v1 | 235.9 | 0.3–0.3 | 0.8 | 3.1 | 13.57 | 2.30 |
| msedge / v2 | 65.9 | 0.3–0.4 | 3.3 | 5.1 | 13.60 | 2.45 |

Heap values are Chromium CDP `Runtime.getHeapUsage` snapshots after 90 send/open cycles, including test instrumentation. They are **not peak RAM, process working set, DOM memory, GPU memory or Android measurements**. Forced collection was only a measurement step; the app does not force GC or promise memory erasure. Browser input/undo history and internal DOM allocations can outlive application clearing; raw DOM counters are retained in the evidence. Runtime data consists of small fixed tables and bounded message buffers. A real phone must still establish total memory use, responsiveness and local-file usability.

## Complete-cover review

The six theme samples and mixed-Unicode sample were read in full. Improvements are concrete: the tea invitation is acknowledged instead of a generic food opener; tea covers stay with tea/snacks rather than jumping to soup/rice/salad; music endings use listening/playing verbs; singular and compound subjects have compatible predicates; body questions are absent; and later sections move from observations to preferences and tentative continuation. Generated replies continue the theme rather than repeat greetings.

The limits are also visible in the full samples. A short secret still produces many sentences. Tea varieties and positive judgments recur; several qualifiers are unnecessary; general themes can contain strained combinations. The result can read like an extended list of preferences. There was no external/native-speaker study, automated fluency score, or steganalysis evaluation. This is improved bounded grammar, **not a claim of natural human conversation or undetectability**.

## Self-review and outstanding validation

Reviewed profile/version authentication, unchanged pair setup and AES-GCM parameters, authentication before bounded unpacking, exact byte preservation, prefix-free parsing, stage synchronization, padding/full-consumption checks, non-repeating subject state, context/secret separation, DOM safety, cancellation and output packaging. Frozen v1/v2 fixtures and an independent Node AES fixture supplement round-trip tests. Production code has no network, storage, worker, WASM or model-loading API. This is a developer review, not an independent security audit.

Android remains unverified. No device was attached; automatic approval review blocked emulator launch with only “blocked by policy,” and it was not retried. Follow [ANDROID-CHECK.md](ANDROID-CHECK.md) on a Galaxy A51-class or comparable budget ARM phone, including offline local-file opening, both-direction exchange, actual messenger copy/paste, timings, repeated use and the size boundary. Desktop viewport checks cannot establish those results.
