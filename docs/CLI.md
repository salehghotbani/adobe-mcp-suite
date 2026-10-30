# Terminal command reference

After [installation](INSTALLATION.md), invoke the reported launcher or add its `bin` directory to PATH. The examples below use `adobe-mcp`. Windows also provides `adobe-mcp.cmd`.

```text
adobe-mcp <command> [options]
```

The extracted portable launcher can perform the initial `install`. Use the installed stable launcher for subsequent management. `--version` reports the version of the launcher target being executed; `status` reports the active version recorded in the selected installation home.

## Commands

| Command                       | Behavior                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--help` or `-h`              | Print usage; no installation is required                                                                                                                      |
| `--version` or `-v`           | Print the executing package version                                                                                                                           |
| `list`                        | List all seven application IDs and indicate which are selected in this home; works before installation                                                        |
| `install --apps ps,pr`        | Install or add application tool sets and regenerate selected entries/panels; preserve existing selections and credentials                                     |
| `uninstall --apps ps`         | Remove selected application entries and move their owned panels into backups                                                                                  |
| `uninstall --all`             | Remove every selected application tool set; retain the manager, credentials, versions and backups                                                             |
| `status`                      | Report the active/previous versions, application selections, platform, locations and update preferences                                                       |
| `doctor`                      | Verify the active bundle and version pointer, saved connection settings, generated client configuration, bootstrap file presence and selected panel ownership |
| `config`                      | Print MCP client entries for the selected applications                                                                                                        |
| `updates check`               | Check the latest stable release immediately, bypassing the persisted check interval                                                                           |
| `updates on` / `updates off`  | Enable or disable background checks for this installation                                                                                                     |
| `updates interval --hours 48` | Set the persisted interval to an integer from 1 through 168 hours                                                                                             |
| `update`                      | Download, verify and activate a newer stable release; report `updated: false` when already up to date                                                         |
| `rollback`                    | Activate the previously active installed version using current application selections and credentials                                                         |
| `run photoshop`               | Start one selected application server over stdio; normally invoked by the MCP client                                                                          |

Omitting `--apps` for `install` or selective `uninstall` opens an interactive selection in a terminal. Piped/non-interactive runs require `--apps`, or `--all` for removal. Running `adobe-mcp` with no command prints help.

`doctor` verifies local installation data. Use the MCP tool `connection_status` to inspect the live bridge, then `get_app_info` to exercise a connected native host. A healthy installation alone does not establish an Adobe connection.

## Application selection

| Application ID  | Accepted aliases     | Symbol |
| --------------- | -------------------- | ------ |
| `premiere-pro`  | `premiere`, `pr`     | Pr     |
| `photoshop`     | `ps`                 | Ps     |
| `media-encoder` | `encoder`, `me`      | Me     |
| `illustrator`   | `ai`                 | Ai     |
| `indesign`      | `id`                 | Id     |
| `after-effects` | `ae`, `aftereffects` | Ae     |
| `audition`      | `au`                 | Au     |

Selection is case-insensitive. Use comma-separated values, repeat `--apps`, or use `--apps all`:

```sh
adobe-mcp install --apps ps,pr --apps ae
adobe-mcp install --apps all
adobe-mcp uninstall --apps ps,ae
```

The ZIP includes shared code for all seven servers. Selection controls the registered application entries and installed panels. Individual tools within an application's default catalog cannot be selected through `--apps`.

## Options

| Option                         | Applies to                    | Meaning                                                                                                    |
| ------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `--apps <IDs>`                 | `install`, `uninstall`        | Application IDs, aliases or `all`; may be repeated                                                         |
| `--all`                        | `uninstall`                   | Remove all selected application tool sets                                                                  |
| `--root <directory>`           | Management commands and `run` | Use a dedicated installation home; takes precedence over `ADOBE_MCP_HOME`                                  |
| `--extensions-dir <directory>` | `install`                     | Override the CEP panel directory on Windows/macOS                                                          |
| `--server-only`                | `install`                     | Install managed server entries without native CEP panels; initial Linux installations default to this mode |
| `--enable-unsigned`            | `install`                     | Explicitly enable current-user unsigned CEP panel loading on Windows/macOS                                 |
| `--replace-existing`           | `install`                     | Back up and replace existing project panels that are not owned by this home                                |
| `--json`                       | `list`                        | Return the application listing as JSON; other management results already use JSON                          |
| `--hours <integer>`            | `updates interval`            | Set the background check interval from 1 through 168 hours                                                 |

Use flags with the command listed above. The unsigned-panel option requires Windows/macOS panel mode; omit it with `--server-only`. Changing an existing installation's server-only mode or CEP directory requires removing all selected tool sets first. Re-running `install` adds to the selection; it does not replace the selection with the supplied list.

For a custom home, use its installed launcher or specify the home explicitly:

```sh
adobe-mcp status --root /absolute/path/to/adobe-mcp-home
adobe-mcp install --apps ai --root /absolute/path/to/adobe-mcp-home
```

PowerShell bootstrap parameters use PowerShell syntax: `-Apps`, `-Root`, `-ServerOnly`, `-EnableUnsigned` and `-ReplaceExisting`. They are documented in [INSTALLATION.md](INSTALLATION.md). The POSIX bootstrap forwards CLI options to `install`.

## Output and process behavior

`list` prints a readable table unless `--json` is supplied. Help/version are text. Installation, status, diagnostics, configuration and version-management results are JSON on stdout. `run` reserves stdout for the MCP protocol. Diagnostics, interactive prompts and update notices go to stderr.

Successful management commands exit with code 0. Invalid arguments, failed operations, an unhealthy `doctor` result and an unavailable explicit update check exit with code 1. A check finding a newer release still succeeds; inspect `available` in its JSON. Background network failures do not fail the MCP server. Normal process signal handling also applies to long-running servers.

For update notification timing, token retention and the stable bootstrap runtime, see [installation and updates](INSTALLATION.md#updates-and-rollback). For error recovery, see [troubleshooting](TROUBLESHOOTING.md).
