# Dive films: prompts and how to drop them in

Status 2026-11-14: not generated. The Higgsfield balance (2.5 credits) is below one clip (7.5), so the app runs the
procedural dive with no film. The film layer is optional (`DIVE_FILMS` in `apps/web/components/hero/DiveFilm.tsx`).

## Inputs
Keyframes are in the hive (`hive/dive/<farm>-start.png` whole Earth centred on the farm, `<farm>-end.png` the farm landing
frame), for `cornell`, `beltsville`, `lancaster`, `oakville`.

## Generation (same settings as the Agassiz film)
Model `minimax_h3_max`, 832x480, about 5.2 s, start frame + end frame, one clip per farm (7.5 credits each).

Prompt (replace the bracketed part per farm):

> A smooth continuous descent from orbit. Start on the whole Earth with the farm region at the centre; fall straight in
> through thin white cloud, past ocean and coastline, over [farm surroundings], down to low skim over [crops/terrain],
> and settle on the farm landing view. One unbroken forward camera move, no cuts, steady speed, sun from the left,
> natural colour. No text, no people, no vehicles, no UI.

Farm surroundings: cornell = rolling dairy hills and tree lines of upstate New York; beltsville = Maryland woodland
and research fields near Washington; lancaster = patchwork Pennsylvania farmland and barns; oakville = Napa Valley
vineyard rows and oak-covered hills.
Negative prompt: text, captions, logos, zoom jitter, morphing buildings, fast cuts.

## Cut to the app's film
`scripts/dive-film.sh <farm-id> <raw.mp4>` writes `apps/web/public/hero/<id>-dive.mp4` and `<id>-dive-2s.mp4` (about
1.7 s, original speed, ends on the landing frame) and prints the length. Needs `ffmpeg` (Homebrew). Pass a third argument
to change the kept stretches (`"0.30-0.70,...,4.60-END"`, source seconds for a 5.2 s clip; scaled to the real length).

Then add to `DIVE_FILMS` (Phyllis owns that file):
`<id>: { sources: ["/hero/<id>-dive-2s.mp4"], seconds: <printed length> }`.
The caption "illustrative, AI-generated" is shown by `DiveFilm` while it plays. Check the clip's first and last frames
match the live globe and landing framing; if the landing height changes, re-shoot the end keyframe.
