# Contributing to Adobe MCP Suite

Terminal manager code lives in `src/cli/` and `src/installer/`. Run `npm run package:release` to build a portable archive for your current platform, then `node scripts/smoke-release.mjs` to verify installation and real MCP stdio from that archive. Packaging installs production dependencies into an isolated staging directory and obtains the matching Node.js license if necessary. Never include generated connection tokens in commits or release assets.

The release workflow builds and tests Windows x64, macOS x64/ARM64, and Linux x64/ARM64 bundles on native runners. A stable `vX.Y.Z` tag must match `package.json` and belong to `main`. Publishing waits for every bundle and its smoke test, assembles checksums and documentation, then publishes the complete draft. Workflow dispatch builds artifacts without publishing. Increment the package version and update `docs/RELEASE-NOTES.md` before tagging a new release.

Bug reports, compatibility results, documentation improvements, and focused application tools are welcome.

## Before starting

Read the [README](README.md), [tool catalog](docs/TOOLS.md), [architecture notes](docs/ARCHITECTURE.md), and [security policy](SECURITY.md). For a substantial change or new transport, open an issue describing the problem and proposed behavior before implementation.

Do not include bridge tokens, generated panels, local configuration, proprietary Adobe binaries, licensed assets, or private project files in issues or pull requests. Use small synthetic fixtures for reproductions.

## Local setup

Use Node.js 22 or newer:

```sh
npm ci
npm run setup
npm run check
npm test
```

The tests do not require Adobe installations. Native verification requires the matching installed application and CEP panel. The included panel installer is for Windows; other platforms need separate verification.

## Development conventions

- Keep each application's catalog in `src/apps/<application>.mjs` and its executable entrypoint in `src/servers/`.
- Use the shared `tool()` helper and strict Zod schemas. State units, index bases, active-document behavior, and completion semantics in descriptions.
- Keep generated host code ES3-compatible. It has Adobe ExtendScript globals, not Node.js or browser globals.
- Pass tool arguments through `p`; do not concatenate user input into executable script source.
- Use `h.require`, `h.input`, and `h.output` for preconditions and file checks. Avoid overwriting outputs without an explicit option.
- Return plain JSON-compatible data instead of native Adobe object references. Bound large lists with pagination.
- Mark read-only operations accurately. Treat edits, imports, exports, and command invocation as mutating operations.
- Write logs to stderr. stdout belongs to the MCP transport.
- Follow the existing ESM module structure and avoid adding dependencies unless they solve a concrete problem.
- Preserve the distinction between command dispatch, queue acceptance, and confirmed completion. Never automatically repeat a native mutation after an uncertain timeout.

## Validation

Before submitting a pull request:

```sh
npm run check
npm test
npm run catalog
npm run catalog:check
git diff --check
```

Commit changes to `docs/TOOLS.md` and `docs/tools.json` whenever a tool schema or description changes. Generated `.adobe-mcp/`, `build/`, and `node_modules/` files must remain untracked.

Use `npm run format` to apply the shared formatting rules. Keep unit tests in `tests/unit`, integration tests in `tests/integration`, and reusable fixtures in `tests/helpers`. Panel setup belongs in `src/setup`; application metadata and connection validation belong in `src/config`. The public server entrypoints in `src/servers` should remain stable.

Add tests for meaningful behavior changes, especially validation, file handling, connection isolation, serialization, queue ordering, and error recovery. Avoid tests that merely repeat implementation details. For Adobe-facing changes, report the exact application version, platform, workflow exercised, and observed result. Clearly distinguish simulated tests from native host tests.

## Pull request workflow

1. Fork the repository or create a topic branch from current `main`.
2. Make a focused change and include its documentation and relevant tests.
3. Use concise, descriptive commit messages in English and your own contributor identity.
4. Open a pull request explaining the problem, resulting behavior, validation, and any remaining host limitations.
5. Resolve review conversations and wait for the required CI check before merging.

`main` is the default branch and is protected. Use pull requests for changes; force pushes and branch deletion are disabled. Keep the branch up to date with `main` when required by checks.

## Reporting bugs

Use the bug-report issue template. Include the application and Node.js versions, platform, tool name, redacted arguments, expected behavior, observed behavior, and the shortest reproduction. Do not submit sensitive audio, video, images, documents, or access tokens.

For vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of opening a public issue with exploit details.

## Licensing contributions

By submitting a contribution, you agree that your original contributions may be distributed under the project's MIT License. You must have the right to contribute any code, documentation, or assets included in your submission. Third-party material must retain its required notices and compatible license terms.
