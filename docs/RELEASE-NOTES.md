# Adobe MCP Suite v0.3.1

Terminal installation and version management for seven independent Adobe MCP servers, with 131 default tools and per-server resources and prompts.

This release adds live connection diagnostics and generated-file recovery. The v0.3.1 patch increases bundle-download timeouts for slower connections and makes the deadline configurable. Existing managed installations can run `adobe-mcp update`; new users should download the matching v0.3.1 ZIP. If an older updater hits its two-minute deadline, download a current ZIP and run its `install --root <existing-home> --apps <selected-IDs>` command to upgrade while preserving settings.

- `doctor --live` checks selected running bridges through authenticated read-only loopback requests, reporting disconnected panels, authentication/port mismatches, unavailable servers and uncertain operations. It never starts Adobe or dispatches scripts.
- `repair` rebuilds generated launchers, client configuration, the active pointer and owned panels from the verified installed version while preserving credentials, selections, update preferences and rollback history.
- Offline diagnostics now check all generated panel files and stale connection settings. Selected applications cannot share a bridge port.
- `install --with-panels` (PowerShell bootstrap: `-WithPanels`) supports returning from server-only mode after removing selected tools.
- CLI validation rejects ignored/incompatible flags and explicitly uninstalled app selections before changing the installation. Server-only setup now gives suitable next-step instructions.

Read the [current documentation](https://github.com/salehghotbani/adobe-mcp-suite/blob/main/docs/README.md) for the expanded terminal reference, MCP configuration examples and troubleshooting. Documents inside release archives remain snapshots of the release tag.

- Select Premiere Pro (Pr), Photoshop (Ps), Media Encoder (Me), Illustrator (Ai), InDesign (Id), After Effects (Ae), Audition (Au), or any combination.
- Portable Windows x64, macOS Intel/Apple Silicon, and Linux x64/ARM64 ZIPs include Node.js and production dependencies. Linux supports server-only mode.
- Incremental tool installation, selective removal, stable MCP client configuration, preserved tokens, verified updates and rollback.
- Automatic update checks with persistent throttling, configurable intervals, an opt-out, and stderr-only notifications. Installation always requires the explicit `update` command.
- SHA-256 checksums, per-file bundle verification, safer extraction, panel backups and transaction recovery.
- Blue pen icon accompanied by named application letter badges.

Download your platform's ZIP and read `INSTALLATION.md`. `install.ps1` and `install.sh` are optional latest-release bootstrap installers. `adobe-mcp-suite-0.3.1.tgz` is the source/npm package and requires a separately installed Node.js/npm. GitHub's source archives are also available. `SHA256SUMS`, `LICENSE` and `NOTICE` accompany the assets; dependency and Node.js licenses are included inside the ZIPs.

All portable bundles are built on native runners and smoke-tested by installing selected tools, preserving tokens across incremental installation, starting real MCP stdio sessions through stable launchers, repairing generated files and removing a selection. Windows/macOS additionally test switching from server-only to panel mode and repairing damaged panel assets. Automated tests cover live diagnostics against real local HTTP bridges, bounded/invalid responses, credential redaction, update integrity failures, rollback and storage safety.

This is an early development release. Native Adobe workflows have not yet been verified inside Adobe applications. Hosts must retain compatible CEP/ExtendScript support; UXP is not included. The project is independent of Adobe and is not endorsed by Adobe. The bundles and CEP panels are unsigned.
