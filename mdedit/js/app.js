/**
 * Global application state and constants
 */

// Check if File System Access API is available
const hasFileSystemAccess = 'showDirectoryPicker' in window;

// Directory and file handles
let directoryHandle = null;
let fileTree = {};
let currentFileHandle = null;

// Map to store editor instances for each file
// Key: file path, Value: { editor, container, tocContainer, etc. }
const editorInstances = new Map();

// Current TOC max depth (1-6)
let tocMaxDepth = 3;

// Scratchpad ID constant
const SCRATCHPAD_ID = '__scratchpad__';
