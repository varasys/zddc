#!/usr/bin/env bash
set -euo pipefail

root_dir=$(cd "$(dirname "$0")" && pwd)
. "$root_dir/../shared/build-lib.sh"

src_html="$root_dir/template.html"
output_dir="$root_dir/dist"
output_html="$output_dir/mdedit.html"

# Vendor files (bundled dependencies — no CDN required at runtime)
# Note: Tailwind is NOT a vendor file — it's replaced by css/tailwind-utils.css,
# a hand-written subset of only the utility classes used in template.html.
toastui_js="$root_dir/vendor/toastui-editor-all.min.js"
toastui_css="$root_dir/vendor/toastui-editor.min.css"

# CSS files to concatenate in order.
# tailwind-utils.css provides all Tailwind utility classes used in template.html,
# replacing the Tailwind Play CDN script entirely (no runtime overhead, no warnings).
# shared/base.css follows so its :root tokens and .btn primitive are available.
main_css=(
  "css/tailwind-utils.css"
  "../shared/base.css"
  "css/base.css"
  "css/editor.css"
  "css/toc.css"
  "css/markdown.css"
)

# JavaScript files to concatenate in order
main_js=(
  "../shared/zddc.js"
  "../shared/theme.js"
  "js/app.js"
  "js/utils.js"
  "js/front-matter.js"
  "js/file-system.js"
  "js/file-tree.js"
  "js/editor.js"
  "js/toc.js"
  "js/resizer.js"
  "js/events.js"
  "js/main.js"
  "../shared/help.js"
)

mkdir -p "$output_dir"
ensure_exists "$src_html"
ensure_exists "$toastui_js"
ensure_exists "$toastui_css"

css_temp=$(mktemp)
js_raw=$(mktemp)
js_temp=$(mktemp)
toastui_js_safe=$(mktemp)
cleanup() { rm -f "$css_temp" "$js_raw" "$js_temp" "$toastui_js_safe"; }
trap cleanup EXIT

concat_files main_css > "$css_temp"
concat_files main_js  > "$js_raw"

# Escape all </ sequences in both the app JS and the Toast UI vendor JS so the
# browser HTML parser cannot mistake them for closing HTML tags inside <script>.
# The JS engine treats \/ as / (valid escape), so runtime behaviour is unchanged.
# mdedit JS uses HTML template literals (e.g. '<div></div>') which trigger this.
sed 's#</#<\\/#g' "$js_raw"     > "$js_temp"
sed 's#</#<\\/#g' "$toastui_js" > "$toastui_js_safe"

# Process template:
#   - Strip the Tailwind CDN <script> tag (css/tailwind-utils.css replaces it)
#   - Replace CDN <link> for Toast UI CSS with inline bundled CSS
#   - Replace CDN <script src="...toastui..."> with inline bundled Toast UI JS
#   - Inject custom CSS at {{CSS_PLACEHOLDER}}
#   - Inject custom JS at {{JS_PLACEHOLDER}}
#   - Substitute {{BUILD_TIMESTAMP}}
awk \
  -v css_file="$css_temp" \
  -v js_file="$js_temp" \
  -v toastui_js="$toastui_js_safe" \
  -v toastui_css="$toastui_css" \
  -v build_timestamp="$build_timestamp" \
'
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
  /<script src="https:\/\/cdn\.tailwindcss\.com"/ {
    # Stripped: Tailwind utility classes are in css/tailwind-utils.css instead
    next
  }
  /<link rel="stylesheet" href="https:\/\/uicdn\.toast\.com\/editor\/[^"]*\/toastui-editor\.min\.css"/ {
    # Inline the bundled Toast UI CSS
    print "<style>"
    while ((getline line < toastui_css) > 0) print line
    close(toastui_css)
    print "</style>"
    next
  }
  /<script src="https:\/\/uicdn\.toast\.com\/editor\/[^"]*\/toastui-editor/ {
    # Inline the bundled Toast UI JS.
    # The content is pre-processed (see toastui_js_safe): all </ → <\/ so the
    # HTML parser cannot find a </script> sequence inside the JS content.
    # We close with the real </script> (not <\/script>) because only the exact
    # string </script> terminates a script block per the HTML5 spec.
    print "<script>"
    while ((getline line < toastui_js) > 0) print line
    close(toastui_js)
    print "</script>"
    next
  }
  { print }
' "$src_html" > "$output_html"

echo "Wrote $output_html ($(wc -c < "$output_html") bytes)"

# Copy built file to website/dev/ for live serving
dev_dir="$root_dir/../website/dev"
mkdir -p "$dev_dir"
cp --remove-destination "$output_html" "$dev_dir/mdedit.html"
echo "Copied to $dev_dir/mdedit.html"
