#!/usr/bin/env bash
set -euo pipefail

root_dir=$(cd "$(dirname "$0")" && pwd)
. "$root_dir/../shared/build-lib.sh"

src_html="$root_dir/template.html"
output_dir="$root_dir/dist"
output_html="$output_dir/archive.html"

# CSS files to concatenate in order
main_css=(
  "../shared/base.css"
  "css/base.css"
  "css/layout.css"
  "css/components.css"
  "css/table.css"
  "css/print.css"
)

# JavaScript files to concatenate in order
main_js=(
  "../shared/zddc.js"
  "../shared/theme.js"
  "js/parser.js"
  "js/source.js"
  "js/hash.js"
  "js/drag-drop.js"
  "js/directory.js"
  "../shared/zddc-filter.js"
  "js/filtering.js"
  "js/table.js"
  "js/export.js"
  "js/events.js"
  "js/app.js"
  "../shared/help.js"
)

mkdir -p "$output_dir"
ensure_exists "$src_html"

css_temp=$(mktemp)
js_temp=$(mktemp)
cleanup() { rm -f "$css_temp" "$js_temp"; }
trap cleanup EXIT

concat_files main_css > "$css_temp"
concat_files main_js  > "$js_temp"

# Process template: inject CSS/JS, substitute build_timestamp, strip CDN refs
awk -v css_file="$css_temp" -v js_file="$js_temp" -v build_timestamp="$build_timestamp" '
  /\{\{CSS_PLACEHOLDER\}\}/ {
    while ((getline line < css_file) > 0) print line
    close(css_file)
    next
  }
  /\{\{JS_PLACEHOLDER\}\}/ {
    while ((getline line < js_file) > 0) print line
    close(js_file)
    next
  }
  /\{\{BUILD_TIMESTAMP\}\}/ {
    gsub(/\{\{BUILD_TIMESTAMP\}\}/, build_timestamp)
    print
    next
  }
  /<script src="https?:\/\// { next }
  /<link rel="stylesheet" href="https?:\/\// { next }
  { print }
' "$src_html" > "$output_html"

echo "Wrote $output_html"

# Copy built file to website/dev/ for live serving
dev_dir="$root_dir/../website/dev"
mkdir -p "$dev_dir"
cp --remove-destination "$output_html" "$dev_dir/archive.html"
echo "Copied to $dev_dir/archive.html"
