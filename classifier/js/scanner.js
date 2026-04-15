/**
 * Directory Scanner Module
 * Scans directories and collects files
 */
(function() {
    'use strict';
    
    // Store ZIP data for later access
    const zipCache = new Map();  // path -> { zip: JSZip, fileHandle: FileSystemFileHandle }

    /**
     * Scan directory and build folder tree with files
     */
    async function scanDirectory(dirHandle, preserveState = false) {

        
        // Save current state if preserving
        let savedExpanded = new Set();
        let savedSelected = new Set();
        if (preserveState) {
            savedExpanded = getExpandedPaths(window.app.folderTree);
            savedSelected = new Set(window.app.selectedFolders);
        }
        
        // Clear ZIP cache
        zipCache.clear();
        
        // Map to store files by folder handle (or ZIP path for virtual folders)
        const foldersMap = new Map();
        
        // Recursively scan
        await scanFolder(dirHandle, foldersMap, dirHandle.name);
        
        // Build tree structure
        window.app.folderTree = window.app.modules.tree.buildTree(dirHandle, foldersMap);
        
        // Set in store
        window.app.modules.store.setFolderTree(window.app.folderTree);
        
        if (preserveState) {
            // Restore expanded state
            restoreExpandedPaths(window.app.folderTree, savedExpanded);
            // Restore selection
            window.app.selectedFolders = savedSelected;
            // Render without changing selection
            window.app.modules.tree.render();
            window.app.modules.store.setSelectedFolders(savedSelected);
        } else {
            // Render tree
            window.app.modules.tree.render();
            // Auto-expand and select all folders
            window.app.modules.tree.expandAll();
            window.app.modules.tree.selectAll();
        }
        

    }
    
    /**
     * Get all expanded folder paths from tree
     */
    function getExpandedPaths(folders, paths = new Set()) {
        for (const folder of folders) {
            if (folder.expanded) {
                paths.add(folder.path);
            }
            if (folder.children) {
                getExpandedPaths(folder.children, paths);
            }
        }
        return paths;
    }
    
    /**
     * Restore expanded state to tree
     */
    function restoreExpandedPaths(folders, expandedPaths) {
        for (const folder of folders) {
            folder.expanded = expandedPaths.has(folder.path);
            if (folder.children) {
                restoreExpandedPaths(folder.children, expandedPaths);
            }
        }
    }

    /**
     * Recursively scan a folder
     */
    async function scanFolder(dirHandle, foldersMap, currentPath) {
        const items = [];
        
        try {
            for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file') {
                    // Create file object
                    const file = await createFileObject(entry, dirHandle);
                    if (file) {
                        items.push(file);
                        
                        // Check if it's a ZIP file - scan its contents
                        if (file.extension.toLowerCase() === '.zip' && typeof JSZip !== 'undefined') {
                            await scanZipFile(file, foldersMap, currentPath, items);
                        }
                    }
                } else if (entry.kind === 'directory') {
                    // Add directory reference
                    items.push({
                        handle: entry,
                        isDirectory: true
                    });
                    
                    // Recursively scan subdirectory
                    const childPath = currentPath + '/' + entry.name;
                    await scanFolder(entry, foldersMap, childPath);
                }
            }
        } catch (err) {
            console.error('Error scanning folder:', dirHandle.name, err);
        }
        
        // Store files for this folder
        foldersMap.set(dirHandle, items);
    }
    
    /**
     * Scan a ZIP file and add its contents as virtual folders
     */
    async function scanZipFile(zipFileObj, foldersMap, parentPath, parentItems) {
        try {
            const fileObj = await zipFileObj.handle.getFile();
            const arrayBuffer = await fileObj.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            
            const zipPath = parentPath + '/' + zipFileObj.originalFilename + zipFileObj.extension;
            
            // Cache the ZIP for later extraction
            zipCache.set(zipPath, {
                zip: zip,
                fileHandle: zipFileObj.handle,
                folderHandle: zipFileObj.folderHandle
            });
            
            // Mark the file as a ZIP container
            zipFileObj.isZipContainer = true;
            zipFileObj.zipPath = zipPath;
            
            // Build virtual folder structure from ZIP contents
            const virtualFolders = new Map();  // path -> { files: [], subdirs: Set }
            virtualFolders.set(zipPath, { files: [], subdirs: new Set() });
            
            zip.forEach((relativePath, zipEntry) => {
                if (zipEntry.dir) {
                    // It's a directory
                    const dirPath = zipPath + '/' + relativePath.replace(/\/$/, '');
                    if (!virtualFolders.has(dirPath)) {
                        virtualFolders.set(dirPath, { files: [], subdirs: new Set() });
                    }
                    // Add to parent's subdirs
                    const parentDir = dirPath.substring(0, dirPath.lastIndexOf('/'));
                    if (virtualFolders.has(parentDir)) {
                        virtualFolders.get(parentDir).subdirs.add(dirPath);
                    }
                } else {
                    // It's a file
                    const fileName = relativePath.split('/').pop();
                    const fileDir = relativePath.includes('/') 
                        ? zipPath + '/' + relativePath.substring(0, relativePath.lastIndexOf('/'))
                        : zipPath;
                    
                    // Ensure parent directories exist
                    ensureVirtualPath(virtualFolders, zipPath, fileDir);
                    
                    // Create virtual file object
                    const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : '';
                    const nameWithoutExt = ext ? fileName.substring(0, fileName.length - ext.length) : fileName;
                    
                    const virtualFile = {
                        originalFilename: nameWithoutExt,
                        extension: ext,
                        size: zipEntry._data ? zipEntry._data.uncompressedSize : 0,
                        lastModified: zipEntry.date ? zipEntry.date.getTime() : Date.now(),
                        
                        // Virtual file markers
                        isVirtual: true,
                        zipPath: zipPath,
                        zipEntryPath: relativePath,
                        
                        // Editable fields
                        tracking: '',
                        revision: '',
                        status: '',
                        title: '',
                        
                        // State
                        isDirty: false,
                        error: false,
                        errorMessage: '',
                        validation: null,
                        sha256: null
                    };
                    
                    virtualFolders.get(fileDir).files.push(virtualFile);
                }
            });
            
            // Convert virtual folders to format compatible with tree builder
            // Create a virtual handle for the ZIP root
            const zipVirtualHandle = {
                name: zipFileObj.originalFilename + zipFileObj.extension,
                kind: 'directory',
                isZipRoot: true,
                zipPath: zipPath
            };
            
            // Store virtual folder data
            buildVirtualFolderMap(virtualFolders, zipPath, foldersMap, zipVirtualHandle);
            
            // Add ZIP as a virtual directory in parent
            parentItems.push({
                handle: zipVirtualHandle,
                isDirectory: true,
                isZipRoot: true
            });
            
        } catch (err) {
            console.error('Error scanning ZIP file:', zipFileObj.originalFilename, err);
        }
    }
    
    /**
     * Ensure all parent directories exist in virtual folder map
     */
    function ensureVirtualPath(virtualFolders, zipPath, targetPath) {
        if (virtualFolders.has(targetPath)) return;
        
        const parts = targetPath.substring(zipPath.length + 1).split('/').filter(p => p);
        let currentPath = zipPath;
        
        for (const part of parts) {
            const parentPath = currentPath;
            currentPath = currentPath + '/' + part;
            
            if (!virtualFolders.has(currentPath)) {
                virtualFolders.set(currentPath, { files: [], subdirs: new Set() });
            }
            
            if (virtualFolders.has(parentPath)) {
                virtualFolders.get(parentPath).subdirs.add(currentPath);
            }
        }
    }
    
    /**
     * Build virtual folder entries for the foldersMap
     * Uses path strings as keys for virtual folders to avoid object reference issues
     */
    function buildVirtualFolderMap(virtualFolders, zipPath, foldersMap, zipVirtualHandle) {
        const rootData = virtualFolders.get(zipPath);
        if (!rootData) return;
        
        // Create items array for ZIP root
        const rootItems = [...rootData.files];
        
        // Add subdirectories
        for (const subdirPath of rootData.subdirs) {
            const subdirName = subdirPath.split('/').pop();
            const subdirHandle = {
                name: subdirName,
                kind: 'directory',
                isVirtualDir: true,
                virtualPath: subdirPath,
                zipPath: zipPath
            };
            rootItems.push({
                handle: subdirHandle,
                isDirectory: true,
                isVirtualDir: true
            });
            
            // Recursively add subdir contents
            buildVirtualSubfolder(virtualFolders, subdirPath, foldersMap, zipPath);
        }
        
        // Store with both the handle object AND the path string as keys
        // This ensures lookup works regardless of which reference is used
        foldersMap.set(zipVirtualHandle, rootItems);
        foldersMap.set(zipPath, rootItems);  // Path-based key for tree building
    }
    
    /**
     * Recursively build virtual subfolder entries
     */
    function buildVirtualSubfolder(virtualFolders, folderPath, foldersMap, zipPath) {
        const folderData = virtualFolders.get(folderPath);
        if (!folderData) return;
        
        const folderName = folderPath.split('/').pop();
        const folderHandle = {
            name: folderName,
            kind: 'directory',
            isVirtualDir: true,
            virtualPath: folderPath,
            zipPath: zipPath
        };
        
        const items = [...folderData.files];
        
        // Store with path string key for tree building lookup
        foldersMap.set(folderPath, items);
        
        // Add subdirectories
        for (const subdirPath of folderData.subdirs) {
            const subdirName = subdirPath.split('/').pop();
            const subdirHandle = {
                name: subdirName,
                kind: 'directory',
                isVirtualDir: true,
                virtualPath: subdirPath,
                zipPath: zipPath
            };
            items.push({
                handle: subdirHandle,
                isDirectory: true,
                isVirtualDir: true
            });
            
            // Recursively add subdir contents
            buildVirtualSubfolder(virtualFolders, subdirPath, foldersMap, zipPath);
        }
        
        foldersMap.set(folderHandle, items);
    }
    
    /**
     * Get cached ZIP data
     */
    function getZipCache(zipPath) {
        return zipCache.get(zipPath);
    }
    
    /**
     * Extract a ZIP file to its parent directory
     */
    async function extractZip(zipPath) {
        const cached = zipCache.get(zipPath);
        if (!cached) {
            throw new Error('ZIP not found in cache');
        }
        
        const { zip, folderHandle } = cached;
        
        // Get the ZIP filename without extension for the extract folder name
        const zipName = zipPath.split('/').pop();
        const extractFolderName = zipName.replace(/\.zip$/i, '');
        
        // Create extraction folder
        const extractFolder = await folderHandle.getDirectoryHandle(extractFolderName, { create: true });
        
        // Extract all files
        const entries = [];
        zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir) {
                entries.push({ path: relativePath, entry: zipEntry });
            }
        });
        
        for (const { path, entry } of entries) {
            try {
                // Create subdirectories if needed
                const parts = path.split('/');
                const fileName = parts.pop();
                
                let currentDir = extractFolder;
                for (const part of parts) {
                    if (part) {
                        currentDir = await currentDir.getDirectoryHandle(part, { create: true });
                    }
                }
                
                // Write file
                const content = await entry.async('arraybuffer');
                const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(content);
                await writable.close();
            } catch (err) {
                console.error('Error extracting file:', path, err);
            }
        }
        
        return extractFolderName;
    }

    /**
     * Create file object with metadata
     */
    async function createFileObject(fileHandle, folderHandle) {
        try {
            const file = await fileHandle.getFile();
            const filename = file.name;
            const extension = filename.includes('.') ? 
                '.' + filename.split('.').pop() : '';
            const nameWithoutExt = extension ? 
                filename.substring(0, filename.length - extension.length) : filename;
            
            return {
                handle: fileHandle,
                folderHandle: folderHandle,
                originalFilename: nameWithoutExt,
                extension: extension,
                size: file.size,
                lastModified: file.lastModified,
                
                // Editable fields
                tracking: '',
                revision: '',
                status: '',
                title: '',
                
                // State
                isDirty: false,
                error: false,
                errorMessage: '',
                validation: null,
                sha256: null
                // folderPath will be added later in buildTree
            };
        } catch (err) {
            console.error('Error reading file:', fileHandle.name, err);
            return null;
        }
    }

    // Export module
    window.app.modules.scanner = {
        scanDirectory,
        getZipCache,
        extractZip
    };
})();

