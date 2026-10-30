# Tool catalog

Every server exposes `connection_status` and `get_app_info`. `run_script` is optional and is registered only when `ADOBE_MCP_ALLOW_SCRIPTS=true`. The JSON catalog includes all tools, including these shared tools.

## Premiere Pro (14 default tools)

| Tool                         | Behavior                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connection_status`          | Check the local bridge for Premiere Pro; works without Adobe connected.                                                                           |
| `get_app_info`               | Read the connected Adobe application name and version.                                                                                            |
| `get_project`                | Read the open Premiere Pro project.                                                                                                               |
| `list_sequences`             | List project sequences and their IDs.                                                                                                             |
| `activate_sequence`          | Open a sequence in the timeline by sequence ID.                                                                                                   |
| `list_project_items`         | Read a paginated flattened project bin tree with node IDs.                                                                                        |
| `create_bin`                 | Create a root-level project bin.                                                                                                                  |
| `import_media`               | Import local media into the project root, suppressing import dialogs.                                                                             |
| `create_sequence_from_clips` | Create a sequence from project-item node IDs.                                                                                                     |
| `get_timeline`               | Read clips on a video or audio track of the active sequence. Track index starts at zero.                                                          |
| `insert_clip`                | Insert a project item on a track at a time in seconds. Inserting can ripple the timeline.                                                         |
| `add_marker`                 | Add a comment marker to the active sequence at seconds.                                                                                           |
| `save_project`               | Save the current Premiere project in place.                                                                                                       |
| `export_sequence`            | Export the active sequence directly using a local .epr preset. This waits for the native export call.                                             |
| `run_script` (optional)      | Execute arbitrary ExtendScript with full Adobe scripting permissions. Return a plain JSON-compatible value using return. No browser or Node APIs. |

## Photoshop (14 default tools)

| Tool                    | Behavior                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connection_status`     | Check the local bridge for Photoshop; works without Adobe connected.                                                                              |
| `get_app_info`          | Read the connected Adobe application name and version.                                                                                            |
| `list_documents`        | List open Photoshop documents; IDs and dimensions are in pixels.                                                                                  |
| `open_document`         | Open an existing image or PSD file.                                                                                                               |
| `create_document`       | Create an RGB document with a transparent background. Dimensions are pixels.                                                                      |
| `activate_document`     | Make an open document active by ID.                                                                                                               |
| `list_layers`           | Read a paginated flattened layer tree in the active document.                                                                                     |
| `create_layer`          | Add an empty art layer to the active document.                                                                                                    |
| `set_layer`             | Set layer name, visibility and opacity by layer ID.                                                                                               |
| `add_text`              | Create a text layer. Position is [x,y] in pixels and font size is points.                                                                         |
| `resize_image`          | Resize the active image to explicit pixel dimensions.                                                                                             |
| `save_document`         | Save the active document to its current file. Unsaved documents must use save_as_psd.                                                             |
| `save_as_psd`           | Save the active document as PSD, preserving layers.                                                                                               |
| `export_image`          | Export a PNG or JPEG copy. The output extension must match the selected format.                                                                   |
| `run_script` (optional) | Execute arbitrary ExtendScript with full Adobe scripting permissions. Return a plain JSON-compatible value using return. No browser or Node APIs. |

## Media Encoder (11 default tools)

| Tool                        | Behavior                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connection_status`         | Check the local bridge for Media Encoder; works without Adobe connected.                                                                          |
| `get_app_info`              | Read the connected Adobe application name and version.                                                                                            |
| `get_batch_status`          | Read batch running state and status (detailed status requires AME 23.3+).                                                                         |
| `list_formats`              | List available encoder output formats.                                                                                                            |
| `list_import_types`         | List supported source media file types.                                                                                                           |
| `add_to_queue`              | Queue one source file with an explicit output path and .epr preset. Queue acceptance does not mean encoding is complete.                          |
| `list_dynamic_link_items`   | Read root composition/sequence GUIDs from an AEP or Premiere project.                                                                             |
| `add_dynamic_link_to_queue` | Queue a composition/sequence using its GUID, project path and preset.                                                                             |
| `start_batch`               | Start or resume the Media Encoder batch. Returns immediately; use get_batch_status for progress.                                                  |
| `pause_batch`               | Pause the active batch.                                                                                                                           |
| `stop_batch`                | Stop the batch. An in-progress output may be incomplete.                                                                                          |
| `run_script` (optional)     | Execute arbitrary ExtendScript with full Adobe scripting permissions. Return a plain JSON-compatible value using return. No browser or Node APIs. |

## Illustrator (15 default tools)

| Tool                    | Behavior                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connection_status`     | Check the local bridge for Illustrator; works without Adobe connected.                                                                            |
| `get_app_info`          | Read the connected Adobe application name and version.                                                                                            |
| `list_documents`        | List open Illustrator documents with one-based indexes.                                                                                           |
| `open_document`         | Open an Illustrator-compatible local file.                                                                                                        |
| `create_document`       | Create an RGB document. Dimensions are points; Illustrator assigns the initial name.                                                              |
| `activate_document`     | Activate a document using its one-based index.                                                                                                    |
| `list_layers`           | List top-level layers in the active document.                                                                                                     |
| `create_layer`          | Create a named layer in the active document.                                                                                                      |
| `list_artboards`        | Read artboard rectangles [left,top,right,bottom] in points.                                                                                       |
| `add_artboard`          | Add an artboard using [left,top,right,bottom] points.                                                                                             |
| `add_rectangle`         | Draw a filled rectangle. Coordinates and dimensions are points.                                                                                   |
| `add_text`              | Create point text at [x,y] in points.                                                                                                             |
| `save_as_ai`            | Save the active Illustrator document as AI.                                                                                                       |
| `export_svg`            | Export the active document as SVG.                                                                                                                |
| `export_png`            | Export PNG24 with artboard clipping. Scale is a percentage.                                                                                       |
| `run_script` (optional) | Execute arbitrary ExtendScript with full Adobe scripting permissions. Return a plain JSON-compatible value using return. No browser or Node APIs. |

## InDesign (14 default tools)

| Tool                    | Behavior                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connection_status`     | Check the local bridge for InDesign; works without Adobe connected.                                                                               |
| `get_app_info`          | Read the connected Adobe application name and version.                                                                                            |
| `list_documents`        | List open InDesign documents.                                                                                                                     |
| `open_document`         | Open an existing InDesign document.                                                                                                               |
| `create_document`       | Create a document with dimensions in points.                                                                                                      |
| `list_pages`            | Read page names and text-frame counts.                                                                                                            |
| `add_page`              | Append one page to the active document.                                                                                                           |
| `add_text_frame`        | Add a text frame. Bounds [top,left,bottom,right] use points in the current ruler origin.                                                          |
| `list_text_frames`      | Read text frame IDs and contents on a page.                                                                                                       |
| `set_text`              | Replace contents of a text frame by ID.                                                                                                           |
| `place_image`           | Place a local image into a new rectangular frame and fit proportionally.                                                                          |
| `save_as`               | Save the active document as INDD.                                                                                                                 |
| `list_pdf_presets`      | List installed PDF export preset names.                                                                                                           |
| `export_pdf`            | Export PDF, optionally using an installed preset name.                                                                                            |
| `run_script` (optional) | Execute arbitrary ExtendScript with full Adobe scripting permissions. Return a plain JSON-compatible value using return. No browser or Node APIs. |

## After Effects (17 default tools)

| Tool                    | Behavior                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connection_status`     | Check the local bridge for After Effects; works without Adobe connected.                                                                          |
| `get_app_info`          | Read the connected Adobe application name and version.                                                                                            |
| `get_project`           | Read current After Effects project information.                                                                                                   |
| `open_project`          | Open an existing AEP project. Refuse if another project is already open with items.                                                               |
| `save_project_as`       | Save the current project as an AEP file.                                                                                                          |
| `list_items`            | List project items with one-based indexes and stable item IDs.                                                                                    |
| `import_file`           | Import a local media file into the project.                                                                                                       |
| `create_composition`    | Create a composition with pixel dimensions and duration in seconds.                                                                               |
| `list_layers`           | Read layers of a composition, with one-based layer indexes.                                                                                       |
| `add_text`              | Add a text layer to a composition.                                                                                                                |
| `add_solid`             | Add a full-frame solid layer with RGB values from zero to one.                                                                                    |
| `add_footage_layer`     | Add an existing project footage or composition item to a composition.                                                                             |
| `set_transform`         | Set static 2D position, scale, rotation and opacity. Existing keyframes cause Adobe to reject static changes.                                     |
| `set_opacity_keyframe`  | Set an opacity keyframe at a time in seconds.                                                                                                     |
| `add_to_render_queue`   | Queue a composition for rendering using existing Render Settings / Output Module template names.                                                  |
| `list_render_queue`     | Read queued render items and their native status values.                                                                                          |
| `render_queue`          | Render all enabled queued items synchronously. This can take a long time; configure ADOBE_MCP_TIMEOUT_MS accordingly.                             |
| `run_script` (optional) | Execute arbitrary ExtendScript with full Adobe scripting permissions. Return a plain JSON-compatible value using return. No browser or Node APIs. |

## Audition (8 default tools)

| Tool                    | Behavior                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connection_status`     | Check the local bridge for Audition; works without Adobe connected.                                                                               |
| `get_app_info`          | Read the connected Adobe application name and version.                                                                                            |
| `list_commands`         | Discover actual Audition command IDs and help from the installed version. Filter before invoking commands.                                        |
| `is_command_enabled`    | Check whether an Audition command ID is enabled in the current workspace.                                                                         |
| `invoke_command`        | Invoke an enabled Audition command discovered with list_commands. It may modify audio or open a native dialog.                                    |
| `get_active_document`   | Read active document type; waveform timing is in samples and seconds.                                                                             |
| `set_playhead`          | Move the waveform playhead to an absolute time in seconds.                                                                                        |
| `inspect_api`           | Read reflected property and method names from Audition to discover version-specific scripting capabilities.                                       |
| `run_script` (optional) | Execute arbitrary ExtendScript with full Adobe scripting permissions. Return a plain JSON-compatible value using return. No browser or Node APIs. |
