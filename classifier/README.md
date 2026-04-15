# Document Classifier

[← Back to ZDDC](../README.md)

Turn chaos into order - a spreadsheet-like tool for bulk renaming files to ZDDC format. Copy/paste with Excel for lightning-fast text operations. The entire app fits in a single HTML file that works forever.

**[🔗 Open Document Classifier](dist/classifier.html)** - Click to use online, or right-click → "Save Link As" to keep your own copy.

## Why This Tool?

Got a folder full of "spec_final_v2_REALLY_FINAL.pdf" files? This tool transforms them into properly named, searchable documents. It's like Excel for file names - edit hundreds at once, paste from spreadsheets, and save hours of manual renaming.

## What You Can Do

📋 **Excel-Like Editing**
- Edit file names like a spreadsheet
- Copy/paste entire columns to/from Excel
- Select ranges just like Excel (click and drag)
- Tab through cells, sort columns, resize as needed

🚀 **Bulk Operations**
- Rename hundreds of files in seconds
- Auto-populate from existing ZDDC names
- Hide already-compliant files to focus on the rest
- Save all changes with one click

🎯 **Smart Features**  
- Real-time validation shows errors instantly
- Files stay in their folders - just get new names
- Preview any file with a single click
- Automatic folder expansion shows everything at once

## Quick Start

1. **Click "Select Directory"** - Pick the folder with messy file names
2. **See the magic** - Files appear in a spreadsheet, auto-parsed if already ZDDC
3. **Double-click to edit** - Just like Excel, or paste from a spreadsheet  
4. **Click "Save All"** - All files renamed instantly
5. **That's it!** - Your files are now organized and searchable

## ZDDC Naming Convention

### File Format
```
trackingNumber_revision (status) - title.extension
```

**Example:**
```
CE-BYR-ALL-EL-SPC-0001_A (IFC) - Cable Specification.pdf
```

**Components:**
- **Tracking Number**: Project identifier (e.g., CE-BYR-ALL-EL-SPC-0001)
- **Revision**: Document revision (e.g., A, B, 0, 1, A+C1)
- **Status**: Status code (IFC, IFR, IFI, AFD, AFC, ASB, etc.)
- **Title**: Descriptive title
- **Extension**: File type (.pdf, .docx, .dwg, etc.)

### Folder Format (Transmittal)
```
YYYY-MM-DD_trackingNumber (status) - title
```

**Example:**
```
2024-10-15_CE-BYR-ALL (IFC) - October Specifications
```

## How to Use

### 1. Select Directory
Click "Select Directory" and choose the root folder containing files to organize. The tool will:
- Scan all subdirectories
- Expand all folders automatically
- Load all files into the spreadsheet
- Parse existing ZDDC filenames into editable fields (shown in gray)

### 2. Navigate and Filter

**Folder Tree:**
- All folders start expanded
- Click folder names to select/deselect
- Click ▼/▶ icons to collapse/expand
- Selected folders show their files in the spreadsheet

**Filtering:**
- Type in column header filter boxes to filter rows
- Check "Hide Compliant Files" to focus on non-compliant files only
- Sort by clicking column headers (Shift+Click for multi-column sort)

### 3. Edit Files

**Spreadsheet Interface:**
- Auto-populated fields appear in gray italic text
- Double-click any cell to edit
- Press Enter or Tab to move to next cell
- Changes mark the row as modified (✓ ✗ buttons appear)

**Excel Integration:**
1. Select cells (click and drag)
2. Copy (Ctrl+C) and paste into Excel
3. Edit in Excel (e.g., convert to proper case)
4. Copy from Excel and paste back (Ctrl+V)
5. Click "Save All" to apply all changes

### 4. Save Changes

**Individual Files:**
- Edit fields for a file
- Click ✓ button to save that file
- Click ✗ button to cancel changes

**Batch Save:**
- Edit multiple files
- Click "Save All" button to rename all modified files at once
- Click "Cancel All" to discard all changes

### 5. Preview Files
- Click any filename link to open the file in a new tab
- Works with PDFs, images, and browser-viewable files

### 6. Keyboard Shortcuts
- **Tab**: Move to next cell
- **Shift+Tab**: Move to previous cell
- **Enter**: Move down one row
- **Escape**: Cancel editing
- **Ctrl+A** (in tree): Select all visible folders
- **Ctrl+S**: Save all (when files are modified)

## Common Status Codes

- **IFR** - Issued for Review
- **IFC** - Issued for Construction
- **IFI** - Issued for Information
- **AFD** - Approved for Design
- **AFC** - Approved for Construction
- **ASB** - As-Built

## Real-World Examples

### 🔧 Fix ALL CAPS Titles
Have files like "CABLE SPECIFICATION.PDF"? Use the Excel trick:
1. Select the Title column → Copy to Excel
2. Use `=PROPER(A1)` to fix casing
3. Paste back → Save All → Done!

### 📝 Organize Random Files  
Transform `spec001.pdf` → `CE-BYR-ALL-EL-SPC-0001_A (IFC) - Cable Specification.pdf`
- Just fill in the spreadsheet cells
- Copy/paste common values
- Save All when ready

### 🔄 Update Revisions
Change revision A to B across multiple files:
- Gray text = current values
- Edit only what needs changing  
- Batch save or save individually

## Browser Compatibility

Requires:
- Modern Chromium-based browser (Chrome, Edge, Brave, etc.)
- File System Access API support
- JavaScript enabled

## Privacy & Security

- All processing happens locally in your browser
- No data transmitted to any server
- File System Access API requires explicit user permission
- No tracking or analytics

## Limitations

### Folder Renaming
Due to browser API limitations, folders cannot be renamed directly. The tool will provide the correct folder name format for manual renaming in your file system.

### File Preview
- PDFs open in browser tab
- Other file types download for viewing in native applications
- Browser cannot preview most file formats

### File System Access
- Requires user permission for each directory
- Some file systems may have restrictions
- Network drives may not be fully supported

## Tips for Efficient Use

1. **Use Hide Compliant Filter**: Check to focus only on non-compliant files
2. **Excel Integration**: Copy/paste columns to Excel for bulk text operations
3. **Auto-Population**: Gray fields are auto-parsed - edit only what needs changing
4. **Column Sorting**: Click headers to sort, Shift+Click for multi-level sorting
5. **Column Filtering**: Type in header filter boxes to narrow down files
6. **Resize Columns**: Drag column borders to see full content
7. **Save All**: Edit multiple files then save all at once

## Troubleshooting

### "Permission denied" errors
- Ensure you've granted browser permission
- Try selecting the directory again
- Check file system permissions

### Files not appearing
- Click "Refresh" button to rescan
- Ensure files aren't hidden by OS
- Check that directory handle is valid

### Rename fails
- Check if file with that name already exists
- Ensure file isn't open in another application
- Verify you have write permissions

### Gray fields not appearing
- Fields only auto-populate if filename matches ZDDC pattern
- Pattern: `TRACKING_REV (STATUS) - TITLE.ext`

## Technical Details

- **Architecture**: Single-page HTML application with centralized state management
- **API**: File System Access API (Chromium browsers only)
- **Build**: Concatenated from modular source files
- **No Dependencies**: Pure vanilla JavaScript
- **State Management**: Event-driven store pattern for predictable updates

## Development

Source files:
```
classifier/
  css/
    base.css         (4.2KB)  - Core styles, layout, typography
    layout.css       (6.8KB)  - Page layout, container, header
    spreadsheet.css  (8.8KB)  - Table/ spreadsheet styling, cell borders
  js/
    app.js           (14KB)   - Main entry point, initialization
    store.js         (11.6KB) - Centralized state management (event-driven store pattern)
    validator.js     (5.2KB)  - ZDDC filename validation
    scanner.js       (17.5KB) - Directory scanning, file system access
    tree.js          (17.2KB) - Folder tree rendering, navigation
    spreadsheet.js   (35.7KB) - Table rendering, cell rendering, editing
    selection.js     (23.9KB) - Cell selection, range selection
    resize.js        (2KB)    - Column resizing
    filter.js        (8KB)    - Column filtering logic
    sort.js          (6.7KB)  - Column sorting, comparison
    excel.js         (4.2KB)  - Excel import/export, clipboard handling
    preview.js       (17.5KB) - File preview rendering
    view.js          (11.8KB) - UI view updates, state observers
    utils.js         (2.6KB)  - Utility functions, helpers
  template.html
  build.sh
  README.md
```

Build: `bash build.sh`

Output: `dist/classifier.html`

### CSS Dependencies
Files are loaded in order to support progressive enhancement:
1. `base.css` - Core styles (defines variables, resets, base elements)
2. `layout.css` - Page structure (extends base styles)
3. `spreadsheet.css` - Table styles (extends both previous)

### JS Dependencies
Modules are loaded in dependency order:
1. `app.js` - Entry point, sets up event bus, initializes state
2. `store.js` - State store, emits events on changes
3. `validator.js` - ZDDC filename parser, validation functions
4. `scanner.js` - File system scanning, async file reading
5. `tree.js` - Directory tree UI, folder expansion
6. `spreadsheet.js` - Spreadsheet rendering, cell management
7. `selection.js` - Cell/row selection range handling
8. `resize.js` - Column width management
9. `filter.js` - Filter logic on table rows
10. `sort.js` - Sort comparison functions
11. `excel.js` - Clipboard parsing, Excel data import
12. `preview.js` - File preview rendering
13. `view.js` - UI state synchronization
14. `utils.js` - Helper utilities used throughout

## Design Philosophy

This tool follows simple, reliable best practices:
- **Single Purpose**: Classify and rename files to ZDDC format
- **Spreadsheet Paradigm**: Familiar Excel-like interface for batch editing
- **Simplicity = Reliability**: Centralized state, unidirectional data flow
- **No Magic**: Deterministic, user-controlled operations with live validation
- **Portable**: Single HTML file, works offline, no server required
- **Excel Integration**: Copy/paste workflow for bulk text operations

Use this tool to prepare files for the ZDDC Archive Browser.
