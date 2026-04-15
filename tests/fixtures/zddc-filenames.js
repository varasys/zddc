/**
 * ZDDC filename test fixtures.
 *
 * Covers the full naming convention from README.md:
 *   trackingNumber_revision (status) - title.extension
 *
 * These fixtures are shared across tool tests to ensure consistent
 * parsing behavior (archive, transmittal, classifier all parse filenames).
 */

/** Valid ZDDC filenames with expected parsed components */
export const VALID_FILES = [
  // --- Standard letter revisions ---
  {
    filename: '123456-EL-SPC-2623_A (IFR) - Specification For Switchgear.pdf',
    parsed: { trackingNumber: '123456-EL-SPC-2623', revision: 'A', status: 'IFR', title: 'Specification For Switchgear', extension: 'pdf' },
    size: 45000,
  },
  {
    filename: '123456-EL-SPC-2623_B (IFR) - Specification For Switchgear.pdf',
    parsed: { trackingNumber: '123456-EL-SPC-2623', revision: 'B', status: 'IFR', title: 'Specification For Switchgear', extension: 'pdf' },
    size: 46000,
  },

  // --- Standard number revisions (issued for construction) ---
  {
    filename: '123456-EL-SPC-2623_0 (IFC) - Specification For Switchgear.pdf',
    parsed: { trackingNumber: '123456-EL-SPC-2623', revision: '0', status: 'IFC', title: 'Specification For Switchgear', extension: 'pdf' },
    size: 47000,
  },
  {
    filename: '123456-EL-SPC-2623_1 (IFC) - Specification For Switchgear.pdf',
    parsed: { trackingNumber: '123456-EL-SPC-2623', revision: '1', status: 'IFC', title: 'Specification For Switchgear', extension: 'pdf' },
    size: 48000,
  },

  // --- Revision modifiers ---
  {
    filename: '123456-EL-SPC-2623_A+C1 (RSB) - Specification For Switchgear.pdf',
    parsed: { trackingNumber: '123456-EL-SPC-2623', revision: 'A+C1', status: 'RSB', title: 'Specification For Switchgear', extension: 'pdf' },
    size: 12000,
    description: 'Comments to Rev A',
  },
  {
    filename: '123456-EL-SPC-2623_A+C2 (RSA) - Specification For Switchgear.pdf',
    parsed: { trackingNumber: '123456-EL-SPC-2623', revision: 'A+C2', status: 'RSA', title: 'Specification For Switchgear', extension: 'pdf' },
    size: 13000,
    description: 'Second set of comments to Rev A',
  },
  {
    filename: '123456-EL-SPC-2623_A+B1 (IFI) - Specification For Switchgear.pdf',
    parsed: { trackingNumber: '123456-EL-SPC-2623', revision: 'A+B1', status: 'IFI', title: 'Specification For Switchgear', extension: 'pdf' },
    size: 8000,
    description: 'Backup material for Rev A',
  },
  {
    filename: '123456-EL-SPC-2623_A+N1 (IFI) - Specification For Switchgear.pdf',
    parsed: { trackingNumber: '123456-EL-SPC-2623', revision: 'A+N1', status: 'IFI', title: 'Specification For Switchgear', extension: 'pdf' },
    size: 5000,
    description: 'Notes for Rev A',
  },
  {
    filename: '123456-EL-SPC-2623_A+Q1 (RSA) - Specification For Switchgear.pdf',
    parsed: { trackingNumber: '123456-EL-SPC-2623', revision: 'A+Q1', status: 'RSA', title: 'Specification For Switchgear', extension: 'pdf' },
    size: 3000,
    description: 'Quality check record for Rev A',
  },

  // --- Draft indicators ---
  {
    filename: '123456-EL-SPC-2623_~B (IFR) - Specification For Switchgear.pdf',
    parsed: { trackingNumber: '123456-EL-SPC-2623', revision: '~B', status: 'IFR', title: 'Specification For Switchgear', extension: 'pdf' },
    size: 44000,
    description: 'Working draft of Rev B',
  },
  {
    filename: '123456-EL-SPC-2623_A+~C1 (---) - Specification For Switchgear.pdf',
    parsed: { trackingNumber: '123456-EL-SPC-2623', revision: 'A+~C1', status: '---', title: 'Specification For Switchgear', extension: 'pdf' },
    size: 11000,
    description: 'Working draft of comments to Rev A, status unknown',
  },

  // --- Multiple disciplines ---
  {
    filename: '123456-EM-MDL-0001_A (IFR) - Master Deliverables List.pdf',
    parsed: { trackingNumber: '123456-EM-MDL-0001', revision: 'A', status: 'IFR', title: 'Master Deliverables List', extension: 'pdf' },
    size: 120000,
  },
  {
    filename: '123456-EL-ARR-0003_A (IFR) - Electrical Room Equipment Arrangement.dwg',
    parsed: { trackingNumber: '123456-EL-ARR-0003', revision: 'A', status: 'IFR', title: 'Electrical Room Equipment Arrangement', extension: 'dwg' },
    size: 500000,
  },
  {
    filename: '123456-ME-RFI-0024_A (IFR) - Mechanical Room Size RFI.pdf',
    parsed: { trackingNumber: '123456-ME-RFI-0024', revision: 'A', status: 'IFR', title: 'Mechanical Room Size RFI', extension: 'pdf' },
    size: 25000,
  },

  // --- All document status codes ---
  { filename: '123456-EL-DWG-0001_A (DFT) - Draft Drawing.pdf', parsed: { trackingNumber: '123456-EL-DWG-0001', revision: 'A', status: 'DFT', title: 'Draft Drawing', extension: 'pdf' }, size: 10000 },
  { filename: '123456-EL-DWG-0002_A (IFA) - Approval Drawing.pdf', parsed: { trackingNumber: '123456-EL-DWG-0002', revision: 'A', status: 'IFA', title: 'Approval Drawing', extension: 'pdf' }, size: 10000 },
  { filename: '123456-EL-DWG-0003_A (IFB) - Bid Drawing.pdf', parsed: { trackingNumber: '123456-EL-DWG-0003', revision: 'A', status: 'IFB', title: 'Bid Drawing', extension: 'pdf' }, size: 10000 },
  { filename: '123456-EL-DWG-0004_A (IFC) - Construction Drawing.pdf', parsed: { trackingNumber: '123456-EL-DWG-0004', revision: 'A', status: 'IFC', title: 'Construction Drawing', extension: 'pdf' }, size: 10000 },
  { filename: '123456-EL-DWG-0005_A (IFD) - Design Drawing.pdf', parsed: { trackingNumber: '123456-EL-DWG-0005', revision: 'A', status: 'IFD', title: 'Design Drawing', extension: 'pdf' }, size: 10000 },
  { filename: '123456-EL-DWG-0006_A (IFI) - Information Drawing.pdf', parsed: { trackingNumber: '123456-EL-DWG-0006', revision: 'A', status: 'IFI', title: 'Information Drawing', extension: 'pdf' }, size: 10000 },
  { filename: '123456-EL-DWG-0007_A (IFP) - Purchase Drawing.pdf', parsed: { trackingNumber: '123456-EL-DWG-0007', revision: 'A', status: 'IFP', title: 'Purchase Drawing', extension: 'pdf' }, size: 10000 },
  { filename: '123456-EL-DWG-0008_A (IFR) - Review Drawing.pdf', parsed: { trackingNumber: '123456-EL-DWG-0008', revision: 'A', status: 'IFR', title: 'Review Drawing', extension: 'pdf' }, size: 10000 },
  { filename: '123456-EL-DWG-0009_A (IFU) - Use Drawing.pdf', parsed: { trackingNumber: '123456-EL-DWG-0009', revision: 'A', status: 'IFU', title: 'Use Drawing', extension: 'pdf' }, size: 10000 },
  { filename: '123456-EL-DWG-0010_A (REC) - Record Drawing.pdf', parsed: { trackingNumber: '123456-EL-DWG-0010', revision: 'A', status: 'REC', title: 'Record Drawing', extension: 'pdf' }, size: 10000 },

  // --- Review status codes (used with modifiers) ---
  { filename: '123456-EL-DWG-0001_A+C1 (RSA) - No Comments.pdf', parsed: { trackingNumber: '123456-EL-DWG-0001', revision: 'A+C1', status: 'RSA', title: 'No Comments', extension: 'pdf' }, size: 5000 },
  { filename: '123456-EL-DWG-0001_A+C1 (RSB) - Incorporate and Resubmit.pdf', parsed: { trackingNumber: '123456-EL-DWG-0001', revision: 'A+C1', status: 'RSB', title: 'Incorporate and Resubmit', extension: 'pdf' }, size: 5000 },
  { filename: '123456-EL-DWG-0001_A+C1 (RSC) - Revise and Resubmit.pdf', parsed: { trackingNumber: '123456-EL-DWG-0001', revision: 'A+C1', status: 'RSC', title: 'Revise and Resubmit', extension: 'pdf' }, size: 5000 },
  { filename: '123456-EL-DWG-0001_A+C1 (RSD) - Rejected.pdf', parsed: { trackingNumber: '123456-EL-DWG-0001', revision: 'A+C1', status: 'RSD', title: 'Rejected', extension: 'pdf' }, size: 5000 },
  { filename: '123456-EL-DWG-0001_A+B1 (RSI) - Supplemental Info.pdf', parsed: { trackingNumber: '123456-EL-DWG-0001', revision: 'A+B1', status: 'RSI', title: 'Supplemental Info', extension: 'pdf' }, size: 5000 },

  // --- Record/construction lifecycle ---
  {
    filename: '123456-EL-ARR-0003_0 (IFC) - Electrical Room Equipment Arrangement.pdf',
    parsed: { trackingNumber: '123456-EL-ARR-0003', revision: '0', status: 'IFC', title: 'Electrical Room Equipment Arrangement', extension: 'pdf' },
    size: 50000,
    description: 'First construction issue',
  },
  {
    filename: '123456-EL-ARR-0003_1 (IFC) - Electrical Room Equipment Arrangement.pdf',
    parsed: { trackingNumber: '123456-EL-ARR-0003', revision: '1', status: 'IFC', title: 'Electrical Room Equipment Arrangement', extension: 'pdf' },
    size: 51000,
    description: 'Construction revision',
  },
  {
    filename: '123456-EL-ARR-0003_2 (REC) - Electrical Room Equipment Arrangement.pdf',
    parsed: { trackingNumber: '123456-EL-ARR-0003', revision: '2', status: 'REC', title: 'Electrical Room Equipment Arrangement', extension: 'pdf' },
    size: 52000,
    description: 'For record',
  },
];

/** Invalid filenames for negative testing */
export const INVALID_FILES = [
  { filename: 'random-document.pdf', reason: 'No ZDDC naming convention' },
  { filename: 'has spaces in tracking_A (IFR) - Title.pdf', reason: 'Spaces in tracking number' },
  { filename: '123456_EL_SPC_2623_A (IFR) - Title.pdf', reason: 'Underscores in tracking number' },
  { filename: '123456-EL-SPC-2623_A (IFR).pdf', reason: 'Missing title separator' },
  { filename: '123456-EL-SPC-2623_A - Title.pdf', reason: 'Missing status' },
  { filename: '123456-EL-SPC-2623 (IFR) - Title.pdf', reason: 'Missing revision' },
  { filename: '123456-EL-SPC-2623_ (IFR) - Title.pdf', reason: 'Empty revision' },
  { filename: '123456-EL-SPC-2623_A () - Title.pdf', reason: 'Empty status' },
  { filename: '123456-EL-SPC-2623_A (IFR) - .pdf', reason: 'Empty title' },
];

/** Transmittal folder names */
export const VALID_FOLDERS = [
  {
    foldername: '2025-10-31_123456-EM-SUB-0001 (IFR) - General Arrangement for Review',
    parsed: { date: '2025-10-31', trackingNumber: '123456-EM-SUB-0001', status: 'IFR', title: 'General Arrangement for Review' },
  },
  {
    foldername: '2025-10-31_123456-EL-TRN-0043 (IFC) - Electrical Design Issued For Construction',
    parsed: { date: '2025-10-31', trackingNumber: '123456-EL-TRN-0043', status: 'IFC', title: 'Electrical Design Issued For Construction' },
  },
  {
    foldername: '2025-10-31_123456-ME-RFI-0024 (IFR) - Mechanical Room Size RFI',
    parsed: { date: '2025-10-31', trackingNumber: '123456-ME-RFI-0024', status: 'IFR', title: 'Mechanical Room Size RFI' },
  },
  {
    foldername: '2025-11-12_123456-ME-RFI-0024 (IFU) - Mechanical Room Size RFI',
    parsed: { date: '2025-11-12', trackingNumber: '123456-ME-RFI-0024', status: 'IFU', title: 'Mechanical Room Size RFI' },
  },
];

/**
 * Expected revision sort order (letters before numbers, drafts before finals).
 * This documents the canonical behavior -- tests should verify each tool's
 * compareRevisions() matches this order.
 */
export const REVISION_SORT_ORDER = [
  '~A',       // draft of A
  'A',        // final A
  'A+B1',     // backup material for A
  'A+C1',     // comments to A
  'A+~C2',    // draft of second comments to A
  'A+C2',     // second comments to A
  'A+N1',     // notes for A
  'A+Q1',     // quality check for A
  '~B',       // draft of B
  'B',        // final B
  '0',        // first construction issue
  '1',        // construction revision
  '2',        // for record
];
