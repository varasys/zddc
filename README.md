# Zero Day Document Control (ZDDC)
**The Universal Distributed Filing Cabinet**

ZDDC is a set of opensource lightweight project management tools.

ZDDC is focused on deliverables/task based project management and the concept that planning the deliverables/tasks list is planning the project, and that project information must be readily accessable by all project participants.

The name Zero Day Document Control is based on the idea that this system is based around file naming and organization, and that the only requirement to opt-in to the delightfully useful utilities is to adopt the  [ZDDC file naming convention](#file-naming-convention) described below which can be done on the "zeroeth" day of a project. It is in contrast to complex systems that takes months to implement and train.

ZDDC is not the software tools - it is the organizational structure of the information as described below. The software tools are just examples of how to create user interfaces around this structure.

## Prototype Tools

Think of these tools as the "record player that comes with the record" - each is a complete, self-contained application in a single HTML file that will work forever, exactly as it does today. No updates, no subscriptions, no cloud dependencies. Just save it and use it.

1. **[Archive Browser](archive/README.md)** - Your digital filing cabinet. Browse and organize project documents with powerful search, filtering, and batch operations. Perfect for finding that specification from three months ago.
   - 🔗 **[Open Archive Browser](archive/dist/archive.html)** *(right-click to save locally)*

2. **[Transmittal Creator](transmittal/README.md)** - Create professional document transmittals with built-in integrity checking and optional digital signatures. Each transmittal is a self-contained HTML file you can email or archive.
   - 🔗 **[Open Transmittal Creator](transmittal/dist/transmittal.html)** *(right-click to save locally)*

3. **[Document Classifier](classifier/README.md)** - Excel-like interface for bulk renaming files to ZDDC format. Copy/paste with Excel for efficient text operations. Turn that pile of randomly named files into an organized archive.
   - 🔗 **[Open Document Classifier](classifier/dist/classifier.html)** *(right-click to save locally)*

4. **[Markdown Editor](mdedit/README.md)** - Browser-based markdown editor with live preview, YAML front matter support, table of contents, and direct local file access via the File System Access API.
   - 🔗 **[Open Markdown Editor](mdedit/dist/mdedit.html)** *(right-click to save locally)*

**Why single-page HTML applications?** These tools embody the principle of sustainable software - they're immune to vendor lock-in, service shutdowns, or forced updates. Download once, use forever. Your data stays with you, in formats you control.

## Key Principles

The key principles underlying the ZDDC organizational structure are:

1. **Unique Identification**: Each deliverable receives an immutable tracking number
2. **Version Control**: Revisions track document changes throughout project lifecycle
3. **Centralized Storage**: All files reside in directories with unique filenames combining:
   - Tracking number
   - Revision
   - Title
   - Status
   - Date (for folders)

**Naming Requirements**:

- Tracking numbers must NOT contain spaces or underscores (_)
- Revisions must NOT contain spaces
- File extensions preserve original format (e.g., .dwg, .pdf)

## File Naming Convention

`trackingNumber`_`revision` (`status`) - `title`.`extension`

**Field Specifications**:

| Component         | Rules                                                                           |
| ----------------- | ------------------------------------------------------------------------------- |
| `trackingNumber` | Unique identifier (no whitespace or _ chars)                                    |
| `revision`        | Alphanumeric with letters sorted before numbers (e.g., A → 1) and optional modifier (see below)                 |
| `status`          | Project phase code (IFA=Issued For Approval, IFC=Issued For Construction, etc.) |
| `title`           | Short descriptive title matching deliverables list                              |
| `extension`       | Original file type preserved                                                    |

*Examples*:

- `123456-EM-MDL-0001_A (IFR) - Master Deliverables List.pdf`
- `123456-EL-SPC-2623_A (IFR) - Specification For Switchgear.pdf`
- `123456-EL-ARR-0003_A (IFR) - Electrical Room Equipment Arrangement.pdf`
- `123456-EL-ARR-0003_A+C1 (IFR) - Electrical Room Equipment Arrangement.pdf` (comments to Rev A)
- `123456-EL-ARR-0003_0 (IFC) - Electrical Room Equipment Arrangement.pdf`
- `123456-EL-ARR-0003_1 (IFC) - Electrical Room Equipment Arrangement.pdf` (revision to construction print)
- `123456-EL-ARR-0003_2 (REC) - Electrical Room Equipment Arrangement.pdf` (for record)

### `status` codes
Typical `status` codes include:

| CODE | DESCRIPTION |
|:-:|-|
| DFT | Issued as DRAFT |
| IFA | Issued For Approval |
| IFB | Issued For Bid |
| IFC | Issued For Construction |
| IFD | Issued For Design |
| IFI | Issued For Information |
| IFP | Issued For Purchase |
| IFR | Issued For Review |
| IFU | Issued For Use |
| REC | Issued For Record |

### Revision Modifiers (+ modifier)

A "+" sign may be used to indicate a relationship between the file and a file with the same tracking number and revision (ie. the base content). These files are sorted lexically after the base file in the archive browser.

Typical revision modifiers, where 'x' is a sequential integer, since each modifier can be used more than once for a given deliverable, are:

| MODIFIER | DESCRIPTION |
|:-:|-|
| +Cx | to indicate **C**omments to the base content
| +Bx | to indicate **B**ackup material used to support the base content but isn't included in the base content
| +Nx | to indicate **N**otes that relate to the base content, but which are not meant for general distribution (ie. internal email related to the content)
| +Qx | to indicate **Q**uality check record

For example, given the file `123456-EL-SPC-2623_A (IFR) - Specification For Switchgear.pdf` as the "base content" some examples of how related files could be associated are:

| FILENAME | DESCRIPTION |
|-|-|
| 123456-EL-SPC-2623_A+C1 (RSA) - Specification For Switchgear.pdf | would have comments (ex. markups directly on the base content) |
| 123456-EL-SPC-2623_A+C2 (RSA) - Specification For Switchgear.pdf | would be a second set of comments (ex. a checklist) |
| 123456-EL-SPC-2623_A+B1 (IFI) - Specification For Switchgear.pdf | would be some notes or other content that supports the base content (ex. internal confirmation of a question) |
| 123456-EL-SPC-2623_A+N1 (IFI) - Specification For Switchgear.pdf | would be some notes or reference material associated with the base content (ex. a deeper explination of a review comment that is not meant to be included in the response) |
| 123456-EL-SPC-2623_A+Q1 (RSA) - Specification For Switchgear.pdf | would be a record of the quality review of the base content |

### Modified `status` codes

Typically when a revision modifier is used, the associated status is either related to a review status or informational.

Typical `status` codes used with revision modifiers include:

| CODE | STATUS | DESCRIPTION |
|:-:|-|-|
| IFI | Information Only | |
| RSA | Review Status A | No Comments |
| RSB | Review Status B | Incorporate Comments, Proceed, and Resubmit for Record |
| RSC | Review Status C | Incorporate Comments and Resubmit before Proceeding |
| RSD | Review Status D | Rejected - Resubmit Per Requirements |
| RSI | No Review Required | Typically for supplemental information provided for general information |

### Drafts (~ modifier)

By convention, a tilde "~" can be used as a prefix of the revision or revision modifier field to indicate the working version of a file.

This is a useful way to differentiate between formal final revisions and working versions of files.

Where files are likely to have updates, it is customary to add a formal revision to the archive, and then copy it to a working folder and increment the revision in the filename and add the tilde prefix to indicate that it is the working version of the next revision of the file.

For example, various versions of the `123456-EL-SPC-2623_A (IFR) - Specification For Switchgear.pdf` could be:

| FILENAME | DESCRIPTION |
|-|-|
| 123456-EL-SPC-2623_~A (IFR) - Specification For Switchgear.pdf | working version of revision A which will be issued for review (note the tilde signifies that this file is not in a reliable state - it is a working version) |
| 123456-EL-SPC-2623_A (IFR) - Specification For Switchgear.pdf | final version of revision A (note there is no tilde) |
| 123456-EL-SPC-2623_A+~C1 (---) - Specification For Switchgear.pdf | working version of comments to revision A, note the tilde prefix on the revision modifier and the status is not filled in because it is not known until the comments are finalized |
| 123456-EL-SPC-2623_A+C1 (RSB) - Specification For Switchgear.pdf | final comments to revision A with review status B indicating that there are comments that should be incorporated before the deliverable is re-submitted for review |

## Folder Naming Convention

Folders (ie. transmittal folders) are named using the same rules as the [ZDDC file naming convention](#file-naming-convention) for naming a transmittal using a date revision, except the date prefixes the tracking number instead of suffixing it. This is so the natural sorting of folders puts the most recent transmittal first.

*Examples*:

- `2025-10-31_123456-EM-SUB-0001 (IFR) - General Arrangement for Review`
- `2025-10-31_123456-EL-TRN-0043 (IFC) - Electrical Design Issued For Construction`
- `2025-10-31_123456-ME-RFI-0024 (IFR) - Mechanical Room Size RFI` (question)
- `2025-11-12_123456-ME-RFI-0024 (IFU) - Mechanical Room Size RFI` (response)

## Collaboration

When collaborating with others, it is recommended to use sets of shared "incoming/received/issued" folder with each third party where:

1. the sender puts correctly named files in a transmittal folder and then uploads to the receivers "incoming" folder
2. the receiver checks the transmittal folder for correctness (ie. files are named correctly, etc.) and then transfers the transmittal folder from the "incoming" folder to the "received" folder where it remains as a permanent record of the transmittal
3. the receiver saves an acknowledgment of receipt (with the sha256 hash of each file) in the "receiving" folder to confirm the transmittal was received and accepted
4. the receiver notifies the sender and all other interested parties (ie. the intended distribution) that the transmittal was received and accepted and provide the link to the transmittal folder in the "receiving" folder
  - the notification should include the sha256 hash of each file to confirm the transmittal was received and accepted and establish that as the "official" version of the related file

Ideally the "receiving" folder can be made available to the sender and the entire project team on a read-only basis.

Different sending/receiving pairs can be used as appropriate to segregate things such as commercially sensative files.

The "receiving" folder itself is the permanent archive of the project documents.

Ideally an (optionally digitally signed) acknowledgment of receipt should be sent to the sender to confirm the transmittal was received and accepted including the sha256 hash of each file.

When a shared directory space isn't available, directory syncronization tools such as [rsync](https://rsync.samba.org/) or [rclone](https://rclone.org/) can be used to synchronize "receiving" folders between remote sites.

## Contributing
ZDDC is an opensource project hosted on Github at [https://github.com/varasys/zddc](https://github.com/varasys/zddc) so please contribute any bug reports, feature requests, or code you think may be useful.

Please note the nature of ZDDC is to be simple and require no configuration to start, and minimal configuration overall. So all feature requests or code contributions will be first be filtered through that lens.

## License
ZDDC and related tools are licensed under the [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.en.html). You are free to use, modify, and distribute this material, including for commercial purposes, under the terms of this license.

ZDDC and related tools are provided “as is”, without warranties of any kind, express or implied. The authors and copyright holders disclaim all liability for damages arising from its use.


