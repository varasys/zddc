(function (app) {
    'use strict';

    var dom = app.dom;
    var util = app.util;
    var filesModule = app.modules.files;

    // Build ZDDC filename from file row data — delegates to shared zddc.formatFilename()
    function buildZddcFileName(fileData, droppedExt) {
        var ext = (fileData.extension || droppedExt || '').toLowerCase().replace(/^\.+/, '');
        return zddc.formatFilename({
            trackingNumber: fileData.trackingNumber || '',
            revision:       fileData.revision || '',
            status:         fileData.status || '',
            title:          fileData.title || '',
            extension:      ext,
        });
    }

    function setupRowDropTargets() {
        if (app.state.mode !== 'edit') { return; }
        var rows = document.querySelectorAll('table tbody tr:not(.self-entry)');
        rows.forEach(function (row) {
            row.addEventListener('dragover', function (e) {
                if (app.state.mode !== 'edit') { return; }
                e.preventDefault();
                e.stopPropagation();
                row.classList.add('ring-2', 'ring-blue-400', 'bg-blue-50');
            });
            row.addEventListener('dragleave', function () {
                row.classList.remove('ring-2', 'ring-blue-400', 'bg-blue-50');
            });
            row.addEventListener('drop', async function (e) {
                row.classList.remove('ring-2', 'ring-blue-400', 'bg-blue-50');
                if (app.state.mode !== 'edit') { return; }
                var droppedFile = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                if (!droppedFile) { return; }
                e.preventDefault();
                e.stopPropagation();

                var setStatus = app.modules.data && app.modules.data.setStatus;

                // Prompt for directory if none selected
                if (!app.data.selectedDirHandle) {
                    try {
                        app.data.selectedDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                        app.data.selectedDirName = app.data.selectedDirHandle.name || '';
                        if (filesModule.updateDirectoryIndicator) {
                            filesModule.updateDirectoryIndicator();
                        }
                    } catch (pickErr) {
                        if (setStatus) { setStatus('A directory is required to copy files', 'error'); }
                        return;
                    }
                }

                var indexCell = row.querySelector('td[data-index]');
                if (!indexCell) { return; }
                var fileIndex = Number(indexCell.dataset.index);
                var fileData = app.data.files[fileIndex];
                if (!fileData) { return; }

                var droppedExt = (droppedFile.name.split('.').pop() || '').toLowerCase();
                var zddcName = buildZddcFileName(fileData, droppedExt);
                if (!zddcName) { zddcName = droppedFile.name; }

                var hashCell = row.querySelector('td:last-child');
                try {
                    if (hashCell) { hashCell.textContent = 'copying\u2026'; }
                    var dirHandle = app.data.selectedDirHandle;
                    var newHandle = await dirHandle.getFileHandle(zddcName, { create: true });
                    var writable = await newHandle.createWritable();
                    await writable.write(droppedFile);
                    await writable.close();

                    if (hashCell) { hashCell.textContent = 'hashing\u2026'; }
                    var written = await newHandle.getFile();
                    var hash = await util.hashFile(written);

                    fileData.fileHandle = newHandle;
                    fileData.path = zddcName;
                    fileData.name = zddcName;
                    fileData.size = written.size;
                    fileData.fileSize = written.size;
                    fileData.sha256 = hash;
                    if (!fileData.extension) { fileData.extension = droppedExt; }

                    filesModule.updateFilesInJson(app.data.files);
                    filesModule.render();
                    app.state.apply();
                    app.markDirty();
                    if (setStatus) { setStatus('Copied \u2192 ' + zddcName, 'success'); }
                } catch (err) {
                    console.error('[transmittal] row file drop failed', err);
                    if (hashCell) { hashCell.textContent = 'error'; }
                    if (setStatus) { setStatus('Drop failed: ' + (err.message || err), 'error'); }
                }
            });
        });
    }

    filesModule.clearTable = function clearTable() {
        var tbody = document.querySelector('table tbody');
        if (tbody) { tbody.innerHTML = ''; }
    };

    filesModule.renderSingleRow = function renderSingleRow(file, index) {
        var tbody = document.querySelector('table tbody');
        if (!tbody) { return null; }
        var row = document.createElement('tr');

        var numCell = document.createElement('td');
        numCell.className = 'px-2 py-1 align-top text-center text-gray-400';
        numCell.textContent = String(index + 1);
        row.appendChild(numCell);

        var trackingCell = document.createElement('td');
        trackingCell.className = 'px-2 py-1 align-top whitespace-nowrap font-mono';
        var link = document.createElement('a');
        link.textContent = file.trackingNumber || '';
        var relativePath = file.path || file.name || '';
        if (relativePath) {
            link.href = encodeURI(relativePath);
            link.dataset.relativePath = relativePath;
        } else {
            link.href = '#';
        }
        link.title = relativePath || (file.name || '');
        link.className = 'text-blue-600 hover:underline';
        var ext = (file.extension || (relativePath && relativePath.split('.').pop()) || '').toLowerCase();
        if (app.constants.viewableExts.indexOf(ext) !== -1) {
            link.target = '_blank';
            link.rel = 'noopener';
        } else {
            var filename = (relativePath.split('/').pop() || file.name || 'download');
            link.setAttribute('download', filename);
        }
        trackingCell.appendChild(link);
        trackingCell.contentEditable = 'false';
        trackingCell.dataset.index = String(index);
        trackingCell.dataset.field = 'trackingNumber';
        row.appendChild(trackingCell);

        var titleCell = document.createElement('td');
        titleCell.className = 'px-2 py-1 align-top whitespace-normal break-words w-full';
        titleCell.textContent = file.title || '';
        titleCell.contentEditable = (app.state.mode === 'edit').toString();
        titleCell.setAttribute('role', 'textbox');
        titleCell.setAttribute('aria-multiline', 'false');
        titleCell.setAttribute('tabindex', '0');
        titleCell.dataset.index = String(index);
        titleCell.dataset.field = 'title';
        row.appendChild(titleCell);

        var revisionCell = document.createElement('td');
        revisionCell.className = 'px-2 py-1 align-top whitespace-nowrap text-center font-mono';
        revisionCell.textContent = file.revision || '';
        revisionCell.contentEditable = (app.state.mode === 'edit').toString();
        revisionCell.setAttribute('role', 'textbox');
        revisionCell.setAttribute('aria-multiline', 'false');
        revisionCell.setAttribute('tabindex', '0');
        revisionCell.dataset.index = String(index);
        revisionCell.dataset.field = 'revision';
        row.appendChild(revisionCell);

        var statusCell = document.createElement('td');
        statusCell.className = 'px-2 py-1 align-top whitespace-nowrap text-center font-mono';
        statusCell.textContent = file.status || '';
        statusCell.contentEditable = (app.state.mode === 'edit').toString();
        statusCell.setAttribute('role', 'textbox');
        statusCell.setAttribute('aria-multiline', 'false');
        statusCell.setAttribute('tabindex', '0');
        statusCell.dataset.index = String(index);
        statusCell.dataset.field = 'status';
        row.appendChild(statusCell);

        var extCell = document.createElement('td');
        extCell.className = 'px-2 py-1 align-top whitespace-nowrap text-center font-mono';
        extCell.textContent = (file.extension || '').toLowerCase();
        extCell.contentEditable = 'false';
        row.appendChild(extCell);

        var sizeCell = document.createElement('td');
        sizeCell.className = 'px-2 py-1 align-top whitespace-nowrap text-right font-mono';
        var fileSizeValue = (file.fileSize != null ? file.fileSize : file.size);
        sizeCell.textContent = util.formatFileSize(fileSizeValue);
        sizeCell.contentEditable = 'false';
        row.appendChild(sizeCell);

        var hashCell = document.createElement('td');
        hashCell.className = 'px-2 py-1 align-top font-mono text-[9px] whitespace-normal break-all leading-snug';
        if (file.sha256) {
            hashCell.textContent = util.formatShortFileHash(file.sha256);
        } else {
            var prog = document.createElement('div');
            prog.className = 'hash-progress';
            var bar = document.createElement('div');
            bar.className = 'hash-progress-bar';
            var fill = document.createElement('div');
            fill.className = 'hash-progress-fill';
            bar.appendChild(fill);
            prog.appendChild(bar);
            hashCell.appendChild(prog);
        }
        row.appendChild(hashCell);

        tbody.appendChild(row);
        return hashCell;
    };

    function renderSelfRow(tbody, rowNum) {
        var self = filesModule.buildSelfEntry ? filesModule.buildSelfEntry() : null;
        if (!self) { return; }
        var row = document.createElement('tr');
        row.className = 'self-entry';

        var numCell = document.createElement('td');
        numCell.className = 'px-2 py-1 align-top text-center text-gray-400';
        numCell.textContent = String(rowNum);
        row.appendChild(numCell);

        var trackingCell = document.createElement('td');
        trackingCell.className = 'px-2 py-1 align-top whitespace-nowrap font-mono text-gray-500';
        var selfPath = self.path || self.name || '';
        if (selfPath) {
            var link = document.createElement('a');
            link.href = encodeURI(selfPath);
            link.textContent = self.trackingNumber || '';
            link.className = 'text-gray-500 hover:underline';
            link.target = '_blank';
            link.rel = 'noopener';
            trackingCell.appendChild(link);
        } else {
            trackingCell.textContent = self.trackingNumber || '';
        }
        row.appendChild(trackingCell);

        var titleCell = document.createElement('td');
        titleCell.className = 'px-2 py-1 align-top whitespace-normal break-words w-full text-gray-500';
        titleCell.textContent = self.title || '';
        row.appendChild(titleCell);

        var revisionCell = document.createElement('td');
        revisionCell.className = 'px-2 py-1 align-top whitespace-nowrap text-center font-mono text-gray-500';
        revisionCell.textContent = self.revision || '';
        row.appendChild(revisionCell);

        var statusCell = document.createElement('td');
        statusCell.className = 'px-2 py-1 align-top whitespace-nowrap text-center font-mono text-gray-500';
        statusCell.textContent = self.status || '';
        row.appendChild(statusCell);

        var extCell = document.createElement('td');
        extCell.className = 'px-2 py-1 align-top whitespace-nowrap text-center font-mono text-gray-500';
        extCell.textContent = 'html';
        row.appendChild(extCell);

        var sizeCell = document.createElement('td');
        sizeCell.className = 'px-2 py-1 align-top whitespace-nowrap text-right font-mono text-gray-400';
        sizeCell.textContent = '\u2014';
        row.appendChild(sizeCell);

        var hashCell = document.createElement('td');
        hashCell.className = 'px-2 py-1 align-top font-mono text-[9px] whitespace-nowrap text-gray-400 italic';
        hashCell.textContent = 'see above';
        row.appendChild(hashCell);

        tbody.appendChild(row);
    }

    filesModule.render = function render() {
        var tbody = document.querySelector('table tbody');
        if (!tbody) {
            return;
        }
        tbody.innerHTML = '';
        filesModule.sortFilesInPlace(app.data.files);
        var filters = app.modules.filters ? app.modules.filters.getActiveFilters() : {};
        var filtered = [];
        (app.data.files || []).forEach(function (file, originalIndex) {
            if (!app.modules.filters || app.modules.filters.fileMatchesFilters(file, filters)) {
                filtered.push({ file: file, index: originalIndex });
            }
        });

        // Row 0: transmittal self-entry (always pinned first)
        renderSelfRow(tbody, 0);

        var rowNum = 0;
        filtered.forEach(function (entry) {
            var file = entry.file;
            var index = entry.index;
            var row = document.createElement('tr');
            rowNum++;

            var numCell = document.createElement('td');
            numCell.className = 'px-2 py-1 align-top text-center text-gray-400 whitespace-nowrap';
            if (app.state.mode === 'edit') {
                var delBtn = document.createElement('button');
                delBtn.type = 'button';
                delBtn.className = 'row-delete-btn';
                delBtn.textContent = '\u00d7';
                delBtn.title = 'Remove this file';
                delBtn.dataset.fileIndex = String(index);
                numCell.appendChild(delBtn);
                var numSpan = document.createElement('span');
                numSpan.textContent = String(rowNum);
                numCell.appendChild(numSpan);
            } else {
                numCell.textContent = String(rowNum);
            }
            row.appendChild(numCell);

            var trackingCell = document.createElement('td');
            trackingCell.className = 'px-2 py-1 align-top whitespace-nowrap font-mono';
            var link = document.createElement('a');
            link.textContent = file.trackingNumber || '';
            var relativePath = file.path || file.name || '';
            if (relativePath) {
                link.href = encodeURI(relativePath);
                link.dataset.relativePath = relativePath;
            } else {
                link.href = '#';
            }
            link.title = relativePath || (file.name || '');
            link.className = 'text-blue-600 hover:underline';
            var ext = (file.extension || (relativePath && relativePath.split('.').pop()) || '').toLowerCase();
            if (app.constants.viewableExts.indexOf(ext) !== -1) {
                link.target = '_blank';
                link.rel = 'noopener';
            } else {
                var filename = (relativePath.split('/').pop() || file.name || 'download');
                link.setAttribute('download', filename);
            }
            trackingCell.appendChild(link);
            trackingCell.contentEditable = 'false';
            trackingCell.dataset.index = String(index);
            trackingCell.dataset.field = 'trackingNumber';
            row.appendChild(trackingCell);

            var titleCell = document.createElement('td');
            titleCell.className = 'px-2 py-1 align-top whitespace-normal break-words w-full';
            titleCell.textContent = file.title || '';
            titleCell.contentEditable = (app.state.mode === 'edit').toString();
            titleCell.setAttribute('role', 'textbox');
            titleCell.setAttribute('aria-multiline', 'false');
            titleCell.setAttribute('tabindex', '0');
            titleCell.dataset.index = String(index);
            titleCell.dataset.field = 'title';
            row.appendChild(titleCell);

            var revisionCell = document.createElement('td');
            revisionCell.className = 'px-2 py-1 align-top whitespace-nowrap text-center font-mono';
            revisionCell.textContent = file.revision || '';
            revisionCell.contentEditable = (app.state.mode === 'edit').toString();
            revisionCell.setAttribute('role', 'textbox');
            revisionCell.setAttribute('aria-multiline', 'false');
            revisionCell.setAttribute('tabindex', '0');
            revisionCell.dataset.index = String(index);
            revisionCell.dataset.field = 'revision';
            row.appendChild(revisionCell);

            var statusCell = document.createElement('td');
            statusCell.className = 'px-2 py-1 align-top whitespace-nowrap text-center font-mono';
            statusCell.textContent = file.status || '';
            statusCell.contentEditable = (app.state.mode === 'edit').toString();
            statusCell.setAttribute('role', 'textbox');
            statusCell.setAttribute('aria-multiline', 'false');
            statusCell.setAttribute('tabindex', '0');
            statusCell.dataset.index = String(index);
            statusCell.dataset.field = 'status';
            row.appendChild(statusCell);

            var extCell = document.createElement('td');
            extCell.className = 'px-2 py-1 align-top whitespace-nowrap text-center font-mono';
            extCell.textContent = (file.extension || '').toLowerCase();
            extCell.contentEditable = 'false';
            row.appendChild(extCell);

            var sizeCell = document.createElement('td');
            sizeCell.className = 'px-2 py-1 align-top whitespace-nowrap text-right font-mono';
            var isUnmatched = !file.fileHandle && !file.sha256;
            if (isUnmatched) {
                sizeCell.textContent = '\u2014';
                sizeCell.classList.add('text-gray-400');
            } else {
                var fileSizeValue = (file.fileSize != null ? file.fileSize : file.size);
                sizeCell.textContent = util.formatFileSize(fileSizeValue);
            }
            sizeCell.contentEditable = 'false';
            row.appendChild(sizeCell);

            var hashCell = document.createElement('td');
            hashCell.className = 'px-2 py-1 align-top font-mono text-[9px] whitespace-normal break-all leading-snug';
            if (isUnmatched) {
                hashCell.textContent = 'pending';
                hashCell.classList.add('italic', 'text-gray-400');
            } else {
                hashCell.textContent = util.formatShortFileHash(file.sha256 || '');
            }
            row.appendChild(hashCell);

            if (file._verifyResult) {
                row.classList.add('verify-' + file._verifyResult);
            }

            tbody.appendChild(row);
        });

        if (!filtered.length) {
            var placeholderRow = document.createElement('tr');
            for (var i = 0; i < 8; i += 1) {
                var cell = document.createElement('td');
                cell.className = 'px-2 py-1 align-top';
                placeholderRow.appendChild(cell);
            }
            tbody.appendChild(placeholderRow);
        }

        if (app.modules.filters && typeof app.modules.filters.refreshPlaceholders === 'function') {
            app.modules.filters.refreshPlaceholders();
        }
        setupRowDropTargets();
    };

    // Undo state for row deletion
    var _lastDeleted = null;
    var _undoTimer = null;

    function deleteFileRow(fileIndex) {
        var file = app.data.files[fileIndex];
        if (!file) { return; }
        var setStatus = app.modules.data && app.modules.data.setStatus;
        var label = (file.trackingNumber || '') + (file.title ? ' - ' + file.title : '');

        // Store for undo
        _lastDeleted = { file: file, index: fileIndex };
        if (_undoTimer) { clearTimeout(_undoTimer); }
        _undoTimer = setTimeout(function () { _lastDeleted = null; }, 10000);

        app.data.files.splice(fileIndex, 1);
        filesModule.updateFilesInJson(app.data.files);
        filesModule.render();
        app.state.apply();
        app.markDirty();

        if (setStatus) {
            setStatus('Removed ' + (label || 'row') + '  — click here to undo', 'success');
            // Attach one-time undo click handler to status bar
            var statusEl = document.querySelector('#data-status');
            if (statusEl) {
                statusEl.style.cursor = 'pointer';
                var cleanup = function () {
                    statusEl.removeEventListener('click', handler);
                    statusEl.style.cursor = '';
                };
                var handler = function () {
                    cleanup();
                    if (!_lastDeleted) { return; }
                    var d = _lastDeleted;
                    _lastDeleted = null;
                    if (_undoTimer) { clearTimeout(_undoTimer); _undoTimer = null; }
                    var idx = Math.min(d.index, app.data.files.length);
                    app.data.files.splice(idx, 0, d.file);
                    filesModule.updateFilesInJson(app.data.files);
                    filesModule.render();
                    app.state.apply();
                    app.markDirty();
                    if (setStatus) { setStatus('Restored ' + (label || 'row'), 'success'); }
                };
                // Clear cursor when undo expires
                if (_undoTimer) { clearTimeout(_undoTimer); }
                _undoTimer = setTimeout(function () { _lastDeleted = null; cleanup(); }, 10000);
                statusEl.addEventListener('click', handler);
            }
        }
    }

    filesModule.setupTableEditing = function setupTableEditing() {
        var tbody = document.querySelector('table tbody');
        if (!tbody) {
            return;
        }
        // Delegated handler for row delete buttons
        tbody.addEventListener('click', function (event) {
            var delBtn = event.target.closest('.row-delete-btn');
            if (delBtn && delBtn.dataset.fileIndex !== undefined) {
                event.preventDefault();
                event.stopPropagation();
                deleteFileRow(Number(delBtn.dataset.fileIndex));
                return;
            }
        });
        // Click delegation for file preview
        // Edit mode: always preview (relative paths don't work until HTML is saved)
        // View mode: preview only when checkbox is checked and file source is loaded
        tbody.addEventListener('click', function (event) {
            var link = event.target.closest('a');
            if (!link) {
                return;
            }
            var cell = link.closest('td');
            if (!cell || !cell.dataset.index) {
                return;
            }
            var file = app.data.files[Number(cell.dataset.index)];
            if (!file || !filesModule.hasFileSource || !filesModule.hasFileSource(file)) {
                return;
            }
            var usePreview = (app.state.mode === 'edit') ||
                (filesModule.isPreviewEnabled && filesModule.isPreviewEnabled()) ||
                !!(file.fileHandle);
            if (usePreview) {
                event.preventDefault();
                event.stopPropagation();
                filesModule.showFilePreview(file);
            }
        });
        tbody.addEventListener('input', function (event) {
            var target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }
            var index = target.dataset.index;
            var field = target.dataset.field;
            if (index === undefined || !field) {
                return;
            }
            var entry = app.data.files[Number(index)];
            if (!entry) {
                return;
            }
            entry[field] = (target.textContent || '').replace(/\r?\n/g, ' ').trim();
            filesModule.sortFilesInPlace(app.data.files);
            filesModule.updateFilesInJson(app.data.files);
            filesModule.render();
            app.markDirty();
            if (app.modules.liveDigest && app.modules.liveDigest.schedule) {
                app.modules.liveDigest.schedule();
            }
        });
        tbody.addEventListener('keydown', function (event) {
            var target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }
            if (target.isContentEditable && event.key === 'Enter') {
                event.preventDefault();
            }
        });
        tbody.addEventListener('paste', function (event) {
            var target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }
            if (!target.isContentEditable) {
                return;
            }
            event.preventDefault();
            var text = (event.clipboardData || window.clipboardData).getData('text');
            var sanitized = (text || '').replace(/\r?\n/g, ' ');
            try {
                document.execCommand('insertText', false, sanitized);
            } catch (err) {
                target.textContent = (target.textContent || '') + sanitized;
            }
        });
    };

    filesModule.handleClear = function handleClear() {
        if (app.state.mode !== 'edit') {
            return;
        }
        if (filesModule.cleanupBlobUrls) {
            filesModule.cleanupBlobUrls();
        }
        app.data.files = [];
        app.data.selectedDirHandle = null;
        filesModule.updateDirectoryIndicator('');
        filesModule.updateFilesInJson([]);
        filesModule.render();
        app.state.apply();
        app.markDirty();
    };
})(window.transmittalApp);
