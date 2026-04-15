#!/bin/sh
# =============================================================================
# ZDDC shared build helpers — sourced by each tool's build.sh
#
# Usage in a tool build.sh:
#   root_dir=$(cd "$(dirname "$0")" && pwd)
#   . "$root_dir/../shared/build-lib.sh"
#
# Provides:
#   ensure_exists <path>          — abort with error if file missing
#   concat_files  <file ...>      — cat each relative path under $root_dir
#   build_timestamp               — ISO UTC string set at source time
#   strip_cdns                   — awk filter expression (used in pipelines)
# =============================================================================

# Abort if root_dir is not set by the caller
if [ -z "${root_dir:-}" ]; then
    echo "build-lib.sh: root_dir must be set before sourcing this file" >&2
    exit 1
fi

# Fail hard on any missing source file
ensure_exists() {
    _path="$1"
    if [ ! -f "$_path" ]; then
        echo "error: missing file: $_path" >&2
        exit 1
    fi
}

# Concatenate files listed as positional args, each relative to root_dir
concat_files() {
    for _rel do
        ensure_exists "$root_dir/$_rel"
        cat "$root_dir/$_rel"
        printf '\n'
    done
}

# ISO UTC build timestamp — set once when this file is sourced
build_timestamp=$(date -u +"%Y-%m-%d %H:%M:%S")
