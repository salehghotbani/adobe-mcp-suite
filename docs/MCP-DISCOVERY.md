# MCP resources, prompts, and expanded workflows

Each of the seven servers exposes application-specific tools, two resources, and two prompts over the same stdio connection. Existing source entrypoints continue to work. Managed installations export selected entries through `adobe-mcp config`; see [MCP client configuration](CONFIGURATION.md). Reconnect the client after an update so it can discover the current capabilities. The [command reference](CLI.md) covers installation and version management; the resources and prompts below are features accessed through an MCP client.

The current default catalog contains **131 tools**. Enabling arbitrary scripting adds one optional tool per server, bringing the total across all seven servers to 138.

## Resources

Resources can be read before an Adobe panel connects. They do not invoke native Adobe operations or expose bridge credentials.

| Resource name    | URI pattern                           | Content                                                                                                             |
| ---------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `tool_catalog`   | `adobe-mcp://<application>/catalog`   | JSON tool descriptions, strict input schemas, annotations, version, and the current server's scripting opt-in state |
| `workflow_guide` | `adobe-mcp://<application>/workflows` | Markdown recipes using actual tool names and guidance on inputs, outputs, and completion semantics                  |

Application identifiers are `premiere-pro`, `photoshop`, `media-encoder`, `illustrator`, `indesign`, `after-effects`, and `audition`.

For example, read the Photoshop catalog with an MCP `resources/read` request containing:

```json
{ "uri": "adobe-mcp://photoshop/catalog" }
```

The resource describes only the tools registered on that server instance. `run_script` is absent when disabled. A tool's `enabledByDefault` field describes its default configuration, while `arbitraryScriptingEnabled` reports whether that instance opted in.

## Prompts

Prompts return instructions as MCP messages; retrieving one does not run a tool, edit a document, or grant permission for native operations. Clients that support prompt selection can expose them directly in their interface.

| Prompt                | Arguments                                             | Purpose                                                                                    |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `plan_workflow`       | Required `goal`, optional `context`; both are strings | Build an application-specific plan using the server's available tools and workflow recipes |
| `diagnose_connection` | None                                                  | Explain a fresh local bridge status snapshot and suggest troubleshooting steps             |

Example MCP `prompts/get` request:

```json
{
  "name": "plan_workflow",
  "arguments": {
    "goal": "Create a second poster variation and export it as PNG",
    "context": "Use the active Photoshop document and preserve the original layers."
  }
}
```

Connection diagnosis reports connection state rather than document or render completion. An uncertain dispatched operation may still be running in Adobe; inspect it before retrying or restarting.

## New application capabilities

| Application   | Added workflows                                                                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Photoshop     | Inspect document details, duplicate documents/layers, move layers using explicit pixel units, replace text, and crop within the current canvas                                                        |
| Illustrator   | Read selection previews, edit top-level layer state, activate artboards, draw ellipses, place linked images, and save as PDF                                                                          |
| InDesign      | Activate documents by ID, inspect document/link state, refresh individual links, and export IDML                                                                                                      |
| After Effects | Inspect compositions, update work areas and layer timing, duplicate layers, add effects by match name, set 2D transform keyframes, manage composition markers, and read existing queue-item templates |
| Premiere Pro  | Inspect sequence settings, paginate markers, move the playhead, set in/out ranges, enable/disable clips, and relink media by project-item node ID                                                     |
| Media Encoder | Inspect reflected source metadata, queue image sequences, stitch multiple sources in order, and save TIFF batch previews                                                                              |
| Audition      | Seek relative to the waveform playhead, inspect individual API members, and invoke discovered command IDs in sequence with partial-progress reporting                                                 |

## Behavioral details

- Photoshop movement and cropping use pixels; text sizes use points. Illustrator coordinates and dimensions use points.
- `save_as_pdf` changes Illustrator's active file association. It is not a detached PDF export. `export_idml` creates an InDesign interchange copy.
- Premiere track and clip indexes start at zero. Project-item node IDs, document IDs, and one-based indexes are identified in each tool's description.
- Relinking Premiere media affects every clip referencing that project item. Source existence and the item's relink capability are checked before changing the path.
- After Effects 2D position and scale keyframes use two-number arrays; rotation and opacity use a scalar. Scale must be positive and opacity must be within 0–100. Existing composition markers at the same time require `replaceExisting: true`.
- Render-template discovery reads an existing queue item and does not create one. Effects must be supported by the target layer and installed host.
- Image-sequence queueing can include other images in the supplied folder with the selected image's extension. Stitched source paths cannot contain semicolons because the native API uses that delimiter.
- AME source metadata is reflected from the installed version; returned field names may vary. Queue acceptance is not encoding completion.
- Audition batch command IDs are checked against the installed command dictionary before invocation. A later disabled, failing, or throwing command stops the batch and returns `completed: false`, `completedCommands`, and a zero-based failure index. Earlier changes remain applied; this is not a transaction. Avoid commands that open native dialogs.
- Host-version guards reject unavailable APIs where they can be detected. Native workflows remain unverified in Adobe; automated tests use simulated host objects and real MCP/HTTP transports.

The [tool catalog](TOOLS.md) and [schemas](tools.json) define all inputs. The [architecture notes](ARCHITECTURE.md) explain transport, permissions, and timeout behavior.
