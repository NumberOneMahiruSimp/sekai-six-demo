# Project SEKAI note sounds

These are the original `custom01` Project SEKAI game WAV assets served by the public [SEKAI Viewer asset browser](https://sekai.best/asset_viewer/live/tap_se/custom01/). They are not synthesized approximations. Files are preserved byte-for-byte; `manifest.json` records each exact URL, byte length, and SHA-256 checksum.

Asset base: `https://storage.sekai.best/sekai-jp-assets/live/tap_se/custom01/`

The downloader is `node scripts/download-hit-sounds.mjs`. Game sounds belong to their respective Project SEKAI rights holders; their presence here does not grant a redistribution license.

## Playback mapping in this six-key demo

| Event | Original asset |
| --- | --- |
| Normal successful tap, hold/slide head, normal release | `se_live_perfect.wav` |
| Critical/accent hit or critical release | `se_live_critical.wav` |
| Flick / critical flick | `se_live_flick.wav` / `se_live_flick_critical.wav` |
| Slide checkpoint / critical checkpoint | `se_live_connect.wav` / `se_live_connect_critical.wav` |
| Trace / critical trace | `se_live_trace.wav` / `se_live_trace_critical.wav` |
| Optional sustained hold loop / critical hold loop | `se_live_long.wav` / `se_live_long_critical.wav` |
| Great / Good judgement on a normal tap | `se_live_great.wav` / `se_live_good.wav` |
| Optional empty-tap feedback | `se_live_tap.wav` |

`HitAudio.play(type, volume, 'sekai')` plays cached decoded samples. A descriptor such as `{type:'flick', critical:true}` or `{type:'tap', judgement:'great'}` selects the corresponding variation. String types remain compatible with older callers; `accent`, `release`, `slideTick`, `trace`, and `empty` are supported.

Call and await `loadOriginal()` during song preparation. It resolves to `true` only when every sample has decoded. `originalStatus` is `idle`, `loading`, `ready`, `partial`, or `unavailable`; `originalErrors` identifies failed files. A missing selected sample uses the existing synthesized pop sound, and `lastPlayback.fallback` is then explicitly `true`.

Optional sustained feedback uses `startHold(id, volume, critical)` / `stopHold(id)`; `stopAll()` ends sustained feedback when pausing or leaving play. A sample pack failure does not create a synthesized sustained loop.
