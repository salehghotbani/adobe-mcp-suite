# Terminal installation

Download a portable ZIP from [Releases](https://github.com/salehghotbani/adobe-mcp-suite/releases/latest). Each ZIP includes Node.js and production dependencies. You do not need npm, a global Node installation, or administrator privileges. The manager installs only the MCP server entries and CEP panels you select; shared runtime files are bundled once per version.

## Choose a package

| Platform            | Release suffix    | Native panels |
| ------------------- | ----------------- | ------------- |
| Windows x64         | `windows-x64.zip` | CEP           |
| macOS Intel         | `macos-x64.zip`   | CEP           |
| macOS Apple Silicon | `macos-arm64.zip` | CEP           |
| Linux x64           | `linux-x64.zip`   | Server only   |
| Linux ARM64         | `linux-arm64.zip` | Server only   |

The native Adobe applications must be installed separately. Linux can run the MCP protocol server and disconnected discovery features, but cannot automate a native Adobe desktop host. This release does not provide a remote bridge or Linux Adobe compatibility layer. Windows ARM64 is not packaged.

Host compatibility depends on the installed Adobe version retaining CEP/ExtendScript support. The manifest version range does not certify compatibility. Native operations have not yet been verified inside Adobe applications. See [Adobe system requirements](https://helpx.adobe.com/download-install/apps/system-requirements/creative-cloud-requirements.html) and [CEP/UXP migration guidance](https://helpx.adobe.com/au/creative-cloud/apps/integration-with-other-apps/manage-plugins/cep-uxp-plugin-transition.html).

## Install from a downloaded ZIP

Verify the archive against the release's `SHA256SUMS`, then extract it into a temporary directory. On Windows:

```powershell
Get-FileHash .\adobe-mcp-suite-v0.2.0-windows-x64.zip -Algorithm SHA256
Expand-Archive .\adobe-mcp-suite-v0.2.0-windows-x64.zip .\adobe-mcp-bundle
cd adobe-mcp-bundle
.\adobe-mcp.cmd install --apps photoshop,premiere-pro --enable-unsigned
```

On macOS or Linux, compare `shasum -a 256 <archive>` (macOS) or `sha256sum <archive>` (Linux) with `SHA256SUMS`, extract with `unzip`, then:

```sh
chmod +x ./adobe-mcp ./runtime/node
./adobe-mcp install --apps ps,ai --enable-unsigned  # macOS
./adobe-mcp install --apps ps,ai --server-only    # Linux
```

Omit `--apps` to select applications interactively. Non-interactive runs require `--apps`. `--apps all` selects all seven. You can delete the extracted temporary bundle after installation succeeds.

Alternatively, download and inspect the release's bootstrap script. It selects the matching latest stable ZIP, verifies its SHA-256 checksum, and invokes the same manager:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Apps photoshop,premiere-pro -EnableUnsigned
```

```sh
sh ./install.sh --apps ps,ai --enable-unsigned  # macOS; requires curl, unzip, shasum
sh ./install.sh --apps ps,ai --server-only    # Linux; requires curl, unzip, sha256sum
```

`--enable-unsigned` explicitly enables unsigned development panels for the current user: `PlayerDebugMode=1` for CSXS 10, 11 and 12, through Windows registry settings or macOS `defaults`. It is optional and is never applied in server-only mode. Restart Adobe after panel changes and keep the matching **Window > Extensions (Legacy) > Adobe MCP** panel open. CEP menu names vary by Adobe version. This project does not sign or notarize the bundles or panels; checksums verify download integrity, not publisher identity.

## Installation locations and MCP clients

| System  | Default installation home                                            | CEP panels                                           |
| ------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| Windows | `%LOCALAPPDATA%\AdobeMCPSuite`                                       | `%APPDATA%\Adobe\CEP\extensions`                     |
| macOS   | `~/Library/Application Support/AdobeMCPSuite`                        | `~/Library/Application Support/Adobe/CEP/extensions` |
| Linux   | `$XDG_DATA_HOME/adobe-mcp-suite` or `~/.local/share/adobe-mcp-suite` | Unavailable                                          |

Use `--root <dedicated-directory>` or `ADOBE_MCP_HOME` to choose another installation home. Use `--extensions-dir <directory>` for a custom CEP directory. Do not move an installed home: launchers, panel ownership and exported MCP configuration contain absolute paths. Install again at the desired location instead.

Add the reported `<home>/bin` directory to your terminal PATH. The installer prints the absolute launcher and configuration paths; it does not edit shell profiles. Use the full launcher path until PATH is configured. For example, Windows's default launcher is `& "$env:LOCALAPPDATA\AdobeMCPSuite\bin\adobe-mcp.cmd"` and macOS's is `"$HOME/Library/Application Support/AdobeMCPSuite/bin/adobe-mcp"`.

```sh
adobe-mcp list
adobe-mcp config
adobe-mcp doctor
```

Import `<home>/mcp-servers.json`, or the output of `config`, into your MCP client. Each entry uses an absolute stable launcher that follows the active version after updates. Reconnect the MCP client after changing selections or versions. Run `connection_status` to verify the native panel is polling. MCP protocol output stays on stdout; diagnostics and update notifications use stderr.

## Select applications

| ID              | Short aliases        | Symbol |
| --------------- | -------------------- | ------ |
| `premiere-pro`  | `premiere`, `pr`     | Pr     |
| `photoshop`     | `ps`                 | Ps     |
| `media-encoder` | `encoder`, `me`      | Me     |
| `illustrator`   | `ai`                 | Ai     |
| `indesign`      | `id`                 | Id     |
| `after-effects` | `ae`, `aftereffects` | Ae     |
| `audition`      | `au`                 | Au     |

```sh
adobe-mcp install --apps premiere,ps
adobe-mcp install --apps ae,au       # Adds tools; preserves the previous selections
adobe-mcp uninstall --apps ps       # Removes the selected entry and its owned panel
adobe-mcp uninstall --all           # Removes all selected tool sets
```

Removal retains credentials, the manager, backups and downloaded versions so you can reinstall or roll back. Existing unmanaged panels are refused unless `--replace-existing` is explicitly provided; they are backed up first. Close Adobe before replacing or removing panels. Do not use the older source-only PowerShell installer to overwrite panels managed by this CLI.

Changing panel directory or switching between panel and server-only mode requires removing all selected tools first. Multiple homes must use separate ports and CEP directories; default ports are shared, so one managed home is recommended.

## Updates and rollback

```sh
adobe-mcp updates check
adobe-mcp update
adobe-mcp rollback
adobe-mcp updates off
adobe-mcp updates on
adobe-mcp updates interval --hours 48
```

Automatic checks are enabled by default with a 24-hour interval. A running managed MCP server checks at startup and revisits the persisted cache once an hour. Newer releases produce a stderr notification. Checks do not install updates, download bundles, or run when no managed server is running. Failures are quiet and cached; normal server startup does not wait for them. Set `ADOBE_MCP_NO_UPDATE_CHECK=1` in an MCP entry's environment to suppress its background checks. An explicit `updates check` bypasses the interval and reports network failures.

Checks contact the public GitHub releases API without credentials. Only the current version and standard HTTP request metadata are involved; bridge tokens, documents, filenames and Adobe content are not uploaded. Offline use continues to work.

`update` fetches only a newer stable release from this repository. It verifies the ZIP against `SHA256SUMS` and the GitHub asset digest when supplied, validates every bundled file, and then activates a version directory. It preserves app selections, connection tokens and update preferences. Existing panels are backed up under `<CEP directory>/.adobe-mcp-backups/`. If activation fails, the previous pointer, configuration and panels are restored. Downloads and extraction have size limits and reject path traversal. Updates require network access; downloaded portable ZIP installation works offline.

Restart Adobe and reconnect MCP servers after updating or rolling back. Already running processes continue using their version until restarted. `rollback` switches to the previously active verified version and regenerates panels using current selections and credentials. Old versions are retained because Windows may still be running their executables. The small bootstrap Node runtime remains stable for the same reason; the MCP server runtime comes from the active version. To replace the bootstrap runtime, close every managed server, back up credentials, and reinstall into a new dedicated home from a fresh bundle.

## Source installation and troubleshooting

Developers can use Node.js 22+ and `npm ci`, then `node bin/adobe-mcp.mjs install --apps ps --server-only`. Source installation copies the current runtime and dependencies and may fetch its matching license from the official Node.js repository if the local distribution omits it. Portable releases include all required licenses and production dependencies. The `.tgz` release asset is source-oriented and requires Node.js/npm; it is not a self-contained runtime bundle.

`doctor` reports installation metadata and verifies the active bundle, configuration and selected panel ownership. It cannot certify native Adobe behavior. If the CEP panel is missing, check unsigned panel settings and the installed host's CEP support. If the bridge port is occupied, stop duplicate servers or edit the app's port in `<home>/connections.json`, then rerun `install --apps <id>` to regenerate matching panels. Keep that file private: it contains tokens.

The installation lock prevents concurrent changes. A lock older than five minutes is recovered only if its process no longer exists. An invalid or busy lock should be inspected after closing all manager processes. Restore damaged state from a backup rather than deleting files while a server is running.
