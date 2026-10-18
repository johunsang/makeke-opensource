# Clean source distribution

This source release is based on the original Makeke v1.7.91 source (commit `2007e152`). Keep the original private repository and its history private. The public repository is https://github.com/johunsang/makeke-opensource and starts with a clean source directory and new Git history.

Create and check a clean copy from the live working tree:

```sh
python3 scripts/export-opensource.py --audit
python3 -m unittest discover -s tests -p 'export_opensource_test.py' -v
python3 scripts/export-opensource.py --output /absolute/path/to/new/makeke-source
python3 scripts/export-opensource.py --check /absolute/path/to/new/makeke-source
```

The destination must be new. Export creates a source folder, a `.tar.gz` archive, and a separate `.excluded.json` report containing paths and exclusion reasons. It does not publish, push, initialize Git, or copy the original `.git` directory. It uses current files, including uncommitted source changes.

`opensource/manifest.json` defines the reviewed allowlist. `SOURCE_MANIFEST.json` records included file sizes and SHA-256 hashes. Public `AGENTS.md` and `CLAUDE.md` are generated portable guides; internal development instructions are excluded. The checker rejects unexpected files, known credential patterns, native executables, private-data paths, symlinks, missing local Go modules, and file changes after export. Pattern checks cannot identify every possible secret; review the actual files before publishing.

The distribution contains the main Makeke desktop app, Go API, core UI, browser extension, tests, shared local HTTP guard, and source for its optional media workspace. Production deployment files, release workflows, internal journals, customer/account data, generated workspaces, installers, bundled tools, and unreviewed assets are excluded.

Read `THIRD_PARTY_NOTICES.md` before using optional HyperFrames, Lightpanda, Remotion, FFmpeg, fonts, or copied design assets. Some optional media and player paths require a separate upstream installation. The root project license does not replace upstream licenses, service terms, or trademark rights.

Source checks and a local build do not establish installed desktop QA or a completed installer release. Test any installer separately before distributing it.
