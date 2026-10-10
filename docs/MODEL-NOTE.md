# Why this iteration ships no AI

Model work was stopped when the user chose a fully non-AI design for budget Android phones. No model weights, neural runtime, model dependency, cache or AI mode is included in the shipped HTML or production dependency graph.

Before that decision, isolated Windows `file://` experiments tested Q4 GGUF builds of Qwen3 0.6B, a third-party Farsi fine-tune, Qwen3.5 0.8B and Qwen3.5 2B with wllama 3.8.1. Small-model Persian samples were inconsistent. The 2B model was more fluent but made speaker/context mistakes; CPU generation was about 2.6 tokens/second. A Windows NVIDIA WebGPU sample reached about 38 tokens/second, which says nothing about budget-phone speed.

A fixed word-to-bit grammar recovered all test bits in three 24-word trials, but the generated Persian was repetitive/nonsensical. Those were short bit trials, not proof of authenticated full-message or Android interoperability. A 722 MB embedded-model packaging probe also hit a browser Blob read failure. This was a failed probe, not a proof that all single-file model packaging is impossible. Alternative whole-word sampling was unfinished when the work was stopped.

References: [Qwen3](https://huggingface.co/Qwen/Qwen3-0.6B), [Qwen3.5](https://huggingface.co/Qwen/Qwen3.5-0.8B), [wllama](https://github.com/ngxson/wllama), and [Chromium's Blob design](https://chromium.googlesource.com/chromium/src/+/HEAD/storage/browser/blob/README.md). The current v2 format does not depend on any of them.
