#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
work_dir="$project_dir/.cache/native"
stage_dir="$project_dir/native"
jobs="${PLATINUM_BUILD_JOBS:-2}"
mkdir -p "$work_dir" "$stage_dir/bin" "$stage_dir/licenses" "$stage_dir/source"
command -v cmake >/dev/null
command -v pkg-config >/dev/null

fetch_source() {
  local name="$1" repo_url="$2" commit_id="$3"
  if [[ ! -d "$work_dir/$name/.git" ]]; then
    git init -q "$work_dir/$name"
    git -C "$work_dir/$name" remote add origin "$repo_url"
  fi
  # Refuse to overwrite local edits to an existing dependency checkout.
  if [[ -n "$(git -C "$work_dir/$name" status --porcelain)" ]]; then
    echo "Dependency checkout has local edits: $work_dir/$name" >&2
    echo "Keep those edits in a patch and use a fresh build directory." >&2
    exit 1
  fi
  git -C "$work_dir/$name" fetch --depth 1 origin "$commit_id"
  git -C "$work_dir/$name" checkout --detach FETCH_HEAD
  test "$(git -C "$work_dir/$name" rev-parse HEAD)" = "$commit_id"
}

while IFS=$'\t' read -r name repo_url commit_id; do
  fetch_source "$name" "$repo_url" "$commit_id"
done < <(python3 - "$project_dir/packaging/native/sources.json" <<'PY'
import json,sys
for name,info in json.load(open(sys.argv[1])).items():
 print(name,info['repository'],info['commit'],sep='\t')
PY
)

git -C "$work_dir/atracdenc" submodule update --init --recursive
# Work on an exported copy, keeping the pinned checkout clean and repeatable.
mkdir -p "$work_dir/netmd-patched"
git -C "$work_dir/linux-minidisc" archive HEAD | tar -x -C "$work_dir/netmd-patched"
patch --directory="$work_dir/netmd-patched" -p1 < "$project_dir/packaging/native/netmd-diagnostics.patch"
read -r -a netmd_flags <<< "$(pkg-config --cflags libusb-1.0 json-c libgcrypt)"
read -r -a netmd_libs <<< "$(pkg-config --libs libusb-1.0 json-c libgcrypt)"
netmd_sources=(common error libnetmd log netmd_dev playercontrol secure trackinformation utils send)
source_files=("$work_dir/netmd-patched/netmdcli/netmdcli.c")
for name in "${netmd_sources[@]}"; do source_files+=("$work_dir/netmd-patched/libnetmd/$name.c"); done
cc -O2 -g -D_FORTIFY_SOURCE=2 -fstack-protector-strong "${netmd_flags[@]}" \
  -I"$work_dir/netmd-patched/libnetmd" "${source_files[@]}" "${netmd_libs[@]}" \
  -Wl,-z,relro,-z,now -o "$stage_dir/bin/netmdcli"
bash "$project_dir/scripts/test-native.sh" "$work_dir/netmd-patched"

cmake -S "$work_dir/libsndfile" -B "$work_dir/sndfile-build" \
  -DCMAKE_POLICY_VERSION_MINIMUM=3.5 -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$work_dir/sndfile-install" -DBUILD_SHARED_LIBS=OFF \
  -DENABLE_EXTERNAL_LIBS=OFF -DENABLE_MPEG=OFF -DBUILD_PROGRAMS=OFF -DBUILD_EXAMPLES=OFF -DBUILD_TESTING=OFF
cmake --build "$work_dir/sndfile-build" --parallel "$jobs"
cmake --install "$work_dir/sndfile-build"
cmake -S "$work_dir/atracdenc" -B "$work_dir/atracdenc-build" \
  -DCMAKE_POLICY_VERSION_MINIMUM=3.5 -DCMAKE_BUILD_TYPE=Release \
  -DLIBSNDFILE_INCLUDE_DIR="$work_dir/sndfile-install/include" \
  -DSNDFILE_LIBRARY="$work_dir/sndfile-install/lib/libsndfile.a"
cmake --build "$work_dir/atracdenc-build" --parallel "$jobs"
cp "$work_dir/atracdenc-build/src/atracdenc" "$stage_dir/bin/"

mkdir -p "$work_dir/ffmpeg-build"
(
  cd "$work_dir/ffmpeg-build"
  "$work_dir/ffmpeg/configure" --prefix="$work_dir/ffmpeg-install" \
    --disable-autodetect --disable-shared --enable-static --disable-debug --disable-doc \
    --disable-network --disable-x86asm --disable-everything --enable-ffmpeg --enable-ffprobe \
    --enable-avcodec --enable-avformat --enable-avfilter --enable-swresample --enable-protocol=file \
    --enable-decoder=flac,mp3,mp3float,aac,aac_fixed,alac,vorbis,opus,pcm_s16le,pcm_s16be,pcm_s24le,pcm_s24be,pcm_s32le,pcm_s32be,pcm_f32le,pcm_f64le,pcm_u8,ape,wmav1,wmav2,wmalossless,wmapro,atrac3,atrac3p \
    --enable-demuxer=wav,flac,mp3,mov,ogg,aiff,aac,ape,asf,oma \
    --enable-parser=mpegaudio,aac,flac,opus,vorbis --enable-encoder=pcm_s16le,flac \
    --enable-muxer=wav,flac --enable-filter=aresample,aformat,anull --disable-avdevice --disable-sdl2
  make -j"$jobs"
  make install
)
cp "$work_dir/ffmpeg-install/bin/ffmpeg" "$work_dir/ffmpeg-install/bin/ffprobe" "$stage_dir/bin/"
python3 "$project_dir/scripts/build-cd-reader.py"
cp "$project_dir/packaging/native/sources.json" "$stage_dir/sources.json"
for name in linux-minidisc atracdenc libsndfile ffmpeg; do
  git -C "$work_dir/$name" archive --prefix="$name/" HEAD | gzip -n > "$stage_dir/source/$name.tar.gz"
done
git -C "$work_dir/atracdenc/src/lib/libgha" archive --prefix=libgha/ HEAD | gzip -n > "$stage_dir/source/libgha.tar.gz"
cp "$project_dir/packaging/native/netmd-diagnostics.patch" "$stage_dir/source/"
cp "$work_dir/linux-minidisc/COPYING" "$stage_dir/licenses/linux-minidisc-GPL.txt"
cp "$work_dir/linux-minidisc/COPYING.LIB" "$stage_dir/licenses/linux-minidisc-LGPL.txt"
cp "$work_dir/atracdenc/LICENSE" "$stage_dir/licenses/atracdenc-LGPL.txt"
cp "$work_dir/libsndfile/COPYING" "$stage_dir/licenses/libsndfile-LGPL.txt"
cp "$work_dir/atracdenc/src/lib/libgha/LICENSE" "$stage_dir/licenses/libgha-BSD.txt"
cp "$work_dir/ffmpeg/COPYING.LGPLv2.1" "$stage_dir/licenses/ffmpeg-LGPL.txt"
mkdir -p "$stage_dir/source/build-support/scripts" "$stage_dir/source/build-support/packaging/native" "$stage_dir/source/build-support/app"
cp "$project_dir/scripts/build-native.sh" "$project_dir/scripts/fetch-runtime.py" "$project_dir/scripts/check-native.cjs" "$stage_dir/source/build-support/scripts/"
cp "$project_dir/packaging/native/"* "$stage_dir/source/build-support/packaging/native/"
cp "$project_dir/app/paths.cjs" "$stage_dir/source/build-support/app/"
mkdir -p "$stage_dir/source/build-support/test/native"
cp "$project_dir/scripts/test-native.sh" "$stage_dir/source/build-support/scripts/"
cp "$project_dir/test/native/"*.c "$stage_dir/source/build-support/test/native/"
cp "$project_dir/node_modules/vue/LICENSE" "$stage_dir/licenses/Vue-MIT.txt"
cp "$project_dir/node_modules/electron-builder/LICENSE" "$stage_dir/licenses/electron-builder-MIT.txt"
python3 "$project_dir/scripts/fetch-runtime.py"
node "$project_dir/scripts/check-native.cjs"
