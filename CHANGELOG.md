# Changelog

## Unreleased

- Separate bridge, configuration, MCP, setup, and catalog modules while preserving all seven server entrypoints.
- Organize tests into unit, integration, and shared fixture directories; consolidate branding and archive earlier designs.
- Validate saved connection settings before setup writes and avoid exposing credentials in configuration errors.
- Include shared tools in the generated catalog and add a read-only documentation freshness check.
- Add consistent source formatting, centralized version metadata, and a declarative CEP manifest template.
- Preserve the actionable uncertain-operation error after a stale panel lease and avoid invoking panel request callbacks twice.

## 0.1.0 — 2026-10-30

Initial source release.

- Seven independent MCP servers for Premiere Pro, Photoshop, Media Encoder, Illustrator, InDesign, After Effects, and Audition.
- 93 default tools, with optional arbitrary ExtendScript execution.
- Per-application CEP panels and authenticated loopback bridges.
- Strict input schemas, JSON-safe host serialization, paginated lists, and explicit overwrite controls.
- Serialized native operations and distinct handling of queued and dispatched timeouts.
- Windows development panel installer and generated MCP client configuration.
- Blue pen project icon, English documentation, contributor guidance, and MIT License.
- Automated syntax, protocol, transport, and simulated host tests. Native Adobe workflows remain unverified.
