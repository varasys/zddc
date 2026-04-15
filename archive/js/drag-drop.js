// Drag and drop functionality

let draggedFiles = [];
let targetGroupingFolder = null;

// Setup drag and drop
function setupDragAndDrop() {
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop zones
    ['dragenter', 'dragover'].forEach(eventName => {
        document.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        document.addEventListener(eventName, unhighlight, false);
    });
    
    // Handle drops on grouping folders (for creating transmittals)
    document.getElementById('groupingFoldersList').addEventListener('drop', handleDrop, false);
    
    // Handle drops on the main app area (for adding directories)
    document.getElementById('app').addEventListener('drop', handleAppDrop, false);
}

// Prevent default behaviors
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Highlight drop zone
function highlight(e) {
    const folderItem = e.target.closest('.folder-item');
    if (folderItem && folderItem.parentElement.id === 'groupingFoldersList') {
        folderItem.classList.add('drag-over');
    }
}

// Remove highlight
function unhighlight(e) {
    document.querySelectorAll('.drag-over').forEach(item => {
        item.classList.remove('drag-over');
    });
}

// Handle directory drop on main app area (for adding directories)
async function handleAppDrop(e) {
    // Check if this is a drop on a grouping folder (handled separately)
    const folderItem = e.target.closest('.folder-item');
    if (folderItem && folderItem.parentElement.id === 'groupingFoldersList') {
        return; // Let handleDrop handle this
    }
    
    // Check if dataTransfer has directory items
    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;
    
    // Process each dropped item
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Check if it's a directory using the File System Access API
        if (item.kind === 'file') {
            const entry = await item.getAsFileSystemHandle();
            
            if (entry && entry.kind === 'directory') {
                // Check if already added
                const exists = APP_STATE.directories.some(d => d.name === entry.name);
                if (exists) {

                    continue;
                }
                
                // Add to directories
                APP_STATE.directories.push({
                    handle: entry,
                    name: entry.name,
                    path: entry.name
                });
                
                // Hide empty state if this is the first directory
                if (APP_STATE.directories.length === 1) {
                    hideEmptyState();
                }
                
                // Scan the new directory
                await scanDirectory(entry, entry.name);
            }
        }
    }
    
    // Update UI after processing all dropped directories
    if (APP_STATE.directories.length > 0) {
        updateUI();
    }
}

// Handle file drop on grouping folder (for creating transmittals)
async function handleDrop(e) {
    const folderItem = e.target.closest('.folder-item');
    if (!folderItem) return;
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    
    // Find the grouping folder
    const folderPath = folderItem.getAttribute('data-path');
    const groupingFolder = APP_STATE.groupingFolders.find(f => f.path === folderPath);
    if (!groupingFolder) return;
    
    targetGroupingFolder = groupingFolder;
    draggedFiles = files;
    
    // Show transmittal creation dialog
    showTransmittalDialog();
}

// Show transmittal creation dialog
function showTransmittalDialog() {
    const modal = document.getElementById('dropModal');
    
    // Generate default transmittal name
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Try to extract tracking number from first file
    let trackingNumber = 'TRACKING';
    let title = 'Transmittal';
    
    if (draggedFiles.length > 0) {
        const firstFile = draggedFiles[0];
        const parsed = parseFileName(firstFile.name);
        if (parsed.trackingNumber) {
            trackingNumber = parsed.trackingNumber;
        }
        if (parsed.title) {
            title = parsed.title;
        }
    }
    
    const defaultName = `${dateStr}_${trackingNumber} (IFI) - ${title}`;
    document.getElementById('transmittalName').value = defaultName;
    
    // Show file preview
    updateFilePreview();
    
    modal.classList.remove('hidden');
}

// Update file preview in dialog
function updateFilePreview() {
    const tbody = document.getElementById('filesPreviewBody');
    
    const rows = draggedFiles.map(file => {
        const parsed = parseFileName(file.name);
        
        // Generate ZDDC-compliant name
        let newName = file.name;
        if (parsed.trackingNumber) {
            newName = `${parsed.trackingNumber}_${parsed.revision || 'A'} (${parsed.status || 'IFI'}) - ${parsed.title}.${parsed.extension}`;
        }
        
        const isValid = !!parsed.trackingNumber;
        
        return `
            <tr>
                <td>${escapeHtml(file.name)}</td>
                <td>
                    <input type="text" 
                           class="form-input" 
                           value="${escapeHtml(newName)}"
                           data-original="${escapeHtml(file.name)}"
                           style="width: 100%;">
                </td>
                <td style="color: ${isValid ? 'green' : 'red'};">
                    ${isValid ? '✓ Valid' : '✗ Invalid'}
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = rows;
}

// Confirm transmittal creation
async function confirmTransmittal() {
    const transmittalName = document.getElementById('transmittalName').value.trim();
    
    // Validate transmittal folder name
    if (!isTransmittalFolder(transmittalName)) {
        alert('Invalid transmittal folder name. Must follow format: YYYY-MM-DD_TRACKINGNUMBER (STATUS) - TITLE');
        return;
    }
    
    try {
        // Create transmittal folder
        const transmittalHandle = await targetGroupingFolder.handle.getDirectoryHandle(transmittalName, { create: true });
        
        // Get file mappings from preview
        const fileMappings = [];
        const inputs = document.querySelectorAll('#filesPreviewBody input');
        inputs.forEach((input, index) => {
            fileMappings.push({
                originalFile: draggedFiles[index],
                newName: input.value.trim()
            });
        });
        
        // Save files with new names
        for (const mapping of fileMappings) {
            const fileHandle = await transmittalHandle.getFileHandle(mapping.newName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(mapping.originalFile);
            await writable.close();
        }
        
        // Close modal
        document.getElementById('dropModal').classList.add('hidden');
        
        // Refresh to show new files
        await refreshDirectories();
        
        alert(`Transmittal created successfully with ${fileMappings.length} files.`);
        
    } catch (err) {
        console.error('Error creating transmittal:', err);
        alert('Error creating transmittal: ' + err.message);
    }
}

// Handle drag and drop on table rows (for metadata copy)
function setupTableRowDragDrop() {
    document.getElementById('filesTableBody').addEventListener('dragover', (e) => {
        const tr = e.target.closest('tr');
        if (tr) {
            e.preventDefault();
            tr.classList.add('drag-over');
        }
    });
    
    document.getElementById('filesTableBody').addEventListener('dragleave', (e) => {
        const tr = e.target.closest('tr');
        if (tr) {
            tr.classList.remove('drag-over');
        }
    });
    
    document.getElementById('filesTableBody').addEventListener('drop', async (e) => {
        const tr = e.target.closest('tr');
        if (!tr) return;
        
        tr.classList.remove('drag-over');
        
        // Get tracking number and title from the row
        const trackingNumber = tr.querySelector('td[data-field="trackingNumber"]').textContent;
        const title = tr.querySelector('td[data-field="title"]').textContent;
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;
        
        // For table row drops, just copy metadata
        alert(`Would copy metadata:\nTracking Number: ${trackingNumber}\nTitle: ${title}\n\nTo ${files.length} file(s)`);
    });
}
