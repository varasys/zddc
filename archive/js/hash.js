// SHA-256 hashing and cache management

const HASH_CACHE_FILENAME = '.hashes.json';

// Calculate SHA-256 hash for a file
async function calculateFileHash(file) {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Load hash cache for a directory
async function loadHashCache(dirHandle) {
    try {
        const cacheHandle = await dirHandle.getFileHandle(HASH_CACHE_FILENAME);
        const cacheFile = await cacheHandle.getFile();
        const cacheText = await cacheFile.text();
        return JSON.parse(cacheText);
    } catch (err) {
        // Cache doesn't exist or can't be read
        return {};
    }
}

// Save hash cache for a directory
async function saveHashCache(dirHandle, cache) {
    try {
        const cacheHandle = await dirHandle.getFileHandle(HASH_CACHE_FILENAME, { create: true });
        const writable = await cacheHandle.createWritable();
        await writable.write(JSON.stringify(cache, null, 2));
        await writable.close();
        return true;
    } catch (err) {
        console.warn('Unable to save hash cache:', err);
        return false;
    }
}

// Hash files in a directory with caching
async function hashDirectoryFiles(dirHandle, files) {
    const cache = await loadHashCache(dirHandle);
    const updatedCache = {};
    const results = {};
    
    for (const fileInfo of files) {
        try {
            const file = await fileInfo.handle.getFile();
            const cacheKey = file.name;
            const lastModified = file.lastModified;
            
            // Check if we have a cached hash
            if (cache[cacheKey] && cache[cacheKey].lastModified === lastModified) {
                // Use cached hash
                results[fileInfo.id] = cache[cacheKey].hash;
                updatedCache[cacheKey] = cache[cacheKey];
            } else {
                // Calculate new hash
                const hash = await calculateFileHash(file);
                results[fileInfo.id] = hash;
                updatedCache[cacheKey] = {
                    hash: hash,
                    lastModified: lastModified,
                    size: file.size
                };
            }
        } catch (err) {
            console.error(`Error hashing file ${fileInfo.name}:`, err);
        }
    }
    
    // Try to save updated cache
    await saveHashCache(dirHandle, updatedCache);
    
    return results;
}

// Add hash information to files
async function addHashesToFiles() {
    if (!APP_STATE.files.length) return;
    
    // Hash operations require local file handles — not available in HTTP mode
    if (APP_STATE.sourceMode === 'http') {
        console.log('Hash operations not available in HTTP mode.');
        return;
    }
    
    showProgress('Calculating file hashes...', 0, APP_STATE.files.length);
    
    try {
        // Group files by directory
        const filesByDir = {};
        APP_STATE.files.forEach(file => {
            const dirPath = file.folderPath;
            if (!filesByDir[dirPath]) {
                filesByDir[dirPath] = {
                    handle: null,
                    files: []
                };
            }
            filesByDir[dirPath].files.push(file);
        });
        
        // Find directory handles
        for (const dirPath in filesByDir) {
            const folder = APP_STATE.transmittalFolders.find(f => f.path === dirPath);
            if (folder) {
                filesByDir[dirPath].handle = folder.handle;
            }
        }
        
        // Hash files in each directory
        let processed = 0;
        for (const dirPath in filesByDir) {
            const dirInfo = filesByDir[dirPath];
            if (dirInfo.handle) {
                const hashes = await hashDirectoryFiles(dirInfo.handle, dirInfo.files);
                
                // Update file objects with hashes
                dirInfo.files.forEach(file => {
                    if (hashes[file.id]) {
                        file.hash = hashes[file.id];
                    }
                });
            }
            
            processed += dirInfo.files.length;
            showProgress('Calculating file hashes...', processed, APP_STATE.files.length);
        }
        
        hideProgress();
        
    } catch (err) {
        hideProgress();
        console.error('Error calculating hashes:', err);
    }
}

// Verify file integrity
async function verifyFileIntegrity(fileId) {
    const file = APP_STATE.files.find(f => f.id === fileId);
    if (!file || !file.hash) {
        alert('No hash available for this file.');
        return;
    }
    
    if (!file.handle) {
        alert('File integrity verification is not available in HTTP mode.');
        return;
    }
    
    try {
        const fileData = await file.handle.getFile();
        const currentHash = await calculateFileHash(fileData);
        
        if (currentHash === file.hash) {
            alert('File integrity verified. Hash matches.');
        } else {
            alert('WARNING: File has been modified! Hash does not match.');
        }
    } catch (err) {
        alert('Error verifying file: ' + err.message);
    }
}

// Export hash report
function exportHashReport() {
    const headers = ['File Path', 'SHA-256 Hash', 'Size', 'Last Modified'];
    const rows = [headers];
    
    APP_STATE.filteredFiles.forEach(file => {
        if (file.hash) {
            rows.push([
                file.path,
                file.hash,
                formatFileSize(file.size),
                new Date(file.modified).toISOString()
            ]);
        }
    });
    
    downloadFile(rowsToCSV(rows), 'file-hashes.csv', 'text/csv');
}
