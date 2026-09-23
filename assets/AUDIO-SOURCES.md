# Bundled song audio

The 36 imported MP3 files below were obtained from the corresponding audio URLs in `catalog.json`, using the MP3 rendition at the same path in place of the `.wav` extension. The catalog itself is unchanged. The existing four bundled tracks remain in WAV format.

| ID | Song |
| ---: | --- |
| 2 | ROKI |
| 3 | Teo |
| 6 | HIBANA -Reloaded- |
| 8 | Time Machine |
| 10 | Happy Synthesizer |
| 11 | Viva Happy |
| 13 | Nostalogic |
| 15 | drop pop candy |
| 19 | Charles |
| 21 | Law-evading Rock |
| 26 | BRING IT ON |
| 27 | Just Be Friends |
| 28 | Doctor=Funk Beat |
| 36 | Miracle Paint |
| 38 | BURIKI NO DANCE |
| 41 | Sweet Magic |
| 43 | NEXT NEST |
| 44 | Hand in Hand |
| 45 | 39Music! |
| 46 | Greenlights Serenade |
| 48 | The World is Mine |
| 49 | THE END OF HATSUNE MIKU |
| 50 | Blessing |
| 51 | The World Hasn't Even Started Yet |
| 52 | Becoming Potatoes |
| 54 | Ready Steady |
| 55 | Forward |
| 57 | Newly Edgy Idols |
| 60 | Composing the Future |
| 61 | Cellphone Love Story |
| 62 | Jack Pot Sad Girl |
| 63 | needLe |
| 64 | Stella |
| 66 | Hello/How Are You? |
| 67 | Jishoumushoku |
| 68 | Dance Robot Dance |

Source host: `storage.sekai.best` (the SEKAI Viewer asset archive). The files are in `assets/<song-id>.mp3`, listed in `assets/manifest.json`; `scripts/download-catalog-audio.mjs` records the import procedure.

The ten hosted songs whose jackets were not already local now also have bundled cover art (`assets/55.png`, `assets/57.png`, `assets/60.png`, `assets/61.png`, `assets/62.png`, `assets/63.png`, `assets/64.png`, `assets/66.png`, `assets/67.png`, and `assets/68.png`). These use the corresponding cover URLs already recorded in `catalog.json`; `scripts/download-missing-covers.mjs` records that import.
