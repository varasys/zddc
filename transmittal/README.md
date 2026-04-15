# Transmittal Creator

[← Back to ZDDC](../README.md)

Create professional document transmittals that are impossible to forge or tamper with. Each transmittal is a self-contained HTML file with built-in integrity checking and optional digital signatures. Email it, archive it, trust it.

**[🔗 Open Transmittal Creator](dist/transmittal.html)** - Click to use online, or right-click → "Save Link As" to keep your own copy.

## The "Record Player with the Record" Concept

This tool embodies true data portability - each transmittal contains both the data AND the viewer. Recipients don't need special software, accounts, or training. They just open the HTML file in any browser to see a professional transmittal with full verification capabilities. In 20 years, it will still work exactly the same.

## What Makes Transmittals Special?

✅ **Tamper-Proof**  
Every file gets a SHA-256 fingerprint. If even one character changes, it's detected instantly.

🔒 **Digitally Signable**  
Optionally sign with cryptographic keys. Proves WHO sent it and WHEN, forever.

📧 **Self-Contained**  
The entire transmittal is one HTML file. Email it, archive it, open it anywhere.

📊 **Machine-Readable**  
Embedded JSON data means your systems can parse and process automatically.

🔍 **Independently Verifiable**  
Anyone can verify signatures and checksums - but verification MUST be done using a trusted copy of this tool, not the transmittal itself. See [Verification Security](#verification-security) below.

## Quick Start

### Workflow A: Paste file list first (typical for new transmittals)

1. **Fill in the header** — Tracking Number, Date, To, From, Subject, Purpose, Remarks
2. **Create Folder** — Menu → Create Folder → select staging directory → folder is created and selected
3. **Paste file list** — Copy 3-5 adjacent columns from Excel (Tracking, Title, Revision, [Status], [Extension]) → Menu → Paste New Rows
4. **Drop files onto rows** — Drag individual files from your OS onto matching rows to copy with ZDDC names and compute hashes
5. **Save Draft** — Menu → Save Draft → save into the created folder
6. **Publish** — When ready, Menu → Publish → choose Unsigned or Signed

### Workflow B: Scan an existing directory

1. **Click "Select Directory"** — Choose folder with files to transmit
2. **Files auto-populate** — With tracking numbers, revisions, and checksums parsed from ZDDC filenames
3. **Fill in the form** — To, From, Subject, and any remarks
4. **Click Publish** — Choose Draft, Unsigned, or Signed
5. **Send the HTML file** — Email it or save to your archive

## Verification Security

⚠️ **CRITICAL: Self-Verification is NOT Secure**

When you open a transmittal, it may display "✓ Signature Valid" - but **this display can be faked**. A malicious actor could create a transmittal that shows valid signatures while containing altered data.

### How to Verify Securely

**For Document Controllers / Official Verification:**

1. **Use a trusted tool instance** - Download the official transmittal tool from a trusted source (e.g., your organization's approved version or https://varasys.github.io/zddc/transmittal/dist/transmittal.html)
2. **Export JSON from the transmittal** - Open the transmittal → Click "Download Data"
3. **Import JSON into trusted tool** - Open your trusted tool → Click "Load JSON" → Paste the exported data
4. **Verify file hashes** - Click "Select Directory" and point to the actual files
5. **Check the verification display** - Only trust the verification shown in YOUR trusted tool, not the transmittal itself

**Why This Works:**
- The trusted tool's code is verified (by you or your organization)
- The JSON data is extracted and re-verified independently
- File hashes are computed fresh from the actual files
- The verification logic cannot be tampered with

**For Casual Review:**
- The self-verification display is fine for informal checks
- Useful for catching accidental modifications
- NOT sufficient for legal/contractual verification

### Verification Workflow

```
Received Transmittal (untrusted)
    ↓
Export JSON Data
    ↓
Trusted Tool Instance (verified by your organization)
    ↓
Import JSON → Verify Signatures → Verify File Hashes
    ↓
Official Verification Result
```

**Best Practice:** Organizations should maintain a verified copy of the transmittal tool at a known URL or network location for all document controllers to use for official verification.

## Technical Architecture

### Data-First Design
- **Single source of truth**: `<script id="transmittal-data" type="application/json">` block
- All UI state derived from this embedded JSON
- No duplicate data storage in the HTML

### Build System
- **Build script** that:
  - Concatenates modular CSS and JavaScript files
  - Inlines everything into template.html
  - Embeds this README as help documentation
  - Outputs single `dist/transmittal.html` file

### Security Model
- All cryptographic operations happen **client-side** (Web Crypto API)
- Private keys never stored or uploaded
- **Self-verification is informational only** - a malicious transmittal can fake verification displays
- **Secure verification requires external validation** - see [Verification Security](#verification-security)
- Organizations should maintain a trusted tool instance for official verification

## Key Features

✅ **Portable**: Single HTML file works offline  
✅ **Cryptographic**: SHA-256 hashing + ECDSA signatures  
✅ **Parseable**: Embedded JSON for machine automation  
✅ **Human-readable**: Clean UI with print optimization  
✅ **Filterable**: Boolean logic filtering on all columns  
✅ **Verifiable**: Independent signature verification  
✅ **Standards-based**: ZDDC filename convention compliance  

## Use Case

This tool is designed for **engineering/construction document transmittals** where:
- Multiple files need to be transmitted with metadata
- Cryptographic integrity verification is required
- Non-repudiation via digital signatures is valuable
- Recipients need human-readable + machine-parseable format
- Offline/portable distribution is essential

The project achieves a **self-contained, verifiable document package** that bridges human workflow needs with automation requirements.

## How It Works

The transmittal operates on a simple principle: all data lives in a single JSON block inside the HTML. When you save or publish, it updates this JSON and downloads a new HTML file. This ensures:

- Complete data portability
- No hidden state or complexity  
- Easy integration with other systems
- Full transparency of what's stored


## Field reference (canonical payload)

Form values map to a stable canonical payload used for hashing/signing and JSON export. This payload lives inside the `<script type="application/json" id="transmittal-data">` block.

**JSON Schema**: See [`transmittal.schema.json`](./transmittal/transmittal.schema.json) for the complete, machine-readable schema definition.

### Key Fields

**Payload** (core document data):
- `version` — Payload schema version (currently 1)
- `type` — Document type: "Transmittal", "Submittal", or custom text (e.g., "Contract Attachment 1")
- `title` — Optional descriptive title
- `client` — The Owner Name
- `project` — The Project Name
- `projectNumber` — The Project Number
- `date` — Date in YYYY-MM-DD format (canonicalized from friendly text)
- `trackingNumber` — Must not contain spaces or underscores
- `from` — Who issued the document (hidden when type is not Transmittal or Submittal)
- `to` — Recipient (hidden when type is not Transmittal or Submittal)
- `purpose` — Purpose of document (hidden when type is not Transmittal or Submittal)
- `responseDue` — Response deadline (shown only when type is Submittal)
- `subject` — Subject line
- `remarks` — Free-form Markdown content
- `files[]` — Array of file objects, each containing:
  - `trackingNumber`, `revision`, `status`, `title` (parsed from ZDDC filename)
  - `path` — Directory path relative to transmittal root (empty string for root-level files)
  - `filename` — Filename only (without path)
  - `sha256` — SHA-256 hash of file contents (hex)
  - `fileSize` — File size in bytes

**Envelope** (cryptographic metadata):
- `version` — Envelope schema version (currently 1)
- `digestAlgorithm` — Always "SHA-256"
- `digest` — SHA-256 hash of canonical payload string (hex)
- `digestedAt` — ISO 8601 timestamp when digest was computed
- `signatureAlgorithm` — "ECDSA-P256-SHA256"
- `signatures[]` — Array of signature objects, each containing:
  - `signature` — ECDSA signature over canonical envelope (base64)
  - `signedAt` — ISO 8601 timestamp when this signature was created
  - `publicKeyJwk` — EC P-256 public key (JWK) for verification

**Security Model**: Signatures sign the envelope (which contains the digest), not the payload directly. This prevents tampering with the digest field while maintaining a two-layer verification:
1. **Digest verification**: Confirms payload hasn't been modified (fast, no crypto)
2. **Signature verification**: Confirms envelope (including digest) is authentic (cryptographic proof)

**Presentation** (optional display assets - not signed):
- `leftLogo` — Left logo as data URL
- `rightLogo` — Right logo as data URL
- `theme` — Visual theme identifier
- `customCss` — Optional custom CSS for styling


## Files table

**Columns**: Tracking Number, Title, Revision, Status, EXT, Size, SHA256

**Column visibility**:
- **Default view**: Shows Tracking Number, Title, Revision, Status (essential columns)
- **Show Details**: Toggle to reveal EXT, Size, SHA256 (technical details)
- **Fullscreen**: Expand table to full browser window for better viewing of large file lists

**Pasting file lists**:
- Copy 3-5 **adjacent** tab-separated columns from Excel or any spreadsheet
- Expected column order: Tracking, Title, Revision, [Status], [Extension]
- 3-column paste: third column can be combined "A (IFR)" → splits into Revision "A" and Status "IFR"
- Pastes with more than 5 columns are rejected with an error — condition your data into adjacent columns first
- **Paste New Rows**: Replaces entire file list (confirms first)
- **Paste Append Rows**: Adds to existing list, updates matching rows by tracking+revision key

**Drop file onto row**:
- Drag a file from your OS onto any table row in edit mode
- The file is copied to the selected directory with the proper ZDDC filename
- SHA-256 hash is computed and stored
- If no directory is selected, you will be prompted to pick one

**File scanning**:
- "Select Directory" / "Scan Directory" scans recursively using the File System Access API, hashing files locally and parsing names
- Filename parser expects: `trackingNumber_revision (status) - title.ext`
  - Example: `A101-203_revA (Issued) - Site Plan.pdf`
  - If a filename doesn't match, it still appears; parsed fields default to empty and `title` becomes the base name
- Imports are merged on key `(trackingNumber|revision)`; newer scans update/replace matching rows
- For known viewable types (`pdf,png,jpg,jpeg,gif,svg,webp,txt,html,htm,md`), links open in a new tab; others download


## Filtering

Each column has a filter input. Supported expression syntax:

| Expression | Meaning |
|---|---|
| `term` | Contains "term" (case-insensitive) |
| `!term` | Does not contain "term" |
| `^term` | Starts with "term" |
| `term$` | Ends with "term" |
| `a b` | Matches both (AND) |
| `a \| b` | Matches either (OR) |
| `^IFA \| ^IFB` | Starts with IFA or IFB |
| `pdf !draft` | Contains "pdf" and not "draft" |
| `!^~` | Does not start with ~ (excludes drafts) |
| `el.*spc` | Regex: "el" followed by "spc" |
| `[ei]fa` | Regex character class: "efa" or "ifa" |

Examples:

- Only PDFs: in EXT filter, type `pdf$`.
- Exclude drafts: in Revision, type `!^~`.
- Status IFA or IFB: type `^IFA | ^IFB`.
- Title contains both "floor" and "plan": type `floor plan`.
- Tracking contains "el" then "spc": type `el.*spc`.


## Form validation

The transmittal provides real-time validation to catch errors early:

**Inline validation** (as you type):
- **Tracking Number**: Highlights if contains spaces or underscores (invalid characters)
- **Date fields**: Auto-formats to YYYY-MM-DD, shows format hint on focus
- **File table**: Shows parsing warnings for filenames that don't match ZDDC convention

**Publish-time validation**:
- All required fields must be filled
- Tracking numbers must not contain spaces or underscores
- File revisions must not contain spaces
- At least one file must be included

**Smart defaults**:
- **Date**: Pre-filled with today's date in YYYY-MM-DD format


## Signature verification

⚠️ **WARNING: For official verification, see [Verification Security](#verification-security) above. The verification display shown here can be faked by a malicious transmittal.**

When viewing a published transmittal, signature status is displayed above the files table:

**For each signature**:
- ✓ **Valid** — Signature verified successfully (in this document's context)
- ⚠ **Warning** — Signature valid but transmittal has been edited
- ✗ **Invalid** — Signature verification failed

**Verification Actions**:
- **Verify Externally** — Opens a trusted tool instance for independent verification
  - Copies JSON data to clipboard
  - Opens https://varasys.github.io/zddc/transmittal/dist/transmittal.html in validation mode
  - Paste JSON and select directory to verify file hashes independently
  - Only trust verification results from the trusted tool, not this document

**Signature details** (expandable):
- Public key fingerprint (click to copy)
- Signature timestamp (from `signedAt` field)
- Signature index (e.g., "Signature 1 of 3")

**Other Actions**:
- **Delete signature** — Remove invalid or outdated signatures
- **Add signature** — Co-sign the document with your key
  - Opens signing dialog (select existing key or generate new key)
  - New signature appended to `signatures[]` array with current timestamp
  - Downloads updated document (cannot save in place)


## Saving and loading transmittals

**Save Draft** (Menu → Save Draft):
- Saves current state as an HTML file via the system file picker
- All header info, file list, and remarks are preserved
- Open the saved HTML in a browser to resume editing
- Drafts have no digest or signature

**Create Folder** (Menu → Create Folder):
- Builds a folder name from the form: `YYYY-MM-DD_TRACKING (PURPOSE) - SUBJECT`
- Prompts you to select a staging directory, then creates the subfolder
- The new folder becomes the selected directory for file drops and Save Draft
- Requires at least a tracking number

**Remove Files** (Menu → Remove Files):
- Clears the file list while keeping all header info and remarks
- Useful when reusing a transmittal template with a new set of files

**Save as JSON**:
- Click **Download Data** to export the current transmittal as JSON
- This file can be reloaded later as either:
  - A finished transmittal (view/verify)
  - A starting point for a new transmittal (edit/modify)

**Load from JSON**:
- Click **Load JSON** to import a previously saved transmittal
- All form fields, files, and presentation assets (logos) are restored

**Import HTML** (Menu → Import HTML):
- Load a previously saved draft or published transmittal HTML file
- Extracts the embedded JSON and restores all fields
- You can also drag-and-drop an HTML or JSON file directly onto the page — see **Drag-and-Drop Zones** below

## Drag-and-Drop Zones

Whenever you drag any file or folder over the browser window, labelled drop zones appear on the transmittal to show you exactly where data can land:

| Zone | Location | Accepts | Notes |
|------|----------|---------|-------|
| **Sender logo** | Top-left logo area | Image files (png, jpg, svg, …) | Edit mode only |
| **Receiver logo** | Top-right logo area | Image files | Edit mode only |
| **Header** | Header info block | Transmittal HTML or JSON file | Imports all header fields and file list; edit mode only |
| **File table** | Document table area | Folder (scan or verify) · Transmittal HTML or JSON | Works in both edit and published mode |

**Visual feedback during drag:**
- Zones that can accept the dragged data are highlighted with a blue dashed outline and a descriptive label.
- Zones that cannot accept the data are shown with a grey outline and dimmed.
- When you hover over an eligible zone, it brightens further to confirm where the drop will land.

**Logos and presentation assets**:
- Logos ARE included in JSON exports (in the optional `presentation` object)
- Logos are NOT part of the signed `payload` (separate top-level object)
- When you drag-drop logos, they're converted to data URLs
- The `presentation` object includes:
  - `leftLogo` and `rightLogo` (data URLs)
  - `theme` (visual theme identifier)
  - `customCss` (optional custom styling)
- This keeps the cryptographic signature focused on document data, not visual styling


## JSON export format

Download Data exports the exact contents of the embedded JSON block.

**Format**: See [`transmittal.schema.json`](./transmittal/transmittal.schema.json) for the complete structure.

**Key Points**:
- The `payload` contains all transmittal data (metadata + files)
- The `envelope` contains cryptographic metadata (digest, timestamp, signatures)
- The `presentation` (optional) contains display assets (logos, styling) - **not signed**
- The digest is computed over the canonical JSON string of `payload` only (sorted keys, stable formatting)
- Each signature in the `signatures[]` array signs the same canonical payload string
- If unsigned, the `signatures` array is empty `[]`
- Presentation assets travel with the JSON but are excluded from cryptographic operations


## Browser compatibility and printing

- Directory selection requires the File System Access API (Chromium‑based browsers). On unsupported browsers, file scanning will not work.
- Print styles are optimized for US Letter (8.5in×11in). Table header "sticky" behavior is disabled in print.


## Publishing & Signing

When you click **Publish**, a modal opens with these options:

1. **Save Draft** — Saves HTML with current data (no digest, no signature)
   - Also available directly from Menu → Save Draft (without opening the publish modal)
   - Use for work-in-progress transmittals
   - Can be reopened and edited later

2. **Publish Unsigned** — Creates transmittal with digest only (no signature)
   - Provides integrity verification via SHA-256 digest
   - Proves content hasn't been modified
   - No identity authentication

3. **Publish Signed** — Creates transmittal with digest + signature(s)
   - Choose one of:
     - **Sign with Existing Key** — Select your saved private key JWK file
     - **Sign with New Key** — Generate new EC P-256 key pair (downloads private key for you to save)
   - Provides both integrity and authentication
   - Supports multiple signatures (co-signing)

**Security notes**:
- All cryptographic operations happen locally in the browser (Web Crypto API)
- Private keys are never stored or uploaded
- Only public keys are embedded in the published transmittal for verification
- If you generate a new key, **save the downloaded private key file** — you'll need it to sign future transmittals with the same identity
- Editing a published transmittal invalidates existing signatures (they can be deleted)

## Workflow

The transmittal operates in different modes that control what actions are available:

### Edit Mode (Default)

**When active**: New transmittals or when explicitly toggled to Edit mode.

**Document type selector**:

The `type` field is a text input with autocomplete suggestions. Type to select or enter custom text.

| Field | Transmittal | Submittal | File List (custom text) |
|-------|-------------|-----------|-------------------------|
| From | ✓ | ✓ | — |
| To | ✓ | ✓ | — |
| Purpose | ✓ | ✓ | — |
| Response Due | — | ✓ | — |
| Subject | ✓ | ✓ | ✓ |
| Remarks | ✓ | ✓ | ✓ |

**Usage**:
- **Transmittal** — General document transmittals (no response required)
- **Submittal** — Submittals requiring response (shop drawings, product data, samples)
- **Custom text** — Type any text (e.g., "Contract Attachment 1", "Document Register") for file lists without workflow fields

**Primary actions** (toolbar buttons):
- **Select Directory** / **Scan Directory** — Scan filesystem to populate files table
- **Verify Directory** — Re-hash files and compare against stored hashes
- **Publish** — Opens publish modal (Draft / Unsigned / Signed)

**Menu actions** (☰ dropdown):
- **Scan Directory** / **Verify Directory** — Same as toolbar buttons
- **Publish** / **Save Draft** / **Create Folder** — Publishing and folder management
- **Paste New Rows** / **Paste Append Rows** — Paste file lists from clipboard
- **Copy Table** — Copy file table to clipboard as tab-separated text
- **Remove Files** — Clear file list, keep header and remarks
- **Import HTML** — Load a saved draft or published transmittal
- **Copy JSON** / **Paste JSON** — JSON clipboard operations
- **Reset** — Clear all form data and files (start over)
- **Create Index** — Generate archive redirect index in selected directory

**Header bar actions** (always available):
- **View/Edit toggle** — Switch between edit and read-only mode
- **Load JSON** — Import a previously saved document
- **Download Data** — Export JSON for signature verification or system integration
- **Help** — View this documentation

**UI behavior**: All form fields and table cells are editable. Filter inputs remain active for searching.

### View Mode

**When active**: Toggle from Edit mode or when opening a published transmittal.

**Available actions**:
- **View/Edit** — Switch to Edit mode (allows modifications)
- **Download Data** — Export JSON for signature verification or system integration
- **Help** — View this documentation

**UI behavior**: Form fields and table cells are read-only. Filter inputs remain active for searching. All editing controls hidden (Select Directory, Publish, Reset).

### Published State

**When active**: Automatically detected when transmittal contains a valid digest.

**Additional display**: Signature verification status shown above files table with public key fingerprint(s).

**Behavior**: Defaults to View mode on load. Can toggle to Edit mode, but signature status indicates the transmittal has been published.

### Mode Transitions

```
New Transmittal → Edit Mode
                    ↓
              Save Draft → Edit Mode (unsigned)
                    ↓
           Sign & Publish → Published State (View Mode)
                    ↓
              Toggle Edit → Published State (Edit Mode)
```


---

Authoring notes:

- UI copy uses “Tracking Number” consistently. The underlying key remains `trackingNumber`.
- This README documents only the transmittal folder assets and does not change any code outside this directory.
