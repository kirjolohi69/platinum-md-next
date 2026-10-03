# Third-party software

Platinum-MD Next is a community fork of [Platinum-MD by Gavin Benda](https://github.com/gavinbenda/platinum-md). The original application and artwork retain their MIT license and attribution in `LICENSE`. New application code is also MIT licensed. This project is not an official Sony product or an upstream Platinum-MD release.

The desktop package includes separately licensed programs. The MIT application license does not replace these licenses.

| Component | Source / version | License |
| --- | --- | --- |
| Electron / Chromium / Node.js | Electron (version in `package.json`), https://github.com/electron/electron | MIT and component licenses; see the packaged `LICENSE.electron.txt` and `LICENSES.chromium.html` |
| Vue | 3.5.42, https://github.com/vuejs/core | MIT; copyright Evan You and Vue contributors |
| electron-builder installer templates | 26.15.3, https://github.com/electron-userland/electron-builder | MIT; copyright Vladimir Krivosheev and contributors |
| netmdcli and libnetmd | https://github.com/gavinbenda/linux-minidisc, pinned in `sources.json`, with our diagnostic patch | GPL-2.0-or-later and LGPL-2.1-or-later components; distributed helper is GPL-2.0-or-later |
| atracdenc | https://github.com/dcherednik/atracdenc, pinned in `sources.json` | LGPL-2.1 and individual component licenses |
| libsndfile | 1.2.2, https://github.com/libsndfile/libsndfile | LGPL-2.1-or-later |
| libgha and its bundled components | https://github.com/dcherednik/libgha, pinned submodule | BSD and component licenses; see corresponding source |
| FFmpeg | 8.1.2, https://ffmpeg.org | LGPL-2.1-or-later, built without GPL/nonfree options |
| cdparanoia | 3.10.2 with Ubuntu 24.04 Debian patches; https://xiph.org/paranoia/; pinned in `cd-reader.json` | GPL-2.0-or-later executable; LGPL-2.1-or-later libraries |
| Linux helper libraries | Ubuntu 24.04 packages pinned by URL and SHA-256 in `linux-runtime.json` | Each package's copyright and license text is included |

Native executables are built from source. Their exact upstream source snapshots, our patch, build instructions, dependency locks, and matching Ubuntu library source packages are included under `resources/native/source/` in desktop distributions. For an installed Debian package, this is inside the application installation directory. For an AppImage, use `--appimage-extract` to inspect the files. License texts are in `resources/native/licenses/`. The connection-test archive uses `native/source/` and `native/licenses/`.

To rebuild the modified NetMD helper, extract `linux-minidisc.tar.gz`, apply `netmd-diagnostics.patch` with `patch -p1`, and use the compiler invocation in `build-support/scripts/build-native.sh`. The same script documents compilation and linkage of the audio tools. `libgha.tar.gz` belongs at `atracdenc/src/lib/libgha/` (remove its top-level `libgha/` directory when extracting there). The libsndfile source permits rebuilding and relinking atracdenc with a modified libsndfile. Runtime `.dsc`, original tarball and Debian patch archives provide the corresponding sources for the bundled Linux shared libraries. The complete application source and build workflow are included in the companion source archive.

The legacy upstream directories remain in the source repository for history and reference. Their old binaries and dependency tree are **not** included in the new desktop packages. They are not a supported build path for this alpha.

The CD reader is built by `build-support/scripts/build-cd-reader.py`. Its checksum-pinned original source, Ubuntu/Debian patch archive and source descriptor are under `source/cdparanoia/`; the script applies the published patch series and uses the included configure script. Shared CD-reader libraries can be rebuilt and replaced independently.
