---
"@jmfederico/pi-web": patch
---

Support Pi SDK 0.85.x and exclude the broken `@earendil-works/pi-coding-agent` 0.85.0 release from the peer range: its published package could not be loaded at all, which prevented PI WEB from starting. Fresh installs now resolve Pi SDK 0.85.1 or later, while existing 0.84.x installs remain supported. A new package-integrity test also makes this class of upstream packaging defect surface as a single clear test failure during development.
