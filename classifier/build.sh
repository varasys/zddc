#!/bin/sh
set -eu

root_dir=$(cd "$(dirname "$0")" && pwd)
. "$root_dir/../shared/build-lib.sh"

src_html="$root_dir/template.html"
output_dir="$root_dir/dist"
output_html="$output_dir/classifier.html"

mkdir -p "$output_dir"
ensure_exists "$src_html"

css_temp=$(mktemp)
js_temp=$(mktemp)
cleanup() { rm -f "$css_temp" "$js_temp"; }
trap cleanup EXIT

# CSS files to concatenate in order
concat_files \
  "../shared/base.css" \
  "css/base.css" \
  "css/layout.css" \
  "css/spreadsheet.css" \
  > "$css_temp"

# JavaScript files to concatenate in order
concat_files \
  "../shared/zddc.js" \
  "../shared/theme.js" \
  "js/app.js" \
  "js/utils.js" \
  "../shared/zddc-filter.js" \
  "js/store.js" \
  "js/validator.js" \
  "js/scanner.js" \
  "js/tree.js" \
  "js/spreadsheet.js" \
  "js/selection.js" \
  "js/preview.js" \
  "js/resize.js" \
  "js/filter.js" \
  "js/sort.js" \
  "js/excel.js" \
  "../shared/help.js" \
  > "$js_temp"

# Process template: inject CSS/JS, substitute timestamp, strip CDN refs
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
rm -f "$dev_dir/classifier.html" && cp "$output_html" "$dev_dir/classifier.html"
echo "Copied to $dev_dir/classifier.html"
