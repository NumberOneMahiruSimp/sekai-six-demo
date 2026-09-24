# Character theme artwork

The profile assets are unchanged official Project SEKAI character artwork downloaded
from SEGA's character website on 2026-09-23. They extend the existing official
Emu Otori artwork in `assets/emu/`.

Each character has a full standing illustration for the library banner, a
navigation portrait for theme selection, and an illustration for gameplay.
Miku's profile has no card illustration; `card.webp` is a second copy of her
transparent standing illustration. Her gameplay background now uses the
user-supplied image described below. No character images are AI generated or
recolored.

| Character | Official profile |
| --- | --- |
| Hoshino Ichika | https://pjsekai.sega.jp/character/unite01/ichika/index.html |
| Tenma Saki | https://pjsekai.sega.jp/character/unite01/saki/index.html |
| Hanasato Minori | https://pjsekai.sega.jp/character/unite02/minori/index.html |
| Azusawa Kohane | https://pjsekai.sega.jp/character/unite03/kohane/index.html |
| Tenma Tsukasa | https://pjsekai.sega.jp/character/unite04/tsukasa/index.html |
| Yoisaki Kanade | https://pjsekai.sega.jp/character/unite05/kanade/index.html |
| Hatsune Miku | https://pjsekai.sega.jp/character/virtualsinger/miku/index.html |

The exact source URL, local file, dimensions, byte count, and SHA-256 checksum
for every downloaded asset are recorded in `manifest.json`. The source paths
were checked against the image references in each profile's HTML before
downloading. `scripts/download-character-art.mjs` can reproduce the downloads.

Artwork credit shown on the official site: © SEGA / © Colorful Palette Inc. /
© Crypton Future Media, INC. All rights reserved.

## User-supplied Miku background

`miku/background.png` is the unchanged 860 × 492 PNG supplied by the project
owner on 2026-09-24. It is used as Miku's gameplay backdrop; the official
standing illustration remains in the library and results screen. The original
artist/source URL was not supplied, so this image is not labeled as official
SEGA artwork. Attribution can be completed when that source is available.
