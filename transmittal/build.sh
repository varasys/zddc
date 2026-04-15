#!/usr/bin/env bash
set -euo pipefail

root_dir=$(cd "$(dirname "$0")" && pwd)
. "$root_dir/../shared/build-lib.sh"

src_html="$root_dir/template.html"
output_dir="$root_dir/dist"
output_html="$output_dir/transmittal.html"

main_css=(
  "../shared/base.css"
  "css/base.css"
  "css/layout.css"
  "css/forms.css"
  "css/table.css"
  "css/remarks.css"
  "css/markdown.css"
  "css/markdown-editor.css"
  "css/filter.css"
  "css/modal.css"
  "css/utilities.css"
  "css/print.css"
)

main_js=(
  "../shared/zddc.js"
  "../shared/theme.js"
  "js/app.js"
  "js/reactive.js"
  "js/dom.js"
  "js/util.js"
  "js/json.js"
  "js/hydrate.js"
  "js/state.js"
  "js/mode.js"
  "js/visibility.js"
  "js/live-digest.js"
  "js/files.js"
  "js/files-archive.js"
  "js/files-render.js"
  "js/files-preview.js"
  "../shared/zddc-filter.js"
  "js/filters.js"
  "js/markdown.js"
  "js/markdown-editor.js"
  "js/email-tags.js"
  "js/validation.js"
  "js/security.js"
  "js/verification.js"
  "js/data.js"
  "js/publish.js"
  "js/reset.js"
  "js/publish-modal.js"
  "js/logos.js"
  "js/drop-zones.js"
  "js/advanced.js"
  "js/focus.js"
  "../shared/help.js"
  "js/main.js"
)

mkdir -p "$output_dir"
ensure_exists "$src_html"
readme_file="$root_dir/README.md"
ensure_exists "$readme_file"

css_temp=$(mktemp)
js_temp=$(mktemp)
md_temp=$(mktemp)
cleanup() { rm -f "$css_temp" "$js_temp" "$md_temp"; }
trap cleanup EXIT

concat_files main_css > "$css_temp"
# JS source must never contain a literal </script> sequence (breaks inline embedding).
# Use string splitting ('</​' + 'script>') or new RegExp() to avoid it.
concat_files main_js > "$js_temp"
sed 's#</script>#<\/script>#g' "$readme_file" > "$md_temp"

awk -v css_file="$css_temp" -v js_file="$js_temp" -v md_file="$md_temp" -v build_timestamp="$build_timestamp" '
  BEGIN {
    css_inserted = 0
    js_inserted = 0
    help_inserted = 0
    in_help = 0
  }
  /<link rel="stylesheet" href="css\// { next }
  /<link rel="stylesheet" href="tailwind-lite\.css"/ { next }
  /<script src="js\// { next }
  /<script id="help-markdown" type="application\/markdown">/ {
    in_help = 1
    next
  }
  in_help {
    if ($0 ~ /<\/script>/) {
      in_help = 0
    }
    next
  }
  /<head>/ {
    print
    if (!css_inserted) {
      print "<style>"
      while ((getline line < css_file) > 0) print line
      close(css_file)
      print "</style>"
      css_inserted = 1
    }
    next
  }
  /<\/body>/ {
    if (!js_inserted) {
      print "<script>"
      while ((getline line < js_file) > 0) print line
      close(js_file)
      print "</script>"
      js_inserted = 1
    }
    if (!help_inserted) {
      print "<script id=\"help-markdown\" type=\"application/markdown\">"
      while ((getline line < md_file) > 0) print line
      close(md_file)
      print "</script>"
      help_inserted = 1
    }
    print
    next
  }
  /\{\{BUILD_TIMESTAMP\}\}/ {
    gsub(/\{\{BUILD_TIMESTAMP\}\}/, build_timestamp)
    print
    next
  }
  { print }
  END {
    if (!css_inserted) {
      print "<style>"
      while ((getline line < css_file) > 0) print line
      close(css_file)
      print "</style>"
    }
    if (!js_inserted) {
      print "<script>"
      while ((getline line < js_file) > 0) print line
      close(js_file)
      print "</script>"
    }
    if (!help_inserted) {
      print "<script id=\"help-markdown\" type=\"application/markdown\">"
      while ((getline line < md_file) > 0) print line
      close(md_file)
      print "</script>"
    }
  }
' "$src_html" > "$output_html"

echo "Wrote $output_html"

# Copy built file to website/dev/ for live serving
dev_dir="$root_dir/../website/dev"
mkdir -p "$dev_dir"
cp --remove-destination "$output_html" "$dev_dir/transmittal.html"
echo "Copied to $dev_dir/transmittal.html"