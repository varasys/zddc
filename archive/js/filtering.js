// Filtering functionality

// Apply all filters
function applyFilters() {
    // Start with files from selected transmittal folders AND selected grouping folders
    let filtered = APP_STATE.files.filter(file => {
        // Must have at least one grouping folder selected (if grouping folders exist)
        if (APP_STATE.groupingFolders.length > 0 && APP_STATE.selectedGroupingFolders.size === 0) {
            return false;
        }
        
        // Must have at least one transmittal folder selected
        if (APP_STATE.selectedTransmittalFolders.size === 0) {
            return false;
        }
        
        // File must be in a selected transmittal folder
        if (!APP_STATE.selectedTransmittalFolders.has(file.folderPath)) {
            return false;
        }
        
        // Outstanding files: actualPath must be under a selected grouping folder that is
        // itself visible (not hidden by folder type toggles).
        if (file.folderPath === '__outstanding__') {
            if (!outstandingFileIsVisible(file)) return false;
        }
        
        // If grouping folders exist and are selected, the file's transmittal folder must be within one.
        // Outstanding files are exempt — their grouping scope is enforced by the actualPath check above.
        if (file.folderPath !== '__outstanding__' && APP_STATE.groupingFolders.length > 0 && APP_STATE.selectedGroupingFolders.size > 0) {
            const inSelectedGrouping = Array.from(APP_STATE.selectedGroupingFolders).some(groupingPath => 
                file.folderPath.startsWith(groupingPath + '/')
            );
            if (!inSelectedGrouping) {
                return false;
            }
        }
        
        return true;
    });
    
    // Apply global search
    if (APP_STATE.globalSearchAST && APP_STATE.globalSearchAST.length > 0) {
        filtered = applyGlobalSearch(filtered);
    }
    
    // Apply column filters
    filtered = applyColumnFilters(filtered);
    
    // Apply modifier filter
    if (APP_STATE.selectedModifiers.size < APP_STATE.availableModifiers.size) {
        filtered = filtered.filter(file => filePassesModifierFilter(file));
    }
    
    // Apply selected-only filter
    if (APP_STATE.showSelectedOnly) {
        filtered = filtered.filter(file => APP_STATE.selectedFiles.has(file.id));
    }
    
    APP_STATE.filteredFiles = filtered;
    updateFileTable();
    updateStatusBar();
    updateSelectAllVisibleCheckbox();
}

// Apply global search using stored AST
function applyGlobalSearch(files) {
    const ast = APP_STATE.globalSearchAST;
    return files.filter(file => {
        const searchableText = [
            file.trackingNumber,
            file.title,
            file.revision,
            file.status,
            file.extension,
            file.name
        ].join(' ');
        return ZDDCFilter.matches(searchableText, ast);
    });
}

// Apply column filters using stored ASTs
function applyColumnFilters(files) {
    const asts = APP_STATE.columnFilterASTs;
    
    if (asts.trackingNumber && asts.trackingNumber.length > 0) {
        files = files.filter(file =>
            ZDDCFilter.matches(file.trackingNumber || '', asts.trackingNumber)
        );
    }
    
    if (asts.title && asts.title.length > 0) {
        files = files.filter(file =>
            ZDDCFilter.matches(file.title || '', asts.title)
        );
    }
    
    if (asts.revisions && asts.revisions.length > 0) {
        files = files.filter(file => {
            const revisionText = [
                file.revision,
                file.status,
                file.extension
            ].join(' ');
            return ZDDCFilter.matches(revisionText, asts.revisions);
        });
    }
    
    return files;
}

// Clear all filters
function clearFilters() {
    APP_STATE.globalSearch = '';
    APP_STATE.globalSearchAST = null;
    APP_STATE.columnFilters = {
        trackingNumber: '',
        title: '',
        revisions: ''
    };
    APP_STATE.columnFilterASTs = {
        trackingNumber: null,
        title: null,
        revisions: null
    };
    APP_STATE.groupingFilter = '';
    APP_STATE.transmittalFilter = '';
    
    // Clear UI inputs
    document.getElementById('globalSearch').value = '';
    document.getElementById('groupingFilter').value = '';
    document.getElementById('transmittalFilter').value = '';
    document.querySelectorAll('.column-filter').forEach(input => {
        input.value = '';
    });
    
    applyFilters();
}
