---
"@jmfederico/pi-web": patch
---

Make the running instance identifiable at a glance, especially in an installed PWA. The header now always shows a machine control: a dropdown listing every machine with its own favicon (dimmed when offline) when a choice exists, or a static bubble with the instance favicon and gateway address when only the local machine exists. The mobile breadcrumb leads with a Machine chip carrying the same identity. Development deployments (Docker dev mode or a source checkout) recolor the favicon and PWA icons purple and install the PWA as "PI WEB (dev)".
