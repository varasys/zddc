/**
 * Sort Module
 * Handles multi-column sorting for the spreadsheet
 */
(function() {
    'use strict';

    // Sort state: array of {column, direction}
    let sortState = [];

    /**
     * Initialize sorting
     */
    function init() {
        const table = window.app.dom.spreadsheet;
        const headers = table.querySelectorAll('thead th');
        
        headers.forEach((th, index) => {
            // Skip row number column
            if (th.classList.contains('col-row-num')) return;
            
            // Skip if already initialized
            if (th.querySelector('.sort-indicator')) return;
            
            // Make header clickable
            th.style.cursor = 'pointer';
            th.style.userSelect = 'none';
            
            // Add sort indicator container
            const sortIndicator = document.createElement('span');
            sortIndicator.className = 'sort-indicator';
            
            // Insert after the text node (before any br or filter)
            const firstChild = th.firstChild;
            if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
                // Insert after text node
                firstChild.after(sortIndicator);
            } else {
                // Prepend to header
                th.insertBefore(sortIndicator, firstChild);
            }
            
            // Click to sort (only add once)
            const handleClick = (e) => {
                // Don't sort if clicking on resizer or filter input
                if (e.target.classList.contains('column-resizer')) return;
                if (e.target.classList.contains('column-filter')) return;
                
                const columnName = th.className.replace('col-', '');
                handleSort(columnName, e.ctrlKey || e.metaKey);
            };
            
            th.addEventListener('click', handleClick);
        });
    }

    /**
     * Apply default sort (called after initial render)
     */
    function applyDefaultSort() {
        const files = window.app.modules.store.getDisplayFiles();
        if (files.length > 0) {
            sortState = [{ column: 'original', direction: 'asc' }];
            applySorts();
            updateSortIndicators();
        }
    }

    /**
     * Handle sort click
     */
    function handleSort(columnName, multiSort) {
        // Use store to toggle sort
        window.app.modules.store.toggleSort(columnName, multiSort);
    }

    /**
     * Apply sort to files array (pure function - doesn't mutate)
     */
    function applySortToFiles(files) {
        if (sortState.length === 0) {
            return files;
        }
        
        return [...files].sort((a, b) => {
            for (const sort of sortState) {
                const result = compareValues(a, b, sort.column, sort.direction);
                if (result !== 0) return result;
            }
            return 0;
        });
    }

    /**
     * Apply all sorts (legacy - triggers render)
     */
    function applySorts() {
        window.app.modules.spreadsheet.render();
    }
    
    /**
     * Apply default sort
     */
    function applyDefaultSort() {
        const files = window.app.modules.store.getDisplayFiles();
        if (files.length > 0 && sortState.length === 0) {
            sortState = [{ column: 'original', direction: 'asc' }];
            window.app.modules.spreadsheet.render();
        }
    }
    
    /**
     * Get current sort state
     */
    function getSortState() {
        return sortState;
    }
    
    /**
     * Update sort indicators in headers
     */
    function updateIndicators() {
        const table = window.app.dom.spreadsheet;
        const headers = table.querySelectorAll('thead th');
        
        headers.forEach(th => {
            const indicator = th.querySelector('.sort-indicator');
            if (!indicator) return;
            
            const columnName = th.className.replace('col-', '');
            const sortIndex = sortState.findIndex(s => s.column === columnName);
            
            if (sortIndex >= 0) {
                const sort = sortState[sortIndex];
                const arrow = sort.direction === 'asc' ? '▲' : '▼';
                const priority = sortState.length > 1 ? (sortIndex + 1) : '';
                indicator.textContent = ` ${arrow}${priority}`;
                indicator.style.display = 'inline';
            } else {
                indicator.textContent = '';
                indicator.style.display = 'none';
            }
        });
    }

    /**
     * Compare two values for sorting
     */
    function compareValues(a, b, columnName, direction) {
        let aVal, bVal;
        
        // Get values based on column
        switch (columnName) {
            case 'original':
                aVal = a.originalFilename || '';
                bVal = b.originalFilename || '';
                break;
            case 'extension':
                aVal = a.extension || '';
                bVal = b.extension || '';
                break;
            case 'new':
            case 'newFilename':
                aVal = a.manualFilename || window.app.modules.spreadsheet.computeNewFilename(a, 0);
                bVal = b.manualFilename || window.app.modules.spreadsheet.computeNewFilename(b, 0);
                break;
            case 'tracking':
                aVal = a.tracking || '';
                bVal = b.tracking || '';
                break;
            case 'revision':
                aVal = a.revision || '';
                bVal = b.revision || '';
                break;
            case 'status':
                aVal = a.status || '';
                bVal = b.status || '';
                break;
            case 'title':
                aVal = a.title || '';
                bVal = b.title || '';
                break;
            case 'sha256':
                aVal = a.sha256 || '';
                bVal = b.sha256 || '';
                break;
            default:
                return 0;
        }
        
        // Natural sort for strings (handles numbers within strings)
        const comparison = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
        
        return direction === 'asc' ? comparison : -comparison;
    }

    /**
     * Clear all sorts
     */
    function clearSorts() {
        sortState = [];
        applySorts();
    }

    // Export module
    window.app.modules.sort = {
        init,
        applyDefaultSort,
        applySorts,
        applySortToFiles,
        updateIndicators,
        getSortState,
        clearSorts
    };
})();
