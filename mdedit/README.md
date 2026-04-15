# ZDDC Markdown Editor

[← Back to ZDDC](../README.md)

A lightweight, browser-based markdown editor with YAML front matter support.

**[🔗 Open Markdown Editor](dist/mdedit.html)** - Click to use online, or right-click → "Save Link As" to keep your own copy.

## Reliability

This tool follows the "record player with the record" philosophy - the application and your data travel together. The single HTML file contains everything needed to edit markdown files locally in your browser.

## Quick Start

1. Open the editor in your browser
2. Click **Select Directory** to choose a folder with markdown files
3. Navigate the file tree on the left
4. Click any `.md` file to edit it
5. Click **Save File** or **Save All** to save changes

## Features

### 📂 File Navigation
- Browse directories using the File System Access API
- Collapsible folder tree with file type icons
- Files sorted alphabetically with directories grouped

### ✏️ Markdown Editing
- Toast UI Editor with live preview
- Split view (markdown + preview)
- Full toolbar for formatting

### 📋 YAML Front Matter
- Separate front matter section at top of editor
- Auto-parsed and preserved on save
- Collapsible for more editing space

### 📑 Table of Contents
- Auto-generated from headings
- Adjustable depth (H1 only through H6)
- Click to jump to heading in preview

### 💾 File Operations
- Save individual files or Save All
- Reload from disk (discards unsaved changes)
- External change detection with reload prompt
- Unsaved change warnings before leaving

### 🖼️ File Previews
- Image preview for common formats
- HTML preview in sandboxed iframe
- Plain text editing for non-markdown files

## Build

The editor is built from modular source files using a bash script:

```bash
cd mdedit
./build.sh
```

This concatenates CSS and JS files into `dist/mdedit.html`.

## Project Structure

```
mdedit/
├── css/
│   ├── base.css                  # Core styles and layout
│   ├── editor.css                # Toast UI Editor overrides
│   ├── toc.css                   # Table of Contents styles
│   └── markdown.css              # Markdown rendering styles
├── js/
│   ├── app.js                    # Global state
│   ├── utils.js                  # Utility functions
│   ├── front-matter.js           # YAML parsing
│   ├── file-system.js            # File operations
│   ├── file-tree.js              # Tree rendering
│   ├── editor.js                 # Toast UI setup
│   ├── toc.js                    # TOC generation
│   ├── resizer.js                # Pane resizing
│   ├── events.js                 # Event listeners
│   └── main.js                   # Initialization
├── vendor/
│   ├── toastui-editor-all.min.js # Toast UI Editor JS (bundled)
│   └── toastui-editor.min.css    # Toast UI Editor CSS (bundled)
├── template.html                 # HTML structure (uses CDN for local dev convenience)
├── build.sh                      # Build script (inlines vendor files, strips CDN refs)
└── dist/
    └── mdedit.html               # Built self-contained file
```

## Technical Details

- **No server required** - runs entirely in browser
- **File System Access API** - direct local file access
- **Toast UI Editor v3.2.2** - bundled from `vendor/` into the built output (no CDN required)
- **Tailwind CSS** - replaced at build time by `css/tailwind-utils.css`, a hand-written static subset containing only the ~80 utility classes actually used in `template.html` (no runtime overhead, no console warnings)
- **Fully self-contained** - `dist/mdedit.html` (~775 KB) works offline with no external dependencies

> **Development note**: `template.html` loads Toast UI and Tailwind from CDN for a faster local development
> experience (open `template.html` directly in a browser). The `build.sh` script replaces the Tailwind CDN
> `<script>` tag with nothing (utilities come from `css/tailwind-utils.css` instead) and replaces the Toast UI
> CDN tags with the locally bundled `vendor/` files when producing `dist/mdedit.html`.

### CSS Architecture

| File | Purpose |
|------|---------|
| `css/tailwind-utils.css` | Static subset of Tailwind v3 utilities used in `template.html` — replaces the Play CDN |
| `css/base.css` | Core styles, layout reset, color palette, typography |
| `css/editor.css` | Toast UI Editor customizations and overrides |
| `css/toc.css` | Table of Contents styles, collapsible sections |
| `css/markdown.css` | Markdown rendering (headings, lists, code blocks, etc.) |

### JavaScript Modules

| File | Size | Purpose |
|------|------|---------|
| `js/app.js` | 560B | Global state object (app state) |
| `js/utils.js` | 2.5KB | Utility functions, helper utilities |
| `js/front-matter.js` | 3.3KB | YAML front matter parsing and rendering |
| `js/file-system.js` | 16.6KB | File System Access API integration |
| `js/file-tree.js` | 24KB | Folder tree rendering, navigation |
| `js/editor.js` | 15KB | Toast UI Editor initialization, event handlers |
| `js/toc.js` | 7.9KB | TOC generation from headings |
| `js/resizer.js` | 2.8KB | Split-pane resizing with mouse |
| `js/events.js` | 2KB | Event bus, dispatching state changes |
| `js/main.js` | 1.5KB | Initialization, entry point |

### Build Process

The build script (`build.sh`):
1. Concatenates all local CSS and JS files in dependency order
2. **Replaces** the CDN `<script>`/`<link>` tags for Tailwind and Toast UI with the locally bundled files from `vendor/`
3. Injects everything into `template.html` to produce `dist/mdedit.html`

The final HTML file (~1.2MB) is fully self-contained and works offline.

### Architecture Notes

- All local CSS/JS files are inlined into the output HTML
- Vendor dependencies (Toast UI, Tailwind) are bundled from `vendor/` — no runtime CDN access
- `template.html` loads dependencies from CDN for convenient local development, but `build.sh` replaces these
- No npm dependencies required at runtime
- File System Access API requires Chromium-based browsers
