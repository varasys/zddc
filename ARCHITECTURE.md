# ZDDC Architecture

This document is the single authoritative reference for how ZDDC tools are designed and built. It covers the shared single-file HTML application pattern, the build system, tool-specific architectural decisions, and contribution guidelines.

---

## Why Single-File HTML Applications

Every ZDDC tool compiles to a single self-contained `.html` file — no servers, no installers, no subscriptions.

| Principle | Rationale |
|-----------|-----------|
| **Reliability** | Opens in any modern Chromium-based browser without network access or external services |
| **Portability** | Can be emailed, archived, or deployed to air-gapped environments with no tooling |
| **Auditability** | Source, embedded data, and output travel together, satisfying ZDDC traceability requirements |
| **Longevity** | Static assets remain functional long after build environments have changed |
| **Simplicity** | A single `.html` file eliminates deployment steps and brittle dependency chains |

---

## Repository Structure

Every HTML tool follows the same directory layout:

```
tool/
  README.md        # Feature scope, UI design, domain rules, help content
  css/             # Logically separated stylesheets (one responsibility per file)
  js/              # Vanilla ES modules (one responsibility per file)
  template.html    # Shell markup with {{PLACEHOLDER}} markers for development
  build.sh         # Inlines css/ and js/ into dist/tool.html
  dist/
    tool.html      # Generated output — never edit this manually
```

Website files are managed in two locations:
- `website/` — Contains manually placed "last known good" versions of each tool
- `website/dev/` — Contains the latest build artifacts copied from each tool's `dist/` folder

During development, open `website/dev/tool.html` to test the latest build.

Vendor dependencies (bundled third-party libraries) live in `tool/vendor/` if present. The build script is responsible for inlining them into the output.

---

## Build System

### How It Works

Each tool's `build.sh`:

1. Reads CSS files in declaration order, concatenates them
2. Reads JS files in declaration order, concatenates them
3. Processes `template.html` with `awk`, replacing `{{PLACEHOLDER}}` markers with the concatenated content and stripping CDN `<script>`/`<link>` tags
4. Writes the result to `dist/tool.html`
5. Copies the output to `website/dev/tool.html` for the local dev server

The top-level `build.sh` at the repository root calls all four tool build scripts in sequence.

### Website Deployment

- `website/` contains manually placed "last known good" versions of each tool
- `website/dev/` contains the latest build artifacts from each tool's `dist/` folder
- After building, verify the output in `website/dev/` for development serving
- For production deployment, copy from `dist/` to `website/` manually

### Build Script Requirements

Every `build.sh` must:

- Begin with `#!/usr/bin/env bash` and `set -euo pipefail`
- Fail immediately on missing source files (`ensure_exists` pattern)
- Clean up temp files on exit (use `trap cleanup EXIT`)
- Accept no arguments — configuration lives in the file itself

### HTML Embedding Safety

When inlining JavaScript into a `<script>` block, the HTML parser scans for the exact string `</script>` to terminate the block — backslash escaping (`<\/script>`) does **not** prevent termination. Any JS source file or vendor library that contains `</tag>` sequences inside string literals or template literals will break the inline `<script>` block.

The rule is:

> **All `</` sequences in inlined JavaScript must be escaped as `<\/` using `sed`.**

Both the app JS concatenation step and any vendor JS bundling step must run through:

```bash
sed 's#</#<\\/#g' "$input_js" > "$safe_js"
```

Then use `</script>` (not `<\/script>`) to close the `<script>` block, since the content no longer contains any `</` sequences that the parser could misread.

This is already enforced for mdedit's vendor bundling. It is the contributor's responsibility to ensure new tools follow this pattern.

### Vendor Dependencies

Some tools bundle third-party libraries. These live in `tool/vendor/` and are committed to the repository. The build script inlines them into `dist/tool.html`.

**Current vendor files:**

| Tool | Library | File | Notes |
|------|---------|------|-------|
| mdedit | Toast UI Editor v3.2.2 | `vendor/toastui-editor-all.min.js` | Markdown editor with live preview |
| mdedit | Toast UI Editor CSS | `vendor/toastui-editor.min.css` | Editor stylesheet |
| transmittal | jszip, docx-preview, xlsx | CDN at runtime | Optional preview features; tool works without them |

**Runtime CDN loading exception**: The transmittal tool loads jszip, docx-preview, and xlsx from CDN at runtime via `loadLibrary()` forDOCX/XLSX preview functionality. These are **optional enhancements**—core transmittal functionality (JSON payload communication) works without them. This exception is documented here because:

1. The core transmittal features (creating, signing, verifying SHA-256 digests) do not depend on these libraries
2. Preview functionality gracefully degrades if libraries fail to load
3. Bundling would significantly increase file size for rarely-used features

**Rule**: Runtime CDN loading is allowed only when:
- Features are strictly optional (graceful degradation)
- Core functionality works without the external library
- Library is clearly documented as non-essential

`template.html` for tools with vendor deps loads those deps from CDN for convenient local development. The build script replaces CDN tags with the bundled vendor files in the output.

### Development vs Production

| Context | Tailwind / Vendor | How to run |
|---------|-------------------|-----------|
| Development | CDN (live, from `template.html`) | Open `template.html` directly in Chromium |
| Production | Bundled / Static CSS | Run `bash tool/build.sh`, open `dist/tool.html` |

For mdedit specifically: `template.html` loads Toast UI from CDN and uses Tailwind Play CDN. The build replaces Toast UI with the bundled vendor file and replaces the Tailwind CDN script with the static `css/tailwind-utils.css` subset.

---

## JavaScript Architecture

### Vanilla JS Only

All tools use plain JavaScript — no TypeScript, no frameworks, no bundlers. Dependencies are managed manually via vendor files.

### Module Pattern

Each JS file wraps its code in an IIFE or module-scope block and registers its API on `window.app.modules`:

```javascript
// js/mymodule.js
(function() {
    function doSomething() { ... }

    window.app.modules.mymodule = { doSomething };
})();
```

`window.app` is the single global debug surface. Never expose implementation internals beyond what's needed for testing.

### Module Load Order

JS files are concatenated in the order declared in `build.sh`. Each file can assume earlier files' modules are available on `window.app`. Circular dependencies are not permitted — modules must be layered.

Typical ordering:

```
app.js          ← Declares window.app and top-level state
utils.js        ← Stateless helpers (no dependencies)
store.js        ← State management (depends on app.js)
[domain].js     ← Feature modules (depend on store/utils)
main.js         ← Initialization (depends on all modules)
```

### State Management

Tools manage state in one of two patterns:

**1. Module-scope state object** (archive, classifier, mdedit)

```javascript
const APP_STATE = { files: [], selectedFolders: new Set(), ... };
```

State is read directly; mutations trigger re-render calls.

**2. Proxy-based reactive state** (transmittal)

```javascript
const state = createReactiveState({ mode: 'edit', published: false });
state.subscribe((prop, newVal) => { /* auto-update UI */ });
state.mode = 'view'; // Proxy notifies all subscribers automatically
```

Use reactive state when the same property drives multiple independent UI elements. Use direct state when the data flow is simple and unidirectional.

---

## Tool-Specific Architecture

### Archive Browser

**Pattern:** Module-scope `APP_STATE`, event-driven UI updates, File System Access API for directory scanning.

**Two-level directory structure required:**

```
root-directory/
  transmittal-folder/         ← "grouping folder" — must be a subdirectory
    123456-EL-SPC-0001_A (IFC) - Spec.pdf
    ...
```

Files at the root level are ignored. The grouping folder list and transmittal folder list are populated from the first two levels of the selected directory. Files are only counted in `filteredFiles` after ZDDC filename parsing succeeds.

**Key DOM IDs:** `#addDirectoryBtn`, `#noDirectoryMessage`, `.main-container`, `#filesTableBody`, `#fileCount`, `#selectedCount`, `#selectAllGroupingCheckbox`.

---

### Document Classifier

**Pattern:** Event-driven store (`store.js`) with `notify()` / `on()` pub-sub, spreadsheet rendering on `'files'` events.

**File object shape** (as produced by `scanner.js`):

```javascript
{
    tracking: '123456-EL-SPC-2623',   // NOT trackingNumber
    title: 'Specification',
    revision: 'A',
    status: 'IFC',
    extension: '.pdf',                // includes the leading dot
    originalFilename: '...',          // filename without extension
    name: '...',                      // full filename with extension
    path: 'folder/filename.pdf',
    size: 45000,
    isDirectory: false,
    manualFilename: null              // set if user overrides computed name
}
```

**`computeNewFilename(file)`** (in `utils.js`) uses `file.tracking`, not `file.trackingNumber`. Returns `file.originalFilename + file.extension` if any required field is missing.

**Main app panel** (`#mainApp`) stays hidden (class `hidden`) until a real directory is opened via `showDirectoryPicker`. State can be injected via `store.setFolderTree()` + `store.setSelectedFolders()` for testing without triggering the picker.

---

### Markdown Editor (mdedit)

**Pattern:** Global functions (`window.updateToc`), editor instances managed per file-path in a `Map`, File System Access API for direct file read/write.

**Dependencies:** Toast UI Editor v3.2.2 (bundled), Tailwind utility subset (static CSS).

**Toast UI availability check:**

```javascript
if (typeof toastui === 'undefined') {
    // Graceful degradation — show error message
}
const editor = new toastui.Editor({ el: container, ... });
```

**Key DOM IDs:** `#app`, `#select-directory`, `#welcome-screen`, `#file-tree`, `#content-container`.

**File tree:** Populated after `showDirectoryPicker()` resolves. File items are rendered as DOM children of `#file-tree`. Clicking a file opens it in the editor panel.

---

### Transmittal Creator

**Pattern:** Proxy-based reactive state, two-phase hydration, ECDSA digital signatures, SHA-256 file integrity.

**Two-phase hydration:**

1. **`populateStatic()`** — called before publishing. Fills all form fields and the file table into the HTML so the output is readable without JavaScript (progressive enhancement for SharePoint, email clients, etc.).
2. **`hydrate()`** — called on page load of a published transmittal. Hides the "Not Validated" static warning, runs signature verification, and enables interactive features.

**Progressive enhancement matrix:**

| Feature | No JavaScript | With JavaScript |
|---------|--------------|-----------------|
| Content display | ✅ Full | ✅ Full |
| File table | ✅ Shown | ✅ Shown |
| Digest / signatures | ✅ Listed | ✅ Listed + cryptographically verified |
| Validation status | ⚠️ "Not Validated" badge | ✅ "Verified" / ❌ "Invalid" |
| Editing | ❌ Disabled | ✅ Enabled (if draft) |
| Column filtering | ❌ No | ✅ Yes |

**Data store:** A `<script id="transmittal-data" type="application/json">` element embedded in the published HTML holds the full transmittal payload. On load, `data.js` reads and parses it; all UI state derives from this JSON.

**Reactive state:**

```javascript
// app.state is a Proxy — assignments auto-notify subscribers
app.state.mode = 'view';  // Triggers UI updates automatically
```

Subscribe for cross-cutting concerns:
```javascript
app.state.subscribe((property, newValue) => {
    if (property === 'mode') updateModeToggleLabel(newValue);
});
```

**Security model:** ECDSA P-256 signing of the SHA-256 digest. Signatures are stored in the JSON payload. Any number of signers can co-sign. Verification runs client-side in the browser's Web Crypto API — no server required.

**Key module globals:** `window.transmittalApp` exposes `app.data`, `app.state`, and `app.modules` for debugging and testing.

---

## CSS Architecture

All tools use vanilla CSS. No frameworks at build time (mdedit's Tailwind utilities are pre-generated static CSS).

**Common conventions:**

- CSS variables for theme colors and spacing in `base.css`
- Component-scoped class names (no global utilities except where Tailwind provides them)
- `.hidden` class uses `display: none !important` for JavaScript show/hide
- Print styles in a separate `print.css`

**mdedit Tailwind subset:**

`css/tailwind-utils.css` contains only the ~80 Tailwind v3 utility classes actually used in `template.html`. If a new utility class is needed in the template, add it here. Classes follow Tailwind v3 naming and values exactly.

---

## Testing

Tests use Playwright with Chromium only (File System Access API requires it).

### Running Tests

```bash
npm test                    # all tools
npx playwright test archive # single tool
npx playwright test --debug # debug mode
```

### Test Structure

Each tool has a spec file in `tests/`:

```
tests/
  archive.spec.js      ← 2 tests: load + directory scan
  classifier.spec.js   ← 2 tests: load + store injection
  mdedit.spec.js       ← 2 tests: load + file tree render
  transmittal.spec.js  ← 2 tests: paste round-trip + filesystem round-trip
  fixtures/
    mock-fs-api.js     ← Reusable File System Access API mock
    transmittal-data.js
    zddc-filenames.js
```

### Mock File System API

`MOCK_FS_INIT_SCRIPT` (from `tests/fixtures/mock-fs-api.js`) overrides `showDirectoryPicker`, `showOpenFilePicker`, and `showSaveFilePicker`. Inject it via `page.addInitScript` before navigating.

```javascript
// Flat directory
window.__setMockDirectory('name', [{ name: 'file.pdf', content: '...', size: 100 }]);

// Nested directory tree
window.__setMockDirectoryTree('name', {
    'subfolder': { 'file.pdf': 'content' },
    'root-file.md': 'content',
});
```

### Writing Tests

Follow the pattern in `tests/transmittal.spec.js`:

- Use ESM `import` syntax
- Inject `MOCK_FS_INIT_SCRIPT` in `test.beforeEach` for any test that navigates to a tool page
- Use `waitUntil: 'domcontentloaded'` or `'load'` (not `'networkidle'` — the bundled scripts may keep the network active)
- Prefer `page.waitForFunction` over `page.waitForSelector` for app-state readiness
- Assert through the store/module API for tests that don't need visible DOM

---

## Code Standards

| Rule | Rationale |
|------|-----------|
| No `</script>` or any `</tag>` in JS string literals | Breaks inline HTML embedding — escape with `'<' + '/tag>'` or use `<\/` in `sed` at build time |
| No external dependencies at runtime | Self-contained output requirement |
| No TypeScript, no bundlers | Keeps the build system auditable and simple |
| `window.app` is the only global | Keeps the global namespace clean; expose only what's needed for debugging |
| Defensive input validation | File System API handles and user-pasted data are untrusted |
| Update README.md when features ship | Documentation parity is a delivery requirement, not optional |

---

## Git Workflow

**Branching:** GitHub Flow — short-lived feature branches (`feature/<name>`, `bugfix/<name>`, `hotfix/<name>`), squash-merged to `main` and immediately deleted. Quick fixes (typos, one-liners) go direct to `main`.

**Commit messages:** Conventional Commits — `<type>(<scope>): <description>`. Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`. See `AGENTS.md` for the full table and examples.

**Releases:** Tag the commit after confirming `dist/` is current. Format: `{project}-v{version}` (e.g. `archive-v1.0.0`). Semantic versioning applies. There is no CI/CD — the built `.html` file is already committed to the repo.

```bash
bash tool/build.sh                  # rebuild dist/
git add -f tool/dist/tool.html      # stage if needed
git commit -m "chore(tool): rebuild for vX.Y.Z"
git tag tool-vX.Y.Z
git push origin main --tags

git tag -l "archive-v*"             # list releases
git push origin :refs/tags/tag-name # delete a remote tag
```

---

## Adding a New Tool

1. Create `tool/` with the standard directory layout
2. Write `template.html` with `{{CSS_PLACEHOLDER}}` and `{{JS_PLACEHOLDER}}` markers
3. Write `tool/build.sh` following the pattern of an existing tool
4. Add `bash "$SCRIPT_DIR/tool/build.sh"` to the root `build.sh`
5. Add a test project entry to `playwright.config.js`
6. Create a stub `tests/tool.spec.js`
7. Force-add the dist output: `git add -f tool/dist/tool.html`

If the tool requires vendor dependencies, download them to `tool/vendor/`, add them to `.gitignore` exclusions if appropriate, and update `build.sh` to inline them (with the `</` escaping step).
