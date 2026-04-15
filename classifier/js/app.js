/**
 * ZDDC Classifier - Main Application
 * Spreadsheet-based file renaming with Excel-like formulas
 */
(function() {
    'use strict';

    // Global application state
    window.app = {
        // File System
        rootHandle: null,
        
        // Data
        folderTree: [],
        selectedFolders: new Set(), // Multi-select support
        lastSelectedFolderPath: null,
        hideCompliant: false,
        calculateSha256: false,
        
        // DOM elements (populated on init)
        dom: {},
        
        // Modules (populated by other files)
        modules: {}
    };

    /**
     * Initialize the application
     */
    function init() {

        
        // Check browser compatibility
        if (!checkBrowserCompatibility()) {
            showBrowserWarning();
            return;
        }
        
        // Cache DOM elements
        cacheDOMElements();
        
        // Set up event listeners
        setupEventListeners();
        
        // Show welcome screen
        showWelcomeScreen();
        

    }

    /**
     * Check if browser supports File System Access API
     */
    function checkBrowserCompatibility() {
        return 'showDirectoryPicker' in window;
    }

    /**
     * Show browser compatibility warning
     */
    function showBrowserWarning() {
        const warning = document.getElementById('browserWarning');
        const selectBtn = document.getElementById('selectDirectoryBtn');
        if (warning) {
            warning.classList.remove('hidden');
        }
        if (selectBtn) {
            selectBtn.disabled = true;
            selectBtn.textContent = 'Browser Not Supported';
        }
    }

    /**
     * Cache DOM element references
     */
    function cacheDOMElements() {
        app.dom = {
            // Screens
            welcomeScreen: document.getElementById('welcomeScreen'),
            mainApp: document.getElementById('mainApp'),
            
            // Header buttons
            selectDirectoryBtn: document.getElementById('selectDirectoryBtn'),
            refreshBtn: document.getElementById('refreshBtn'),
            saveAllBtn: document.getElementById('saveAllBtn'),
            cancelAllBtn: document.getElementById('cancelAllBtn'),
            exportHashesBtn: document.getElementById('exportHashesBtn'),
            sha256Checkbox: document.getElementById('sha256Checkbox'),
            hideCompliantCheckbox: document.getElementById('hideCompliantCheckbox'),
            
            // Folder tree
            folderTree: document.getElementById('folderTree'),
            folderTreePane: document.getElementById('folderTreePane'),
            collapseTreeBtn: document.getElementById('collapseTreeBtn'),
            autoScrollCheckbox: document.getElementById('autoScrollCheckbox'),
            selectedFoldersCount: document.getElementById('selectedFoldersCount'),
            
            // Spreadsheet
            spreadsheet: document.getElementById('spreadsheet'),
            spreadsheetBody: document.getElementById('spreadsheetBody'),
            sha256Column: document.getElementById('sha256Column'),
            
            // Stats
            totalFiles: document.getElementById('totalFiles'),
            modifiedFiles: document.getElementById('modifiedFiles'),
            errorFiles: document.getElementById('errorFiles'),
            
            // Preview
            togglePreviewBtn: document.getElementById('togglePreviewBtn')
        };
    }

    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Directory selection
        app.dom.selectDirectoryBtn.addEventListener('click', handleSelectDirectory);
        app.dom.refreshBtn.addEventListener('click', handleRefresh);
        
        // Drag and drop on welcome screen
        setupWelcomeDragDrop();
        
        // Bulk actions
        app.dom.saveAllBtn.addEventListener('click', handleSaveAll);
        app.dom.cancelAllBtn.addEventListener('click', handleCancelAll);
        
        // Export hashes
        app.dom.exportHashesBtn.addEventListener('click', handleExportHashes);
        
        // SHA256 toggle
        app.dom.sha256Checkbox.addEventListener('change', handleSha256Toggle);
        
        // Hide compliant toggle
        app.dom.hideCompliantCheckbox.addEventListener('change', handleHideCompliantToggle);
        
        // Collapse tree button
        app.dom.collapseTreeBtn.addEventListener('click', handleCollapseTree);
        
        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyDown);
        
        // Resize handle
        setupResizeHandle();
    }
    
    /**
     * Handle collapse/expand folder tree pane
     */
    function handleCollapseTree() {
        const pane = app.dom.folderTreePane;
        const btn = app.dom.collapseTreeBtn;
        
        pane.classList.toggle('collapsed');
        
        if (pane.classList.contains('collapsed')) {
            // Clear any inline width from resize handle
            pane.style.width = '';
            btn.textContent = '▶';
            btn.title = 'Expand folder tree';
        } else {
            btn.textContent = '◀';
            btn.title = 'Collapse folder tree';
        }
    }

    /**
     * Set up folder tree resize handle
     */
    function setupResizeHandle() {
        const handle = document.getElementById('treeResizeHandle');
        const pane = document.getElementById('folderTreePane');
        
        if (!handle || !pane) return;
        
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        
        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = pane.offsetWidth;
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const delta = e.clientX - startX;
            const newWidth = startWidth + delta;
            
            // Respect min width only
            if (newWidth >= 150) {
                pane.style.width = newWidth + 'px';
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
            }
        });
    }

    /**
     * Set up drag-and-drop on the welcome screen
     */
    function setupWelcomeDragDrop() {
        const screen = app.dom.welcomeScreen;
        if (!screen) return;
        
        ['dragenter', 'dragover'].forEach(evt => {
            screen.addEventListener(evt, (e) => {
                e.preventDefault();
                screen.classList.add('drag-over');
            });
        });
        
        ['dragleave', 'drop'].forEach(evt => {
            screen.addEventListener(evt, (e) => {
                e.preventDefault();
                screen.classList.remove('drag-over');
            });
        });
        
        screen.addEventListener('drop', async (e) => {
            const item = e.dataTransfer.items && e.dataTransfer.items[0];
            if (!item) return;
            
            const handle = await item.getAsFileSystemHandle();
            if (!handle || handle.kind !== 'directory') {
                alert('Please drop a folder, not a file.');
                return;
            }
            
            await openDirectory(handle);
        });
    }

    /**
     * Handle directory selection via button click
     */
    async function handleSelectDirectory() {
        try {
            const dirHandle = await window.showDirectoryPicker();
            await openDirectory(dirHandle);
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Error selecting directory:', err);
                alert('Error selecting directory: ' + err.message);
            }
        }
    }

    /**
     * Open a directory handle and initialize the application
     */
    async function openDirectory(dirHandle) {
        app.rootHandle = dirHandle;
        
        // Hide welcome screen and show main UI
        hideWelcomeScreen();
        showMainUI();
        
        // Initialize modules BEFORE scanning (so they're ready for store updates)
        app.modules.spreadsheet.init();  // Subscribe to store
        app.modules.selection.init();
        app.modules.preview.init();  // After selection so it can listen for rowfocused
        app.modules.resize.init();
        app.modules.filter.init();
        app.modules.sort.init();
        app.modules.tree.setupKeyboardShortcuts();
        
        // Now scan directory (this will trigger store updates and renders)
        await app.modules.scanner.scanDirectory(dirHandle);
        
        // Show refresh button now that a directory is loaded
        if (app.dom.refreshBtn) { app.dom.refreshBtn.classList.remove('hidden'); }
    }

    /**
     * Handle Refresh button - rescan current directory
     */
    async function handleRefresh() {
        if (!app.rootHandle) {
            alert('No directory selected');
            return;
        }

        try {
            // Clear current data
            app.folderTree = [];
            app.selectedFolders.clear();
            app.lastSelectedFolderPath = null;
            
            // Reset store
            app.modules.store.reset();

            // Rescan directory (modules already initialized, just rescan)
            await app.modules.scanner.scanDirectory(app.rootHandle);

        } catch (err) {
            console.error('Error refreshing directory:', err);
            alert('Error refreshing directory: ' + err.message);
        }
    }

    /**
     * Handle Save All button
     */
    async function handleSaveAll() {
        if (!confirm('Save all modified files?')) return;
        
        try {
            app.dom.saveAllBtn.disabled = true;
            await app.modules.spreadsheet.saveAllFiles();
        } catch (err) {
            console.error('Error saving files:', err);
            alert('Error saving files: ' + err.message);
        } finally {
            app.dom.saveAllBtn.disabled = false;
        }
    }

    /**
     * Handle Cancel All button
     */
    function handleCancelAll() {
        if (!confirm('Cancel all changes?')) return;
        app.modules.spreadsheet.cancelAllChanges();
    }

    /**
     * Handle Export Hashes button
     */
    function handleExportHashes() {
        app.modules.excel.exportHashes();
    }

    /**
     * Handle SHA256 checkbox toggle
     */
    function handleSha256Toggle() {
        app.calculateSha256 = app.dom.sha256Checkbox.checked;
        
        // Show/hide SHA256 column
        if (app.calculateSha256) {
            app.dom.sha256Column.classList.remove('hidden');
        } else {
            app.dom.sha256Column.classList.add('hidden');
        }
        
        // Re-render table
        app.modules.spreadsheet.render();
    }

    /**
     * Handle Hide Compliant checkbox toggle
     */
    function handleHideCompliantToggle() {
        app.hideCompliant = app.dom.hideCompliantCheckbox.checked;
        app.modules.store.setHideCompliant(app.hideCompliant);
    }

    /**
     * Handle keyboard shortcuts
     */
    function handleKeyDown(e) {
        // Ctrl+S - Save All
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            if (!app.dom.saveAllBtn.disabled) {
                handleSaveAll();
            }
        }
        
        // Escape - Cancel editing
        if (e.key === 'Escape') {
            app.modules.spreadsheet.cancelEditing();
        }
    }

    /**
     * Show welcome screen (empty-state overlay)
     */
    function showWelcomeScreen() {
        if (app.dom.welcomeScreen) {
            app.dom.welcomeScreen.classList.remove('hidden');
        }
    }

    /**
     * Hide welcome screen (empty-state overlay)
     */
    function hideWelcomeScreen() {
        if (app.dom.welcomeScreen) {
            app.dom.welcomeScreen.classList.add('hidden');
        }
    }

    /**
     * Show main UI (no-op: main UI is always rendered)
     */
    function showMainUI() {
        // Main app is always visible; only the empty-state overlay is toggled
    }

    /**
     * Update stats display
     */
    function updateStats() {
        const files = app.modules.store.getDisplayFiles();
        const totalFiles = files.length;
        const modifiedFiles = files.filter(f => f.isDirty).length;
        const errorFiles = files.filter(f => f.error).length;
        
        app.dom.totalFiles.textContent = `${totalFiles} file${totalFiles !== 1 ? 's' : ''}`;
        app.dom.modifiedFiles.textContent = `${modifiedFiles} modified`;
        
        if (errorFiles > 0) {
            app.dom.errorFiles.textContent = `${errorFiles} error${errorFiles !== 1 ? 's' : ''}`;
            app.dom.errorFiles.classList.remove('hidden');
        } else {
            app.dom.errorFiles.classList.add('hidden');
        }
        
        // Enable/disable bulk action buttons
        app.dom.saveAllBtn.disabled = modifiedFiles === 0;
        app.dom.cancelAllBtn.disabled = modifiedFiles === 0;
        
        // Enable/disable export hashes button
        app.dom.exportHashesBtn.disabled = totalFiles === 0 || !app.calculateSha256;
    }

    // Export functions for use by other modules
    app.modules.app = {
        updateStats
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
