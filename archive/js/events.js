// Event handling

// Set up all event listeners
function setupEventListeners() {
    // Header buttons
    document.getElementById('addDirectoryBtn').addEventListener('click', addDirectory);
    document.getElementById('refreshHeaderBtn').addEventListener('click', refreshDirectories);
    
    // Content area buttons
    document.getElementById('filterSelectedBtn').addEventListener('click', toggleFilterSelected);
    document.getElementById('downloadSelectedBtn').addEventListener('click', downloadSelected);
    document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
    
    // Search and filter inputs
    document.getElementById('globalSearch').addEventListener('input', debounce(handleGlobalSearch, 300));
    document.getElementById('groupingFilter').addEventListener('input', (e) => {
        APP_STATE.groupingFilter = e.target.value;
        updateUI();
    });
    
    document.getElementById('transmittalFilter').addEventListener('input', (e) => {
        APP_STATE.transmittalFilter = e.target.value;
        updateUI();
        applyFilters(); // Re-filter files when transmittal filter changes
    });
    
    // Select All Grouping Folders checkbox
    document.getElementById('selectAllGroupingCheckbox').addEventListener('change', (e) => {
        APP_STATE.selectAllGroupingFolders = e.target.checked;
        renderGroupingFolders();
        renderTransmittalFolders();
        applyFilters();
    });
    
    // Folder type toggle bar — global click delegation
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.folder-type-toggle');
        if (btn) {
            const type = btn.getAttribute('data-type');
            if (type) toggleFolderType(type);
        }
    });
    
    // Select All Transmittals checkbox
    document.getElementById('selectAllTransmittalsCheckbox').addEventListener('change', (e) => {
        APP_STATE.selectAllTransmittals = e.target.checked;
        renderTransmittalFolders();
        applyFilters();
    });
    
    // Modifier filter dropdown
    document.getElementById('modifierFilterBtn').addEventListener('click', toggleModifierDropdown);
    document.getElementById('modifierSelectAll').addEventListener('change', (e) => {
        toggleAllModifiers(e.target.checked);
    });
    
    // Close modifier dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const container = document.querySelector('.modifier-filter-container');
        const dropdown = document.getElementById('modifierFilterDropdown');
        if (container && dropdown && !container.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
    
    // Select all visible files checkbox
    document.getElementById('selectAllVisibleCheckbox').addEventListener('change', (e) => {
        e.stopPropagation();
        toggleSelectAllVisible(e.target.checked);
    });
    
    // Column filters — delegated from thead
    const thead = document.querySelector('thead');
    if (thead) {
        thead.addEventListener('input', (e) => {
            if (e.target.matches('.column-filter[data-filter-field]')) {
                const field = e.target.getAttribute('data-filter-field');
                const raw = e.target.value.trim();
                APP_STATE.columnFilters[field] = raw;
                APP_STATE.columnFilterASTs[field] = ZDDCFilter.parse(raw);
                applyFilters();
            }
        });
        thead.addEventListener('keydown', (e) => {
            if (!e.target.matches('.column-filter[data-filter-field]')) return;
            if (e.key === 'Escape') {
                e.target.value = '';
                const field = e.target.getAttribute('data-filter-field');
                APP_STATE.columnFilters[field] = '';
                APP_STATE.columnFilterASTs[field] = null;
                applyFilters();
                e.preventDefault();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const inputs = Array.from(thead.querySelectorAll('.column-filter'));
                const idx = inputs.indexOf(e.target);
                if (idx !== -1) {
                    inputs[(idx + 1) % inputs.length].focus();
                }
            }
        });
        thead.addEventListener('click', (e) => {
            if (e.target.matches('.column-filter')) {
                e.stopPropagation();
            }
        });
    }
    
    // Table sorting
    document.querySelectorAll('.sortable').forEach(th => {
        th.querySelector('.th-content').addEventListener('click', () => {
            const field = th.getAttribute('data-field');
            sortTable(field);
        });
    });
    
    // Initialize column resize
    initializeColumnResize();
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    
    // Modal backdrop clicks
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', closeModal);
    });
    
    // Drop modal buttons
    const dropModal = document.getElementById('dropModal');
    dropModal.querySelector('.modal-cancel').addEventListener('click', closeModal);
    dropModal.querySelector('.modal-confirm').addEventListener('click', confirmTransmittal);
    
    // Drag and drop (local mode only — requires write access)
    if (APP_STATE.sourceMode === 'local') {
        setupDragAndDrop();
    }
    
    // Multi-select for folders
    setupFolderMultiSelect();
    
    // Date group toggle handlers
    setupDateGroupToggles();
    
    // Grouping section collapse toggle
    setupGroupingToggle();
    
    // Resizable panes
    setupResizablePanes();
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Handle global search
function handleGlobalSearch(e) {
    const raw = e.target.value;
    APP_STATE.globalSearch = raw;
    APP_STATE.globalSearchAST = ZDDCFilter.parse(raw.trim());
    applyFilters();
}

// Handle grouping filter
function handleGroupingFilter(e) {
    APP_STATE.groupingFilter = e.target.value;
    renderGroupingFolders();
    // Re-render transmittal folders as they depend on grouping selection
    renderTransmittalFolders();
    // Re-filter files based on updated folder selections
    applyFilters();
}

// Handle transmittal filter
function handleTransmittalFilter(e) {
    APP_STATE.transmittalFilter = e.target.value;
    renderTransmittalFolders();
    // Re-filter files based on updated folder selections
    applyFilters();
}

// Close modal
function closeModal(e) {
    const modal = e.target.closest('.modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Handle keyboard shortcuts
function handleKeyboardShortcuts(e) {
    // Escape closes modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal:not(.hidden)').forEach(modal => {
            modal.classList.add('hidden');
        });
    }
    
    // Ctrl+A selects all visible files
    if (e.ctrlKey && e.key === 'a' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        toggleSelectAll();
    }
    
    // F5 refreshes
    if (e.key === 'F5') {
        e.preventDefault();
        refreshDirectories();
    }
}

// Utility: Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Multi-select handling for folder lists
function setupFolderMultiSelect() {
    let lastSelectedGroupingIndex = -1;
    let lastSelectedTransmittalIndex = -1;
    
    // Handle grouping folders
    const groupingList = document.getElementById('groupingFoldersList');
    groupingList.addEventListener('click', (e) => {
        const result = handleFolderClick(e, APP_STATE.selectedGroupingFolders, lastSelectedGroupingIndex);
        if (result !== undefined) {
            lastSelectedGroupingIndex = result;
            // Turn off "Select All" mode when user manually selects
            if (APP_STATE.selectAllGroupingFolders) {
                APP_STATE.selectAllGroupingFolders = false;
                document.getElementById('selectAllGroupingCheckbox').checked = false;
            }
            // Update selection state first
            updateFolderSelectionState('groupingFoldersList');
            // Then update transmittal folder list based on new selection
            renderTransmittalFolders();
            applyFilters(); // Re-filter files
            // Reset transmittal index since list may have changed
            lastSelectedTransmittalIndex = -1;
        }
    });
    
    // Handle transmittal folders
    const transmittalList = document.getElementById('transmittalFoldersList');
    transmittalList.addEventListener('click', (e) => {
        const result = handleFolderClick(e, APP_STATE.selectedTransmittalFolders, lastSelectedTransmittalIndex);
        if (result !== undefined) {
            lastSelectedTransmittalIndex = result;
            // Turn off "Select All" mode when user manually selects
            if (APP_STATE.selectAllTransmittals) {
                APP_STATE.selectAllTransmittals = false;
                document.getElementById('selectAllTransmittalsCheckbox').checked = false;
            }
            // Update selection state without rebuilding DOM
            updateFolderSelectionState('transmittalFoldersList');
            applyFilters(); // Update file display
        }
    });
    
    // Handle Ctrl+A for folder lists
    groupingList.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();
            selectAllVisibleFolders('grouping');
        }
    });
    
    transmittalList.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();
            selectAllVisibleFolders('transmittal');
        }
    });
    
    // Make lists focusable
    groupingList.setAttribute('tabindex', '0');
    transmittalList.setAttribute('tabindex', '0');
}

/**
 * Handle folder click with multi-select support (Shift/Ctrl)
 * @param {Event} e - Click event
 * @param {Set} selectedSet - Set of selected folder paths
 * @param {number} lastIndex - Index of last clicked item
 * @returns {number|undefined} Current index if valid click, undefined otherwise
 */
function handleFolderClick(e, selectedSet, lastIndex) {
    const folderItem = e.target.closest('.folder-item');
    if (!folderItem) return undefined;
    
    const path = folderItem.getAttribute('data-path');
    if (!path) return undefined;
    
    const container = folderItem.parentElement;
    const items = Array.from(container.children);
    const currentIndex = items.indexOf(folderItem);
    
    if (e.shiftKey && lastIndex !== -1 && lastIndex < items.length) {
        // Shift+click: select range from last to current
        e.preventDefault();
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        
        if (!e.ctrlKey) {
            selectedSet.clear();
        }
        
        for (let i = start; i <= end; i++) {
            const itemPath = items[i]?.getAttribute('data-path');
            if (itemPath) {
                selectedSet.add(itemPath);
            }
        }
    } else if (e.ctrlKey || e.metaKey) {
        // Ctrl+click: toggle individual selection
        e.preventDefault();
        if (selectedSet.has(path)) {
            selectedSet.delete(path);
        } else {
            selectedSet.add(path);
        }
    } else {
        // Regular click: clear and select single item
        selectedSet.clear();
        selectedSet.add(path);
    }
    
    return currentIndex;
}

/**
 * Toggle expand/collapse state of a grouping folder
 * @param {string} path - Folder path to toggle
 * @param {boolean} recursive - If true, also toggle all descendants
 */
function toggleGroupingFolder(path, recursive) {
    const isCurrentlyCollapsed = APP_STATE.collapsedGroupingFolders.has(path);
    
    if (recursive) {
        // Get all descendant folder paths
        const descendants = APP_STATE.groupingFolders
            .filter(f => f.path.startsWith(path + '/'))
            .map(f => f.path);
        
        if (isCurrentlyCollapsed) {
            // Expand this folder and all descendants
            APP_STATE.collapsedGroupingFolders.delete(path);
            descendants.forEach(p => APP_STATE.collapsedGroupingFolders.delete(p));
        } else {
            // Collapse this folder and all descendants
            APP_STATE.collapsedGroupingFolders.add(path);
            descendants.forEach(p => APP_STATE.collapsedGroupingFolders.add(p));
        }
    } else {
        // Just toggle this folder
        if (isCurrentlyCollapsed) {
            APP_STATE.collapsedGroupingFolders.delete(path);
        } else {
            APP_STATE.collapsedGroupingFolders.add(path);
        }
    }
    
    renderGroupingFolders();
}

// Select all visible folders
function selectAllVisibleFolders(folderType) {
    const container = folderType === 'grouping' ? 
        document.getElementById('groupingFoldersList') : 
        document.getElementById('transmittalFoldersList');
    
    const selectedSet = folderType === 'grouping' ? 
        APP_STATE.selectedGroupingFolders : 
        APP_STATE.selectedTransmittalFolders;
    
    selectedSet.clear();
    
    const items = container.querySelectorAll('.folder-item');
    items.forEach(item => {
        const path = item.getAttribute('data-path');
        if (path) {
            selectedSet.add(path);
        }
    });
    
    if (folderType === 'grouping') {
        // Update UI to reflect grouping changes
        updateUI();
        applyFilters();
    } else {
        // For transmittal folders, just update selection state
        updateFolderSelectionState('transmittalFoldersList');
        applyFilters();
    }
}

// Setup date group toggle handlers
function setupDateGroupToggles() {
    // Toggle all dates button
    const toggleAllBtn = document.getElementById('toggleAllDatesBtn');
    if (toggleAllBtn) {
        toggleAllBtn.addEventListener('click', toggleAllDateGroups);
    }
    
    // Individual date group headers (using event delegation)
    const transmittalList = document.getElementById('transmittalFoldersList');
    transmittalList.addEventListener('click', (e) => {
        const header = e.target.closest('.date-group-header');
        if (header) {
            const date = header.getAttribute('data-date');
            if (date) {
                toggleDateGroup(date);
            }
        }
    });
}

// Toggle a single date group
function toggleDateGroup(date) {
    if (APP_STATE.collapsedDateGroups.has(date)) {
        APP_STATE.collapsedDateGroups.delete(date);
    } else {
        APP_STATE.collapsedDateGroups.add(date);
    }
    renderTransmittalFolders();
    updateToggleAllIcon();
}

// Toggle all date groups
function toggleAllDateGroups() {
    const headers = document.querySelectorAll('.date-group-header');
    const allDates = Array.from(headers).map(h => h.getAttribute('data-date')).filter(Boolean);
    
    // If all are collapsed, expand all. Otherwise, collapse all.
    const allCollapsed = allDates.length > 0 && allDates.every(date => APP_STATE.collapsedDateGroups.has(date));
    
    if (allCollapsed) {
        // Expand all
        APP_STATE.collapsedDateGroups.clear();
    } else {
        // Collapse all
        allDates.forEach(date => APP_STATE.collapsedDateGroups.add(date));
    }
    
    renderTransmittalFolders();
    updateToggleAllIcon();
}

// Update the toggle all icon based on current state
function updateToggleAllIcon() {
    const icon = document.getElementById('toggleAllDatesIcon');
    if (!icon) return;
    
    const headers = document.querySelectorAll('.date-group-header');
    const allDates = Array.from(headers).map(h => h.getAttribute('data-date')).filter(Boolean);
    const allCollapsed = allDates.length > 0 && allDates.every(date => APP_STATE.collapsedDateGroups.has(date));
    
    icon.textContent = allCollapsed ? '▶' : '▼';
}

// Setup grouping section collapse toggle
function setupGroupingToggle() {
    const toggleBtn = document.getElementById('toggleGroupingBtn');
    const groupingSection = document.getElementById('groupingSection');
    const icon = document.getElementById('toggleGroupingIcon');
    
    if (toggleBtn && groupingSection && icon) {
        toggleBtn.addEventListener('click', () => {
            groupingSection.classList.toggle('collapsed');
            icon.textContent = groupingSection.classList.contains('collapsed') ? '▶' : '▼';
        });
    }
}

// Setup resizable panes
function setupResizablePanes() {
    // Resize nav sections (vertical divider between grouping and transmittal)
    const navSectionsHandle = document.querySelector('[data-resize="nav-sections"]');
    if (navSectionsHandle) {
        let isResizing = false;
        let startY = 0;
        let startHeight = 0;
        let groupingSection = null;
        
        navSectionsHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startY = e.clientY;
            groupingSection = document.getElementById('groupingSection');
            startHeight = groupingSection.offsetHeight;
            navSectionsHandle.classList.add('resizing');
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const deltaY = e.clientY - startY;
            const newHeight = startHeight + deltaY;
            
            // Set min/max heights
            if (newHeight >= 100 && newHeight <= window.innerHeight - 250) {
                groupingSection.style.flex = 'none';
                groupingSection.style.height = newHeight + 'px';
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                navSectionsHandle.classList.remove('resizing');
            }
        });
    }
    
    // Resize nav pane (horizontal divider between nav and content)
    const navPaneHandle = document.querySelector('[data-resize="nav-pane"]');
    if (navPaneHandle) {
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        let navPane = null;
        
        navPaneHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            navPane = document.getElementById('navigationPane');
            startWidth = navPane.offsetWidth;
            navPaneHandle.classList.add('resizing');
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const deltaX = e.clientX - startX;
            const newWidth = startWidth + deltaX;
            
            // Set min/max widths
            if (newWidth >= 200 && newWidth <= window.innerWidth - 400) {
                navPane.style.width = newWidth + 'px';
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                navPaneHandle.classList.remove('resizing');
            }
        });
    }
}
