#!/usr/bin/env bash
# Cut a Higgsfield dive clip down to the ~1.7 s film the app plays (see apps/web/components/hero/DiveFilm.tsx).
# Usage: scripts/dive-film.sh <farm-id> <raw-clip.mp4> [segments]
#   Writes apps/web/public/hero/<farm-id>-dive.mp4 (full clip, re-encoded) and <farm-id>-dive-2s.mp4 (the cut).
#   segments = "start-end,start-end,..." in source seconds. Default is the recipe used for Agassiz on a 5.2 s clip
#   (globe, clouds, ocean, city, trees, farm); it is scaled to the real clip length and the last segment runs to the end,
#   so the film still finishes on the farm landing frame. No speed-up: segments are kept at original speed.
# Afterwards (Phyllis owns DiveFilm.tsx): add { sources: ["/hero/<id>-dive-2s.mp4"], seconds: <printed length> } to DIVE_FILMS.
set -euo pipefail
id="${1:?farm id}"; src="${2:?raw clip}"; segs="${3:-0.30-0.70,1.05-1.25,1.45-1.60,2.40-2.60,3.15-3.40,4.60-END}"
out="$(cd "$(dirname "$0")/.." && pwd)/apps/web/public/hero"
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$src")
scale=$(awk -v d="$dur" 'BEGIN{print d/5.2}')
filter=""; labels=""; i=0
IFS=',' read -ra parts <<<"$segs"
for p in "${parts[@]}"; do
  a="${p%-*}"; b="${p#*-}"
  a=$(awk -v a="$a" -v s="$scale" 'BEGIN{printf "%.3f", a*s}')
  if [ "$b" = "END" ]; then trim="start=$a"; else b=$(awk -v b="$b" -v s="$scale" 'BEGIN{printf "%.3f", b*s}'); trim="start=$a:end=$b"; fi
  filter+="[0:v]trim=$trim,setpts=PTS-STARTPTS[v$i];"; labels+="[v$i]"; i=$((i+1))
done
filter+="${labels}concat=n=$i:v=1:a=0,format=yuv420p[v]"
enc=(-c:v libx264 -preset slow -crf 23 -movflags +faststart -an)
ffmpeg -v error -y -i "$src" "${enc[@]}" "$out/$id-dive.mp4"
ffmpeg -v error -y -i "$src" -filter_complex "$filter" -map "[v]" "${enc[@]}" "$out/$id-dive-2s.mp4"
echo "wrote $out/$id-dive-2s.mp4, seconds: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out/$id-dive-2s.mp4")"
