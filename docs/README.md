# Adobe MCP Suite documentation

This guide covers the terminal manager and seven independent Adobe MCP servers. The current documentation describes the v0.2.1 command set. Documents included in release archives remain snapshots of their release tag; this directory on `main` includes subsequent documentation corrections.

## Start here

1. Choose your platform and install the applications you need using the [installation guide](INSTALLATION.md).
2. Import the generated server entries using the [MCP client and configuration guide](CONFIGURATION.md).
3. On Windows/macOS, open each selected application's CEP panel and call `connection_status` through your MCP client.
4. Read the [tool catalog](TOOLS.md) and [workflow resources and prompts](MCP-DISCOVERY.md) before modifying a document.

| Guide                                                      | What it covers                                                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [Installation](INSTALLATION.md)                            | Platform packages, checksum verification, selective installation, locations, upgrades and rollback    |
| [Terminal command reference](CLI.md)                       | Every command, supported flags, selection aliases, output and exit behavior                           |
| [MCP clients and configuration](CONFIGURATION.md)          | Managed versus source configuration, generated stdio entries, environment variables, ports and tokens |
| [Troubleshooting](TROUBLESHOOTING.md)                      | Missing panels, disconnected bridges, occupied ports, failed updates and uncertain native operations  |
| [Tool catalog](TOOLS.md)                                   | All enabled tools grouped by application, including shared tools                                      |
| [Machine-readable schemas](tools.json)                     | Generated input schemas and tool metadata                                                             |
| [Resources, prompts and workflows](MCP-DISCOVERY.md)       | Discovery URIs, workflow planning and application behavior                                            |
| [Architecture](ARCHITECTURE.md)                            | Runtime boundaries, managed storage, update verification and the native bridge                        |
| [Release notes](RELEASE-NOTES.md)                          | Changes and assets in the current software release                                                    |
| [Contributing](../CONTRIBUTING.md)                         | Source setup, checks, pull requests and release preparation                                           |
| [Security policy](../SECURITY.md)                          | Credentials, scripting permissions, unsigned panels and vulnerability reporting                       |
| [License](../LICENSE) and [third-party notices](../NOTICE) | Project and bundled dependency licensing                                                              |

## Platform and verification scope

Windows x64 and macOS Intel/Apple Silicon have portable packages and CEP panel installation. Linux x64/ARM64 provides server-only operation and disconnected MCP discovery. Native Adobe desktop applications must be installed separately on a supported platform and retain compatible CEP/ExtendScript APIs. A UXP adapter and a remote Adobe bridge are not included.

Portable installation and MCP stdio are tested on native operating-system runners. Adobe tool behavior is covered by simulated host tests; native workflows inside Adobe applications remain unverified. Use disposable documents when verifying your installed host version. The project is an independent integration; the [blue pen icon and application badges](../assets/branding/README.md) do not indicate Adobe endorsement or certified version compatibility.
