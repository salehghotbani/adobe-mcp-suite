# Troubleshooting

Start with the installed launcher's `status` and `doctor` commands. Then use `connection_status` in your MCP client to inspect the live application bridge. `doctor` checks local files and configuration; it does not start Adobe, probe native APIs, or certify compatibility.

## The terminal cannot find adobe-mcp

Use the absolute launcher path printed by installation. The installer creates `<home>/bin/adobe-mcp.cmd` on Windows and `<home>/bin/adobe-mcp` on macOS/Linux, and does not edit PATH. For the default Windows location:

```powershell
& "$env:LOCALAPPDATA\AdobeMCPSuite\bin\adobe-mcp.cmd" status
```

For the default macOS location:

```sh
"$HOME/Library/Application Support/AdobeMCPSuite/bin/adobe-mcp" status
```

For a custom home, use its launcher. A different extracted portable launcher uses the default home unless given `--root` or `ADOBE_MCP_HOME`.

## The MCP client cannot start or discover the server

Import the exact `command` and `args` from `adobe-mcp config`, adapting the outer JSON layout to the client. Each selected application needs a separate entry. Use the generated absolute executable path and keep argument array elements separate, including paths containing spaces.

Only one process can own a given bridge port. Let the client start the server; close a manually started `adobe-mcp run <app>` before connecting that same app in a client. Startup output such as `EADDRINUSE` indicates a port conflict. Changes to a shell's environment do not necessarily reach an already running desktop MCP client; set overrides on its server entry and reconnect it.

## The CEP panel is missing

On Windows/macOS, confirm installation selected the desired application and that `serverOnly` is `false` in `status`. Panels are installed under the CEP directory shown there. Restart Adobe and check **Window > Extensions** or **Extensions (Legacy)**; menu availability depends on the host version.

For unsigned development panels, explicitly rerun `install --apps <app> --enable-unsigned` if that is the intended setup. This changes shared current-user CEP development settings. Check that the installed Adobe version still supports CEP/ExtendScript. A UXP-only host cannot load this adapter. Linux server-only installations do not have native Adobe panels.

## connection_status reports disconnected

Keep the matching Adobe MCP panel open. Confirm the app ID and panel match the server entry. Compare the saved port and token with any process environment overrides; both panel and server must agree. After changing credentials, regenerate panels using the [configuration workflow](CONFIGURATION.md#change-a-saved-port-or-rotate-a-token).

An `Unauthorized` error points to mismatched credentials. `Wrong Adobe host` indicates the panel is running in the wrong application. `Another Adobe panel is connected` means another live panel owns the lease; close duplicates. A healthy `doctor` result alone does not establish a live connection.

Once connected, call `get_app_info` on a disposable session. Check tool-specific API availability, document state and version requirements if that call succeeds but another tool fails.

## The installation directory or panel already exists

Choose a dedicated empty home or an existing home managed by this project. A personal folder, checkout root or unrelated nonempty directory cannot be used as an installation home.

An existing project panel with no matching ownership marker is refused. Close Adobe, review its contents and use `install --apps <app> --replace-existing` only when you intend to back it up and replace it. Backups are retained under `<CEP directory>/.adobe-mcp-backups/`. Using a second home against the same panel directory can create ownership conflicts.

Changing the CEP directory or switching installation mode requires `uninstall --all` first. It retains credentials and the manager. Then rerun `install` with the intended mode and directory. Do not overwrite managed panels with the older development installer.

## An operation times out or reports uncertain execution

Read the returned error before retrying. A queued command that expires before dispatch is removed. A command that times out after dispatch may still be running inside Adobe; inspect the application and output files before attempting another mutation.

The bridge holds additional dispatch while the result remains uncertain. Allow the current operation to finish. If no result arrives, inspect the host, close/restart the matching server and panel, then assess the document before retrying. Restarting the bridge does not undo Adobe changes. Multi-step edits and batches can leave partial results.

For legitimately long operations, increase both `ADOBE_MCP_TIMEOUT_MS` and the MCP client's timeout before starting the workflow. A longer deadline does not bypass native dialogs, missing presets or unsupported APIs.

## Update checks fail or no notification appears

Run `updates check` to bypass the persisted interval and view the result. Automatic checks require a running managed MCP server; a closed client or direct `src/servers` process does not run this monitor. Preferences from `updates off`, `ADOBE_MCP_NO_UPDATE_CHECK=1`, or a fresh cache can suppress background requests. Checks inspect the cache hourly and normally contact GitHub at most once per configured interval per home. Concurrent processes use a check lock; a busy result can be retried later.

Network errors, rate limiting, unavailable release assets or proxy/TLS restrictions can produce `status: unavailable`. Background failures are quiet and cached, including failures during offline use. Manual checks report the error. Background checks never install a release.

## A download or bundle fails verification

Use `update` again after confirming the network and the intended release. It checks `SHA256SUMS`, the GitHub asset digest when supplied, the archive version/platform and every bundled file before activation. Do not bypass a checksum failure or edit the per-file manifest. Discard a corrupt download and obtain a fresh matching ZIP.

The Windows bootstrap checksum-response issue in v0.2.0 is fixed in v0.2.1. Download the current `install.ps1`, or install from the current platform ZIP. Existing v0.2.0 managed installations can use `adobe-mcp update`.

If `doctor` reports damaged active bundle files, a same-version `install` reuses the existing version directory and is not an integrity repair. Close all managed processes and install a verified portable bundle into a new dedicated home. Preserve a private backup of connection settings and selections; resolve the old panel ownership explicitly before replacing panels. Avoid editing internal state or deleting a version directory while a process is using it.

`rollback` requires a previously active verified version. It keeps current app selections and credentials, and can switch between the two most recently active versions. Reconnect clients and reopen Adobe panels afterwards. Removing a selected tool set does not recreate it during rollback.

## Installation is locked

Wait for another install, update, rollback or configuration change to finish. A lock older than five minutes is recovered only when its recorded process no longer exists. Inspect a corrupt or stale lock after closing manager processes; do not remove a lock belonging to a live operation.

## Removing retained files

`uninstall --all` removes selected entries from the generated configuration and moves owned panels into backups. Remove those entries from the MCP client's own configuration too, and stop any existing server processes. Removal retains the installed manager, credentials, versions and backups. To remove everything, close the MCP clients and Adobe panels, make any desired private backups, and remove only the dedicated home and the panel backups belonging to that installation. Leave unrelated CEP extensions and other applications' files intact. Shared unsigned-panel preferences are not reset automatically.

## Reporting an unresolved issue

Include the suite version, OS/architecture, installation method, selected app IDs, Adobe version when relevant, MCP client, command or tool name, redacted error and smallest reproduction. Use synthetic documents. Do not attach `connections.json`, `.adobe-mcp/config.json`, panel `config.js`, panel backups or private media. The [bug report form](https://github.com/salehghotbani/adobe-mcp-suite/issues/new?template=bug_report.yml) and [security policy](../SECURITY.md) describe the reporting routes.
