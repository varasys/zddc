/**
 * Transmittal JSON test fixtures.
 * Matches transmittal/transmittal.schema.json (JSON Schema draft 2020-12).
 */

/** Minimal valid transmittal (required fields only) */
export const MINIMAL_TRANSMITTAL = {
  payload: {
    version: 1,
    type: 'Transmittal',
    date: '2025-10-31',
    trackingNumber: '123456-EL-TRN-0001',
    files: [
      {
        filename: '123456-EL-SPC-2623_A (IFR) - Specification For Switchgear.pdf',
        sha256: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      },
    ],
  },
  envelope: {
    version: 1,
    digestAlgorithm: 'SHA-256',
    digest: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    digestedAt: '2025-10-31T12:00:00.000Z',
    signatureAlgorithm: 'ECDSA-P256-SHA256',
  },
};

/** Full transmittal with all optional fields populated */
export const FULL_TRANSMITTAL = {
  payload: {
    version: 1,
    type: 'Transmittal',
    title: 'Electrical Design Package',
    client: 'ACME Corporation',
    project: 'New Substation',
    projectNumber: '123456',
    date: '2025-10-31',
    trackingNumber: '123456-EL-TRN-0043',
    from: 'Engineering Team',
    to: 'Construction Team',
    purpose: 'IFC',
    responseDue: '2025-11-15',
    subject: 'Electrical Design Issued For Construction',
    remarks: '## Notes\n\nPlease review the attached specifications and drawings.\n\n- Item 1\n- Item 2',
    files: [
      {
        trackingNumber: '123456-EL-SPC-2623',
        revision: 'A',
        status: 'IFC',
        title: 'Specification For Switchgear',
        path: '',
        filename: '123456-EL-SPC-2623_A (IFC) - Specification For Switchgear.pdf',
        sha256: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        fileSize: 45000,
      },
      {
        trackingNumber: '123456-EL-ARR-0003',
        revision: '0',
        status: 'IFC',
        title: 'Electrical Room Equipment Arrangement',
        path: 'drawings',
        filename: '123456-EL-ARR-0003_0 (IFC) - Electrical Room Equipment Arrangement.pdf',
        sha256: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
        fileSize: 500000,
      },
      {
        trackingNumber: '123456-EL-DWG-0010',
        revision: 'A',
        status: 'IFC',
        title: 'Single Line Diagram',
        path: 'drawings',
        filename: '123456-EL-DWG-0010_A (IFC) - Single Line Diagram.pdf',
        sha256: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        fileSize: 250000,
      },
    ],
  },
  envelope: {
    version: 1,
    digestAlgorithm: 'SHA-256',
    digest: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    digestedAt: '2025-10-31T14:30:00.000Z',
    signatureAlgorithm: 'ECDSA-P256-SHA256',
    signatures: [],
  },
  presentation: {
    theme: 'default',
    customCss: '',
  },
};

/** Submittal type (shows responseDue field) */
export const SUBMITTAL = {
  payload: {
    version: 1,
    type: 'Submittal',
    date: '2025-10-31',
    trackingNumber: '123456-EL-SUB-0001',
    from: 'Contractor',
    to: 'Engineer',
    purpose: 'IFA',
    responseDue: '2025-11-14',
    subject: 'Switchgear Submittal',
    files: [
      {
        trackingNumber: '123456-EL-SPC-2623',
        revision: 'A',
        status: 'IFA',
        title: 'Specification For Switchgear',
        filename: '123456-EL-SPC-2623_A (IFA) - Specification For Switchgear.pdf',
        sha256: 'f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1',
        fileSize: 45000,
      },
    ],
  },
  envelope: {
    version: 1,
    digestAlgorithm: 'SHA-256',
    digest: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    digestedAt: '2025-10-31T10:00:00.000Z',
    signatureAlgorithm: 'ECDSA-P256-SHA256',
  },
};

/** Invalid transmittal payloads for negative testing */
export const INVALID_TRANSMITTALS = [
  {
    description: 'Missing required payload.version',
    data: {
      payload: { type: 'Transmittal', date: '2025-10-31', trackingNumber: '123456-EL-TRN-0001', files: [] },
      envelope: { version: 1, digestAlgorithm: 'SHA-256', digest: 'a'.repeat(64), digestedAt: '2025-10-31T12:00:00.000Z', signatureAlgorithm: 'ECDSA-P256-SHA256' },
    },
  },
  {
    description: 'Invalid date format',
    data: {
      payload: { version: 1, type: 'Transmittal', date: '31-10-2025', trackingNumber: '123456-EL-TRN-0001', files: [] },
      envelope: { version: 1, digestAlgorithm: 'SHA-256', digest: 'a'.repeat(64), digestedAt: '2025-10-31T12:00:00.000Z', signatureAlgorithm: 'ECDSA-P256-SHA256' },
    },
  },
  {
    description: 'Tracking number with underscore',
    data: {
      payload: { version: 1, type: 'Transmittal', date: '2025-10-31', trackingNumber: '123456_EL_TRN_0001', files: [] },
      envelope: { version: 1, digestAlgorithm: 'SHA-256', digest: 'a'.repeat(64), digestedAt: '2025-10-31T12:00:00.000Z', signatureAlgorithm: 'ECDSA-P256-SHA256' },
    },
  },
  {
    description: 'Invalid SHA-256 hash (wrong length)',
    data: {
      payload: { version: 1, type: 'Transmittal', date: '2025-10-31', trackingNumber: '123456-EL-TRN-0001', files: [{ filename: 'test.pdf', sha256: 'abc123' }] },
      envelope: { version: 1, digestAlgorithm: 'SHA-256', digest: 'a'.repeat(64), digestedAt: '2025-10-31T12:00:00.000Z', signatureAlgorithm: 'ECDSA-P256-SHA256' },
    },
  },
  {
    description: 'File with additional unexpected property',
    data: {
      payload: { version: 1, type: 'Transmittal', date: '2025-10-31', trackingNumber: '123456-EL-TRN-0001', files: [{ filename: 'test.pdf', sha256: 'a'.repeat(64), unexpected: true }] },
      envelope: { version: 1, digestAlgorithm: 'SHA-256', digest: 'a'.repeat(64), digestedAt: '2025-10-31T12:00:00.000Z', signatureAlgorithm: 'ECDSA-P256-SHA256' },
    },
  },
];
