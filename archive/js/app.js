// Main application state and initialization

// Known second-level folder type names (case-insensitive match)
const FOLDER_TYPE_NAMES = ['issued', 'received', 'mdl', 'incoming'];

const APP_STATE = {
    directories: [],          // Selected root directories
    groupingFolders: [],     // Grouping folders (non-transmittal)
    transmittalFolders: [],  // Transmittal folders
    files: [],               // All files from selected folders
    filteredFiles: [],       // Files after filtering
    selectedFiles: new Set(), // Selected file IDs
    
    // Source mode: 'local' (File System Access API) or 'http' (Caddy JSON browse)
    sourceMode: null,
    
    // UI state
    isScanning: false,
    scanProgress: '',
    
    // Filtering state
    globalSearch: '',
    globalSearchAST: null,
    columnFilters: {
        trackingNumber: '',
        title: '',
        revisions: ''
    },
    columnFilterASTs: {
        trackingNumber: null,
        title: null,
        revisions: null
    },
    groupingFilter: '',
    transmittalFilter: '',
    enabledFolderTypes: new Set(['issued', 'received']),  // Active second-level folder types
    
    // Sorting state
    sortField: 'trackingNumber',
    sortDirection: 'asc',
    
    // Selected folders
    selectedGroupingFolders: new Set(),
    selectedTransmittalFolders: new Set(),
    
    // Collapsed date groups in transmittal folders
    collapsedDateGroups: new Set(),
    
    // Collapsed grouping folders (for tree view)
    collapsedGroupingFolders: new Set(),
    
    // Auto-select all folders mode
    selectAllGroupingFolders: true,
    selectAllTransmittals: true,
    
    // Revision modifier filter (e.g., base, +B, +C, +N, +Q)
    availableModifiers: new Set(),     // Populated during scan
    selectedModifiers: new Set(),      // Which modifiers to show (all by default)
    
    // Filter to show only selected files
    showSelectedOnly: false
};

// Initialize application
function initApp() {
    // Detect source mode from protocol
    APP_STATE.sourceMode = (location.protocol === 'file:') ? 'local' : 'http';
    
    if (APP_STATE.sourceMode === 'local') {
        // Check File System Access API support (local mode only)
        if (!('showDirectoryPicker' in window)) {
            showUnsupportedBrowserMessage();
            return;
        }
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Set up file link handlers (event delegation)
    setupFileLinkHandlers();
    
    // Apply source-mode-specific UI adjustments
    applySourceModeUI();
    
    // Initialize UI
    updateUI();
    
    // Show initial sort indicator
    updateSortIndicators();
    
    if (APP_STATE.sourceMode === 'http') {
        // Auto-connect to the server in HTTP mode
        autoConnectHttpSource();
    } else {
        // Show empty state if no directories (local mode)
        if (APP_STATE.directories.length === 0) {
            showEmptyState();
        }
    }
}

// Apply UI differences based on source mode
function applySourceModeUI() {
    // "Add Local Directory" button is always visible in both modes —
    // in HTTP mode the user can augment the online archive with local directories.
}

// Auto-connect to the HTTP server
// Derives the base URL from the current page's location
async function autoConnectHttpSource() {
    var href = window.location.href;
    // Strip query string and fragment
    href = href.split('?')[0].split('#')[0];
    // Strip the filename to get the directory
    var lastSlash = href.lastIndexOf('/');
    var baseUrl = (lastSlash >= 0) ? href.substring(0, lastSlash + 1) : href + '/';
    
    await addHttpSource(baseUrl);
}

// Add an HTTP source root (analogous to addDirectory() for local mode)
async function addHttpSource(baseUrl) {
    // Derive a display name from the URL path
    var urlPath = baseUrl.replace(/\/$/, '');
    var rootName = urlPath.substring(urlPath.lastIndexOf('/') + 1) || urlPath;
    
    // Check if already added
    var exists = APP_STATE.directories.some(function(d) { return d.url === baseUrl; });
    if (exists) return;
    
    APP_STATE.directories.push({
        handle: null,
        name: rootName,
        path: rootName,
        url: baseUrl
    });
    
    if (APP_STATE.directories.length === 1) {
        hideEmptyState();
    }
    
    await scanHttpSource(baseUrl, rootName);
    updateUI();
}

// Scan an HTTP source root
async function scanHttpSource(baseUrl, rootName) {
    APP_STATE.isScanning = true;
    APP_STATE.scanProgress = 'Connecting to server...';
    updateStatusBar();
    
    var source = createSource('http', { baseUrl: baseUrl });
    
    var fileCount = 0;
    var callbacks = {
        onGroupingFolder: function(folder) {
            APP_STATE.groupingFolders.push(folder);
        },
        onTransmittalFolder: function(folder) {
            APP_STATE.transmittalFolders.push(folder);
        },
        onFile: function(file) {
            APP_STATE.files.push(file);
            fileCount++;
            // Throttled progress update — don't update DOM on every file
            if (fileCount % 10 === 0) {
                APP_STATE.scanProgress = 'Scanning\u2026 ' + fileCount + ' files found';
                updateStatusBar();
            }
        },
        onProgress: function() { /* no-op: parallel scan — spinner is enough */ }
    };
    
    try {
        await source.scan(baseUrl, callbacks);
        
        // Auto-select top-level party folders (shallowest depth)
        var groupingDepths = APP_STATE.groupingFolders.map(function(f) { return f.path.split('/').length; });
        var minGroupingDepth = groupingDepths.length > 0 ? Math.min.apply(null, groupingDepths) : 1;
        APP_STATE.groupingFolders.forEach(function(folder) {
            if (folder.path.split('/').length === minGroupingDepth) {
                APP_STATE.selectedGroupingFolders.add(folder.path);
            }
        });
        
        APP_STATE.transmittalFolders.forEach(function(folder) {
            if (!isUnderHiddenFolderType(folder.path)) {
                APP_STATE.selectedTransmittalFolders.add(folder.path);
            }
        });
        
        ensureOutstandingTransmittal();
        // Auto-select Outstanding if selectAllTransmittals is active
        if (APP_STATE.selectAllTransmittals) {
            APP_STATE.selectedTransmittalFolders.add('__outstanding__');
        }
        
        collectModifiers();
        updateUI();
        applyFilters();
    } catch (err) {
        console.error('Error scanning HTTP source:', err);
        showHttpErrorState(err.message);
    } finally {
        APP_STATE.isScanning = false;
        APP_STATE.scanProgress = '';
        updateStatusBar();
    }
}

// Ensure the Outstanding virtual transmittal exists if there are any outstanding files.
// Called after each scan completes. Idempotent — safe to call multiple times.
function ensureOutstandingTransmittal() {
    const hasOutstanding = APP_STATE.files.some(f => f.folderPath === '__outstanding__');
    const alreadyExists = APP_STATE.transmittalFolders.some(f => f.path === '__outstanding__');
    if (hasOutstanding && !alreadyExists) {
        APP_STATE.transmittalFolders.push({
            name: 'Outstanding',
            path: '__outstanding__',
            displayPath: 'Outstanding',
            handle: null,
            url: null,
            isVirtual: true
        });
    }
}

// Show error state when HTTP server is unreachable
function showHttpErrorState(message) {
    var el = document.getElementById('noDirectoryMessage');
    if (!el) return;
    var content = el.querySelector('.empty-state-content');
    if (content) {
        content.innerHTML =
            '<h2>Could not connect to server</h2>' +
            '<p>The archive browser could not retrieve the directory listing from the server.</p>' +
            '<p><strong>Error:</strong> ' + escapeHtml(message || 'Unknown error') + '</p>' +
            '<p>Ensure the server is running, CORS is not blocking the request, and Caddy\'s file browsing is enabled.</p>';
    }
    el.classList.remove('hidden');
}

// Show unsupported browser message
function showUnsupportedBrowserMessage() {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-content">
                <h2>Browser Not Supported</h2>
                <p>This application requires a Chromium-based browser (Chrome, Edge, Brave) with File System Access API support.</p>
                <p>Please use one of these browsers to access the Archive Browser.</p>
            </div>
        </div>
    `;
}

// Show empty state
function showEmptyState() {
    document.getElementById('noDirectoryMessage').classList.remove('hidden');
    document.querySelector('.main-container').style.display = 'none';
    // Keep header visible
    document.querySelector('.app-header').style.display = '';
    var refreshBtn = document.getElementById('refreshHeaderBtn');
    if (refreshBtn) { refreshBtn.classList.add('hidden'); }
}

// Hide empty state
function hideEmptyState() {
    document.getElementById('noDirectoryMessage').classList.add('hidden');
    document.querySelector('.main-container').style.display = '';
    var refreshBtn = document.getElementById('refreshHeaderBtn');
    if (refreshBtn) { refreshBtn.classList.remove('hidden'); }
}

// Update UI based on current state
function updateUI() {
    renderFolderTypeBar();
    renderFolderLists();
    updateFileTable();
    updateStatusBar();
}

// Render folder lists (rebuilds DOM)
function renderFolderLists() {
    renderGroupingFolders();
    renderTransmittalFolders();
}

// Check if a folder path is under a hidden folder type
// Returns true if any path segment is a known folder type that is NOT currently enabled
function isUnderHiddenFolderType(path) {
    const parts = path.toLowerCase().split('/');
    return parts.some(part =>
        FOLDER_TYPE_NAMES.includes(part) && !APP_STATE.enabledFolderTypes.has(part)
    );
}

// Get filtered grouping folders (single source of truth for filtering logic)
function getFilteredGroupingFolders() {
    const filter = APP_STATE.groupingFilter;
    
    return APP_STATE.groupingFolders.filter(folder => {
        if (isUnderHiddenFolderType(folder.path)) {
            return false;
        }
        
        if (!filter) return true;
        
        const terms = parseSearchTerms(filter);
        return matchesSearchTerms(folder.name.toLowerCase(), terms);
    });
}

// Render grouping folders as a flat list of party names (depth 1 only)
function renderGroupingFolders() {
    const container = document.getElementById('groupingFoldersList');

    // Get filtered grouping folders (uses shared filtering logic)
    const filteredFolders = getFilteredGroupingFolders();

    // Only show top-level party folders (the shallowest depth among all grouping folders)
    const allDepths = APP_STATE.groupingFolders.map(f => f.path.split('/').length);
    const minDepth = allDepths.length > 0 ? Math.min(...allDepths) : 1;
    const partyFolders = filteredFolders.filter(f => f.path.split('/').length === minDepth);

    // Sort alphabetically
    partyFolders.sort((a, b) => a.path.localeCompare(b.path));

    // Build set of paths for quick lookup
    const partyPaths = new Set(partyFolders.map(f => f.path));

    // If "Select All" mode is active, auto-select all visible party folders
    if (APP_STATE.selectAllGroupingFolders) {
        APP_STATE.selectedGroupingFolders.clear();
        partyFolders.forEach(f => APP_STATE.selectedGroupingFolders.add(f.path));
    } else {
        // Remove selections for folders that are no longer visible
        for (const selectedPath of APP_STATE.selectedGroupingFolders) {
            if (!partyPaths.has(selectedPath)) {
                APP_STATE.selectedGroupingFolders.delete(selectedPath);
            }
        }
    }

    // Sync checkbox state
    const checkbox = document.getElementById('selectAllGroupingCheckbox');
    if (checkbox) checkbox.checked = APP_STATE.selectAllGroupingFolders;

    if (partyFolders.length === 0 && APP_STATE.groupingFilter) {
        container.innerHTML = '<div class="folder-list-empty">No parties match your filter</div>';
        updateFolderSelectionState('groupingFoldersList');
        return;
    }

    container.innerHTML = partyFolders.map(folder => `
        <div class="folder-item ${APP_STATE.selectedGroupingFolders.has(folder.path) ? 'selected' : ''}"
             data-path="${escapeHtml(folder.path)}"
             data-folder-type="grouping">
            <span class="folder-item-name" title="${escapeHtml(folder.path)}">${escapeHtml(folder.name)}</span>
        </div>
    `).join('');

    updateFolderSelectionState('groupingFoldersList');
}

// Render the global folder type toggle bar
function renderFolderTypeBar() {
    const bar = document.getElementById('folderTypeBar');
    if (!bar) return;

    bar.innerHTML = FOLDER_TYPE_NAMES.map(type => {
        const active = APP_STATE.enabledFolderTypes.has(type);
        const label = type.charAt(0).toUpperCase() + type.slice(1);
        return `<button class="folder-type-toggle ${active ? 'active' : ''}"
                        data-type="${type}"
                        title="Toggle ${label} folders">${label}</button>`;
    }).join('');
}

// Toggle a folder type on/off globally
function toggleFolderType(type) {
    if (APP_STATE.enabledFolderTypes.has(type)) {
        APP_STATE.enabledFolderTypes.delete(type);
    } else {
        APP_STATE.enabledFolderTypes.add(type);
    }
    renderFolderTypeBar();
    renderGroupingFolders();
    renderTransmittalFolders();
    applyFilters();
}

// Returns true if an outstanding file's actualPath is under a selected grouping folder
// that is itself visible (not hidden by folder type toggles).
function outstandingFileIsVisible(file) {
    const selectedGrouping = APP_STATE.selectedGroupingFolders;
    if (selectedGrouping.size === 0) return false;
    // The actualPath must not be under a hidden folder type
    if (isUnderHiddenFolderType(file.actualPath)) return false;
    // The actualPath must be at or under one of the selected grouping folder paths
    return Array.from(selectedGrouping).some(function(gPath) {
        return file.actualPath === gPath || file.actualPath.startsWith(gPath + '/');
    });
}

// Returns true if any outstanding (non-transmittal) files exist under the currently
// selected and visible grouping folders.
function hasVisibleOutstandingFiles() {
    return APP_STATE.files.some(function(f) {
        if (f.folderPath !== '__outstanding__') return false;
        return outstandingFileIsVisible(f);
    });
}

// Returns true if a transmittal folder is under a selected party and an enabled folder type.
// Handles both HTTP paths (party at depth 0) and local paths (party at depth 1+ due to root dir prefix).
function transmittalIsUnderVisibleParty(folder) {
    const parts = folder.path.split('/');

    // Find which segment is the party (the one that matches a selected grouping folder path prefix).
    // The party path is the selected grouping folder path, so check prefix matches.
    for (const partyPath of APP_STATE.selectedGroupingFolders) {
        const partyParts = partyPath.split('/');
        const partyDepth = partyParts.length; // e.g. 1 for HTTP ("ACME"), 2 for local ("RootDir/ACME")

        // Check that folder path starts with partyPath
        if (!folder.path.startsWith(partyPath + '/') && folder.path !== partyPath) continue;

        // The segment immediately after partyPath is either a folder type or the transmittal itself
        const remainder = folder.path.substring(partyPath.length + 1); // e.g. "Issued/2025-01-01_..." or "2025-01-01_..."
        const remainderParts = remainder.split('/');

        if (remainderParts.length >= 2) {
            // There's a folder type segment before the transmittal
            const folderType = remainderParts[0].toLowerCase();
            if (FOLDER_TYPE_NAMES.includes(folderType)) {
                // Must be an enabled type
                return APP_STATE.enabledFolderTypes.has(folderType);
            }
            // Unknown folder type — treat as visible
            return true;
        }

        // Transmittal is directly under the party (no folder type level) — always show
        return true;
    }

    // Party not selected
    return false;
}

// Render transmittal folders (rebuilds DOM)
function renderTransmittalFolders() {
    const container = document.getElementById('transmittalFoldersList');
    const filter = APP_STATE.transmittalFilter;
    
    // Filter transmittal folders based on grouping selection and name filter
    const filteredFolders = APP_STATE.transmittalFolders.filter(folder => {
        // Outstanding virtual transmittal: include if there are visible outstanding files
        if (folder.path === '__outstanding__') {
            if (!hasVisibleOutstandingFiles()) return false;
            // Apply name filter to "Outstanding" label too
            if (filter && filter.trim()) {
                const terms = parseSearchTerms(filter.trim());
                if (!matchesSearchTerms('outstanding', terms)) return false;
            }
            return true;
        }
        
        // Check name filter
        let matchesFilter = true;
        if (filter && filter.trim()) {
            const terms = parseSearchTerms(filter.trim());
            const folderText = folder.name.toLowerCase();
            matchesFilter = matchesSearchTerms(folderText, terms);
        }
        
        // If no grouping folders exist at all, show all transmittal folders (flat structure)
        if (APP_STATE.groupingFolders.length === 0) {
            return matchesFilter;
        }
        
        // If grouping folders exist but none are selected, show nothing
        if (APP_STATE.selectedGroupingFolders.size === 0) {
            return false;
        }
        
        // Check party + folder type visibility
        return matchesFilter && transmittalIsUnderVisibleParty(folder);
    });
    
    // Sort regular transmittal folders by date (newest first); Outstanding handled separately
    const regularFolders = filteredFolders.filter(f => f.path !== '__outstanding__');
    regularFolders.sort((a, b) => b.name.localeCompare(a.name));
    
    const showOutstanding = filteredFolders.some(f => f.path === '__outstanding__');
    
    // Build set of visible folder paths (for Select All and deselection logic)
    const filteredPaths = new Set(filteredFolders.map(f => f.path));
    
    // If "Select All" mode is active, auto-select all visible transmittal folders
    if (APP_STATE.selectAllTransmittals) {
        APP_STATE.selectedTransmittalFolders.clear();
        filteredFolders.forEach(f => APP_STATE.selectedTransmittalFolders.add(f.path));
    } else {
        // Remove selections for folders that are now filtered out
        for (const selectedPath of APP_STATE.selectedTransmittalFolders) {
            if (!filteredPaths.has(selectedPath)) {
                APP_STATE.selectedTransmittalFolders.delete(selectedPath);
            }
        }
    }
    
    // Sync checkbox state
    const checkbox = document.getElementById('selectAllTransmittalsCheckbox');
    if (checkbox) checkbox.checked = APP_STATE.selectAllTransmittals;
    
    // Group regular folders by date
    const foldersByDate = new Map();
    regularFolders.forEach(folder => {
        const match = folder.name.match(/^(\d{4}-\d{2}-\d{2})/);
        const date = match ? match[1] : 'Unknown';
        if (!foldersByDate.has(date)) {
            foldersByDate.set(date, []);
        }
        foldersByDate.get(date).push(folder);
    });
    
    // Build HTML
    let html = '';
    
    // Outstanding virtual transmittal — pinned at top
    if (showOutstanding) {
        const isSelected = APP_STATE.selectedTransmittalFolders.has('__outstanding__');
        html += `
            <div class="folder-item outstanding-transmittal ${isSelected ? 'selected' : ''}"
                 data-path="__outstanding__"
                 data-folder-type="transmittal"
                 title="Files in non-transmittal folders under selected grouping folders">
                <div class="transmittal-folder-content">
                    <div class="transmittal-first-line outstanding-label">⋯ Outstanding</div>
                </div>
            </div>
        `;
    }
    
    // Regular date-grouped folders
    for (const [date, folders] of foldersByDate) {
        const isCollapsed = APP_STATE.collapsedDateGroups.has(date);
        const folderCount = folders.length;
        
        html += `
            <div class="date-group-header" data-date="${escapeHtml(date)}">
                <span class="date-group-toggle">${isCollapsed ? '▶' : '▼'}</span>
                <span class="date-group-date">${escapeHtml(date)}</span>
                <span class="date-group-count">(${folderCount})</span>
            </div>
        `;
        
        if (!isCollapsed) {
            for (const folder of folders) {
                const match = folder.name.match(/^\d{4}-\d{2}-\d{2}_([^_\s]+)\s*\(([^)]+)\)\s*-\s*(.+)$/);
                let firstLine = folder.name;
                let secondLine = '';
                
                if (match) {
                    const [, tracking, status, title] = match;
                    firstLine = `${tracking} • ${status}`;
                    secondLine = title;
                }
                
                html += `
                    <div class="folder-item ${APP_STATE.selectedTransmittalFolders.has(folder.path) ? 'selected' : ''}"
                         data-path="${escapeHtml(folder.path)}"
                         data-folder-type="transmittal"
                         title="${escapeHtml(folder.path)}">
                        <div class="transmittal-folder-content">
                            <div class="transmittal-first-line">${escapeHtml(firstLine)}</div>
                            ${secondLine ? `<div class="transmittal-second-line">${escapeHtml(secondLine)}</div>` : ''}
                        </div>
                    </div>
                `;
            }
        }
    }
    
    if (filteredFolders.length === 0 && APP_STATE.transmittalFilter) {
        container.innerHTML = '<div class="folder-list-empty">No folders match your filter</div>';
        updateFolderSelectionState('transmittalFoldersList');
        updateToggleAllIcon();
        return;
    }

    container.innerHTML = html;
    
    // Ensure selection state is visually reflected after DOM rebuild
    updateFolderSelectionState('transmittalFoldersList');
    
    // Update the toggle all icon to reflect current state
    updateToggleAllIcon();
}


// Update status bar
function updateStatusBar() {
    const fileCountEl = document.getElementById('fileCount');
    const selectedCountEl = document.getElementById('selectedCount');

    // Before any directory is loaded, show a hint instead of "0 files"
    if (APP_STATE.directories.length === 0 && !APP_STATE.isScanning) {
        fileCountEl.textContent = 'Select a directory to begin';
        selectedCountEl.textContent = '';
        document.getElementById('scanStatus').textContent = '';
        document.getElementById('downloadSelectedBtn').disabled = true;
        document.getElementById('exportCsvBtn').disabled = true;
        return;
    }

    // Count unique tracking numbers
    const trackingNumbers = new Set(APP_STATE.filteredFiles.map(f => f.trackingNumber));
    const trackingCount = trackingNumbers.size;
    const fileCount = APP_STATE.filteredFiles.length;
    
    // Count files with path errors
    const pathErrorCount = APP_STATE.filteredFiles.filter(f => f.hasPathError).length;
    
    // Format: "X tracking numbers, Y files" + optional path error warning
    let countText = `${trackingCount} tracking number${trackingCount !== 1 ? 's' : ''}, ${fileCount} file${fileCount !== 1 ? 's' : ''}`;
    if (pathErrorCount > 0) {
        countText += ` (⚠️ ${pathErrorCount} inaccessible)`;
    }
    
    fileCountEl.textContent = countText;
    selectedCountEl.textContent = `${APP_STATE.selectedFiles.size} selected`;
    document.getElementById('scanStatus').textContent = APP_STATE.scanProgress;

    // Disable action buttons when nothing is selected
    const noneSelected = APP_STATE.selectedFiles.size === 0;
    document.getElementById('downloadSelectedBtn').disabled = noneSelected;
    document.getElementById('exportCsvBtn').disabled = noneSelected;
}

// Escape HTML for safe insertion
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Update folder selection visual state without rebuilding DOM
 * This is more efficient than re-rendering when only selection changes
 * @param {string} containerId - 'groupingFoldersList' or 'transmittalFoldersList'
 */
function updateFolderSelectionState(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`Container not found: ${containerId}`);
        return;
    }
    
    const selectedSet = containerId === 'groupingFoldersList' ? 
        APP_STATE.selectedGroupingFolders : 
        APP_STATE.selectedTransmittalFolders;
    
    // Update selected class on existing elements
    container.querySelectorAll('.folder-item').forEach(item => {
        const path = item.getAttribute('data-path');
        if (path) {
            item.classList.toggle('selected', selectedSet.has(path));
        }
    });
}

// Extract modifier type from revision string (e.g., "2+B1" -> "+B", "2" -> "base")
function getModifierType(revision) {
    if (!revision) return 'base';
    const match = revision.match(/\+([A-Za-z])/);
    return match ? '+' + match[1].toUpperCase() : 'base';
}

// Collect all unique modifiers from files
function collectModifiers() {
    APP_STATE.availableModifiers.clear();
    
    APP_STATE.files.forEach(file => {
        const modType = getModifierType(file.revision);
        APP_STATE.availableModifiers.add(modType);
    });
    
    // Select all by default
    APP_STATE.selectedModifiers = new Set(APP_STATE.availableModifiers);
    
    // Update the dropdown UI
    renderModifierDropdown();
}

// Render the modifier dropdown options
function renderModifierDropdown() {
    const list = document.getElementById('modifierFilterList');
    if (!list) return;
    
    // Sort modifiers: "base" first, then alphabetically
    const sorted = Array.from(APP_STATE.availableModifiers).sort((a, b) => {
        if (a === 'base') return -1;
        if (b === 'base') return 1;
        return a.localeCompare(b);
    });
    
    let html = '';
    sorted.forEach(mod => {
        const checked = APP_STATE.selectedModifiers.has(mod) ? 'checked' : '';
        const label = mod === 'base' ? 'Base (no modifier)' : mod;
        const labelClass = mod === 'base' ? 'modifier-base' : 'modifier-type';
        html += `
            <div class="modifier-filter-item">
                <label>
                    <input type="checkbox" 
                           data-modifier="${mod}" 
                           ${checked}
                           onchange="toggleModifierFilter('${mod}')">
                    <span class="${labelClass}">${label}</span>
                </label>
            </div>
        `;
    });
    
    list.innerHTML = html;
    updateModifierSelectAll();
    updateModifierButtonLabel();
}

// Toggle a specific modifier filter
function toggleModifierFilter(mod) {
    if (APP_STATE.selectedModifiers.has(mod)) {
        APP_STATE.selectedModifiers.delete(mod);
    } else {
        APP_STATE.selectedModifiers.add(mod);
    }
    updateModifierSelectAll();
    updateModifierButtonLabel();
    applyFilters();
}

// Toggle all modifiers
function toggleAllModifiers(selectAll) {
    if (selectAll) {
        APP_STATE.selectedModifiers = new Set(APP_STATE.availableModifiers);
    } else {
        APP_STATE.selectedModifiers.clear();
    }
    renderModifierDropdown();
    applyFilters();
}

// Update the "Select All" checkbox state
function updateModifierSelectAll() {
    const selectAllCheckbox = document.getElementById('modifierSelectAll');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = APP_STATE.selectedModifiers.size === APP_STATE.availableModifiers.size;
        selectAllCheckbox.indeterminate = APP_STATE.selectedModifiers.size > 0 && 
                                          APP_STATE.selectedModifiers.size < APP_STATE.availableModifiers.size;
    }
}

// Update button label to show filter status
function updateModifierButtonLabel() {
    const btn = document.getElementById('modifierFilterBtn');
    if (!btn) return;
    
    const total = APP_STATE.availableModifiers.size;
    const selected = APP_STATE.selectedModifiers.size;
    
    if (selected === total) {
        btn.textContent = 'Modifiers ▼';
    } else if (selected === 0) {
        btn.textContent = 'Modifiers (none) ▼';
    } else {
        btn.textContent = `Modifiers (${selected}/${total}) ▼`;
    }
}

// Toggle modifier dropdown visibility
function toggleModifierDropdown() {
    const dropdown = document.getElementById('modifierFilterDropdown');
    dropdown.classList.toggle('hidden');
}

// Update the Folders icon button state based on active visibility toggles
function updateFolderVisibilityBtnLabel() {
    // replaced by renderFolderTypeBar()
}

// Check if a file passes the modifier filter
function filePassesModifierFilter(file) {
    const modType = getModifierType(file.revision);
    return APP_STATE.selectedModifiers.has(modType);
}

// Toggle filter to show only selected files
function toggleFilterSelected() {
    APP_STATE.showSelectedOnly = !APP_STATE.showSelectedOnly;
    
    // Update button visual state and label
    const btn = document.getElementById('filterSelectedBtn');
    if (APP_STATE.showSelectedOnly) {
        btn.classList.add('btn-active');
        btn.textContent = 'Show All';
    } else {
        btn.classList.remove('btn-active');
        btn.textContent = 'Filter Selected';
    }
    
    applyFilters();
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initApp);
