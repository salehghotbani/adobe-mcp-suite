# Adobe MCP Suite v0.2.0

Terminal installation and version management for seven independent Adobe MCP servers, with 131 default tools and per-server resources and prompts.

- Select Premiere Pro (Pr), Photoshop (Ps), Media Encoder (Me), Illustrator (Ai), InDesign (Id), After Effects (Ae), Audition (Au), or any combination.
- Portable Windows x64, macOS Intel/Apple Silicon, and Linux x64/ARM64 ZIPs include Node.js and production dependencies. Linux supports server-only mode.
- Incremental tool installation, selective removal, stable MCP client configuration, preserved tokens, verified updates and rollback.
- Automatic update checks with persistent throttling, configurable intervals, an opt-out, and stderr-only notifications. Installation always requires the explicit `update` command.
- SHA-256 checksums, per-file bundle verification, safer extraction, panel backups and transaction recovery.
- Blue pen icon accompanied by named application letter badges.

Download your platform's ZIP and read `INSTALLATION.md`. `install.ps1` and `install.sh` are optional latest-release bootstrap installers. `adobe-mcp-suite-0.2.0.tgz` is the source/npm package and requires a separately installed Node.js/npm. GitHub's source archives are also available. `SHA256SUMS`, `LICENSE` and `NOTICE` accompany the assets; dependency and Node.js licenses are included inside the ZIPs.

All portable bundles are built on native runners and smoke-tested by installing selected tools, preserving tokens across incremental installation, starting real MCP stdio sessions through stable launchers, and removing a selection. Automated tests cover update integrity failures, rollback, storage safety and the existing protocol/bridge behavior.

This is an early development release. Native Adobe workflows have not yet been verified inside Adobe applications. Hosts must retain compatible CEP/ExtendScript support; UXP is not included. The project is independent of Adobe and is not endorsed by Adobe. The bundles and CEP panels are unsigned.
