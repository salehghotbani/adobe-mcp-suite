# Implementation notes

The seven stable entrypoints in `src/servers` load independent catalogs from `src/apps`. Shared responsibilities have explicit boundaries:

| Directory     | Responsibility                                                                        |
| ------------- | ------------------------------------------------------------------------------------- |
| `src/bridge`  | Authenticated loopback queue and safe ExtendScript serialization                      |
| `src/config`  | Application identifiers, connection validation, repository paths, and package version |
| `src/mcp`     | MCP server registration, shared tools, reusable schemas, and tool definitions         |
| `src/setup`   | Validated, repeatable generation of local panels and client configuration             |
| `src/catalog` | Tool reference generation using the same definitions as the running servers           |
| `cep`         | Runtime panel assets and the declarative manifest template                            |

New application tools are declared with `tool(name, description, shape, body, readOnly)`; the body must be ES3 and return plain data. Parameters are passed as a JSON literal in `p`, with `h.require`, `h.input` and `h.output` for preconditions. `npm run check` verifies formatting and parses every generated script as ES3. Shared tools are included in both runtime registration and generated documentation; arbitrary scripting is explicitly marked optional in the JSON catalog. `npm run catalog:check` detects stale documentation without rewriting it.

The server and panel version come from `package.json`. Connection files use a strict shared schema, so invalid ports, tokens, application IDs, and attempts to override a panel's host are rejected before setup writes generated files. Error messages do not echo credential values. Setup persists validated tokens before copying panel assets and preserves them on repeated runs. Unit and integration fixtures use disposable directories rather than the user's local connection files.

The official MCP SDK v2 serves modern and legacy MCP clients using its stdio factory. No custom JSON-RPC implementation is maintained here. The HTTP endpoint is an internal CEP transport, not an MCP HTTP endpoint. Multiple client processes must not own the same app bridge port simultaneously.

`src/mcp/discovery.mjs` registers two resources and two prompts per server. Resource catalogs are serialized from the instance's registered definitions, so optional scripting is hidden unless enabled. Workflow recipes in `src/mcp/workflows.mjs` are checked against the actual tool names. Resource reads and prompt retrieval do not dispatch native scripts; the diagnosis prompt reads only the local bridge status. See [MCP-DISCOVERY.md](MCP-DISCOVERY.md) for URIs, prompt arguments, and expanded workflows.

The CEP panel calls the native `window.__adobe_cep__` API directly, so it needs no vendored CSInterface library or Node integration. Polls last at most 20 seconds, native evaluation is serialized, and the resulting payload is retained until the bridge acknowledges it. Result delivery can retry; native execution cannot. Another panel cannot take the lease while an operation is in flight. A disconnected poll and a missing native result are distinct cases. Responses from timed-out dispatched jobs release the uncertain state without changing the already-returned MCP error.

Output paths require an existing parent and explicit overwrite for existing files. Save-in-place tools intentionally save the active file. These are checks at invocation/queue time, not a filesystem sandbox or an atomic lock: external processes can create output files afterwards, native dialogs and render queues retain their own behavior, and `run_script` has full host permissions. After Effects templates may alter the output extension, so the resolved module path is checked again when queued. Inspect render targets before executing an existing queue.

MCP read-only annotations reflect actual tools; mutating tools conservatively carry `destructiveHint`. Insertion, imported media and text edits are changes to the open Adobe session. The server does not claim an application's undo stack provides atomic transactions.

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

The repository tests exercise protocol and transport behavior against simulated native objects. Before using production projects, install each panel in the specific Adobe version, verify `connection_status` and `get_app_info`, and exercise a disposable file with each workflow. Verify localized output template names, fonts, codecs, presets and any host dialogs. A wide manifest version range is a loading rule, not a certification matrix. No UXP adapter, cloud service, installer signing or Adobe Marketplace publication is included.
