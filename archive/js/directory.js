// Directory selection and scanning functionality

// Add directory
async function addDirectory() {
    try {
        const dirHandle = await window.showDirectoryPicker();
        
        // Check if already added
        const exists = APP_STATE.directories.some(d => d.name === dirHandle.name);
        if (exists) {
            alert('This directory has already been added.');
            return;
        }
        
        // Add to directories
        APP_STATE.directories.push({
            handle: dirHandle,
            name: dirHandle.name,
            path: dirHandle.name // Root path
        });
        
        // Hide empty state if this is the first directory
        if (APP_STATE.directories.length === 1) {
            hideEmptyState();
        }
        
        // Scan the new directory
        await scanDirectory(dirHandle, dirHandle.name);
        
        updateUI();
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Error selecting directory:', err);
            alert('Error selecting directory: ' + err.message);
        }
    }
}

// Scan directory recursively (local mode — delegates to local source in source.js)
async function scanDirectory(dirHandle, path) {
    APP_STATE.isScanning = true;
    APP_STATE.scanProgress = 'Scanning ' + path + '...';
    updateStatusBar();
    
    const source = createSource('local', {});
    
    const callbacks = {
        onGroupingFolder: function(folder) {
            APP_STATE.groupingFolders.push(folder);
        },
        onTransmittalFolder: function(folder) {
            APP_STATE.transmittalFolders.push(folder);
        },
        onFile: function(file) {
            APP_STATE.files.push(file);
        },
        onProgress: function(message) {
            APP_STATE.scanProgress = message;
            updateStatusBar();
        }
    };
    
    try {
        await source.scan(dirHandle, callbacks);
        
        // Only auto-select top-level party folders (shallowest depth)
        const groupingDepths = APP_STATE.groupingFolders.map(f => f.path.split('/').length);
        const minGroupingDepth = groupingDepths.length > 0 ? Math.min(...groupingDepths) : 1;
        APP_STATE.groupingFolders.forEach(folder => {
            if (folder.path.split('/').length === minGroupingDepth) {
                APP_STATE.selectedGroupingFolders.add(folder.path);
            }
        });
        
        APP_STATE.transmittalFolders.forEach(folder => {
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
        console.error('Error scanning directory:', err);
        alert('Error scanning directory: ' + err.message);
    } finally {
        APP_STATE.isScanning = false;
        APP_STATE.scanProgress = '';
        updateStatusBar();
    }
}

// Refresh all directories
async function refreshDirectories() {
    // Clear existing data
    APP_STATE.groupingFolders = [];
    APP_STATE.transmittalFolders = [];
    APP_STATE.files = [];
    APP_STATE.filteredFiles = [];
    
    if (APP_STATE.sourceMode === 'http') {
        // Re-scan all HTTP sources
        const dirs = APP_STATE.directories.slice();
        APP_STATE.directories = [];
        for (const dir of dirs) {
            await addHttpSource(dir.url);
        }
    } else {
        // Re-scan all local directories
        for (const dir of APP_STATE.directories) {
            await scanDirectory(dir.handle, dir.name);
        }
    }
    
    updateUI();
}

// Remove directory
function removeDirectory(dirName) {
    const index = APP_STATE.directories.findIndex(d => d.name === dirName);
    if (index !== -1) {
        APP_STATE.directories.splice(index, 1);
        
        // Remove associated folders and files
        APP_STATE.groupingFolders = APP_STATE.groupingFolders.filter(f => 
            !f.path.startsWith(dirName)
        );
        APP_STATE.transmittalFolders = APP_STATE.transmittalFolders.filter(f => 
            !f.path.startsWith(dirName)
        );
        APP_STATE.files = APP_STATE.files.filter(f => 
            !f.path.startsWith(dirName)
        );
        
        // Clean up the Outstanding virtual transmittal if no outstanding files remain
        const hasAnyOutstanding = APP_STATE.files.some(f => f.folderPath === '__outstanding__');
        if (!hasAnyOutstanding) {
            APP_STATE.transmittalFolders = APP_STATE.transmittalFolders.filter(f => f.path !== '__outstanding__');
            APP_STATE.selectedTransmittalFolders.delete('__outstanding__');
        }
        
        // Show empty state if no directories left
        if (APP_STATE.directories.length === 0) {
            showEmptyState();
        }
        
        updateUI();
    }
}

// Request permission for directory
async function requestPermission(dirHandle) {
    const options = { mode: 'read' };
    
    // Check current permission state
    if ((await dirHandle.queryPermission(options)) === 'granted') {
        return true;
    }
    
    // Request permission
    if ((await dirHandle.requestPermission(options)) === 'granted') {
        return true;
    }
    
    return false;
}
