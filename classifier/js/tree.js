/**
 * Folder Tree Module
 * Handles folder tree rendering and multi-select
 */
(function() {
    'use strict';

    /**
     * Render the folder tree
     */
    function render() {
        const container = window.app.dom.folderTree;
        container.innerHTML = '';

        if (window.app.folderTree.length === 0) {
            container.innerHTML = '<div class="empty-state">No folders found</div>';
            return;
        }

        window.app.folderTree.forEach(folder => {
            const element = createFolderElement(folder);
            container.appendChild(element);
        });

        updateSelectedCount();
    }

    /**
     * Create a folder element
     */
    function createFolderElement(folder, level = 0) {
        const div = document.createElement('div');
        
        const item = document.createElement('div');
        item.className = 'folder-item';
        item.dataset.path = folder.path;
        item.style.paddingLeft = `${level * 1.5}rem`;

        // Check if selected
        if (window.app.selectedFolders.has(folder.path)) {
            item.classList.add('selected');
        }

        // Toggle button (if has children)
        const toggle = document.createElement('span');
        toggle.className = 'folder-toggle';
        if (folder.children && folder.children.length > 0) {
            toggle.textContent = folder.expanded ? '▼' : '▶';
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const recursive = e.ctrlKey || e.metaKey;
                toggleFolder(folder, recursive);
            });
        } else {
            toggle.textContent = ' ';
        }
        item.appendChild(toggle);

        // Folder icon (different for ZIP files)
        const icon = document.createElement('span');
        icon.className = 'folder-icon';
        if (folder.isZipRoot) {
            icon.innerHTML = '&#128230;';  // 📦
        } else if (folder.isVirtualDir) {
            icon.innerHTML = '&#128194;';  // 📂
        } else {
            icon.innerHTML = '&#128193;';  // 📁
        }
        item.appendChild(icon);

        // Folder name
        const name = document.createElement('span');
        name.className = 'folder-name';
        name.textContent = folder.name;
        item.appendChild(name);

        // File count
        const count = document.createElement('span');
        count.className = 'folder-count';
        count.textContent = `(${folder.fileCount || 0})`;
        item.appendChild(count);
        
        // Extract button for ZIP roots
        if (folder.isZipRoot) {
            const extractBtn = document.createElement('button');
            extractBtn.className = 'btn btn-sm zip-extract-btn';
            extractBtn.textContent = '📤 Extract';
            extractBtn.title = 'Extract ZIP contents to folder';
            extractBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await handleExtractZip(folder);
            });
            item.appendChild(extractBtn);
        }
        
        // Extract All button for folders with ZIP descendants (but not ZIP roots themselves)
        if (!folder.isZipRoot && !folder.isVirtualDir) {
            const zipCount = countZipDescendants(folder);
            if (zipCount > 0) {
                const extractAllBtn = document.createElement('button');
                extractAllBtn.className = 'btn btn-sm zip-extract-all-btn';
                extractAllBtn.textContent = `📤 Extract All (${zipCount})`;
                extractAllBtn.title = `Extract all ${zipCount} ZIP file(s) in this folder`;
                extractAllBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await handleExtractAllZips(folder);
                });
                item.appendChild(extractAllBtn);
            }
        }

        // Click handler for selection
        item.addEventListener('click', (e) => {
            handleFolderClick(folder, e);
        });

        div.appendChild(item);

        // Children (if expanded)
        if (folder.expanded && folder.children && folder.children.length > 0) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'folder-children';
            folder.children.forEach(child => {
                const childElement = createFolderElement(child, level + 1);
                childrenDiv.appendChild(childElement);
            });
            div.appendChild(childrenDiv);
        }

        return div;
    }

    /**
     * Handle folder click with multi-select support
     */
    function handleFolderClick(folder, event) {
        if (event.ctrlKey || event.metaKey) {
            // Ctrl+Click: Toggle selection
            if (window.app.selectedFolders.has(folder.path)) {
                window.app.selectedFolders.delete(folder.path);
            } else {
                window.app.selectedFolders.add(folder.path);
            }
        } else if (event.shiftKey) {
            // Shift+Click: Range selection
            const visibleFolders = getVisibleFolders();
            const currentIndex = visibleFolders.findIndex(f => f.path === folder.path);
            
            if (currentIndex >= 0 && window.app.lastSelectedFolderPath) {
                const lastIndex = visibleFolders.findIndex(f => f.path === window.app.lastSelectedFolderPath);
                
                if (lastIndex >= 0) {
                    const start = Math.min(currentIndex, lastIndex);
                    const end = Math.max(currentIndex, lastIndex);
                    
                    // Select range
                    for (let i = start; i <= end; i++) {
                        window.app.selectedFolders.add(visibleFolders[i].path);
                    }
                }
            } else {
                window.app.selectedFolders.add(folder.path);
            }
        } else {
            // Normal click: Single selection
            window.app.selectedFolders.clear();
            window.app.selectedFolders.add(folder.path);
        }

        // Remember last selected for shift-click
        window.app.lastSelectedFolderPath = folder.path;

        // Re-render tree
        render();

        // Load files from selected folders
        loadFilesFromSelectedFolders();
    }

    /**
     * Handle ZIP extraction
     */
    async function handleExtractZip(folder) {
        if (!folder.isZipRoot || !folder.zipPath) return;
        
        try {
            const confirmed = confirm(`Extract "${folder.name}" to a new folder?\n\nThis will create a folder named "${folder.name.replace(/\.zip$/i, '')}" with the ZIP contents.`);
            if (!confirmed) return;
            
            // Show extracting state
            const btn = document.querySelector(`.folder-item[data-path="${folder.path}"] .zip-extract-btn`);
            if (btn) {
                btn.textContent = '⏳ Extracting...';
                btn.disabled = true;
            }
            
            await window.app.modules.scanner.extractZip(folder.zipPath);
            
            // Auto-refresh preserving tree state
            await window.app.modules.scanner.scanDirectory(window.app.rootHandle, true);
        } catch (err) {
            console.error('Error extracting ZIP:', err);
            alert('Error extracting ZIP: ' + err.message);
            
            // Reset button
            const btn = document.querySelector(`.folder-item[data-path="${folder.path}"] .zip-extract-btn`);
            if (btn) {
                btn.textContent = '📤 Extract';
                btn.disabled = false;
            }
        }
    }
    
    /**
     * Count ZIP descendants in a folder
     */
    function countZipDescendants(folder) {
        let count = 0;
        if (folder.children) {
            for (const child of folder.children) {
                if (child.isZipRoot) {
                    count++;
                }
                count += countZipDescendants(child);
            }
        }
        return count;
    }
    
    /**
     * Get all ZIP folders as flat list
     */
    function getZipDescendants(folder, zips = []) {
        if (folder.children) {
            for (const child of folder.children) {
                if (child.isZipRoot) {
                    zips.push(child);
                }
                getZipDescendants(child, zips);
            }
        }
        return zips;
    }
    
    /**
     * Handle extracting all ZIPs in a folder
     */
    async function handleExtractAllZips(folder) {
        const zips = getZipDescendants(folder);
        if (zips.length === 0) return;
        
        const confirmed = confirm(`Extract ${zips.length} ZIP file(s)?\n\nThis will create folders for each ZIP with their contents.`);
        if (!confirmed) return;
        
        try {
            // Show extracting state on button
            const btn = document.querySelector(`.folder-item[data-path="${folder.path}"] .zip-extract-all-btn`);
            if (btn) {
                btn.textContent = '⏳ Extracting...';
                btn.disabled = true;
            }
            
            // Extract all ZIPs
            for (const zip of zips) {
                if (zip.zipPath) {
                    await window.app.modules.scanner.extractZip(zip.zipPath);
                }
            }
            
            // Auto-refresh preserving tree state
            await window.app.modules.scanner.scanDirectory(window.app.rootHandle, true);
        } catch (err) {
            console.error('Error extracting ZIPs:', err);
            alert('Error extracting ZIPs: ' + err.message);
            
            // Reset button
            const btn = document.querySelector(`.folder-item[data-path="${folder.path}"] .zip-extract-all-btn`);
            if (btn) {
                btn.textContent = `📤 Extract All (${zips.length})`;
                btn.disabled = false;
            }
        }
    }

    /**
     * Toggle folder expansion
     */
    function toggleFolder(folder, recursive = false) {
        folder.expanded = !folder.expanded;
        
        if (recursive && folder.children) {
            // Recursively expand/collapse all children
            const newState = folder.expanded;
            function setAllExpanded(f) {
                f.expanded = newState;
                if (f.children) {
                    f.children.forEach(setAllExpanded);
                }
            }
            folder.children.forEach(setAllExpanded);
        }
        
        render();
    }

    /**
     * Load files from all selected folders
     */
    async function loadFilesFromSelectedFolders() {
        // Use store to manage files
        window.app.modules.store.setSelectedFolders(Array.from(window.app.selectedFolders));
    }

    /**
     * Find folder by path in tree
     */
    function findFolderByPath(path) {
        function search(folders) {
            for (const folder of folders) {
                if (folder.path === path) {
                    return folder;
                }
                if (folder.children) {
                    const found = search(folder.children);
                    if (found) return found;
                }
            }
            return null;
        }
        return search(window.app.folderTree);
    }

    /**
     * Update selected folders count
     */
    function updateSelectedCount() {
        const count = window.app.selectedFolders.size;
        window.app.dom.selectedFoldersCount.textContent = 
            `${count} folder${count !== 1 ? 's' : ''} selected`;
    }

    /**
     * Build folder tree from scanned data
     */
    function buildTree(rootHandle, foldersMap) {
        const tree = [];
        
        // Convert flat map to tree structure
        function buildNode(handle, path) {
            // For virtual folders, look up by path string; for real folders, use handle
            let files;
            if (handle.isVirtualDir || handle.isZipRoot) {
                files = foldersMap.get(handle.virtualPath || handle.zipPath) || [];
            } else {
                files = foldersMap.get(handle) || [];
            }
            
            // Add folderPath to each file for folder highlighting (filter out null files)
            files.filter(file => file !== null).forEach(file => {
                if (!file.isDirectory) {
                    file.folderPath = path;
                }
            });
            
            // Filter out null files for the node
            const validFiles = files.filter(f => f !== null);
            
            const node = {
                name: handle.name,
                path: path,
                handle: handle,
                files: validFiles,
                fileCount: validFiles.length,
                children: [],
                expanded: false
            };
            
            // Mark ZIP-related nodes
            if (handle.isZipRoot) {
                node.isZipRoot = true;
                node.zipPath = handle.zipPath;
            }
            if (handle.isVirtualDir) {
                node.isVirtualDir = true;
                node.zipPath = handle.zipPath;
            }
            
            return node;
        }

        // Recursively build tree
        function addChildren(node) {
            // Get subdirectories (filter out null files first)
            // For virtual folders, look up by path string
            let files;
            if (node.handle.isVirtualDir || node.handle.isZipRoot) {
                files = foldersMap.get(node.handle.virtualPath || node.handle.zipPath) || [];
            } else {
                files = foldersMap.get(node.handle) || [];
            }
            const validFiles = files.filter(f => f !== null);
            const subdirs = validFiles.filter(f => f.isDirectory);
            
            subdirs.forEach(subdir => {
                const childPath = node.path + '/' + subdir.handle.name;
                const childNode = buildNode(subdir.handle, childPath);
                addChildren(childNode);
                node.children.push(childNode);
            });
            
            // Update file count to exclude directories and null files
            node.files = validFiles.filter(f => !f.isDirectory);
            node.fileCount = node.files.length;
        }

        // Build root
        const root = buildNode(rootHandle, rootHandle.name);
        addChildren(root);
        
        // Expand root by default
        root.expanded = true;
        
        tree.push(root);
        return tree;
    }

    /**
     * Get all currently visible folders (expanded tree)
     */
    function getVisibleFolders() {
        const visible = [];
        
        function traverse(folders) {
            for (const folder of folders) {
                visible.push(folder);
                if (folder.expanded && folder.children) {
                    traverse(folder.children);
                }
            }
        }
        
        traverse(window.app.folderTree);
        return visible;
    }

    /**
     * Select all visible folders
     */
    function selectAllVisible() {
        const visible = getVisibleFolders();
        window.app.selectedFolders.clear();
        visible.forEach(f => window.app.selectedFolders.add(f.path));
        render();
        loadFilesFromSelectedFolders();
    }

    /**
     * Expand all folders in tree
     */
    function expandAll() {
        function setAllExpanded(folder) {
            folder.expanded = true;
            if (folder.children) {
                folder.children.forEach(setAllExpanded);
            }
        }
        
        window.app.folderTree.forEach(setAllExpanded);
        render();
    }

    /**
     * Select all folders in tree
     */
    function selectAll() {
        function collectAllPaths(folders, paths = []) {
            folders.forEach(folder => {
                paths.push(folder.path);
                if (folder.children) {
                    collectAllPaths(folder.children, paths);
                }
            });
            return paths;
        }
        
        const allPaths = collectAllPaths(window.app.folderTree);
        allPaths.forEach(path => window.app.selectedFolders.add(path));
        
        render();
        loadFilesFromSelectedFolders();
    }

    /**
     * Set up keyboard shortcuts for folder tree
     */
    function setupKeyboardShortcuts() {
        const container = window.app.dom.folderTree;
        
        container.addEventListener('keydown', (e) => {
            // Ctrl+A: Select all visible
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                selectAllVisible();
            }
        });
        
        // Make container focusable
        container.tabIndex = 0;
    }

    // Export module
    window.app.modules.tree = {
        render,
        buildTree,
        loadFilesFromSelectedFolders,
        setupKeyboardShortcuts,
        expandAll,
        selectAll
    };
})();
