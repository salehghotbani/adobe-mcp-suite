# MCP clients and configuration

Each selected Adobe application is a separate local stdio MCP server. The MCP client launches its configured process. The loopback HTTP bridge connects that process to the CEP panel; it is an internal transport and is not an MCP HTTP URL.

## Generated client entries

After a managed installation, run:

```sh
adobe-mcp config
```

The same entries are saved in `<installation home>/mcp-servers.json`. Copy the selected entries into your client's local-server configuration, keeping `command`, `args` and any `env` values intact. Clients may use different outer field names or configuration screens; adapt the outer structure to your client's format. The generated `mcpServers` wrapper is a conventional interchange layout.

For example, a Windows installation at the default location generates a Photoshop entry shaped like this. Replace `YOUR_USER` with your actual user directory, or copy the exact generated paths:

```json
{
  "mcpServers": {
    "adobe-photoshop": {
      "command": "C:\\Users\\YOUR_USER\\AppData\\Local\\AdobeMCPSuite\\bootstrap\\node.exe",
      "args": [
        "C:\\Users\\YOUR_USER\\AppData\\Local\\AdobeMCPSuite\\bootstrap\\launcher.mjs",
        "run",
        "photoshop"
      ]
    }
  }
}
```

On macOS, the default executable is `/Users/YOUR_USER/Library/Application Support/AdobeMCPSuite/bootstrap/node`; its first argument is the adjacent `launcher.mjs`. On Linux, paths follow the installation home selected by `XDG_DATA_HOME`, `ADOBE_MCP_HOME` or `--root`. Generated entries already contain correct absolute paths, including spaces. Store program paths as JSON strings and arguments as separate array elements.

These entries use the stable bootstrap, which resolves the active version. Keep them pointing to the installed home. Reconnect the client after changing application selections, updating or rolling back. Adding an application also requires importing its newly generated entry into the client.

## Managed installation and source checkout

| Setting                  | Managed installation                                        | Direct source entrypoints                                     |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------- |
| Connection settings      | `<home>/connections.json`                                   | `<checkout>/.adobe-mcp/config.json` by default                |
| Generated client entries | `<home>/mcp-servers.json`                                   | `<checkout>/.adobe-mcp/mcp-servers.json`                      |
| Entry process            | `<home>/bootstrap/node[.exe]` with `launcher.mjs run <app>` | A Node.js 22+ executable with `src/servers/<app>.mjs`         |
| Regenerate panels        | `adobe-mcp install --apps <app>`                            | `npm run setup`, then reinstall the generated panel           |
| Configuration override   | Managed `run` explicitly selects `<home>/connections.json`  | `ADOBE_MCP_CONFIG` can select another connection file         |
| Automatic update checks  | Enabled by managed `run`, subject to saved preferences      | Direct source servers do not start the managed update monitor |

Use the workflow that owns the installed panel. The older `scripts/install-cep.ps1` development installer does not manage the terminal manager's ownership records. Avoid overwriting a managed panel through that script.

## Environment variables

Set server environment values in the individual MCP entry's `env` object:

| Variable                    | Behavior                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ADOBE_MCP_PORT`            | Override the saved loopback port for this process; integer 1–65535                                                                    |
| `ADOBE_MCP_TOKEN`           | Override the saved bridge token; 32–1024 visible ASCII characters, excluding spaces                                                   |
| `ADOBE_MCP_TIMEOUT_MS`      | Native operation deadline in milliseconds; default `60000`, range `100`–`3600000`                                                     |
| `ADOBE_MCP_ALLOW_SCRIPTS`   | Only the exact string `true` enables the optional `run_script` tool                                                                   |
| `ADOBE_MCP_NO_UPDATE_CHECK` | The exact string `1` suppresses background checks in managed `run`                                                                    |
| `ADOBE_MCP_CONFIG`          | Alternative connection file for direct source servers; managed `run` sets this to its own home                                        |
| `ADOBE_MCP_HOME`            | Select an installation home for direct CLI invocation; `--root` takes precedence. Installed bootstrap launchers select their own home |

For example, this fragment raises the native deadline and suppresses that managed server's background update checks:

```json
{
  "env": {
    "ADOBE_MCP_TIMEOUT_MS": "120000",
    "ADOBE_MCP_NO_UPDATE_CHECK": "1"
  }
}
```

Merge it into the relevant generated server entry in your MCP client. `adobe-mcp config` outputs generated command/argument entries; it does not preserve client-specific environment additions. Keep those additions in the client configuration when reimporting. A long operation can also require increasing the client's own tool timeout.

Port and token environment overrides affect the server process. Its installed panel must use matching values. The connection file is still validated even when per-process overrides are present. Enabling arbitrary scripting gives the client the host's full ExtendScript permissions; read the [security policy](../SECURITY.md).

## Change a saved port or rotate a token

For a managed installation:

1. Close the relevant Adobe panels and stop the matching MCP client server processes.
2. Make a private backup of `<home>/connections.json`.
3. Edit only the application's `port` and/or `token`. Keep the other applications' entries. Choose a free port and a fresh, unpredictable token satisfying the constraints above.
4. Run `adobe-mcp install --apps <app>` through that home's installed launcher. This regenerates selected panels with the saved settings.
5. Remove stale port/token overrides from the client's environment, or update them to match. Restart Adobe, reopen the panel and reconnect the client.
6. Call `connection_status`, then `get_app_info` through the MCP client.

For a direct source setup, edit `.adobe-mcp/config.json`, run `npm run setup`, and reinstall the affected generated panel. On Windows, the development panel script uses `-App <app> -Force` for replacement.

Connection files accept only known application IDs with `port` and `token` fields. Do not add host IDs, titles, comments or trailing commas. Token rotation updates active panels; older panel backups can retain previous credentials and should remain private.

## Installation metadata

`state.json`, `current`, `versions/`, `bootstrap/` and panel ownership markers are managed by the installer. Use `status`, `doctor`, `update`, `rollback` and the `updates` commands to inspect or change installation state. Editing bundled application files causes integrity verification to fail. Use a source checkout for development.

`uninstall --apps <IDs>` and `uninstall --all` retain the home, tokens, version directories and panel backups. Remove discarded entries from the MCP client's own configuration and stop its matching processes. See [removal](INSTALLATION.md#select-applications) and [troubleshooting](TROUBLESHOOTING.md) before manually removing retained files.
