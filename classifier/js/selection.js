/**
 * Selection Module
 * Handles Excel-style cell selection and copy/paste
 */
(function() {
    'use strict';

    let selectionStart = null;
    let selectionEnd = null;
    let isSelecting = false;
    let initialized = false;
    let autoScrollInterval = null;
    let lastMouseY = 0;

    /**
     * Initialize selection handlers
     */
    function init() {
        // Only initialize once
        if (initialized) return;
        initialized = true;
        
        const table = window.app.dom.spreadsheet;
        
        // Make table focusable so clipboard events fire
        if (!table.hasAttribute('tabindex')) {
            table.setAttribute('tabindex', '-1');
            table.style.outline = 'none';
        }
        
        // Mouse down on cell - start selection
        table.addEventListener('mousedown', handleMouseDown);
        
        // Mouse move - extend selection
        document.addEventListener('mousemove', handleMouseMove);
        
        // Mouse up - end selection
        document.addEventListener('mouseup', handleMouseUp);
        
        // Copy/paste handlers
        document.addEventListener('copy', handleCopy);
        document.addEventListener('paste', handlePaste);
        document.addEventListener('cut', handleCut);
    }

    /**
     * Handle mouse down on cell
     */
    function handleMouseDown(e) {
        const cell = e.target.closest('td');
        if (!cell) return;
        
        // Ignore if clicking action buttons
        if (e.target.closest('.inline-actions')) return;
        
        // Ignore if cell is being edited (contenteditable)
        if (cell.isContentEditable || cell.classList.contains('editing')) return;
        
        // Don't start selection if double-clicking to edit
        if (e.detail === 2) return;
        
        const row = cell.closest('tr');
        if (!row) return;
        
        const rowIndex = parseInt(row.dataset.index);
        const colIndex = Array.from(row.children).indexOf(cell);
        
        // Shift+Click: extend selection from existing start to clicked cell
        if (e.shiftKey && selectionStart) {
            selectionEnd = { row: rowIndex, col: colIndex };
            updateSelection();
            updateButtonStates();
            e.preventDefault();
            return;
        }
        
        // Clear previous selection
        clearSelection();
        
        // Start new selection
        selectionStart = { row: rowIndex, col: colIndex };
        selectionEnd = { row: rowIndex, col: colIndex };
        isSelecting = true;
        
        // Highlight cell
        updateSelection();
        updateButtonStates();
        
        // Focus the table so clipboard events (Ctrl+V) fire
        window.app.dom.spreadsheet.focus();
        
        e.preventDefault();
    }

    /**
     * Handle mouse move during selection
     */
    function handleMouseMove(e) {
        if (!isSelecting) return;
        
        // Store mouse position for auto-scroll
        lastMouseY = e.clientY;
        
        const cell = e.target.closest('td');
        if (!cell) return;
        
        const row = cell.closest('tr');
        if (!row) return;
        
        const rowIndex = parseInt(row.dataset.index);
        const colIndex = Array.from(row.children).indexOf(cell);
        
        if (rowIndex === undefined || colIndex === -1) return;
        
        // Update selection end
        selectionEnd = { row: rowIndex, col: colIndex };
        
        // Highlight selected cells
        updateSelection();
        
        // Start auto-scroll if not already running
        if (!autoScrollInterval) {
            startAutoScroll();
        }
    }

    /**
     * Start continuous auto-scroll
     */
    function startAutoScroll() {
        const scrollThreshold = 50; // pixels from edge
        const scrollSpeed = 5; // pixels per frame
        
        const scroll = () => {
            if (!isSelecting) {
                autoScrollInterval = null;
                return;
            }
            
            const viewport = document.querySelector('.spreadsheet-pane');
            if (!viewport) {
                autoScrollInterval = null;
                return;
            }
            
            const rect = viewport.getBoundingClientRect();
            
            // Determine scroll direction based on last mouse position
            if (lastMouseY > rect.bottom - scrollThreshold) {
                viewport.scrollTop += scrollSpeed; // Scroll down
            } else if (lastMouseY < rect.top + scrollThreshold) {
                viewport.scrollTop -= scrollSpeed; // Scroll up
            }
            
            // Continue scrolling
            autoScrollInterval = requestAnimationFrame(scroll);
        };
        
        autoScrollInterval = requestAnimationFrame(scroll);
    }

    /**
     * Handle mouse up - end selection
     */
    function handleMouseUp(e) {
        isSelecting = false;
        
        // Stop auto-scrolling
        if (autoScrollInterval) {
            cancelAnimationFrame(autoScrollInterval);
            autoScrollInterval = null;
        }
        
        updateButtonStates();
    }

    /**
     * Update visual selection highlighting
     */
    function updateSelection() {
        if (!selectionStart || !selectionEnd) return;
        
        // Clear all previous highlights
        document.querySelectorAll('.selected-cell').forEach(cell => {
            cell.classList.remove('selected-cell');
        });
        
        // Calculate selection bounds
        const minRow = Math.min(selectionStart.row, selectionEnd.row);
        const maxRow = Math.max(selectionStart.row, selectionEnd.row);
        const minCol = Math.min(selectionStart.col, selectionEnd.col);
        const maxCol = Math.max(selectionStart.col, selectionEnd.col);
        
        // Highlight selected cells
        const tbody = window.app.dom.spreadsheetBody;
        const rows = tbody.querySelectorAll('tr');
        
        for (let r = minRow; r <= maxRow; r++) {
            const row = rows[r];
            if (!row) continue;
            
            const cells = row.children;
            for (let c = minCol; c <= maxCol; c++) {
                const cell = cells[c];
                if (cell) {
                    cell.classList.add('selected-cell');
                }
            }
        }
        
        // Emit rowfocused event for preview pane
        emitRowFocused(minRow);
    }
    
    /**
     * Emit row focused event for preview pane
     */
    function emitRowFocused(rowIndex) {
        const files = window.app.modules.store.getDisplayFiles();
        const file = files[rowIndex];
        
        if (file) {
            const event = new CustomEvent('rowfocused', {
                detail: { rowIndex, file }
            });
            document.dispatchEvent(event);
        }
    }

    /**
     * Clear selection
     */
    function clearSelection() {
        selectionStart = null;
        selectionEnd = null;
        document.querySelectorAll('.selected-cell').forEach(cell => {
            cell.classList.remove('selected-cell');
        });
        updateButtonStates();
    }

    /**
     * Check if there is an active selection
     */
    function hasSelection() {
        return selectionStart !== null && selectionEnd !== null;
    }

    /**
     * Update Copy/Paste button enabled states
     */
    function updateButtonStates() {
        const copyBtn = document.getElementById('copyBtn');
        const pasteBtn = document.getElementById('pasteBtn');
        const active = hasSelection();
        if (copyBtn) copyBtn.disabled = !active;
        if (pasteBtn) pasteBtn.disabled = !active;
    }

    /**
     * Get column headers for selected columns
     */
    function getColumnHeaders(minCol, maxCol) {
        const headerCells = window.app.dom.spreadsheet.querySelectorAll('thead th');
        const headers = [];
        for (let c = minCol; c <= maxCol; c++) {
            const th = headerCells[c];
            if (th) {
                // Get the text content, excluding filter inputs
                const text = th.childNodes[0]?.textContent?.trim() || th.textContent.trim();
                headers.push(text);
            } else {
                headers.push('');
            }
        }
        return headers;
    }

    /**
     * Check if first row looks like a header row
     */
    function isHeaderRow(row) {
        const headerPatterns = ['#', 'Original', 'Ext', 'New', 'Tracking', 'Rev', 'Status', 'Title', 'SHA256'];
        return row.some(cell => headerPatterns.includes(cell.trim()));
    }

    /**
     * Convert 2D array of rows to an HTML table string.
     * Excel prefers text/html over text/plain, so providing a
     * proper <table> ensures cell boundaries are preserved.
     */
    function rowsToHtml(allRows) {
        const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const headerRow = allRows[0];
        const dataRows = allRows.slice(1);
        let html = '<table>';
        html += '<tr>' + headerRow.map(c => '<th>' + esc(c) + '</th>').join('') + '</tr>';
        for (const row of dataRows) {
            html += '<tr>' + row.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>';
        }
        html += '</table>';
        return html;
    }

    /**
     * Handle copy event
     */
    function handleCopy(e) {
        if (!selectionStart || !selectionEnd) return;
        
        const minCol = Math.min(selectionStart.col, selectionEnd.col);
        const maxCol = Math.max(selectionStart.col, selectionEnd.col);
        
        // Get column headers for selected range
        const headers = getColumnHeaders(minCol, maxCol);
        
        const data = getSelectionData();
        if (!data) return;
        
        // Prepend header row
        const allRows = [headers, ...data];
        
        // Convert to TSV and HTML table
        const tsv = allRows.map(row => row.join('\t')).join('\n');
        
        e.clipboardData.setData('text/plain', tsv);
        e.clipboardData.setData('text/html', rowsToHtml(allRows));
        e.preventDefault();
    }

    /**
     * Handle cut event
     */
    function handleCut(e) {
        if (!selectionStart || !selectionEnd) return;
        
        const minCol = Math.min(selectionStart.col, selectionEnd.col);
        const maxCol = Math.max(selectionStart.col, selectionEnd.col);
        
        // Get column headers for selected range
        const headers = getColumnHeaders(minCol, maxCol);
        
        const data = getSelectionData();
        if (!data) return;
        
        // Prepend header row
        const allRows = [headers, ...data];
        
        // Convert to TSV
        const tsv = allRows.map(row => row.join('\t')).join('\n');
        
        e.clipboardData.setData('text/plain', tsv);
        e.clipboardData.setData('text/html', rowsToHtml(allRows));
        
        // Clear selected cells (only editable ones)
        clearSelectionData();
        
        e.preventDefault();
    }

    /**
     * Handle paste event
     */
    function handlePaste(e) {
        // Don't intercept paste in input fields
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }
        
        if (!selectionStart) return;
        
        const tsv = e.clipboardData.getData('text/plain');
        if (!tsv) return;
        
        e.preventDefault();
        executePaste(tsv);
    }

    /**
     * Execute paste from TSV string into the selected range.
     * - If pasted cols > selected cols, right-align (user likely copied all but only pastes back editable cols).
     * - If pasted data includes the first two columns (#, Original), validate they match.
     * - If pasted row count != selected row count, abort with error.
     */
    function executePaste(tsv) {
        if (!selectionStart || !selectionEnd) return;

        // Parse TSV
        let rows = tsv.split('\n').map(row => row.split('\t'));

        // Filter out empty trailing rows
        while (rows.length > 0 && rows[rows.length - 1].every(cell => !cell.trim())) {
            rows.pop();
        }
        if (rows.length === 0) return;

        // Check if first row is a header row and skip it
        if (rows.length > 1 && isHeaderRow(rows[0])) {
            rows = rows.slice(1);
        }
        if (rows.length === 0) return;

        // Selection bounds
        const minRow = Math.min(selectionStart.row, selectionEnd.row);
        const maxRow = Math.max(selectionStart.row, selectionEnd.row);
        const minCol = Math.min(selectionStart.col, selectionEnd.col);
        const maxCol = Math.max(selectionStart.col, selectionEnd.col);
        const selectedRowCount = maxRow - minRow + 1;
        const selectedColCount = maxCol - minCol + 1;
        const pastedColCount = rows[0].length;

        // Row count validation: must match
        if (rows.length !== selectedRowCount) {
            alert(`Paste aborted: row count mismatch.\n` +
                  `Selected ${selectedRowCount} row(s), but clipboard has ${rows.length} row(s).`);
            return;
        }

        // Determine column offset for right-alignment
        let colOffset = 0;
        if (pastedColCount > selectedColCount) {
            colOffset = pastedColCount - selectedColCount;
        }

        // Get column names from header
        const headerCells = window.app.dom.spreadsheet.querySelectorAll('thead th');
        const columnNames = Array.from(headerCells).map(th => {
            const match = th.className.match(/col-(\w+)/);
            return match ? match[1] : '';
        });

        // If pasted data includes first two columns (row-num, original), validate they match
        if (colOffset === 0 && pastedColCount >= selectedColCount) {
            // Check if pasted range starts at col 0 or col 1 (row-num or original)
            const files = window.app.modules.store.getDisplayFiles();
            const startsAtRowNum = (minCol === 0);
            const startsAtOriginal = (minCol === 1);

            if (startsAtRowNum || startsAtOriginal) {
                for (let r = 0; r < rows.length; r++) {
                    const targetRowIndex = minRow + r;
                    const file = files[targetRowIndex];
                    if (!file) continue;

                    if (startsAtRowNum) {
                        // Validate col 0 = row number, col 1 = original filename
                        const expectedNum = String(targetRowIndex + 1);
                        const pastedNum = rows[r][0]?.trim();
                        const pastedOriginal = rows[r][1]?.trim();
                        if (pastedNum && pastedNum !== expectedNum) {
                            alert(`Paste aborted: row number mismatch at row ${targetRowIndex + 1}.\n` +
                                  `Expected "${expectedNum}", got "${pastedNum}".\n` +
                                  `Data may be shuffled.`);
                            return;
                        }
                        if (pastedOriginal && pastedOriginal !== file.originalFilename) {
                            alert(`Paste aborted: filename mismatch at row ${targetRowIndex + 1}.\n` +
                                  `Expected "${file.originalFilename}", got "${pastedOriginal}".\n` +
                                  `Data may be shuffled.`);
                            return;
                        }
                    } else if (startsAtOriginal) {
                        // Validate col 0 of paste = original filename
                        const pastedOriginal = rows[r][0]?.trim();
                        if (pastedOriginal && pastedOriginal !== file.originalFilename) {
                            alert(`Paste aborted: filename mismatch at row ${targetRowIndex + 1}.\n` +
                                  `Expected "${file.originalFilename}", got "${pastedOriginal}".\n` +
                                  `Data may be shuffled.`);
                            return;
                        }
                    }
                }
            }
        }

        // Editable columns
        const editableColumns = ['newFilename', 'tracking', 'revision', 'status', 'title'];
        const files = window.app.modules.store.getDisplayFiles();
        let updatedCount = 0;

        for (let r = 0; r < rows.length; r++) {
            const targetRowIndex = minRow + r;
            if (targetRowIndex >= files.length) continue;
            const file = files[targetRowIndex];
            if (!file) continue;

            const rowData = rows[r];

            for (let c = 0; c < selectedColCount; c++) {
                const pasteIdx = c + colOffset; // right-align: skip leading pasted cols
                if (pasteIdx >= rowData.length) continue;

                const targetColIndex = minCol + c;
                if (targetColIndex >= columnNames.length) continue;

                const columnName = columnNames[targetColIndex];
                if (!editableColumns.includes(columnName)) continue;

                const value = rowData[pasteIdx]?.trim() || '';

                if (columnName === 'newFilename') {
                    if (value) {
                        file.manualFilename = value;
                    } else {
                        delete file.manualFilename;
                    }
                } else {
                    file[columnName] = value;
                    if (file.manualFilename) {
                        delete file.manualFilename;
                    }
                }

                file.isDirty = true;
                file.autoPopulated = false;
                updatedCount++;
            }
        }

        // Re-render and restore selection
        if (updatedCount > 0) {
            window.app.modules.spreadsheet.render();
            // Restore selection highlight
            updateSelection();
            showToast(`Pasted ${updatedCount} cell(s)`, 'success');
        }
    }

    /**
     * Show a brief toast notification
     */
    function showToast(message, type) {
        if (window.app.modules.excel && window.app.modules.excel.showToast) {
            window.app.modules.excel.showToast(message, type);
            return;
        }
        // Fallback: simple toast
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:8px 16px;' +
            'background:' + (type === 'success' ? '#28a745' : '#dc3545') + ';color:#fff;' +
            'border-radius:4px;z-index:9999;font-size:14px;';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    /**
     * Get data from selected cells
     */
    function getSelectionData() {
        if (!selectionStart || !selectionEnd) return null;
        
        const minRow = Math.min(selectionStart.row, selectionEnd.row);
        const maxRow = Math.max(selectionStart.row, selectionEnd.row);
        const minCol = Math.min(selectionStart.col, selectionEnd.col);
        const maxCol = Math.max(selectionStart.col, selectionEnd.col);
        
        const data = [];
        const tbody = window.app.dom.spreadsheetBody;
        const rows = tbody.querySelectorAll('tr');
        
        for (let r = minRow; r <= maxRow; r++) {
            const row = rows[r];
            if (!row) continue;
            
            const rowData = [];
            const cells = row.children;
            
            for (let c = minCol; c <= maxCol; c++) {
                const cell = cells[c];
                if (cell) {
                    rowData.push(cell.textContent.trim());
                } else {
                    rowData.push('');
                }
            }
            
            data.push(rowData);
        }
        
        return data;
    }

    /**
     * Clear data from selected cells (only editable ones)
     */
    function clearSelectionData() {
        if (!selectionStart || !selectionEnd) return;
        
        const minRow = Math.min(selectionStart.row, selectionEnd.row);
        const maxRow = Math.max(selectionStart.row, selectionEnd.row);
        const minCol = Math.min(selectionStart.col, selectionEnd.col);
        const maxCol = Math.max(selectionStart.col, selectionEnd.col);
        
        const tbody = window.app.dom.spreadsheetBody;
        const rows = tbody.querySelectorAll('tr');
        
        // Get column names from header
        const headerCells = window.app.dom.spreadsheet.querySelectorAll('thead th');
        const columnNames = Array.from(headerCells).map(th => {
            const className = th.className.replace('col-', '');
            return className;
        });
        
        for (let r = minRow; r <= maxRow; r++) {
            const row = rows[r];
            if (!row) continue;
            
            const rowIndex = parseInt(row.dataset.index);
            const files = window.app.modules.store.getDisplayFiles();
            const file = files[rowIndex];
            if (!file) continue;
            
            const cells = row.children;
            
            for (let c = minCol; c <= maxCol; c++) {
                const cell = cells[c];
                if (!cell || !cell.classList.contains('cell-editable')) continue;
                
                const columnName = columnNames[c];
                
                // Clear the data
                if (columnName === 'newFilename') {
                    delete file.manualFilename;
                } else {
                    file[columnName] = '';
                }
                
                file.isDirty = true;
            }
        }
        
        // Re-render
        window.app.modules.spreadsheet.render();
    }

    /**
     * Copy selection to clipboard via button click
     */
    function doCopy() {
        if (!selectionStart || !selectionEnd) return;

        const minCol = Math.min(selectionStart.col, selectionEnd.col);
        const maxCol = Math.max(selectionStart.col, selectionEnd.col);
        const headers = getColumnHeaders(minCol, maxCol);
        const data = getSelectionData();
        if (!data) return;

        const allRows = [headers, ...data];
        const tsv = allRows.map(row => row.join('\t')).join('\n');
        const html = rowsToHtml(allRows);

        // Write both plain text and HTML to clipboard
        const htmlBlob = new Blob([html], { type: 'text/html' });
        const textBlob = new Blob([tsv], { type: 'text/plain' });
        const item = new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob });

        navigator.clipboard.write([item]).then(() => {
            showToast(`Copied ${data.length} row(s)`, 'success');
        }).catch(err => {
            // Fallback to plain text if ClipboardItem not supported
            navigator.clipboard.writeText(tsv).then(() => {
                showToast(`Copied ${data.length} row(s)`, 'success');
            }).catch(err2 => {
                console.error('Copy failed:', err2);
            });
        });
    }

    /**
     * Paste from clipboard via button click
     */
    function doPaste() {
        if (!selectionStart || !selectionEnd) return;

        navigator.clipboard.readText().then(tsv => {
            if (tsv) executePaste(tsv);
        }).catch(err => {
            console.error('Paste failed:', err);
            alert('Cannot read clipboard. Use Ctrl+V instead, or grant clipboard permission.');
        });
    }

    // Export module
    window.app.modules.selection = {
        init,
        clearSelection,
        hasSelection,
        doCopy,
        doPaste
    };
})();
