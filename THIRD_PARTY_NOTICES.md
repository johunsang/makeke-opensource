# Third-party software and assets

The project license applies to original Makeke source. Dependencies, external services, trademarks, and third-party assets retain their own terms. This file is a source-distribution inventory, not a completed notice bundle for a compiled application.

## Dependencies installed separately

Use the checked-in manifests and lockfiles to identify the versions actually installed:

- Desktop JavaScript: `package.json` and `package-lock.json` (including Electron, LangChain, FFmpeg wrappers, WebdriverIO, and build tools).
- Go: `api/go.mod`, `api/go.sum`, and the shared local module `modules/localhttp/go.mod`.
- Optional Remotion workspace: `remotion-video/package.json`. Review [Remotion's current license](https://www.remotion.dev/license) before using or redistributing its tooling.

Package managers fetch these components separately. Before distributing an installer or binary, collect the license and notice files for the exact dependency tree and bundled executables, including FFmpeg and its build configuration. No prebuilt third-party executable is included in the clean source export.

## Assets deliberately omitted from the clean export

| Original private-tree component | Clean export treatment |
| --- | --- |
| `tools/lightpanda`, `electron/bin/lightpanda` | Executables omitted. If needed, install from [Lightpanda upstream](https://github.com/lightpanda-io/browser) and review its [AGPL-3.0 license](https://github.com/lightpanda-io/browser/blob/main/LICENSE). The source collector has other collection paths. |
| `static/vendor/hyperframes/`, `vendor/hyperframes-oss/` | Existing built player/runtime files omitted because the private-tree snapshots do not identify a reproducible upstream revision and complete notice bundle. Obtain the player/runtime from [HyperFrames upstream](https://github.com/heygen-com/hyperframes); its current [license is Apache-2.0](https://github.com/heygen-com/hyperframes/blob/main/LICENSE). Optional player and render features need that separate setup. |
| `vendor/deer-flow/` and other vendored skill/template trees | Omitted. The included project license does not relicense those materials. |
| `static/open-design/frames/` | Omitted from this export. The private tree contains an Apache-2.0 notice, but this release does not redistribute the imported snapshots. |
| `static/fonts/AppleSDGothicNeoBold.ttf` | Omitted. No permission to redistribute the bundled file has been established. Use an installed system font or a separately obtained font with appropriate rights. |
| `static/fonts/NanumGothicBold.ttf`, `NanumSquareBold.ttf`, `PretendardBold.otf` | Omitted with the other bundled fonts until the exact font versions and their full accompanying notices are collected. CSS system-font fallbacks remain available. |
| `static/data/`, historical landing images/videos, generated workspaces, customer exports | Omitted. These are not part of the reviewed source release. |

Some optional code paths refer to omitted tools or fonts. Install the required upstream component yourself, or use the available system-font and collection fallbacks. Do not copy files back from the private repository without reviewing their provenance and notices.

External AI, social-network, browser, and media providers are optional integrations. Their credentials are supplied locally by each user, and their service terms apply independently.
