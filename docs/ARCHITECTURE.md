# Implementation notes

For operating instructions, use the [documentation index](README.md), [terminal reference](CLI.md), and [configuration guide](CONFIGURATION.md). This document describes the implementation and its trust boundaries.

The seven stable entrypoints in `src/servers` load independent catalogs from `src/apps`. Shared responsibilities have explicit boundaries:

| Directory       | Responsibility                                                                        |
| --------------- | ------------------------------------------------------------------------------------- |
| `src/bridge`    | Authenticated loopback queue and safe ExtendScript serialization                      |
| `src/config`    | Application identifiers, connection validation, repository paths, and package version |
| `src/cli`       | Terminal command parsing, interactive application selection and management output     |
| `src/installer` | Managed homes, verified portable bundles, panel ownership, updates and rollback       |
| `src/mcp`       | MCP server registration, shared tools, reusable schemas, and tool definitions         |
| `src/setup`     | Validated, repeatable generation of local panels and client configuration             |
| `src/catalog`   | Tool reference generation using the same definitions as the running servers           |
| `cep`           | Runtime panel assets and the declarative manifest template                            |

New application tools are declared with `tool(name, description, shape, body, readOnly)`; the body must be ES3 and return plain data. Parameters are passed as a JSON literal in `p`, with `h.require`, `h.input` and `h.output` for preconditions. `npm run check` verifies formatting and parses every generated script as ES3. Shared tools are included in both runtime registration and generated documentation; arbitrary scripting is explicitly marked optional in the JSON catalog. `npm run catalog:check` detects stale documentation without rewriting it.

The server and panel version come from `package.json`. Connection files use a strict shared schema, so invalid ports, tokens, application IDs, and attempts to override a panel's host are rejected before setup writes generated files. Error messages do not echo credential values. Setup persists validated tokens before copying panel assets and preserves them on repeated runs. Unit and integration fixtures use disposable directories rather than the user's local connection files.

The official MCP SDK v2 serves modern and legacy MCP clients using its stdio factory. No custom JSON-RPC implementation is maintained here. The HTTP endpoint is an internal CEP transport, not an MCP HTTP endpoint. Multiple client processes must not own the same app bridge port simultaneously.

`src/mcp/discovery.mjs` registers two resources and two prompts per server. Resource catalogs are serialized from the instance's registered definitions, so optional scripting is hidden unless enabled. Workflow recipes in `src/mcp/workflows.mjs` are checked against the actual tool names. Resource reads and prompt retrieval do not dispatch native scripts; the diagnosis prompt reads only the local bridge status. See [MCP-DISCOVERY.md](MCP-DISCOVERY.md) for URIs, prompt arguments, and expanded workflows.

The CEP panel calls the native `window.__adobe_cep__` API directly, so it needs no vendored CSInterface library or Node integration. Polls last at most 20 seconds, native evaluation is serialized, and the resulting payload is retained until the bridge acknowledges it. Result delivery can retry; native execution cannot. Another panel cannot take the lease while an operation is in flight. A disconnected poll and a missing native result are distinct cases. Responses from timed-out dispatched jobs release the uncertain state without changing the already-returned MCP error.

Output paths require an existing parent and explicit overwrite for existing files. Save-in-place tools intentionally save the active file. These are checks at invocation/queue time, not a filesystem sandbox or an atomic lock: external processes can create output files afterwards, native dialogs and render queues retain their own behavior, and `run_script` has full host permissions. After Effects templates may alter the output extension, so the resolved module path is checked again when queued. Inspect render targets before executing an existing queue.

MCP read-only annotations reflect actual tools; mutating tools conservatively carry `destructiveHint`. Insertion, imported media and text edits are changes to the open Adobe session. The server does not claim an application's undo stack provides atomic transactions.

## Managed installation and launch

`bin/adobe-mcp.mjs` loads the terminal commands in `src/cli/main.mjs`. The manager supports Windows/macOS CEP installation and Linux server-only installation. A portable ZIP contains `app/`, a platform-specific Node.js executable under `runtime/`, launchers and `release.json`. Its shared application code contains every catalog; selected app IDs determine which client entries and panels are generated.

An installed home has this layout:

```text
<home>/
  bin/                    Shell and Windows command launchers
  bootstrap/              Stable Node executable, launcher.mjs and Node license
  versions/<version>/
    app/                  Application code, production dependencies and documentation
    runtime/              Versioned Node executable and license
    release.json          Platform, version and per-file SHA-256 manifest
  connections.json        Private per-application ports and tokens
  mcp-servers.json         Generated client entries for selected applications
  state.json               Selection, active/previous version and update preferences
  current                  Active version pointer
  update-cache.json        Last update-check result, when a check has run
```

The bootstrap reads `current` and starts that version's Node executable and CLI. Generated MCP entries invoke the bootstrap with `run <app>`, so their command paths survive version changes. Managed `run` selects the home's connection file before importing the MCP server. Direct `src/servers` entrypoints keep the source-checkout workflow and its configurable connection path.

Mutations use an exclusive installation lock. New versions are copied into a staging directory, verified and renamed into `versions/`. Credentials live outside those directories and are preserved across upgrades. Panel preparation shares `src/setup/panels.mjs` with source setup. The manager stages selected panels, checks ownership, backs up replaced panels and writes ownership markers naming the app and home.

Version activation updates the generated client entries, pointer and state using atomic individual file writes. Handled commit failures restore the previous selection/configuration and panels. This is not a single filesystem transaction across all files or a guarantee against interrupted processes; `doctor` checks the pointer, bundle and configuration after recovery. Retained versions and panel backups support inspection and rollback. Removal also retains credentials and moves owned panels into backups.

Rollback activates the previously active verified version using the current selection and connection settings. Running processes continue from their original version until restarted. The stable bootstrap executable is not overwritten during upgrades because Windows can keep it open; the versioned runtime changes with activation. See [runtime replacement guidance](INSTALLATION.md#updates-and-rollback).

## Release integrity and update checks

`src/installer/bundle.mjs` creates and validates per-file manifests. Update downloads are restricted to the repository's fixed HTTPS release paths and trusted GitHub redirect hosts. They have request and size limits. ZIP extraction rejects unsafe paths and limits expanded sizes. Verification checks the archive checksum, optional GitHub digest, platform/architecture, package version and every declared file before activation.

`src/installer/updates.mjs` starts an asynchronous check when a managed server runs, then examines the shared persisted cache hourly. The saved interval defaults to 24 hours, including cached network failures. Background checks are notification-only, use stderr, and can be disabled through preferences or the server environment. The explicit `update` command downloads and installs a newer stable release independently of notification preferences. Direct source servers do not start this monitor.

Release builds run tests and portable installation/MCP smoke checks on five native runner targets. Publishing verifies that the version tag matches the package and belongs to `main`, assembles all archives and supporting assets, calculates `SHA256SUMS`, and publishes only after uploading the complete draft. Build jobs have read permissions; the publication job has contents-write permission. Release checksums detect corruption and do not provide publisher authentication independently of the GitHub repository account.

## Sources

- [Adobe's Illustrator JavaScript reference](https://community.adobe.com/havfw69955/attachments/havfw69955/illustrator/426671/1/Illustrator%20JavaScript%20Scripting%20Reference.pdf): ellipse, placement, selection, layer state, and native PDF save options.
- [Adobe's InDesign Link DOM](https://developer.adobe.com/indesign/uxp/dom/api/l/link/), [Application DOM](https://developer.adobe.com/indesign/uxp/dom/api/a/application/), and [export formats](https://developer.adobe.com/indesign/uxp/dom/api/e/export-format/): shared DOM concepts used by the ExtendScript adapter.
- [Adobe's Photoshop JavaScript reference](https://community.adobe.com/havfw69955/attachments/havfw69955/photoshop/676396/3/photoshop-javascript-ref-2020-online2pdf-version.pdf): native document and layer methods. UXP APIs are not substituted into ExtendScript scripts.
- [Official MCP SDK first-server guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/get-started/first-server.md): server factories, schemas, tool registration and stdio.
- [Adobe CEP resources](https://github.com/Adobe-CEP/CEP-Resources): CEP host integration and native scripting bridge.
- [Adobe Premiere CEP examples](https://github.com/Adobe-CEP/Samples/tree/master/PProPanel): project, sequence, timeline and export scripting patterns.
- [Adobe Premiere extensibility](https://developer.adobe.com/premiere-pro/) and [UXP API](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/): UXP is the current development path; this project deliberately uses CEP for a shared transport across the seven requested apps.
- [Adobe Photoshop scripting](https://helpx.adobe.com/photoshop/desktop/automate-tasks/automation-settings-and-presets/automate-photoshop-with-scripts.html).
- [Adobe Illustrator scripting](https://helpx.adobe.com/illustrator/desktop/automate-visualize-data/automate-actions/install-and-run-scripts.html).
- [Adobe InDesign TextFrame DOM](https://developer.adobe.com/indesign/uxp/dom/api/t/text-frame/): text frame, geometry and export concepts; scripts in this project use the ExtendScript DOM.
- [Adobe After Effects scripts](https://helpx.adobe.com/in/after-effects/desktop/automate-in-after-effects/automate-animation/scripts.html).
- [Adobe Audition CEP support](https://helpx.adobe.com/ca/audition/desktop/applying-effects/enabling-cep-extensions.html).
- [Adobe Audition application command sample](https://github.com/Adobe-CEP/Samples/blob/master/Audition/ApplicationCommands/jsx/Commands.jsx), [invocation sample](https://github.com/Adobe-CEP/Samples/blob/master/Audition/ApplicationCommands/main.js), and [waveform timing sample](https://github.com/Adobe-CEP/Samples/blob/master/Audition/PlayheadPanel/jsx/DocumentHandler.jsx): reflection, `invokeCommand`, `isCommandEnabled`, sample rate, duration and playhead units. The implementation is original and does not vendor these sample files.
- [Adobe Media Encoder API overview](https://developer.adobe.com/media-encoder/uxp/media-encoder-api/): current UXP development. The installed AME 2026 startup script also exposes legacy `getEncoderHost()` hooks; this suite uses the legacy frontend and encoder APIs, not the UXP API.
- [Adobe CEP to UXP transition](https://helpx.adobe.com/au/creative-cloud/apps/integration-with-other-apps/manage-plugins/cep-uxp-plugin-transition.html): verify availability against the actual installed host version.

## Remaining host verification

The repository tests exercise real MCP/HTTP transports, simulated native objects, installer behavior and update integrity. Release smoke checks verify installation and actual MCP stdio from packaged binaries on each target; they do not run the Adobe applications. Before using production projects, install each panel in the specific Adobe version, verify `connection_status` and `get_app_info`, and exercise a disposable file with each workflow. Verify localized output template names, fonts, codecs, presets and any host dialogs. A wide manifest version range is a loading rule, not a certification matrix. No UXP adapter, cloud service, installer signing or Adobe Marketplace publication is included.
