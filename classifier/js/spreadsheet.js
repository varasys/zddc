/**
 * Spreadsheet Module
 * Handles table rendering, cell editing, and file operations
 */
(function() {
    'use strict';

    let editingCell = null;
    let editingInput = null;

    /**
     * Render spreadsheet from store
     */
    function render() {
        const tbody = window.app.dom.spreadsheetBody;
        tbody.innerHTML = '';

        // Get files from store (already filtered and sorted)
        const files = window.app.modules.store.getDisplayFiles();

        // Render rows
        if (files.length === 0) {
            const message = window.app.modules.store.getDisplayFiles().length === 0 
                ? '<h3>No files to display</h3><p>Select one or more folders from the tree to view files</p>'
                : '<h3>No files match filters</h3><p>Adjust or clear filters to see files</p>';
            
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="empty-state">
                        ${message}
                    </td>
                </tr>
            `;
            return;
        }

        files.forEach((file, index) => {
            const row = createRow(file, index);
            tbody.appendChild(row);
        });

        // Update UI
        window.app.modules.app.updateStats();
        updateSortIndicators();

        // Calculate SHA256 if enabled
        if (window.app.calculateSha256) {
            calculateSha256ForAll();
        }
    }

    /**
     * Update sort indicators
     */
    function updateSortIndicators() {
        const sortColumns = window.app.modules.store.getSortColumns();
        const headers = window.app.dom.spreadsheet.querySelectorAll('thead th');

        headers.forEach(th => {
            const indicator = th.querySelector('.sort-indicator');
            if (!indicator) return;

            const columnName = th.className.replace('col-', '');
            const sortIndex = sortColumns.findIndex(s => s.column === columnName);

            if (sortIndex >= 0) {
                const sort = sortColumns[sortIndex];
                const arrow = sort.direction === 'asc' ? '▲' : '▼';
                const priority = sortColumns.length > 1 ? (sortIndex + 1) : '';
                indicator.textContent = ` ${arrow}${priority}`;
                indicator.style.display = 'inline';
            } else {
                indicator.textContent = '';
                indicator.style.display = 'none';
            }
        });
    }

    /**
     * Parse filename to extract ZDDC components (delegates to utils)
     */
    function parseFilename(filename) {
        if (window.app.modules.utils) {
            return window.app.modules.utils.parseFilename(filename);
        }
        
        // Strip extension before matching so title does not include .ext
        const lastDot = filename.lastIndexOf('.');
        const extension = lastDot !== -1 ? filename.substring(lastDot + 1).toLowerCase() : '';
        const nameWithoutExt = lastDot !== -1 ? filename.substring(0, lastDot) : filename;

        const result = {
            tracking: '',
            revision: '',
            status: '',
            title: '',
            extension: extension
        };

        // Try to match ZDDC pattern: TRACKING_REV (STATUS) - TITLE
        const match = nameWithoutExt.match(/^([^_\s]+)_([^\s(]+)\s*\(([^)]+)\)\s*-\s*(.+)$/);

        if (match) {
            result.tracking = match[1].trim();
            result.revision = match[2].trim();
            result.status = match[3].trim();
            result.title = match[4].trim();
        }

        return result;
    }

    /**
     * Create a table row for a file
     */
    function createRow(file, index) {
        const row = document.createElement('tr');
        row.dataset.index = index;
        row.dataset.folderPath = file.folderPath; // Store folder path for highlighting

        // Add state classes
        if (file.isDirty) row.classList.add('modified');
        if (file.error) row.classList.add('error');
        
        // Highlight folder on hover
        row.addEventListener('mouseenter', () => {
            highlightFolder(file.folderPath);
        });
        
        row.addEventListener('mouseleave', () => {
            clearFolderHighlight();
        });

        // Row number
        row.appendChild(createCell('row-num', index + 1, false));

        // Original filename (with link to open)
        const originalCell = createCell('original', '', false);
        const link = document.createElement('a');
        link.className = 'cell-link';
        link.textContent = file.originalFilename;
        link.title = 'Click to open file';
        link.style.cursor = 'pointer';
        
        // Handle any click (left or middle or from context menu)
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            openFile(file);
        });
        
        originalCell.appendChild(link);
        row.appendChild(originalCell);

        // Extension
        row.appendChild(createCell('extension', file.extension, false));

        // New filename (computed unless manually set) with inline actions
        const newFilename = file.manualFilename || computeNewFilename(file, index);
        const newFilenameCell = createEditableCell('newFilename', newFilename, index);
        if (!file.manualFilename) {
            newFilenameCell.classList.add('computed');
        }
        
        // Validate and show errors
        const validation = window.app.modules.validator.validateFilename(newFilename);
        if (!validation.isValid) {
            newFilenameCell.classList.add('validation-error');
            newFilenameCell.title = validation.errors.join('; ');
        } else if (validation.warnings.length > 0) {
            newFilenameCell.classList.add('validation-warning');
            newFilenameCell.title = validation.warnings.join('; ');
        }
        
        // Only show action buttons if row is dirty
        if (file.isDirty) {
            const actions = document.createElement('span');
            actions.className = 'inline-actions';
            
            const saveBtn = document.createElement('button');
            saveBtn.className = 'btn-inline btn-save';
            saveBtn.textContent = '✓';
            saveBtn.title = 'Save';
            saveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                saveFile(index);
            });
            
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'btn-inline btn-cancel';
            cancelBtn.textContent = '✗';
            cancelBtn.title = 'Clear all fields';
            cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                cancelFile(index);
            });
            
            actions.appendChild(saveBtn);
            actions.appendChild(cancelBtn);
            newFilenameCell.appendChild(actions);
        }
        
        row.appendChild(newFilenameCell);

        // Auto-populate fields from filename if empty
        if (!file.tracking && !file.revision && !file.status && !file.title) {
            const parsed = parseFilename(file.originalFilename);
            file.tracking = parsed.tracking || '';
            file.revision = parsed.revision || '';
            file.status = parsed.status || '';
            file.title = parsed.title || '';
            file.autoPopulated = true;  // Mark as auto-populated
        }

        // Editable columns (with gray styling if auto-populated)
        const trackingCell = createEditableCell('tracking', file.tracking || '', index);
        const revisionCell = createEditableCell('revision', file.revision || '', index);
        const statusCell = createEditableCell('status', file.status || '', index);
        const titleCell = createEditableCell('title', file.title || '', index);
        
        if (file.autoPopulated && !file.isDirty) {
            trackingCell.classList.add('auto-populated');
            revisionCell.classList.add('auto-populated');
            statusCell.classList.add('auto-populated');
            titleCell.classList.add('auto-populated');
        }
        
        row.appendChild(trackingCell);
        row.appendChild(revisionCell);
        row.appendChild(statusCell);
        row.appendChild(titleCell);

        // SHA256 (if enabled)
        if (window.app.calculateSha256) {
            const sha256Cell = createCell('sha256', file.sha256 || 'calculating...', false);
            if (!file.sha256) {
                sha256Cell.classList.add('sha256-calculating');
            }
            row.appendChild(sha256Cell);
        }

        return row;
    }

    /**
     * Create a table cell
     */
    function createCell(className, content, editable = false) {
        const td = document.createElement('td');
        td.className = `col-${className}`;
        td.textContent = content;
        return td;
    }

    /**
     * Create an editable cell
     */
    function createEditableCell(columnName, value, rowIndex) {
        const td = document.createElement('td');
        td.className = `col-${columnName} cell-editable`;
        td.textContent = value;
        
        // Double-click to edit
        td.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            startEditing(td, columnName, rowIndex);
        });
        
        return td;
    }


    /**
     * Start editing a cell
     */
    function startEditing(cell, columnName, rowIndex) {
        // Cancel any existing edit
        if (editingCell) {
            cancelEditing();
        }

        const files = window.app.modules.store.getDisplayFiles();
        const file = files[rowIndex];
        if (!file) return;
        
        const currentValue = file[columnName] || '';

        // Clear any cell selection
        if (window.app.modules.selection) {
            window.app.modules.selection.clearSelection();
        }

        // Store references
        editingCell = { cell, columnName, rowIndex, originalValue: currentValue };

        // Save original content and make cell contenteditable
        cell.dataset.originalContent = cell.innerHTML;
        cell.contentEditable = 'true';
        cell.classList.add('editing');
        editingInput = cell;

        // Set content (text only for editing)
        cell.textContent = currentValue;

        // Focus and select all
        cell.focus();
        
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(cell);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        // Event listeners
        cell.addEventListener('blur', handleBlur, { once: true });
        cell.addEventListener('keydown', handleKeyDown);
    }

    /**
     * Handle blur event
     */
    function handleBlur() {
        // Small delay to allow click events to fire first
        setTimeout(() => finishEditing(), 100);
    }

    /**
     * Handle keydown in contenteditable
     */
    function handleKeyDown(e) {
        if (e.key === 'Enter') {
            // Enter exits edit mode
            e.preventDefault();
            finishEditing();
        } else if (e.key === 'Escape') {
            // Escape undoes and exits edit mode
            e.preventDefault();
            cancelEditing();
        } else if (e.key === 'Tab') {
            // Tab/Shift+Tab moves to next/prev cell
            e.preventDefault();
            const { rowIndex, columnName } = editingCell || {};
            const shiftKey = e.shiftKey;
            finishEditingQuiet();  // Don't trigger store update
            if (rowIndex !== undefined) {
                if (shiftKey) {
                    moveToPreviousCell(rowIndex, columnName);
                } else {
                    moveToNextCell(rowIndex, columnName);
                }
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const { rowIndex, columnName } = editingCell || {};
            finishEditingQuiet();
            if (rowIndex !== undefined) {
                moveUpRow(rowIndex, columnName);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const { rowIndex, columnName } = editingCell || {};
            finishEditingQuiet();
            if (rowIndex !== undefined) {
                moveDownRow(rowIndex, columnName);
            }
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            // Allow normal cursor movement within cell
            e.stopPropagation();
        }
    }

    /**
     * Finish editing and save value
     */
    function finishEditing() {
        if (!editingCell || !editingInput) return;

        const { cell, columnName, rowIndex } = editingCell;
        const newValue = editingInput.textContent.trim();
        const files = window.app.modules.store.getDisplayFiles();
        const file = files[rowIndex];
        if (!file) return;
        
        const oldValue = file[columnName] || '';

        // Remove contenteditable
        editingInput.contentEditable = 'false';
        editingInput.classList.remove('editing');
        editingInput.removeEventListener('keydown', handleKeyDown);

        // Update file data if changed
        if (newValue !== oldValue) {
            // Special handling for newFilename column
            if (columnName === 'newFilename') {
                if (newValue) {
                    window.app.modules.store.updateFileField(rowIndex, 'manualFilename', newValue);
                } else {
                    window.app.modules.store.updateFile(rowIndex, { manualFilename: null });
                }
            } else {
                window.app.modules.store.updateFileField(rowIndex, columnName, newValue);
            }

            const updatedFile = window.app.modules.store.getDisplayFiles()[rowIndex];
            validateFile(updatedFile);
        }

        editingCell = null;
        editingInput = null;
    }
    
    /**
     * Finish editing without triggering store update (for Tab/Arrow navigation)
     */
    function finishEditingQuiet() {
        if (!editingCell || !editingInput) return;

        const { columnName, rowIndex } = editingCell;
        const newValue = editingInput.textContent.trim();
        const files = window.app.modules.store.getDisplayFiles();
        const file = files[rowIndex];
        
        // Remove contenteditable
        editingInput.contentEditable = 'false';
        editingInput.classList.remove('editing');
        editingInput.removeEventListener('keydown', handleKeyDown);

        // Update file object directly (no store notification)
        if (file) {
            if (columnName === 'newFilename') {
                file.manualFilename = newValue || null;
            } else {
                file[columnName] = newValue;
            }
            file.isDirty = true;
        }

        editingCell = null;
        editingInput = null;
    }

    /**
     * Cancel editing without saving
     */
    function cancelEditing() {
        if (!editingCell) return;

        const { rowIndex } = editingCell;
        const files = window.app.modules.store.getDisplayFiles();
        const file = files[rowIndex];
        if (!file) return;

        // Clear editing state
        editingCell = null;
        editingInput = null;

        // Re-render the row
        const row = window.app.dom.spreadsheetBody.querySelector(`tr[data-index="${rowIndex}"]`);
        if (row) {
            const newRow = createRow(file, rowIndex);
            row.replaceWith(newRow);
        }
    }

    /**
     * Move to next editable cell
     */
    function moveToNextCell(rowIndex, currentColumn) {
        const columns = ['newFilename', 'tracking', 'revision', 'status', 'title'];
        const currentIndex = columns.indexOf(currentColumn);
        
        if (currentIndex < columns.length - 1) {
            // Next column in same row
            const nextColumn = columns[currentIndex + 1];
            const row = window.app.dom.spreadsheetBody.querySelector(`tr[data-index="${rowIndex}"]`);
            const nextCell = row.querySelector(`.col-${nextColumn}`);
            if (nextCell) {
                startEditing(nextCell, nextColumn, rowIndex);
            }
        } else if (rowIndex < window.app.modules.store.getDisplayFiles().length - 1) {
            // First column of next row
            const nextColumn = columns[0];
            const nextRow = window.app.dom.spreadsheetBody.querySelector(`tr[data-index="${rowIndex + 1}"]`);
            const nextCell = nextRow.querySelector(`.col-${nextColumn}`);
            if (nextCell) {
                startEditing(nextCell, nextColumn, rowIndex + 1);
            }
        }
    }

    /**
     * Move to previous editable cell
     */
    function moveToPreviousCell(rowIndex, currentColumn) {
        const columns = ['newFilename', 'tracking', 'revision', 'status', 'title'];
        const currentIndex = columns.indexOf(currentColumn);
        
        if (currentIndex > 0) {
            // Previous column in same row
            const prevColumn = columns[currentIndex - 1];
            const row = window.app.dom.spreadsheetBody.querySelector(`tr[data-index="${rowIndex}"]`);
            const prevCell = row.querySelector(`.col-${prevColumn}`);
            if (prevCell) {
                startEditing(prevCell, prevColumn, rowIndex);
            }
        } else if (rowIndex > 0) {
            // Last column of previous row
            const prevColumn = columns[columns.length - 1];
            const prevRow = window.app.dom.spreadsheetBody.querySelector(`tr[data-index="${rowIndex - 1}"]`);
            const prevCell = prevRow.querySelector(`.col-${prevColumn}`);
            if (prevCell) {
                startEditing(prevCell, prevColumn, rowIndex - 1);
            }
        }
    }

    /**
     * Move up one row, same column
     */
    function moveUpRow(rowIndex, currentColumn) {
        if (rowIndex > 0) {
            const prevRow = window.app.dom.spreadsheetBody.querySelector(`tr[data-index="${rowIndex - 1}"]`);
            const cell = prevRow.querySelector(`.col-${currentColumn}`);
            if (cell) {
                startEditing(cell, currentColumn, rowIndex - 1);
            }
        }
    }

    /**
     * Move down one row, same column
     */
    function moveDownRow(rowIndex, currentColumn) {
        if (rowIndex < window.app.modules.store.getDisplayFiles().length - 1) {
            const nextRow = window.app.dom.spreadsheetBody.querySelector(`tr[data-index="${rowIndex + 1}"]`);
            const cell = nextRow.querySelector(`.col-${currentColumn}`);
            if (cell) {
                startEditing(cell, currentColumn, rowIndex + 1);
            }
        }
    }

    /**
     * Compute new filename from formula or template (delegates to utils)
     */
    function computeNewFilename(file, index) {
        if (window.app.modules.utils) {
            return window.app.modules.utils.computeNewFilename(file);
        }
        
        // Fallback if utils not loaded
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
     * Validate a file
     */
    function validateFile(file) {
        const newFilename = computeNewFilename(file, 0);
        const validation = window.app.modules.validator.validateFilename(newFilename);
        
        file.validation = validation;
        file.error = !validation.isValid;
    }

    /**
     * Open file in new tab
     */
    async function openFile(file) {
        try {
            let blob;
            if (file.isVirtual) {
                // Virtual file from ZIP - get from cache
                const cached = window.app.modules.scanner.getZipCache(file.zipPath);
                if (!cached) throw new Error('ZIP not found in cache');
                const zipEntry = cached.zip.file(file.zipEntryPath);
                if (!zipEntry) throw new Error('File not found in ZIP');
                const arrayBuffer = await zipEntry.async('arraybuffer');
                const mimeType = getMimeType(file.extension);
                blob = new Blob([arrayBuffer], { type: mimeType });
            } else {
                blob = await file.handle.getFile();
            }
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            
            // Clean up URL after a delay
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (err) {
            console.error('Error opening file:', err);
            alert('Cannot open file: ' + err.message);
        }
    }
    
    /**
     * Get MIME type from file extension
     */
    function getMimeType(extension) {
        const ext = extension.toLowerCase();
        const mimeTypes = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.webp': 'image/webp',
            '.txt': 'text/plain',
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'text/javascript',
            '.json': 'application/json',
            '.xml': 'application/xml',
            '.csv': 'text/csv',
            '.md': 'text/markdown'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * Save a single file
     */
    async function saveFile(index, skipValidation = false) {
        const files = window.app.modules.store.getDisplayFiles();
        const file = files[index];
        if (!file.isDirty) {

            return;
        }
        
        // Virtual files (from ZIPs) cannot be renamed - must extract first
        if (file.isVirtual) {
            alert('Cannot rename files inside ZIP archives.\nExtract the ZIP first to rename files.');
            return;
        }

        const row = window.app.dom.spreadsheetBody.querySelector(`tr[data-index="${index}"]`);
        if (!row) {
            console.error(`Row not found for index ${index}`);
            return;
        }
        row.classList.add('saving');

        try {
            const newFilename = computeNewFilename(file, index);
            const currentFilename = file.originalFilename + file.extension;
            
            // Check if already has correct name
            if (currentFilename === newFilename) {

                row.classList.remove('saving');
                
                // Just clear dirty flag and fields
                file.isDirty = false;
                file.error = false;
                delete file.manualFilename;
                file.tracking = '';
                file.revision = '';
                file.status = '';
                file.title = '';
                
                const newRow = createRow(file, index);
                row.replaceWith(newRow);
                window.app.modules.app.updateStats();
                return;
            }
            
            // Validate filename
            if (!skipValidation) {
                const validation = window.app.modules.validator.validateFilename(newFilename);
                if (!validation.isValid) {
                    const errors = validation.errors.join('\n');
                    const confirmed = confirm(
                        `⚠️ Warning: Filename is not ZDDC compliant!\n\n` +
                        `Errors:\n${errors}\n\n` +
                        `Current filename: ${newFilename}\n\n` +
                        `Do you want to save it anyway?`
                    );
                    
                    if (!confirmed) {
                        row.classList.remove('saving');
                        return;
                    }
                }
            }
            
            // Request write permission for the folder
            const folderPermission = await file.folderHandle.queryPermission({ mode: 'readwrite' });
            if (folderPermission !== 'granted') {
                const granted = await file.folderHandle.requestPermission({ mode: 'readwrite' });
                if (granted !== 'granted') {
                    throw new Error('Write permission denied');
                }
            }
            
            // Rename by copying to new name and deleting old (more reliable than move)
            const oldFilename = file.originalFilename + file.extension;

            
            try {
                // Get fresh handle for old file
                const oldHandle = await file.folderHandle.getFileHandle(oldFilename);
                
                // Read the file content
                const fileData = await oldHandle.getFile();
                
                // Create new file with new name
                const newHandle = await file.folderHandle.getFileHandle(newFilename, { create: true });
                const writable = await newHandle.createWritable();
                await writable.write(fileData);
                await writable.close();
                
                // Delete old file
                await file.folderHandle.removeEntry(oldFilename);
                
                // Update file handle
                file.handle = newHandle;

            } catch (err) {
                console.error(`Failed to rename file:`, err);
                throw err;
            }
            
            // Update file data directly (don't trigger store notification during batch save)
            file.originalFilename = newFilename.substring(0, newFilename.length - file.extension.length);
            file.isDirty = false;
            file.error = false;
            file.manualFilename = null;
            file.tracking = '';
            file.revision = '';
            file.status = '';
            file.title = '';
            file.autoPopulated = false;
            
            // Update row UI
            row.classList.remove('saving');
            const newRow = createRow(file, index);
            row.replaceWith(newRow);
            
        } catch (err) {
            console.error('Error saving file:', err);
            file.error = true;
            file.errorMessage = err.message;
            row.classList.remove('saving');
            row.classList.add('error');
            // Re-throw so caller can handle
            throw err;
        }
    }

    /**
     * Cancel/Clear all fields for a single file
     */
    function cancelFile(index) {
        // Clear all fields through store
        window.app.modules.store.updateFile(index, {
            tracking: '',
            revision: '',
            status: '',
            title: '',
            manualFilename: null,
            isDirty: false,
            error: false,
            validation: null,
            autoPopulated: false
        });
    }

    /**
     * Save all modified files (only ZDDC-compliant ones)
     */
    async function saveAllFiles() {
        const files = window.app.modules.store.getDisplayFiles();
        const modifiedFiles = files
            .map((file, index) => ({ file, index }))
            .filter(({ file }) => file.isDirty);

        if (modifiedFiles.length === 0) {
            alert('No modified files to save.');
            return;
        }

        let successCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const errors = [];
        const skipped = [];

        for (let i = 0; i < modifiedFiles.length; i++) {
            const { file, index } = modifiedFiles[i];
            
            try {
                // Add small delay between operations to prevent race conditions
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
                
                // Validate before saving
                const newFilename = computeNewFilename(file, index);
                const currentFilename = file.originalFilename + file.extension;
                

                
                const validation = window.app.modules.validator.validateFilename(newFilename);
                
                if (!validation.isValid) {
                    // Skip non-compliant files in Save All
                    skippedCount++;
                    skipped.push(`${file.originalFilename}${file.extension}: ${validation.errors[0]}`);

                    continue;
                }
                
                // Check if already has correct name
                if (currentFilename === newFilename) {

                    // Just clear dirty flag
                    file.isDirty = false;
                    file.error = false;
                    delete file.manualFilename;
                    file.tracking = '';
                    file.revision = '';
                    file.status = '';
                    file.title = '';
                    successCount++;
                    continue;
                }
                
                // Save with validation already done - ensure properly awaited
                try {
                    await saveFile(index, true);
                    successCount++;

                } catch (saveErr) {
                    console.error(`Error saving file ${index}:`, saveErr);
                    errorCount++;
                    errors.push(`${file.originalFilename}${file.extension}: ${saveErr.message}`);
                    
                    // Add delay after errors to let filesystem stabilize
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            } catch (err) {
                console.error(`Error processing file ${index}:`, err);
                errorCount++;
                errors.push(`${file.originalFilename}${file.extension}: ${err.message}`);
            }
        }

        // Trigger store notification to update UI after all saves
        window.app.modules.store.notify('files');
        
        let message = `Saved ${successCount} compliant file(s).`;
        
        if (skippedCount > 0) {
            message += `\n\n⚠️ Skipped ${skippedCount} non-compliant file(s):`;
            message += `\n${skipped.slice(0, 3).join('\n')}`;
            if (skipped.length > 3) {
                message += `\n... and ${skipped.length - 3} more`;
            }
            message += `\n\nUse individual save buttons (✓) to save non-compliant files.`;
        }
        
        if (errorCount > 0) {
            message += `\n\n❌ ${errorCount} error(s):`;
            message += `\n${errors.slice(0, 3).join('\n')}`;
            if (errors.length > 3) {
                message += `\n... and ${errors.length - 3} more`;
            }
        }
        
        alert(message);
    }

    /**
     * Cancel all changes
     */
    function cancelAllChanges() {
        const files = window.app.modules.store.getDisplayFiles();
        files.forEach((file, index) => {
            if (file.isDirty) {
                cancelFile(index);
            }
        });
    }

    /**
     * Calculate SHA256 for all files
     */
    async function calculateSha256ForAll() {
        const files = window.app.modules.store.getDisplayFiles();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.sha256) {
                calculateSha256(file, i);
            }
        }
    }

    /**
     * Calculate SHA256 for a single file
     */
    async function calculateSha256(file, index) {
        try {
            let buffer;
            if (file.isVirtual) {
                // Virtual file from ZIP
                const cached = window.app.modules.scanner.getZipCache(file.zipPath);
                if (!cached) throw new Error('ZIP not found in cache');
                const zipEntry = cached.zip.file(file.zipEntryPath);
                if (!zipEntry) throw new Error('File not found in ZIP');
                buffer = await zipEntry.async('arraybuffer');
            } else {
                const fileObj = await file.handle.getFile();
                buffer = await fileObj.arrayBuffer();
            }
            const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            file.sha256 = hashHex;
            
            // Update cell
            const row = window.app.dom.spreadsheetBody.querySelector(`tr[data-index="${index}"]`);
            if (row) {
                const sha256Cell = row.querySelector('.col-sha256');
                if (sha256Cell) {
                    sha256Cell.textContent = hashHex.substring(0, 16) + '...';
                    sha256Cell.title = hashHex;
                    sha256Cell.classList.remove('sha256-calculating');
                }
            }
        } catch (err) {
            console.error('Error calculating SHA256:', err);
        }
    }

    /**
     * Highlight folder in tree when hovering over file
     */
    function highlightFolder(folderPath) {
        if (!folderPath) return;
        
        // Find folder in tree
        const folderTree = document.getElementById('folderTree');
        if (!folderTree) return;
        
        // Find the folder item by data-path attribute
        const folderItem = folderTree.querySelector(`[data-path="${folderPath}"]`);
        if (!folderItem) return;
        
        // Add highlight class
        folderItem.classList.add('folder-hover-highlight');
        
        // Scroll into view if autoscroll is enabled
        const autoScrollCheckbox = document.getElementById('autoScrollCheckbox');
        if (autoScrollCheckbox && autoScrollCheckbox.checked) {
            folderItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    
    /**
     * Clear folder highlight
     */
    function clearFolderHighlight() {
        const folderTree = document.getElementById('folderTree');
        if (!folderTree) return;
        
        // Remove all highlights
        const highlighted = folderTree.querySelectorAll('.folder-hover-highlight');
        highlighted.forEach(el => el.classList.remove('folder-hover-highlight'));
    }

    /**
     * Initialize spreadsheet - subscribe to store
     */
    function init() {
        // Subscribe to store changes (only call this after DOM is ready)
        window.app.modules.store.on('files', render);
    }

    // Export module
    window.app.modules.spreadsheet = {
        init,
        render,
        computeNewFilename,
        saveAllFiles,
        cancelAllChanges,
        cancelEditing
    };
})();
