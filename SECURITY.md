# Security policy

## Supported versions

Security fixes are currently applied to the latest code on `main`. Older snapshots do not have a separate maintenance commitment.

## Reporting a vulnerability

Use the repository's **Security > Advisories > Report a vulnerability** feature if available. If private reporting is unavailable, contact the maintainer at the address listed on their [public profile](https://github.com/salehghotbani). Do not disclose credentials, private documents, or working exploit details in a public issue.

Provide the affected commit or version, platform, reproduction using synthetic data, expected boundary, observed impact, and any proposed mitigation. Please allow time to investigate and coordinate a fix before publishing technical details.

## Trust boundaries

- Servers accept MCP commands from the local client that starts them. That client can request document modifications and file exports.
- The internal HTTP bridge binds to `127.0.0.1` and requires an application-specific token for operational requests. It is not designed for network exposure or multi-user hosting.
- `.adobe-mcp/config.json`, installed panel `config.js` files, and generated panels contain local credentials. Do not publish them or attach them to issues.
- Token protection does not isolate other software with access to the same operating-system account or files.
- `run_script` is disabled by default. Enabling `ADOBE_MCP_ALLOW_SCRIPTS=true` grants the client the Adobe host's full ExtendScript capabilities, including native file access.
- Output existence checks are not an atomic filesystem lock or a filesystem sandbox. Other processes and native render queues can change output files after queueing.
- Native commands can modify open documents, invoke dialogs, render existing queue items, or leave partial changes after a failure. Use trusted clients and appropriate backups.
- A timeout after dispatch does not cancel native execution. Inspect Adobe before retrying a modifying tool.

## Unsigned development panels

The installer's `-EnableUnsigned` option explicitly enables unsigned development panels for the current user's CEP 10–12 settings. Only load extension directories you trust. Omit the option when your environment already provides the intended signed or development setup.
