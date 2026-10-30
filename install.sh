#!/bin/sh
set -eu
repository=salehghotbani/adobe-mcp-suite
for dependency in curl unzip; do
  command -v "$dependency" >/dev/null 2>&1 || { echo "Install $dependency first." >&2; exit 1; }
done
case "$(uname -s)" in Darwin) platform=macos ;; Linux) platform=linux ;; *) echo 'Use install.ps1 on Windows.' >&2; exit 1 ;; esac
case "$(uname -m)" in x86_64|amd64) arch=x64 ;; arm64|aarch64) arch=arm64 ;; *) echo 'Unsupported architecture.' >&2; exit 1 ;; esac
redirect=$(curl --fail --silent --show-error --head --output /dev/null --write-out '%{redirect_url}' "https://github.com/$repository/releases/latest")
tag=$(printf '%s\n' "$redirect" | sed -n "s|^https://github.com/$repository/releases/tag/\(v[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)$|\1|p")
[ -n "$tag" ] || { echo 'No valid stable release was found.' >&2; exit 1; }
name="adobe-mcp-suite-$tag-$platform-$arch.zip"
base="https://github.com/$repository/releases/download/$tag"
temporary=$(mktemp -d "${TMPDIR:-/tmp}/adobe-mcp-install.XXXXXXXX")
cleanup() {
  case "$temporary" in "${TMPDIR:-/tmp}"/adobe-mcp-install.*) rm -rf -- "$temporary" ;; *) echo 'Unsafe cleanup path.' >&2 ;; esac
}
trap cleanup EXIT HUP INT TERM
curl --fail --location --silent --show-error "$base/SHA256SUMS" -o "$temporary/SHA256SUMS"
expected=$(awk -v file="$name" '$2 == file {print $1}' "$temporary/SHA256SUMS")
[ "${#expected}" -eq 64 ] && ! printf '%s' "$expected" | LC_ALL=C grep -q '[^0-9a-fA-F]' || { echo 'Missing or invalid checksum.' >&2; exit 1; }
curl --fail --location --silent --show-error "$base/$name" -o "$temporary/bundle.zip"
if command -v sha256sum >/dev/null 2>&1; then actual=$(sha256sum "$temporary/bundle.zip" | awk '{print $1}')
else actual=$(shasum -a 256 "$temporary/bundle.zip" | awk '{print $1}'); fi
[ "$actual" = "$expected" ] || { echo 'Downloaded archive checksum mismatch.' >&2; exit 1; }
unzip -q "$temporary/bundle.zip" -d "$temporary/bundle"
chmod +x "$temporary/bundle/runtime/node" "$temporary/bundle/adobe-mcp"
"$temporary/bundle/runtime/node" "$temporary/bundle/app/bin/adobe-mcp.mjs" install "$@"
