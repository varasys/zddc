# Archive Browser

[← Back to ZDDC](../README.md)

Your digital filing cabinet - a complete document management system in a single HTML file. No installation, no updates, no cloud required. Just open it and start organizing.

**[🔗 Open Archive Browser](dist/archive.html)** - Click to use online, or right-click → "Save Link As" to keep your own copy forever.

## What Makes This Special?

This is a "record player with the record" - the entire application travels with the file. Save it to a USB drive, email it to a colleague, or archive it with your project files. It will work exactly the same way in 20 years as it does today. No dependencies, no obsolescence.

## Quick Start

1. **Click "Select Directory"** - Choose your project folder
2. **All folders auto-expand** - See everything at once
3. **Type to filter** - Use the search boxes to find files instantly
4. **Click to sort** - Any column header sorts your data
5. **Download selected** - Check boxes and download as ZIP

## Overview

The archive browser presents a two-pane interface:
- **Navigation Pane** (left): Your folder hierarchy with smart filtering
- **Content Area** (right): All your files in a searchable, sortable table

## User Interface Layout

### Navigation Pane
The navigation pane displays a hierarchical folder structure with:

1. **Grouping Folders** (top level)
   - Folders that don't match transmittal naming convention
   - Used for organizational hierarchy (e.g., permissions, departments)
   - Has its own autofilter input
   - Supports multi-select (Shift+Click, Ctrl+Click)
   - **Right-click context menu** for recursive select/deselect of folder trees
   - **Collapsible section** with toggle button to hide/show when not needed
   - **Resizable height** - drag the divider to adjust space allocation
   - Default: 250px height, can be collapsed to header-only
   - Folders named "incoming" (case-insensitive) are excluded from default selection

2. **Transmittal Folders** (displayed in a flat sorted list in a separate section below the grouping folders)
   - Follow naming convention: `YYYY-MM-DD_TRACKINGNUMBER (STATUS) - TITLE`
   - Example: `2025-09-15_A101-203 (IFC) - Site Plan`
   - Has its own autofilter input
   - Supports multi-select
   - Only folders within selected grouping folders are visible
   - **Grouped by date** with collapsible date headers showing folder count
   - **Expand/collapse all** toggle button in section header
   - Date removed from individual folder display (shown in group header instead)
   - All transmittal folders selected by default (except those under "incoming")

### Content Area
Displays files from all selected transmittal folders in a unified table.

**Table Columns**:
1. **Tracking Number** - Extracted from filename
2. **Title** - Extracted from filename
3. **Revisions** - Shows all available revisions/documents for a tracking number
   - Each revision shows: revision identifier, status, and file links
   - Multiple files per revision supported (e.g., PDF, DWG)
   - Checkboxes for selecting individual files

The Revisions column must provide an efficient way to both display all revisions and modifiers compactly while allowing for efficient selection of specific revisions.


## Core Features

### 🔍 Smart Search & Filter
- **Find anything instantly** - Type in any filter box to narrow results
- **Power search** - Use `+must have` or `-exclude` for precise filtering
- **Excel-like sorting** - Click any column header to sort your data

### 📁 Organize Your Files
- **Drag & drop** - Drop files onto folders to create organized transmittals
- **Smart naming** - Automatically extracts document info from ZDDC filenames
- **Version tracking** - See all revisions of a document in one place
- **Batch operations** - Select multiple files for download or export

### 🔒 Data Integrity
- **SHA-256 checksums** - Verify files haven't changed
- **Hash caching** - Fast rescanning of large archives
- **Export to ZIP/CSV** - Take your data with you

Files are sorted by tracking number first, then by revision in proper order (~A, A, B, C+C1, C, 1, 2, 3, etc.)

## Technical Architecture

### Frontend Stack
- **Vanilla JavaScript**: No framework dependencies
- **Inline CSS**: Self-contained styling
- **File System Access API**: Local directory access
- **Web Crypto API**: SHA-256 file hashing

### Build System
- Modular architecture with separate CSS and JavaScript files
- Build script concatenates and inlines all assets
- Produces single self-contained HTML file
- No external dependencies in final output

Uses the same build.sh structure as the transmittal project (requires Git Bash on Windows).


## Additional Features

### File Operations
- **Download Selected**: Creates ZIP file of checked files
- **Export CSV**: Exports only visible/filtered files with metadata
- **Drag & Drop**: Drop files onto table rows to copy metadata
- **File Renaming**: Modal for fixing non-conforming filenames

### Context Menu Operations (Right-click on Grouping Folders)
- **Select This & Subfolders**: Recursively select folder and all descendants
- **Deselect This & Subfolders**: Recursively deselect folder and all descendants
- **Select All Visible**: Select all currently visible grouping folders
- **Deselect All**: Clear all grouping folder selections

Users can drag and drop files onto a grouping folder. The system creates a transmittal folder with the correct naming convention and displays a dialog where users can:
  - Confirm/edit the transmittal folder name
  - Review and correct file names to ensure ZDDC compliance
  - See preview of final file organization before committing

### Data Management
- **SHA-256 Hashing**: Integrity verification for all files
- **Hash Cache**: `.hashes.json` file to avoid re-hashing unchanged files
- **Refresh**: Re-scan directories for changes

Implements hash caching by creating a `.hashes.json` file in each scanned directory (when writable) to store file hashes and modification times, significantly improving performance on subsequent scans.

## Implementation Details

### Resizable Interface
- **Column Resizing**: Draggable column borders with persistent widths
- **Navigation Pane Width**: Drag horizontal divider between nav pane and content area
- **Section Heights**: Drag vertical divider between grouping and transmittal sections
- Visual feedback (blue highlight) when hovering or actively resizing
- Minimum/maximum sizes enforced to prevent unusable layouts

### Performance Optimizations
- Standard scrolling with sticky headers (no virtual scrolling needed)
- Debounced search inputs
- Progressive file scanning
- Cached file metadata

The table uses standard scrolling with sticky headers for navigation. No pagination or virtual scrolling is needed.

### Folder Hierarchy Logic
1. **Grouping Folders**: Any folder not matching transmittal convention
2. **Transmittal Folders**: Match `YYYY-MM-DD_TRACKINGNUMBER (STATUS) - TITLE`
3. **Selection Cascade** (strict enforcement): 
   - If grouping folders exist, at least one must be selected to see transmittal folders
   - Selecting grouping folder shows only its transmittal folders
   - At least one transmittal folder must be selected to see files
   - Selecting transmittal folders shows only their files
   - Multiple selections combine results
   - **Default Selection**: All folders selected except "incoming" and its subfolders

### File Grouping Logic
Files with the same tracking number are grouped together, showing:
- Base revisions (A, B, C, 1, 2, 3)
- Revision modifiers (+C1, +B1, +N1)
- Draft indicators (~A, ~B)
- Multiple file types per revision


## Filtering

Each column has a text filter input. The syntax supports simple boolean logic per field:
- Required token: `+token` must be present in that field.
- Prohibited token: `-token` must not be present.
- Parentheses group sub‑expressions: `(+revA plan)`.
- Terms (without +/−) are OR’ed within the same field: `as-built asbuilt`.
- Wildcard support: `+token*` (starts with), `*token` (ends with), `token` (contains)
Examples:

- Only PDFs: in EXT filter, type `+pdf`.
- Exclude superseded: in Status, type `-superseded`.
- Revisions A or B, but not Draft: in Revision, type `revA revB -draft`.
- Title contains both "floor" and "plan": Title `+floor +plan`.

## UI/UX Considerations

### Visual Design
- Clean, professional interface
- Hover states for interactive elements
- Clear visual hierarchy
- Consistent spacing and alignment
- Status color coding (optional)

Status codes are prominently displayed alongside revisions without color coding. The status is always shown as part of the revision information for clarity.

### Accessibility
- Keyboard navigation support (Ctrl+Click, Shift+Click, Ctrl+A)
- Right-click context menus for advanced operations
- ARIA labels for screen readers
- High contrast mode support
- Resizable text and interface elements
- Collapsible sections to reduce visual clutter

### Error Handling
- Graceful handling of permission errors
- Clear error messages
- Recovery options
- Console logging for debugging


## Browser Compatibility

- **Required**: Chromium-based browsers (Chrome, Edge, Brave) for File System Access API
- **Fallback**: Display message for unsupported browsers
- **Print Styles**: Optimized for US Letter (8.5×11")
- **Responsive Design**: Works on desktop and tablet screens

## Windows Path Length Limitations

The application includes safeguards for Windows' 260-character path limit:

- **Path Length Monitoring**: Warns when paths exceed 240 characters
- **Depth Limits**: Stops scanning directories deeper than 10 levels
- **Path Truncation**: Long paths are truncated in the UI while maintaining full paths internally
- **Graceful Failure**: Files with paths too long are skipped with console warnings
- **Display Optimization**: Shows `...` with shortened paths for better readability

To enable long path support in Windows 10 (1607+):
1. Run `gpedit.msc` as Administrator
2. Navigate to: Computer Configuration → Administrative Templates → System → Filesystem
3. Enable "Enable Win32 long paths"
4. Restart your computer

## Security Considerations

- No data leaves the browser
- All processing happens locally
- Directory permissions requested per-session
- No tracking or analytics

## File Preview

Clicking on a file link opens it in a new browser tab if the browser can display it (PDFs, images, text files), otherwise triggers a download.

## Deliverables

1. **Single HTML file** (`archive.html`) containing all functionality
2. **Modular source code** organized as:
    - `js/` - JavaScript modules
    - `css/` - CSS modules
    - `template.html` - HTML template
    - `build.sh` - Build script
3. **Documentation** embedded in the final HTML file

## CSS/JS Architecture

### CSS Files (loaded in dependency order)

| File | Size | Purpose |
|------|------|---------|
| `css/base.css` | 1.5KB | Core styles, layout reset, typography, theme variables |
| `css/components.css` | 10KB | Button styles, inputs, modal dialogs, menu systems |
| `css/layout.css` | 3.7KB | Page structure, header/footer, container width |
| `css/table.css` | 3.4KB | Table styling, cell padding, border styles, sorting headers |
| `css/print.css` | 2.2KB | Print-specific styles, hide interactive elements |

### JavaScript Modules (loaded in dependency order)

| File | Size | Purpose |
|------|------|---------|
| `js/parser.js` | 7.4KB | ZDDC filename parsing, revision extraction, status validation |
| `js/hash.js` | 5.9KB | SHA-256 hashing for file integrity verification |
| `js/drag-drop.js` | 9.1KB | File system access API integration, drag-and-drop handling |
| `js/directory.js` | 11.9KB | Directory scanning, folder tree rendering, path handling |
| `js/filtering.js` | 8.8KB | Boolean filter logic, column filtering, show/hide rows |
| `js/table.js` | 26KB | Table rendering, row management, selection handling |
| `js/export.js` | 8.2KB | JSON export, file download with ZDDC naming |
| `js/events.js` | 18.9KB | Event bus, state change notifications, UI coordination |
| `js/app.js` | 19.6KB | Main entry point, initialization, state management |

