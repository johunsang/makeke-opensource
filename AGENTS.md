# Makeke contributor guide

This is the clean source distribution. Read README.md, CONTRIBUTING.md,
SECURITY.md, and THIRD_PARTY_NOTICES.md before changing the project.

- Main application: Electron in electron/, Go API in api/, UI in static/.
- Shared loopback HTTP validation lives in modules/localhttp.
- Project accounts, subscriptions, and central product access gates are removed.
- Keep API listeners bound to loopback. Preserve Host and Origin validation.
- External AI and social-network credentials are provided locally by each user.
- Never commit credentials, local databases, account exports, generated media,
  installer binaries, or files copied from the original private history.
- Keep third-party notices and review upstream terms before bundling components.
- Do not restore a production deployment, automatic updater, or release workflow.
- Preserve unrelated local work. Run checks for the code you change.

Useful checks:

    python3 -m unittest discover -s tests -p 'export_opensource_test.py' -v
    python3 scripts/export-opensource.py --audit
    node --check electron/main.js
    node --check electron/preload.js
    cd api && go test ./...

Use scripts/export-opensource.py to create a new reviewed source directory and
archive. It excludes private data, Git history, and unreviewed bundled assets.
Read docs/OPEN_SOURCE.md for the export boundary and optional components.
