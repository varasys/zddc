# AGENTS.md — ZDDC

## Working Plan
At the start of each session, read `PLAN.md` for the current task plan.

When startang a new task, write a detailed plan to `PLAN.md` before coding.

Update `PLAN.md` as you complete steps.

## Commands

```bash
# Build
bash build.sh                   # all four tools
bash archive/build.sh           # single tool (archive | transmittal | classifier | mdedit)

# Test (always test the built dist/, not source)
npm test                        # all tools
npx playwright test archive     # single tool by project name
npx playwright test --debug

# Dev server
./dev-server start              # cache-busting HTTP server; open website/dev/tool.html
./dev-server stop
```

No lint, typecheck, or format commands exist — the project is plain bash + vanilla JS.

## Architecture

Four independent single-file HTML tools. Each compiles to one self-contained `.html` in `dist/` with all CSS and JS inlined. No shared JS between tools — intentional.

```
tool/
  css/           source stylesheets (concatenated in order)
  js/            vanilla JS IIFEs (concatenated in order)
  template.html  placeholder markers: {{CSS_PLACEHOLDER}}, {{JS_PLACEHOLDER}}, etc.
  build.sh       assembles dist/tool.html
  dist/tool.html generated output — commit with `git add -f`
  README.md      embedded into built HTML at {{README_PLACEHOLDER}}

shared/
  base.css       CSS tokens and primitives included first by every tool's build
  build-lib.sh   bash helpers (ensure_exists, concat_files, build_timestamp)
                 sourced by every tool's build.sh via: . "$root_dir/../shared/build-lib.sh"
```

**Critical:** `dist/` files are gitignored but force-committed (`git add -f`). Never edit them directly.

## Shared CSS (`shared/base.css`)

Included as the **first** CSS entry in every tool's `main_css` array. Provides:
- `:root` CSS custom properties — `--primary`, `--bg`, `--text`, `--border`, `--font`, etc.
- Brand color: `--primary: #2a5a8a` (matches varasys.github.io)
- Button primitive: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-sm`, `.btn-lg`, `.btn-link`
- `.app-header` + `.app-header__title` chrome rules
- `.build-timestamp`, `.hidden`, `.truncate`, webkit scrollbars

**Do not** define these in any tool's own CSS — they come from shared.

**Toast CSS** lives in `classifier/css/base.css` only (classifier is the only tool that uses toasts).

## Transmittal CSS quirks

- `transmittal/css/base.css` overrides `html { font-size: 16px }` inside `@media screen` — this must stay. `shared/base.css` sets `14px`; transmittal's floating labels are rem-based and were designed for 16px.
- The floating label position (`position: absolute; left: 0.5rem; top: -0.5rem`) is defined in `transmittal/css/forms.css`, not via Tailwind classes. The template still has `class="absolute left-2 -top-2 ..."` on labels but those Tailwind classes are **not** defined in `transmittal/css/utilities.css` — `forms.css` provides the real values.
- `transmittal/css/utilities.css` is a hand-written Tailwind subset. Arbitrary-value classes used in the template (`text-[10px]`, `text-[12px]`) are defined there. If adding new Tailwind classes to `template.html`, add them to `utilities.css` too — there is no Tailwind build step.

## Build system rules

- Every `build.sh` sources `shared/build-lib.sh` first (provides `ensure_exists`, `concat_files`, `build_timestamp`). Set `root_dir` before sourcing.
- `awk` processes `template.html`, replacing `{{PLACEHOLDER}}` markers and stripping CDN `<script>`/`<link>` tags (pattern: `https?://`)
- `{{BUILD_TIMESTAMP}}` is substituted in all four tools via `gsub` in awk (use `gsub`, not `print build_timestamp` — the placeholder is inline in an HTML line)
- Cleans up temp files via `trap cleanup EXIT`

**`</` escaping is mandatory.** Any JS containing `</tag>` inside string or template literals will break inline `<script>` embedding. Run:
```bash
sed 's#</#<\\/#g' "$input_js" > "$safe_js"
```
Already enforced in mdedit's vendor bundling. Required for any new tool with vendor JS.

## JS module pattern

All JS is vanilla, no bundlers. Files are IIFEs, registered on `window.app.modules`. Load order = declaration order in `build.sh`. `window.app` is the only global.

```javascript
(function() {
    window.app.modules.mymodule = { ... };
})();
```

**Exception:** archive uses plain globals (`APP_STATE`, top-level functions) — not the IIFE/modules pattern.

## ZDDC filename parsers

Each tool has its own parser (no shared code — by design):

| Tool | File | Function | Field name |
|---|---|---|---|
| archive | `archive/js/parser.js` | `parseFileName(filename)` | `trackingNumber` |
| transmittal | `transmittal/js/files.js` | `parseFilename(name)` | `trackingNumber` |
| classifier | `classifier/js/utils.js` | `parseFilename(filename)` | `tracking` (not `trackingNumber`) |
| mdedit | — | none | n/a |

Classifier uses `file.tracking`, not `file.trackingNumber`. `computeNewFilename()` in `classifier/js/utils.js` reads `file.tracking`.

Archive also has `parseRevision(revision)` → `{base, modifier, isDraft, full}` and `compareRevisions()` for revision sorting — archive-only.

## Testing quirks

- Playwright + Chromium only (File System Access API requirement)
- Tests open `dist/tool.html` via `file://` protocol — **always build before testing**
- File System Access API is mocked via `page.addInitScript()` using `tests/fixtures/mock-fs-api.js`
- Use `waitUntil: 'load'` not `'networkidle'` — bundled scripts keep the network "active"
- Archive's `#noDirectoryMessage` empty-state overlay is `position: absolute; top: 50px` — it must clear the header or it will block button clicks in tests

## Specialist agents

| Trigger | Agent | How to invoke |
|---|---|---|
| After editing source files | `build-verify` | Task tool or `/verify` slash command |
| Before committing | `arch-review` | Task tool |
| Running / writing tests | `test-runner` | Task tool or `/test` slash command |
| Parsing ZDDC filenames in code | `naming-check` | Task tool |

Slash commands: `/build [tool]`, `/test [tool]`, `/verify [tool]`

## ZDDC filename convention

Format: `trackingNumber_revision (status) - title.extension`

- `trackingNumber`: no spaces or underscores (e.g. `123456-EL-SPC-2623`)
- `revision`: `A`, `B`, `0`; draft prefix `~`; modifiers `+C1`, `+B1`, `+N1`, `+Q1`
- `status`: `DFT IFA IFB IFC IFD IFI IFP IFR IFU REC RSA RSB RSC RSD RSI` or `---`
- Folder names prefix with date: `2025-10-31_trackingNumber (status) - title`

## Git workflow

- GitHub Flow; squash-merge feature branches to `main`
- Conventional commits: `feat(archive): ...`, `fix(transmittal): ...`
- Release tags: `archive-v1.0.0` (per-tool semver)
- Commit dist files: `git add -f tool/dist/tool.html`

## Transmittal-specific

- Two-phase hydration: `populateStatic()` before publish, `hydrate()` on load of published file
- Reactive state via Proxy — `app.state.mode = 'view'` auto-notifies subscribers
- Runtime CDN loads (jszip, docx-preview, xlsx) are allowed only for the optional DOCX/XLSX preview; core features work offline
- Published payload stored in `<script id="transmittal-data" type="application/json">`

## mdedit-specific

- `css/tailwind-utils.css` is a pre-generated static subset (~80 classes). Add new Tailwind classes here; do not re-run Tailwind.
- Toast UI Editor v3.2.2 is bundled in `vendor/`; `template.html` loads it from CDN for dev convenience
- `</` escaping is essential: `sed 's#</#<\\/#g'` runs on both app JS and vendor JS at build time
