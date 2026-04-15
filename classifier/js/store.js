/**
 * Store Module
 * Single source of truth for all application state
 * Manages files, folders, sorting, filtering
 */
(function() {
    'use strict';

    // State
    const state = {
        // Directory structure
        rootHandle: null,
        folderTree: [],
        selectedFolders: new Set(),
        
        // Files
        allFiles: [],           // All files from selected folders
        displayFiles: [],       // After sorting and filtering
        
        // Sort state
        sortColumns: [],        // [{column: 'original', direction: 'asc'}]
        
        // Filter state
        filters: {},            // {columnName: AST (from ZDDCFilter.parse)}
        
        // UI state
        hideCompliant: false,
        calculateSha256: false
    };

    // Listeners for state changes
    const listeners = {
        'files': [],
        'folders': [],
        'sort': [],
        'filter': []
    };

    /**
     * Set sort columns
     */
    function on(event, callback) {
        if (listeners[event]) {
            listeners[event].push(callback);
        }
    }

    /**
     * Notify listeners of state change
     */
    function notify(event) {
        if (listeners[event]) {
            listeners[event].forEach(cb => cb());
        }
    }

    /**
     * Set root directory handle
     */
    function setRootHandle(handle) {
        state.rootHandle = handle;
    }

    /**
     * Set folder tree
     */
    function setFolderTree(tree) {
        state.folderTree = tree;
        notify('folders');
    }

    /**
     * Select/deselect folder
     */
    function toggleFolder(folderPath) {
        if (state.selectedFolders.has(folderPath)) {
            state.selectedFolders.delete(folderPath);
        } else {
            state.selectedFolders.add(folderPath);
        }
        loadFilesFromSelectedFolders();
    }

    /**
     * Select multiple folders
     */
    function setSelectedFolders(folderPaths) {
        state.selectedFolders.clear();
        folderPaths.forEach(path => state.selectedFolders.add(path));
        loadFilesFromSelectedFolders();
    }

    /**
     * Load files from selected folders
     */
    function loadFilesFromSelectedFolders() {
        state.allFiles = [];

        if (state.selectedFolders.size === 0) {
            updateDisplayFiles();
            return;
        }

        // Collect files from selected folders
        for (const folderPath of state.selectedFolders) {
            const folder = findFolderByPath(folderPath);
            if (folder && folder.files) {
                const files = folder.files.filter(f => !f.isDirectory);
                state.allFiles.push(...files);
            }
        }

        // Apply default sort if no sort set
        if (state.sortColumns.length === 0) {
            state.sortColumns = [{ column: 'original', direction: 'asc' }];
        }

        updateDisplayFiles();
    }

    /**
     * Find folder by path in tree
     */
    function findFolderByPath(path) {
        function search(folders) {
            for (const folder of folders) {
                if (folder.path === path) return folder;
                if (folder.children) {
                    const found = search(folder.children);
                    if (found) return found;
                }
            }
            return null;
        }
        return search(state.folderTree);
    }

    /**
     * Update display files (apply sort, filter, hide compliant)
     */
    function updateDisplayFiles() {
        let files = [...state.allFiles];

        // Apply filters
        files = applyFilters(files);

        // Apply hide compliant
        if (state.hideCompliant) {
            files = files.filter(file => {
                const newFilename = computeNewFilename(file);
                const validation = validateFilename(newFilename);
                return !validation.isValid;
            });
        }

        // Apply sort
        files = applySort(files);

        state.displayFiles = files;
        notify('files');
    }

    /**
     * Apply filters to files using ZDDCFilter ASTs
     */
    function applyFilters(files) {
        if (Object.keys(state.filters).length === 0) {
            return files;
        }

        return files.filter(file => {
            for (const [columnName, ast] of Object.entries(state.filters)) {
                const value = getColumnValue(file, columnName);
                if (!window.ZDDCFilter.matches(value, ast)) {
                    return false;
                }
            }
            return true;
        });
    }

    /**
     * Apply sort to files
     */
    function applySort(files) {
        if (state.sortColumns.length === 0) {
            return files;
        }

        return files.sort((a, b) => {
            for (const sort of state.sortColumns) {
                const result = compareValues(a, b, sort.column, sort.direction);
                if (result !== 0) return result;
            }
            return 0;
        });
    }

    /**
     * Compare two values for sorting
     */
    function compareValues(a, b, columnName, direction) {
        let aVal = getColumnValue(a, columnName);
        let bVal = getColumnValue(b, columnName);

        const comparison = String(aVal).localeCompare(String(bVal), undefined, {
            numeric: true,
            sensitivity: 'base'
        });

        return direction === 'asc' ? comparison : -comparison;
    }

    /**
     * Get column value from file (delegates to utils)
     */
    function getColumnValue(file, columnName) {
        // Use shared utils if available, otherwise inline
        if (window.app.modules.utils) {
            return window.app.modules.utils.getColumnValue(file, columnName);
        }
        switch (columnName) {
            case 'original': return file.originalFilename || '';
            case 'extension': return file.extension || '';
            case 'newFilename': return file.manualFilename || computeNewFilename(file);
            case 'tracking': return file.tracking || '';
            case 'revision': return file.revision || '';
            case 'status': return file.status || '';
            case 'title': return file.title || '';
            case 'sha256': return file.sha256 || '';
            default: return '';
        }
    }

    /**
     * Compute new filename from fields (delegates to utils)
     */
    function computeNewFilename(file) {
        // Use shared utils if available
        if (window.app.modules.utils) {
            return window.app.modules.utils.computeNewFilename(file);
        }
        
        if (file.manualFilename) {
            return file.manualFilename;
        }

        const tracking = (file.tracking || '').trim();
        const revision = (file.revision || '').trim();
        const status = (file.status || '').trim();
        const title = (file.title || '').trim();

        if (!tracking || !revision || !status || !title) {
            return file.originalFilename + file.extension;
        }

        return `${tracking}_${revision} (${status}) - ${title}${file.extension}`;
    }

    /**
     * Validate filename
     */
    function validateFilename(filename) {
        // Use existing validator module
        if (window.app.modules.validator) {
            return window.app.modules.validator.validateFilename(filename);
        }
        return { isValid: true, errors: [], warnings: [] };
    }

    /**
     * Match filter text against value
     */
    function matchesFilter(value, filterText) {
        // Simple contains for now - can enhance later
        return String(value).toLowerCase().includes(filterText.toLowerCase());
    }

    /**
     * Set sort columns
     */
    function setSortColumns(columns) {
        state.sortColumns = columns;
        updateDisplayFiles();
    }

    /**
     * Toggle sort on column
     */
    function toggleSort(columnName, multiSort) {
        if (!multiSort) {
            state.sortColumns = [];
        }

        const existingIndex = state.sortColumns.findIndex(s => s.column === columnName);

        if (existingIndex >= 0) {
            const current = state.sortColumns[existingIndex];
            if (current.direction === 'asc') {
                current.direction = 'desc';
            } else {
                state.sortColumns.splice(existingIndex, 1);
            }
        } else {
            state.sortColumns.push({ column: columnName, direction: 'asc' });
        }

        updateDisplayFiles();
        notify('sort');
    }

    /**
     * Set filter for column. ast is the pre-parsed ZDDCFilter AST.
     */
    function setFilter(columnName, filterText, ast) {
        if (filterText && ast && ast.length > 0) {
            state.filters[columnName] = ast;
        } else {
            delete state.filters[columnName];
        }
        updateDisplayFiles();
    }

    /**
     * Replace all filters at once. filtersObj is {columnName: rawString}.
     * Parses each value. Pass {} to clear all filters.
     */
    function setAllFilters(filtersObj) {
        state.filters = {};
        for (const [columnName, raw] of Object.entries(filtersObj)) {
            if (raw) {
                const ast = window.ZDDCFilter.parse(raw);
                if (ast && ast.length > 0) {
                    state.filters[columnName] = ast;
                }
            }
        }
        updateDisplayFiles();
    }

    /**
     * Set hide compliant flag
     */
    function setHideCompliant(hide) {
        state.hideCompliant = hide;
        updateDisplayFiles();
    }

    /**
     * Update file data
     */
    function updateFile(index, updates) {
        const file = state.displayFiles[index];
        if (!file) return;

        // Apply updates
        Object.assign(file, updates);
        
        // Mark as dirty unless explicitly set to false
        if (updates.isDirty !== false) {
            file.isDirty = true;
        }

        // Notify listeners (will trigger re-render)
        notify('files');
    }
    
    /**
     * Update file field (for editing)
     */
    function updateFileField(index, fieldName, value) {
        const file = state.displayFiles[index];
        if (!file) return;
        
        file[fieldName] = value;
        file.isDirty = true;
        file.autoPopulated = false; // Clear auto-populated flag
        
        // Notify listeners
        notify('files');
    }

    /**
     * Get display files (what should be shown in table)
     */
    function getDisplayFiles() {
        return state.displayFiles;
    }

    /**
     * Get all files (unfiltered)
     */
    function getAllFiles() {
        return state.allFiles;
    }

    /**
     * Get sort columns
     */
    function getSortColumns() {
        return state.sortColumns;
    }

    /**
     * Get selected folder count
     */
    function getSelectedFolderCount() {
        return state.selectedFolders.size;
    }

    /**
     * Get state (read-only)
     */
    function getState() {
        return {
            rootHandle: state.rootHandle,
            folderTree: state.folderTree,
            selectedFolders: Array.from(state.selectedFolders),
            allFiles: state.allFiles,
            displayFiles: state.displayFiles,
            sortColumns: state.sortColumns,
            filters: state.filters,
            hideCompliant: state.hideCompliant
        };
    }

    /**
     * Reset all state
     */
    function reset() {
        state.rootHandle = null;
        state.folderTree = [];
        state.selectedFolders.clear();
        state.allFiles = [];
        state.displayFiles = [];
        state.sortColumns = [];
        state.filters = {};
        state.hideCompliant = false;
        
        notify('files');
        notify('folders');
    }

    // Export
    window.app.modules.store = {
        on,
        notify,
        setRootHandle,
        setFolderTree,
        toggleFolder,
        setSelectedFolders,
        toggleSort,
        setFilter,
        setAllFilters,
        setHideCompliant,
        updateFile,
        updateFileField,
        getDisplayFiles,
        getAllFiles,
        getSortColumns,
        getSelectedFolderCount,
        getState,
        reset
    };
})();
