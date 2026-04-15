(function (app) {
    'use strict';

    const DEBUG = false; // Set to true to enable verbose logging

    const dom = app.dom;
    const json = app.json;
    const util = app.util;

    const filesModule = app.modules.files = {};

    var hasFileSystemAccess = typeof window.showDirectoryPicker === 'function';

    function requireFileSystemAccess() {
        if (hasFileSystemAccess) { return true; }
        alert('This feature requires the File System Access API.\n\nPlease use a Chromium-based browser on desktop.');
        return false;
    }

    function hasFiles() {
        return Array.isArray(app.data.files) && app.data.files.length > 0;
    }

    // Three primary-button states: 'scan', 'verify', 'publish'
    var _primaryIntent = null; // null = auto-detect, or explicit 'scan'|'verify'|'publish'
    var _primaryHandler = null;

    function setPrimary(intent) {
        _primaryIntent = intent;
        updateToolbars();
    }

    function setScanningState(active) {
        var wrapper = document.querySelector('.table-wrapper');
        if (!wrapper) { return; }
        if (active) {
            wrapper.classList.add('scanning');
        } else {
            wrapper.classList.remove('scanning');
        }
    }

    function nowMs() {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }
        return Date.now();
    }

    function formatDuration(ms) {
        const totalSeconds = Math.max(0, Math.round(ms / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        if (minutes > 0) {
            return minutes + 'm ' + seconds.toString().padStart(2, '0') + 's';
        }
        return seconds + 's';
    }

    // ── File handle permission and refresh helpers ─────────────────────

    async function ensureDirHandlePermission(dirHandle) {
        if (!dirHandle || typeof dirHandle.requestPermission !== 'function') {
            return;
        }
        const permissionDescriptor = { mode: 'readwrite' };
        const current = await dirHandle.queryPermission(permissionDescriptor);
        if (current === 'granted') {
            return;
        }
        // Request permission (requires user gesture in most browsers)
        const result = await dirHandle.requestPermission(permissionDescriptor);
        if (result !== 'granted') {
            throw new Error('Read/write permission is required for the selected directory');
        }
    }

    async function getFreshFile(fileHandle, fallbackData) {
        if (!fileHandle || typeof fileHandle.getFile !== 'function') {
            throw new Error('No valid file handle');
        }

        // Check permission state before attempting to get file
        try {
            const current = await fileHandle.queryPermission({ mode: 'read' });
            if (current !== 'granted') {
                // Try to request permission (will fail without user gesture)
                try {
                    await fileHandle.requestPermission({ mode: 'read' });
                } catch (permErr) {
                    // Permission request failed (likely no user gesture), skip with warning
                    console.warn('[transmittal] Permission request failed for file:', fileHandle.name || 'unknown', permErr);
                }
                // Check permission again after potential request
                const newPerm = await fileHandle.queryPermission({ mode: 'read' });
                if (newPerm !== 'granted') {
                    if (fallbackData) {
                        // Use fallback data instead of throwing
                        console.log('[transmittal] Permission not granted, using fallback for ' + (fallbackData.path || fallbackData.name || 'unknown file'));
                        return fallbackData;
                    }
                    throw new Error('Permission denied for file access');
                }
            }
        } catch (err) {
            // queryPermission not supported or error
            console.warn('[transmittal] Permission check error:', err);
        }

        try {
            return await fileHandle.getFile();
        } catch (err) {
            if (err && err.name === 'NotReadableError') {
                if (fallbackData) {
                    console.log('[transmittal] NotReadableError, using fallback for ' + (fallbackData.path || fallbackData.name || 'unknown file'));
                    return fallbackData;
                }
                throw err;
            }
            throw err;
        }
    }

    function updateDirectoryIndicator(name) {
        var indicator = dom.qs('#selected-directory');
        if (indicator) {
            indicator.textContent = name ? name : '';
        }
        updateToolbars();
    }

    function sortFilesInPlace(list) {
        if (!Array.isArray(list)) {
            return;
        }
        list.sort(util.compareFilesByTrackingRevision);
    }

    function buildFileHandleMap(files) {
        var map = {};
        (files || []).forEach(function (f) {
            if (f.fileHandle) {
                var key = (f.path || f.name || '').toLowerCase();
                if (key) { map[key] = f.fileHandle; }
            }
        });
        return map;
    }

    function restoreFileHandles(files, handleMap) {
        (files || []).forEach(function (f) {
            var key = (f.path || f.name || '').toLowerCase();
            if (key && handleMap[key]) {
                f.fileHandle = handleMap[key];
            }
        });
    }

    function selfEntryDate() {
        var raw = (dom.qs('#date') || {}).value || '';
        var trimmed = raw.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) { return trimmed; }
        var d = new Date(trimmed);
        if (!isNaN(d.getTime())) { return d.toISOString().slice(0, 10); }
        return trimmed;
    }

    function buildSelfEntry() {
        var tracking = (dom.qs('#tracking-number') || {}).value || '';
        var subject = (dom.qs('#subject') || {}).value || '';
        var title = (dom.qs('#title') || {}).value || '';
        var date = selfEntryDate();
        var purpose = (dom.qs('#purpose') || {}).value || '';
        var d = app.modules.data;
        var filename = (d && d.buildFileName)
            ? d.buildFileName({ trackingNumber: tracking, title: title, date: date, purpose: purpose }, { extension: 'html' })
            : '';
        return {
            _isSelf: true,
            path: filename ? ('./' + filename) : '',
            name: filename || '',
            trackingNumber: tracking,
            title: subject || title,
            revision: date,
            status: purpose,
            extension: 'html',
            size: 0,
            fileSize: 0,
            sha256: app.constants.SELF_HASH
        };
    }

    filesModule.buildSelfEntry = buildSelfEntry;

    function canonicalFilePayload(entry) {
        const relativePath = entry.path || entry.name || '';
        const filename = relativePath.split('/').pop() || entry.name || '';
        const pathOnly = relativePath.substring(0, relativePath.lastIndexOf('/')) || '';
        return {
            trackingNumber: entry.trackingNumber || '',
            revision: entry.revision || '',
            status: entry.status || '',
            title: entry.title || '',
            path: pathOnly,
            filename: filename,
            extension: entry.extension || '',
            sha256: entry.sha256 || '',
            fileSize: Number(entry.fileSize || entry.size || 0)
        };
    }

    function updateFilesInJson(files) {
        const data = json.parse();
        const envelope = { ...(data.envelope || {}) };
        const payload = { ...(data.payload || {}) };
        const presentation = { ...(data.presentation || {}) };
        
        const sorted = (Array.isArray(files) ? files : []).slice().sort(util.compareFilesByTrackingRevision);
        // Prepend self-entry, then regular files
        var selfEntry = buildSelfEntry();
        payload.files = [canonicalFilePayload(selfEntry)].concat(sorted.map(canonicalFilePayload));
        
        // Clear digest when files change (invalidates signatures)
        envelope.digest = '';
        envelope.digestedAt = '';
        envelope.signatures = [];
        
        json.setData({ envelope: envelope, payload: payload, presentation: presentation });
    }

    function parseFilename(name) {
        const r = zddc.parseFilename(name);
        if (!r) {
            return { trackingNumber: '', revision: '', status: '', title: name || '', extension: '' };
        }
        return {
            trackingNumber: r.trackingNumber,
            revision:       r.revision,
            status:         r.status,
            title:          r.title,
            extension:      r.extension,
        };
    }


    var ARCHIVE_DIR_NAME = '.archive';
    var MAX_DIRECTORY_DEPTH = 48;

    function isHiddenName(name) {
        return !!name && name.startsWith('.');
    }

    function shouldSkipDirectorySegment(name) {
        if (!name) {
            return false;
        }
        if (name === ARCHIVE_DIR_NAME) {
            return true;
        }
        return isHiddenName(name);
    }

    async function collectFilesRecursive(handle, relPath, out, depth) {
        const currentDepth = depth || 0;
        if (DEBUG) console.log('[transmittal] collectFilesRecursive:', relPath, 'depth:', currentDepth, 'kind:', handle.kind);
        
        if (currentDepth > MAX_DIRECTORY_DEPTH) {
            throw new Error('Directory nesting exceeds supported depth');
        }
        if (handle.kind === 'file') {
            if (isHiddenName(handle.name)) {
                if (DEBUG) console.log('[transmittal] Skipping hidden file:', relPath);
                return;
            }
            if (DEBUG) console.log('[transmittal] Adding file to collection:', relPath);
            out.push({ handle, path: relPath, name: handle.name });
            return;
        }
        if (handle.kind !== 'directory') {
            if (DEBUG) console.log('[transmittal] Unknown handle kind:', handle.kind, 'for', relPath);
            return;
        }
        if (shouldSkipDirectorySegment(handle.name) && relPath) {
            if (DEBUG) console.log('[transmittal] Skipping directory segment:', relPath);
            return;
        }
        try {
            if (DEBUG) console.log('[transmittal] Iterating directory:', relPath || 'root');
            let childCount = 0;
            for await (const child of handle.values()) {
                childCount++;
                if (DEBUG) console.log('[transmittal] Found child #' + childCount + ':', child.name, 'kind:', child.kind);
                if (shouldSkipDirectorySegment(child.name)) {
                    continue;
                }
                const childPath = relPath ? (relPath + '/' + child.name) : child.name;
                if (DEBUG) console.log('[transmittal] Recursing into:', childPath);
                await collectFilesRecursive(child, childPath, out, currentDepth + 1);
            }
            if (DEBUG) console.log('[transmittal] Finished iterating directory:', relPath || 'root', 'found', childCount, 'children');
        } catch (err) {
            if (err && err.name === 'NotFoundError') {
                console.error('[transmittal] NotFoundError during directory traversal:', relPath || handle.name || '', {
                    error: err,
                    message: err.message,
                    stack: err.stack,
                    handleName: handle.name,
                    handleKind: handle.kind
                });
                return;
            }
            console.error('[transmittal] Unexpected error during directory traversal:', relPath, err);
            throw err;
        }
    }

    async function collectDirectoryEntries(rootHandle) {
        const entries = [];
        
        if (!rootHandle || rootHandle.kind !== 'directory') {
            throw new Error('Invalid directory handle provided');
        }
        
        try {
            // Start directory scan
            if (DEBUG) console.log('[transmittal] Starting directory scan for:', rootHandle.name);
            
            for await (const child of rootHandle.values()) {
                if (shouldSkipDirectorySegment(child.name)) {
                    continue;
                }
                const childPath = child.name;
                try {
                    await collectFilesRecursive(child, childPath, entries, 1);
                } catch (err) {
                    if (err && err.name === 'NotFoundError') {
                        console.warn('[transmittal] directory entry missing', childPath, err);
                        continue;
                    }
                    throw err;
                }
            }
        } catch (err) {
            if (err && err.name === 'NotFoundError') {
                console.error('[transmittal] NotFoundError during directory scan', {
                    error: err,
                    message: err.message,
                    stack: err.stack,
                    handle: rootHandle,
                    handleName: rootHandle.name
                });
                // Return empty entries instead of throwing
                return entries;
            }
            console.error('[transmittal] Unexpected error during directory scan', err);
            throw err;
        }
        return entries;
    }

    // Promote shared helpers to filesModule for use by sub-modules
    filesModule.nowMs = nowMs;
    filesModule.formatDuration = formatDuration;
    filesModule.updateDirectoryIndicator = updateDirectoryIndicator;
    filesModule.sortFilesInPlace = sortFilesInPlace;
    filesModule.updateFilesInJson = updateFilesInJson;
    filesModule.parseFilename = parseFilename;
    filesModule.collectDirectoryEntries = collectDirectoryEntries;

    async function ensureDirHandle() {
        if (typeof window.showDirectoryPicker !== 'function') {
            throw new Error('File System Access API showDirectoryPicker is required');
        }
        const handle = await window.showDirectoryPicker();
        
        // Log the handle details for debugging
        if (DEBUG) {
            console.log('[transmittal] Directory selected:', {
                name: handle.name,
                kind: handle.kind,
                hasQueryPermission: typeof handle.queryPermission === 'function',
                hasRequestPermission: typeof handle.requestPermission === 'function'
            });
        }

        async function ensureRwPermission(dirHandle) {
            if (!dirHandle) {
                throw new Error('Directory handle is undefined');
            }
            if (typeof dirHandle.requestPermission !== 'function') {
                return;
            }
            const permissionDescriptor = { mode: 'readwrite' };
            if (typeof dirHandle.queryPermission === 'function') {
                const current = await dirHandle.queryPermission(permissionDescriptor);
                if (current === 'granted') {
                    return;
                }
            }
            const result = await dirHandle.requestPermission(permissionDescriptor);
            if (result !== 'granted') {
                throw new Error('Read/write permission is required for the selected directory');
            }
        }

        await ensureRwPermission(handle);
        
        // Verify the handle is still valid after permission check
        if (!handle || handle.kind !== 'directory') {
            throw new Error('Directory handle became invalid after permission check');
        }

        app.data.selectedDirHandle = handle;
        updateDirectoryIndicator(handle.name);
        app.state.apply();
        
        if (DEBUG) console.log('[transmittal] Directory handle ready:', handle.name);
        return handle;
    }

    // Parse folder name: YYYY-MM-DD_TRACKING (STATUS) - TITLE
    function parseFolderName(name) {
        var m = name.match(/^(\d{4}-\d{2}-\d{2})_(.+?)\s*\(([^)]*)\)\s*-\s*(.+)$/);
        if (!m) { return null; }
        return {
            date: m[1].trim(),
            trackingNumber: m[2].trim(),
            status: m[3].trim(),
            title: m[4].trim()
        };
    }

    function populateFields(parsed) {
        if (!parsed) { return; }
        var map = {
            'date': parsed.date,
            'tracking-number': parsed.trackingNumber,
            'purpose': parsed.status,
            'subject': parsed.title
        };
        Object.keys(map).forEach(function (id) {
            var el = dom.qs('#' + id);
            if (el && map[id]) {
                el.value = map[id];
            }
        });
    }

    // Shared scan pipeline: collect → populate rows → hash with progress
    // onHash(item, hash) is called per file after hashing; return value sets cell content.
    async function scanEntries(dirHandle, onHash) {
        var entries = await collectDirectoryEntries(dirHandle);
        entries.sort(function (a, b) { return a.path.localeCompare(b.path); });

        // Phase 0: Ensure directory handle has permission
        await ensureDirHandlePermission(dirHandle);

        // Phase 1: merge with existing files
        var existingIndex = filesModule.buildExistingIndex(app.data.files || []);
        var existingPasteKeys = Object.keys(existingIndex);
        setScanningState(true);
        var hashCells = [];
        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            try {
                // Check and refresh handle permission before getFile
                var file = await getFreshFile(entry.handle);
                var parsed = parseFilename(file.name);
                var fileData = {
                    path: entry.path,
                    name: file.name,
                    size: file.size,
                    fileSize: file.size,
                    sha256: '',
                    trackingNumber: parsed.trackingNumber,
                    title: parsed.title,
                    revision: parsed.revision,
                    status: parsed.status,
                    extension: parsed.extension || (file.name.split('.').pop() || ''),
                    fileHandle: entry.handle
                };
                var pasteKey = (fileData.trackingNumber || '').toLowerCase() + '|' + (fileData.revision || '').toLowerCase();
                if (existingPasteKeys.indexOf(pasteKey) === -1) {
                    app.data.files.push(fileData);
                    var hashCell = filesModule.renderSingleRow(fileData, app.data.files.length - 1);
                    hashCells.push({ cell: hashCell, fileData: fileData, handle: entry.handle });
                }
            } catch (err) {
                console.error('[transmittal] Error reading file:', entry.path, err);
            }
            if (i % 20 === 0) {
                await new Promise(function (r) { setTimeout(r, 0); });
            }
        }

        // Phase 2: hash each file with progress bar
        setScanningState(false);
        for (var j = 0; j < hashCells.length; j++) {
            var item = hashCells[j];
            try {
                var fill = item.cell ? item.cell.querySelector('.hash-progress-fill') : null;
                var onProgress = fill ? function (f) {
                    return function (loaded, total) {
                        var pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
                        f.style.width = pct + '%';
                    };
                }(fill) : null;
                var file = await getFreshFile(item.handle);
                var hash = await util.hashFile(file, onProgress);
                item.fileData.sha256 = hash;
                if (onHash) {
                    onHash(item, hash);
                } else if (item.cell) {
                    item.cell.textContent = util.formatShortFileHash(hash);
                }
            } catch (err) {
                console.error('[transmittal] Error hashing file:', item.fileData.path, err);
                if (item.cell) { item.cell.textContent = 'error'; }
            }
        }
        return hashCells;
    }

    function finalizeAfterScan() {
        var handleMap = buildFileHandleMap(app.data.files);
        updateFilesInJson(app.data.files);
        filesModule.render();
        filesModule.loadFromJson({ filesOnly: true });
        restoreFileHandles(app.data.files, handleMap);
        app.state.apply();
    }

    async function selectDirectory(event) {
        if (DEBUG) console.log('[transmittal] ========== SELECT DIRECTORY STARTED ==========');
        const trigger = event && event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
        if (trigger) {
            trigger.disabled = true;
            trigger.classList.add('opacity-60');
        }
        try {
            var dirHandle = app.data.selectedDirHandle;
            if (!dirHandle) {
                dirHandle = await ensureDirHandle();
            }
            populateFields(parseFolderName(dirHandle.name));
            await scanEntries(dirHandle);
            finalizeAfterScan();
            app.markDirty();
            setPrimary('publish');
        } catch (err) {
            if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
                if (DEBUG) console.log('[transmittal] User cancelled directory selection');
            } else {
                console.error('[transmittal] selectDirectory failed', err);
            }
        } finally {
            setScanningState(false);
            if (trigger) {
                trigger.disabled = false;
                trigger.classList.remove('opacity-60');
            }
        }
    }

    async function writeFileToSelectedDir(filename, contents, mime) {
        if (!app.data.selectedDirHandle) {
            throw new Error('No directory selected');
        }
        const fileHandle = await app.data.selectedDirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(new Blob([contents], { type: mime || 'text/plain' }));
        await writable.close();
    }

    filesModule.writeFileToSelectedDir = writeFileToSelectedDir;

    // ── Paste helpers ─────────────────────────────────────
    // Expected formats (tab-separated, 3-5 adjacent columns):
    //   3 cols: Tracking \t Title \t Revision+Status   ("A (IFR)")
    //   4 cols: Tracking \t Title \t Revision \t Status
    //   5 cols: Tracking \t Title \t Revision \t Status \t Extension
    var MAX_PASTE_COLS = 5;
    var HEADER_RE = /^(#|tracking|number|title|revision|status|ext)/i;

    function isHeaderLine(cols) {
        if (!cols || !cols.length) { return false; }
        return HEADER_RE.test((cols[0] || '').trim());
    }

    function columnsToFileRow(cols) {
        var tracking = (cols[0] || '').trim();
        if (!tracking) { return null; }
        var revision = (cols[2] || '').trim();
        var status = (cols[3] || '').trim();
        var extension = (cols[4] || '').trim().toLowerCase();

        // 3-column paste: split "A (IFR)" into revision "A" and status "IFR"
        if (cols.length <= 3 && revision) {
            var spaceIdx = revision.indexOf(' ');
            if (spaceIdx > 0) {
                status = revision.substring(spaceIdx + 1).trim().replace(/^\(+/, '').replace(/\)+$/, '');
                revision = revision.substring(0, spaceIdx).trim();
            }
        }
        return {
            trackingNumber: tracking,
            title: (cols[1] || '').trim(),
            revision: revision,
            status: status,
            extension: extension,
            path: '', name: '', size: 0, fileSize: 0, sha256: ''
        };
    }

    // Parse plain-text tab-separated clipboard data.
    // Returns { rows: [...], tooWide: false } or { rows: [], tooWide: true }.
    function parseClipboardText(text) {
        var lines = (text || '').split(/\r?\n/);
        var rows = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) { continue; }
            var cols = line.split('\t');
            if (isHeaderLine(cols)) { continue; }
            if (cols.length > MAX_PASTE_COLS) {
                return { rows: [], tooWide: true, colCount: cols.length };
            }
            var row = columnsToFileRow(cols);
            if (row) { rows.push(row); }
        }
        return { rows: rows, tooWide: false };
    }

    function pasteFileKey(trackingNumber, revision) {
        return (trackingNumber || '').toLowerCase() + '|' + (revision || '').toLowerCase();
    }

    function buildExistingIndex(files) {
        var index = {};
        for (var i = 0; i < files.length; i++) {
            index[pasteFileKey(files[i].trackingNumber, files[i].revision)] = i;
        }
        return index;
    }

    async function handlePasteFiles(mode, clipText) {
        var setStatus = app.modules.data && app.modules.data.setStatus;
        try {
            var text = clipText || await navigator.clipboard.readText();
            var result = parseClipboardText(text);
            if (result.tooWide) {
                if (setStatus) {
                    setStatus('Paste has ' + result.colCount + ' columns (max ' + MAX_PASTE_COLS + '). ' +
                        'Copy only: Tracking, Title, Revision, [Status], [Extension]', 'error');
                }
                return;
            }
            var rows = result.rows;
            if (!rows.length) {
                if (setStatus) { setStatus('No valid rows found. Expected tab-separated: Tracking, Title, Revision, [Status], [Ext]', 'error'); }
                return;
            }

            var added = 0, updated = 0;
            if (mode === 'new') {
                app.data.files = [];
                for (var i = 0; i < rows.length; i++) {
                    app.data.files.push(rows[i]);
                    added++;
                }
            } else {
                var index = buildExistingIndex(app.data.files || []);
                for (var j = 0; j < rows.length; j++) {
                    var row = rows[j];
                    var key = pasteFileKey(row.trackingNumber, row.revision);
                    if (index.hasOwnProperty(key)) {
                        var existing = app.data.files[index[key]];
                        existing.title = row.title;
                        existing.status = row.status;
                        if (row.extension) { existing.extension = row.extension; }
                        updated++;
                    } else {
                        app.data.files.push(row);
                        added++;
                    }
                }
            }

            filesModule.sortFilesInPlace(app.data.files);
            updateFilesInJson(app.data.files);
            filesModule.render();
            app.state.apply();
            app.markDirty();
            setPrimary('verify');

            var msg = mode === 'new'
                ? 'Replaced file list: ' + added + ' rows'
                : added + ' added, ' + updated + ' updated';
            if (setStatus) { setStatus(msg, 'success'); }
        } catch (err) {
            console.error('[transmittal] paste failed', err);
            if (setStatus) { setStatus('Paste failed: ' + (err && err.message ? err.message : err), 'error'); }
        }
    }

    // ── Toolbar visibility per state ────────────────────
    function updateToolbars() {
        var docState = app.state.detectState();
        buildBottomBar(docState);
    }

    function createMenuItem(label, handler, options) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dropdown-item' + ((options && options.danger) ? ' text-red-600' : '');
        btn.setAttribute('role', 'menuitem');
        btn.textContent = label;
        btn.addEventListener('click', handler);
        return btn;
    }

    function createSeparator(label) {
        var el = document.createElement('div');
        el.className = 'dropdown-separator';
        if (label) { el.textContent = label; }
        return el;
    }

    function applyPrimaryButton(btn, intent) {
        if (_primaryHandler) { btn.removeEventListener('click', _primaryHandler); }
        btn.disabled = false;
        btn.classList.remove('opacity-60');
        if (intent === 'publish') {
            btn.textContent = 'Publish';
            _primaryHandler = function () {
                document.dispatchEvent(new CustomEvent('transmittal:open-publish'));
            };
        } else if (intent === 'verify') {
            btn.textContent = 'Verify Directory';
            _primaryHandler = function () {
                if (!requireFileSystemAccess()) { return; }
                verifyFiles();
            };
        } else {
            btn.textContent = 'Scan Directory';
            _primaryHandler = function () {
                if (!requireFileSystemAccess()) { return; }
                selectDirectory({ currentTarget: null });
            };
        }
        btn.addEventListener('click', _primaryHandler);
    }

    function buildBottomBar(docState) {
        var primaryBtn = dom.qs('#bottom-primary');
        var dropdown = dom.qs('#bottom-dropdown');
        if (!primaryBtn || !dropdown) { return; }

        var isPublished = docState === 'published';
        var d = app.modules.data || {};

        dropdown.innerHTML = '';
        dropdown.classList.add('hidden');

        if (isPublished) {
            applyPrimaryButton(primaryBtn, 'verify');

            dropdown.appendChild(createMenuItem('Copy Table', function () {
                if (d.handleCopyTable) { d.handleCopyTable(); }
            }));
            dropdown.appendChild(createMenuItem('Copy JSON', function () {
                if (d.handleCopyJson) { d.handleCopyJson(); }
            }));
            dropdown.appendChild(createSeparator());
            dropdown.appendChild(createMenuItem('Add Signature', function () {
                if (app.modules.security && app.modules.security.addSignature) {
                    app.modules.security.addSignature();
                }
            }));
            dropdown.appendChild(createMenuItem('Acknowledge Receipt', function () {
                if (app.modules.security && app.modules.security.addSignature) {
                    app.modules.security.addSignature({ label: 'Received By' });
                }
            }));
            dropdown.appendChild(createSeparator());
            dropdown.appendChild(createMenuItem('Revise', function () {
                if (d.handleRevise) { d.handleRevise(); }
            }));
            dropdown.appendChild(createMenuItem('Import HTML', function () {
                if (d.handleImportHtml) { d.handleImportHtml(); }
            }));
            dropdown.appendChild(createMenuItem('Reset', function () {
                if (app.modules.reset && app.modules.reset.handleReset) {
                    app.modules.reset.handleReset();
                }
            }, { danger: true }));
            dropdown.appendChild(createSeparator());
            dropdown.appendChild(createMenuItem('Create Index', function () {
                if (!requireFileSystemAccess()) { return; }
                if (filesModule.generateArchiveRedirects) {
                    filesModule.generateArchiveRedirects().catch(function (err) {
                        console.error('[transmittal] create-index failed', err);
                    });
                }
            }));
        } else {
            // Edit: respect explicit intent, or auto-detect
            var intent = _primaryIntent;
            if (!intent) {
                intent = hasFiles() ? 'verify' : 'scan';
            }
            applyPrimaryButton(primaryBtn, intent);

            dropdown.appendChild(createMenuItem('Scan Directory', function () {
                if (!requireFileSystemAccess()) { return; }
                selectDirectory({ currentTarget: null });
            }));
            dropdown.appendChild(createMenuItem('Verify Directory', function () {
                if (!requireFileSystemAccess()) { return; }
                verifyFiles();
            }));
            dropdown.appendChild(createSeparator());
            dropdown.appendChild(createMenuItem('Publish', function () {
                document.dispatchEvent(new CustomEvent('transmittal:open-publish'));
            }));
            dropdown.appendChild(createMenuItem('Save Draft', function () {
                if (d.handleSaveHtmlDraft) { d.handleSaveHtmlDraft(); }
            }));
            dropdown.appendChild(createMenuItem('Create Folder', async function () {
                var setStatus = d.setStatus;
                try {
                    // Sync UI so payload reflects current form values
                    filesModule.syncUiToJson();
                    var data = json.parse();
                    var payload = (data && data.payload) || {};
                    if (!payload.trackingNumber) {
                        if (setStatus) { setStatus('Enter a tracking number first', 'error'); }
                        return;
                    }
                    var folderName = d.buildFolderName(payload);
                    // Sanitize for filesystem
                    folderName = folderName.replace(/[<>:"/\\|?*]+/g, '_').replace(/_+/g, '_');

                    // Prompt for staging directory
                    var stagingHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                    var newFolderHandle = await stagingHandle.getDirectoryHandle(folderName, { create: true });

                    // Set as selected directory for subsequent file operations
                    app.data.selectedDirHandle = newFolderHandle;
                    app.data.selectedDirName = folderName;
                    if (filesModule.updateDirectoryIndicator) {
                        filesModule.updateDirectoryIndicator();
                    }

                    // Save a draft into the new folder
                    var pub = app.modules.publish;
                    if (pub && typeof pub.syncUiToJson === 'function' && typeof pub.buildHtmlString === 'function') {
                        await pub.syncUiToJson({ sign: false, computeDigest: false });
                        var html = await pub.buildHtmlString();
                        var draftName = d.buildFileName(
                            ((json.parse() || {}).payload || {}),
                            { extension: 'html', draft: true }
                        );
                        await writeFileToSelectedDir(draftName, html, 'text/html');
                        if (setStatus) {
                            setStatus('Draft saved to ' + folderName + '. Close this file and open ' + draftName + ' from the new folder.', 'success');
                        }
                    } else {
                        if (setStatus) { setStatus('Created folder: ' + folderName, 'success'); }
                    }
                } catch (err) {
                    if (err && err.name === 'AbortError') { return; }
                    console.error('[transmittal] create-folder failed', err);
                    if (setStatus) { setStatus('Create folder failed: ' + (err.message || err), 'error'); }
                }
            }));
            dropdown.appendChild(createSeparator());
            dropdown.appendChild(createMenuItem('Paste New Rows', async function () {
                var text;
                try { text = await navigator.clipboard.readText(); } catch (e) {
                    if (d.setStatus) { d.setStatus('Clipboard access denied', 'error'); }
                    return;
                }
                var result = parseClipboardText(text);
                if (result.tooWide) {
                    if (d.setStatus) {
                        d.setStatus('Paste has ' + result.colCount + ' columns (max ' + MAX_PASTE_COLS + '). ' +
                            'Copy only: Tracking, Title, Revision, [Status], [Extension]', 'error');
                    }
                    return;
                }
                if (!result.rows.length) {
                    if (d.setStatus) { d.setStatus('No valid rows on clipboard', 'error'); }
                    return;
                }
                if (confirm('Replace file list with ' + result.rows.length + ' rows from clipboard?')) {
                    handlePasteFiles('new', text);
                }
            }));
            dropdown.appendChild(createMenuItem('Paste Append Rows', function () {
                handlePasteFiles('append');
            }));
            dropdown.appendChild(createMenuItem('Copy Table', function () {
                if (d.handleCopyTable) { d.handleCopyTable(); }
            }));
            dropdown.appendChild(createMenuItem('Remove Files', function () {
                if (!app.data.files.length) {
                    if (d.setStatus) { d.setStatus('File list is already empty', 'error'); }
                    return;
                }
                if (confirm('Remove all ' + app.data.files.length + ' files from the list? Header info and remarks will be kept.')) {
                    app.data.files = [];
                    updateFilesInJson([]);
                    filesModule.render();
                    app.state.apply();
                    app.markDirty();
                    if (d.setStatus) { d.setStatus('File list cleared', 'success'); }
                }
            }));
            dropdown.appendChild(createSeparator());
            dropdown.appendChild(createMenuItem('Import HTML', function () {
                if (d.handleImportHtml) { d.handleImportHtml(); }
            }));
            dropdown.appendChild(createMenuItem('Copy JSON', function () {
                if (d.handleCopyJson) { d.handleCopyJson(); }
            }));
            dropdown.appendChild(createMenuItem('Paste JSON', function () {
                if (d.handleLoadFromClipboard) { d.handleLoadFromClipboard(); }
            }));
            dropdown.appendChild(createSeparator());
            dropdown.appendChild(createMenuItem('Reset', function () {
                if (app.modules.reset && app.modules.reset.handleReset) {
                    app.modules.reset.handleReset();
                }
            }, { danger: true }));
            dropdown.appendChild(createSeparator());
            dropdown.appendChild(createMenuItem('Create Index', function () {
                if (!requireFileSystemAccess()) { return; }
                if (filesModule.generateArchiveRedirects) {
                    filesModule.generateArchiveRedirects().catch(function (err) {
                        console.error('[transmittal] create-index failed', err);
                    });
                }
            }));
        }
    }

    // ── Bottom bar dropdown toggle ──────────────────────
    function initBottomBarToggle() {
        var toggle = dom.qs('#bottom-toggle');
        var menu = dom.qs('#bottom-dropdown');
        if (!toggle || !menu) { return; }

        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            var open = !menu.classList.contains('hidden');
            menu.classList.toggle('hidden', open);
            toggle.setAttribute('aria-expanded', String(!open));
        });

        menu.addEventListener('click', function () {
            menu.classList.add('hidden');
            toggle.setAttribute('aria-expanded', 'false');
        });

        document.addEventListener('click', function (e) {
            var container = dom.qs('#bottom-menu');
            if (container && !container.contains(e.target)) {
                menu.classList.add('hidden');
                toggle.setAttribute('aria-expanded', 'false');
            }
        });
    }


    async function refreshDirectory() {
        var dirHandle = app.data.selectedDirHandle;
        if (!dirHandle) { return; }
        try {
            // Ensure directory handle has permission before scanning
            await ensureDirHandlePermission(dirHandle);
            
            // Build expected-hash lookup from current JSON
            var expectedHashes = {};
            var currentData = json.parse();
            var loadedFiles = (currentData && currentData.payload && Array.isArray(currentData.payload.files)) ? currentData.payload.files : [];
            loadedFiles.forEach(function (f) {
                var key = (f.path ? f.path + '/' : '') + f.filename;
                if (f.sha256) { expectedHashes[key.toLowerCase()] = f.sha256.toLowerCase(); }
            });
            var hasExpected = Object.keys(expectedHashes).length > 0;
            var matchCount = 0;
            var mismatchCount = 0;

            var hashCells = await scanEntries(dirHandle, hasExpected ? function (item, hash) {
                if (!item.cell) { return; }
                var display = util.formatShortFileHash(hash);
                var fileKey = (item.fileData.path || item.fileData.name).toLowerCase();
                var expected = expectedHashes[fileKey];
                if (expected && expected === hash.toLowerCase()) {
                    item.cell.innerHTML = '<span class="hash-match" title="Hash matches expected value">\u2713</span> ' + display;
                    matchCount++;
                } else if (expected) {
                    item.cell.innerHTML = '<span class="hash-mismatch" title="Hash does NOT match expected value">\u2717</span> ' + display;
                    mismatchCount++;
                } else {
                    item.cell.textContent = display;
                }
            } : null);

            if (hasExpected && app.modules.data && app.modules.data.setStatus) {
                if (mismatchCount === 0 && matchCount > 0) {
                    app.modules.data.setStatus(matchCount + '/' + hashCells.length + ' files verified', 'success');
                } else if (mismatchCount > 0) {
                    app.modules.data.setStatus(mismatchCount + ' hash mismatch(es) \u2014 ' + matchCount + ' matched', 'error');
                }
            }

            finalizeAfterScan();
            if (!hasExpected) { app.markDirty(); }
        } catch (err) {
            console.error('[transmittal] Refresh failed', err);
        } finally {
            setScanningState(false);
        }
    }

    // ── Verify row helpers ────────────────────────────────────
    function findRowByFileIndex(idx) {
        var cell = document.querySelector('td[data-index="' + idx + '"]');
        return cell ? cell.closest('tr') : null;
    }

    function getHashCell(row) {
        return row ? row.querySelector('td:last-child') : null;
    }

    function setRowVerifyState(row, state) {
        if (!row) { return; }
        row.classList.remove('verify-match', 'verify-mismatch', 'verify-missing', 'verify-new', 'verify-progress');
        if (state) { row.classList.add('verify-' + state); }
    }

    function clearAllVerifyStates() {
        var rows = document.querySelectorAll('tr.verify-match, tr.verify-mismatch, tr.verify-missing, tr.verify-new, tr.verify-progress');
        rows.forEach(function (r) {
            r.classList.remove('verify-match', 'verify-mismatch', 'verify-missing', 'verify-new', 'verify-progress');
        });
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showPathDiff(trackingCell, expectedPath, actualPath) {
        var diffEl = document.createElement('div');
        diffEl.className = 'path-diff';
        var del = document.createElement('del');
        del.textContent = expectedPath;
        var ins = document.createElement('ins');
        ins.textContent = actualPath;
        diffEl.appendChild(del);
        diffEl.appendChild(document.createTextNode(' \u2192 '));
        diffEl.appendChild(ins);
        trackingCell.appendChild(diffEl);
    }

    // Hash every directory entry upfront, before any event-loop yields.
    // On file:// origins in Chromium, FileSystemFileHandle.getFile() fails after
    // macrotask boundaries have elapsed since the handle was created. The fix is
    // to call getFile() + hashFile() back-to-back for each entry in one tight
    // sequential pass, producing a complete index before any UI yields occur.
    // Returns { sizeIndex, nameIndex } where each entry has hash already computed.
    async function buildVerifyIndex(entries, onProgress) {
        var sizeIndex = {};  // fileSize → [candidate]
        var nameIndex = {};  // "tracking\trevision" → candidate
        var entryList = [];  // List of file metadata for later use
        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            try {
                var file = await entry.handle.getFile();
                var hash = await util.hashFile(file);
                var cand = {
                    handle: entry.handle,
                    path: entry.path,
                    name: file.name,
                    fileSize: file.size,
                    hash: hash,
                    matched: false
                };
                // Store file metadata for later use
                entryList.push({
                    handle: entry.handle,
                    path: entry.path,
                    name: file.name,
                    fileSize: file.size,
                    hash: hash,
                    parsed: parseFilename(entry.name)
                });
                // size index
                if (!sizeIndex[file.size]) { sizeIndex[file.size] = []; }
                sizeIndex[file.size].push(cand);
                // name index
                var parsed = parseFilename(entry.name);
                if (parsed.trackingNumber) {
                    var nkey = parsed.trackingNumber.toLowerCase() + '\t' + (parsed.revision || '').toLowerCase();
                    if (!nameIndex[nkey]) { nameIndex[nkey] = []; }
                    nameIndex[nkey].push(cand);
                }
                if (onProgress) { onProgress(i + 1, entries.length); }
            } catch (err) {
                console.warn('[transmittal] verify skip entry', entry.path, err);
            }
        }
        return { sizeIndex: sizeIndex, nameIndex: nameIndex, entryList: entryList };
    }

    // Find a matching directory entry by sha256 hash.
    function findByHash(sizeIndex, fileSize, expectedHash) {
        if (!expectedHash || fileSize == null) { return null; }
        var candidates = sizeIndex[fileSize];
        if (!candidates) { return null; }
        var target = expectedHash.toLowerCase();
        for (var c = 0; c < candidates.length; c++) {
            var cand = candidates[c];
            if (cand.matched) { continue; }
            if (cand.hash && cand.hash.toLowerCase() === target) {
                cand.matched = true;
                return cand;
            }
        }
        return null;
    }

    // Find a matching directory entry by tracking number + revision.
    function findByTrackingRevision(nameIndex, trackingNumber, revision) {
        var key = (trackingNumber || '').toLowerCase() + '\t' + (revision || '').toLowerCase();
        var candidates = nameIndex[key];
        if (!candidates || !candidates.length) { return null; }
        for (var i = 0; i < candidates.length; i++) {
            if (!candidates[i].matched) {
                candidates[i].matched = true;
                return candidates[i];
            }
        }
        return null;
    }

    // Count unmatched entries in a size index
    function countUnmatched(sizeIndex) {
        var count = 0;
        for (var size in sizeIndex) {
            var group = sizeIndex[size];
            for (var i = 0; i < group.length; i++) {
                if (!group[i].matched) { count++; }
            }
        }
        return count;
    }

    async function verifyFiles() {
        var isPublished = !!app.state.published;
        var setStatus = app.modules.data && app.modules.data.setStatus;
        try {
            var dirHandle = app.data.selectedDirHandle;
            if (!dirHandle) {
                dirHandle = await ensureDirHandle();
            }
            clearAllVerifyStates();
            if (setStatus) { setStatus('Hashing directory\u2026', 'info'); }

            var entries = await collectDirectoryEntries(dirHandle);
            var allFiles = app.data.files || [];

            // Hash every file upfront before any UI yields — on file:// origins,
            // Chromium invalidates FileSystemFileHandle after macrotask boundaries.
            var idx = await buildVerifyIndex(entries);
            var sizeIndex = idx.sizeIndex;
            var nameIndex = idx.nameIndex;
            var entryList = idx.entryList || [];

            // Build pasteKey index for existing files to avoid duplicates
            var existingIndex = buildExistingIndex(allFiles);
            var existingPasteKeys = Object.keys(existingIndex);

            if (isPublished) {
                // ── Published: read-only verification by hash ──
                var verified = 0;
                var missingCount = 0;

                for (var p = 0; p < allFiles.length; p++) {
                    var tf = allFiles[p];
                    var row = findRowByFileIndex(p);
                    var hCell = getHashCell(row);
                    var trackingCell = row ? row.querySelector('td[data-field="trackingNumber"]') : null;

                    setRowVerifyState(row, 'progress');
                    await new Promise(function (r) { setTimeout(r, 0); });

                    var fileSize = tf.fileSize != null ? tf.fileSize : tf.size;
                    var found = findByHash(sizeIndex, fileSize, tf.sha256);

                    if (found) {
                        verified++;
                        tf.fileHandle = found.handle;
                        setRowVerifyState(row, 'match');
                        if (hCell) {
                            hCell.innerHTML = '<span style="color:#166534;font-weight:700;">\u2713</span> ' + escapeHtml(util.formatShortFileHash(tf.sha256));
                        }
                        var expectedPath = tf.path || tf.name || '';
                        if (trackingCell && expectedPath && found.path && expectedPath !== found.path) {
                            showPathDiff(trackingCell, expectedPath, found.path);
                        }
                    } else {
                        missingCount++;
                        setRowVerifyState(row, 'missing');
                        if (hCell) {
                            hCell.innerHTML = '<span style="color:#92400e;">\u26A0 not found</span>';
                        }
                    }
                }

                var extra = countUnmatched(sizeIndex);
                var msg = verified + ' verified';
                if (missingCount) { msg += ', ' + missingCount + ' missing'; }
                if (extra) { msg += ', ' + extra + ' extra in directory'; }
                if (setStatus) {
                    setStatus(msg, missingCount ? 'error' : 'success');
                }
            } else {
                // ── Edit: match rows against directory ──
                // Rows WITH hash+size → match by size+hash
                // Rows WITHOUT hash → match by tracking+revision, then populate hash/size
                var verified = 0;
                var populated = 0;
                var notFound = 0;
                var dirty = false;

                for (var mi = 0; mi < allFiles.length; mi++) {
                    var mf = allFiles[mi];
                    var mRow = findRowByFileIndex(mi);
                    var mhCell = getHashCell(mRow);

                    setRowVerifyState(mRow, 'progress');
                    await new Promise(function (r) { setTimeout(r, 0); });

                    var hasHash = !!mf.sha256;
                    var mFileSize = mf.fileSize != null ? mf.fileSize : mf.size;

                    if (hasHash && mFileSize != null) {
                        var foundByHash = findByHash(sizeIndex, mFileSize, mf.sha256);
                        if (foundByHash) {
                            mf.fileHandle = foundByHash.handle;
                            verified++;
                            setRowVerifyState(mRow, 'match');
                            if (mhCell) {
                                mhCell.innerHTML = '<span style="color:#166534;font-weight:700;">\u2713</span> ' + escapeHtml(util.formatShortFileHash(mf.sha256));
                            }
                        } else {
                            mf.fileHandle = null;
                            notFound++;
                            setRowVerifyState(mRow, 'missing');
                            if (mhCell) {
                                mhCell.innerHTML = '<span style="color:#92400e;">\u26A0 not found</span>';
                            }
                        }
                    } else {
                        var foundByName = findByTrackingRevision(nameIndex, mf.trackingNumber, mf.revision);
                        if (foundByName) {
                            mf.fileHandle = foundByName.handle;
                            mf.path = foundByName.path;
                            mf.name = foundByName.name;
                            mf.size = foundByName.fileSize;
                            mf.fileSize = foundByName.fileSize;
                            mf.sha256 = foundByName.hash;
                            mf.extension = mf.extension || (foundByName.name.split('.').pop() || '').toLowerCase();
                            populated++;
                            dirty = true;
                            setRowVerifyState(mRow, 'match');
                            if (mhCell) {
                                mhCell.innerHTML = '<span style="color:#166534;font-weight:700;">\u2713</span> ' + escapeHtml(util.formatShortFileHash(mf.sha256));
                            }
                        } else {
                            notFound++;
                            setRowVerifyState(mRow, 'missing');
                            if (mhCell) {
                                mhCell.innerHTML = '<span style="color:#92400e;">\u26A0 not found</span>';
                            }
                        }
                    }
                }

                if (dirty) {
                    updateFilesInJson(allFiles);
                    filesModule.render();
                    app.state.apply();
                    app.markDirty();
                }

                var editMsg = '';
                var parts = [];
                if (verified) { parts.push(verified + ' verified'); }
                if (populated) { parts.push(populated + ' matched'); }
                if (notFound) { parts.push(notFound + ' not found'); }
                editMsg = parts.join(', ') || 'No files to verify';

                // Add new files from directory that don't match existing pasteKeys
                var added = 0;
                for (var ei = 0; ei < entryList.length; ei++) {
                    var entryData = entryList[ei];
                    if (!entryData.parsed.trackingNumber && !entryData.parsed.revision) continue; // Skip files without ZDDC pattern
                    var pasteKey = (entryData.parsed.trackingNumber || '').toLowerCase() + '|' + (entryData.parsed.revision || '').toLowerCase();
                    if (existingPasteKeys.indexOf(pasteKey) === -1) {
                        // New file - use pre-hashed file data
                        var fileData = {
                            path: entryData.path,
                            name: entryData.name,
                            size: entryData.fileSize,
                            fileSize: entryData.fileSize,
                            sha256: '',
                            trackingNumber: entryData.parsed.trackingNumber,
                            title: entryData.parsed.title,
                            revision: entryData.parsed.revision,
                            status: entryData.parsed.status,
                            extension: entryData.parsed.extension || (entryData.name.split('.').pop() || ''),
                            fileHandle: entryData.handle
                        };
                        app.data.files.push(fileData);
                        added++;
                    }
                }
                if (added > 0) {
                    dirty = true;
                    updateFilesInJson(app.data.files);
                    filesModule.render();
                    app.state.apply();
                    app.markDirty();
                    editMsg = (editMsg ? editMsg + ', ' : '') + added + ' new file(s) added';
                }

                if (setStatus) {
                    setStatus(editMsg, notFound && !added ? 'error' : 'success');
                }
            }
        } catch (err) {
            if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
                if (DEBUG) console.log('[transmittal] User cancelled verify');
            } else {
                console.error('[transmittal] verifyFiles failed', err);
                if (setStatus) { setStatus('Verify failed: ' + (err.message || err), 'error'); }
            }
        }
    }

    document.addEventListener('transmittal:scan-directory', function () {
        selectDirectory({ currentTarget: dom.qs('#bottom-primary') });
    });

    document.addEventListener('transmittal:verify-directory', function () {
        verifyFiles();
    });

    filesModule.bindActionButtons = function bindActionButtons() {
        // Reveal the menu now that JS is running
        var bottomMenu = dom.qs('#bottom-menu');
        if (bottomMenu) { bottomMenu.hidden = false; }
        var noJsNotice = dom.qs('#no-js-notice');
        if (noJsNotice) { dom.show(noJsNotice, false); }
        initBottomBarToggle();
        updateToolbars();
    };

    filesModule.updateToolbars = updateToolbars;

    filesModule.syncUiToJson = function syncUiToJson() {
        const val = function (selector) {
            const el = dom.qs(selector);
            return el ? (el.value || '') : '';
        };

        function toIsoDate(value) {
            if (!value) {
                return '';
            }
            const trimmed = String(value).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                return trimmed;
            }
            const match = trimmed.match(/^(?:[A-Za-z]+\s+)?([A-Za-z]{3,})\s+(\d{1,2}),\s*(\d{4})$/);
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            if (match) {
                const monthIndex = months.indexOf(match[1].slice(0, 3));
                if (monthIndex >= 0) {
                    const day = String(parseInt(match[2], 10)).padStart(2, '0');
                    const month = String(monthIndex + 1).padStart(2, '0');
                    const year = match[3];
                    return year + '-' + month + '-' + day;
                }
            }
            const date = new Date(trimmed);
            if (!Number.isNaN(date.getTime())) {
                return date.toISOString().slice(0, 10);
            }
            return trimmed;
        }

        const data = json.parse();
        const envelope = { ...(data.envelope || {}) };
        const presentation = { ...(data.presentation || {}) };
        
        const payload = {
            version: 1,
            type: val('#type'),
            title: val('#title') || '',
            client: (dom.qs('#owner-name')?.textContent) || '',
            project: (dom.qs('#project-name')?.textContent) || '',
            projectNumber: (dom.qs('#project-number')?.textContent) || '',
            date: toIsoDate(val('#date')),
            trackingNumber: val('#tracking-number'),
            from: val('#from'),
            to: val('#to'),
            purpose: val('#purpose'),
            responseDue: val('#response-due'),
            subject: val('#subject'),
            remarks: val('#remarks'),
            files: (function () {
                var memFiles = Array.isArray(app.data.files) ? app.data.files : [];
                var sorted = memFiles.slice().sort(util.compareFilesByTrackingRevision).map(canonicalFilePayload);
                var self = buildSelfEntry();
                return [canonicalFilePayload(self)].concat(sorted);
            })()
        };
        
        const leftLogoEl = dom.qs('#left-logo');
        const rightLogoEl = dom.qs('#right-logo');
        presentation.leftLogo = leftLogoEl && leftLogoEl.src ? leftLogoEl.src : '';
        presentation.rightLogo = rightLogoEl && rightLogoEl.src ? rightLogoEl.src : '';
        
        json.setData({ envelope: envelope, payload: payload, presentation: presentation });
    };

    filesModule.loadFromJson = function loadFromJson(options) {
        const opts = options || {};
        const data = json.parse();
        const payload = (data && data.payload) || {};
        if (!opts.filesOnly) {
            const assignValue = function (selector, value) {
                const element = dom.qs(selector);
                if (element) {
                    element.value = value || '';
                }
            };
            const assignText = function (selector, value) {
                const element = dom.qs(selector);
                if (element) {
                    element.textContent = value || '';
                }
            };
            assignValue('#type', payload.type || 'Transmittal');
            var typeDisplay = dom.qs('#type-display');
            if (typeDisplay) { typeDisplay.textContent = payload.type || 'Transmittal'; }
            assignValue('#title', payload.title || '');
            assignText('#owner-name', payload.client || '');
            assignText('#project-name', payload.project || '');
            assignText('#project-number', payload.projectNumber || '');
            assignValue('#date', payload.date || '');
            assignValue('#tracking-number', payload.trackingNumber || '');
            assignValue('#from', payload.from || '');
            assignValue('#to', payload.to || '');
            assignValue('#purpose', payload.purpose || '');
            assignValue('#response-due', payload.responseDue || '');
            assignValue('#subject', payload.subject || '');
            const remarks = dom.qs('#remarks');
            if (remarks) {
                remarks.value = payload.remarks || '';
            }
            
            // Load logos from presentation data
            const presentation = (data && data.presentation) || {};
            const leftLogoEl = dom.qs('#left-logo');
            const rightLogoEl = dom.qs('#right-logo');
            if (leftLogoEl && presentation.leftLogo) {
                leftLogoEl.src = presentation.leftLogo;
            }
            if (rightLogoEl && presentation.rightLogo) {
                rightLogoEl.src = presentation.rightLogo;
            }
        }
        var SELF_HASH = app.constants.SELF_HASH;
        const files = Array.isArray(payload.files)
            ? payload.files.filter(function (f) { return f.sha256 !== SELF_HASH; })
            : [];
        app.data.files = files.map(function (entry) {
            const pathOnly = entry.path || '';
            const filename = entry.filename || '';
            const relativePath = pathOnly ? (pathOnly + '/' + filename) : filename;
            
            // When filename is empty (e.g., from pasted files), reconstruct from trackingNumber
            let baseName = filename || relativePath.split('/').pop() || '';
            if (!baseName && entry.trackingNumber) {
                baseName = entry.trackingNumber + '.' + (entry.extension || '');
            }
            
            const ext = (baseName || '').split('.').pop() || '';
            const fileSize = entry.fileSize || entry.size || 0;
            return {
                path: relativePath,
                name: baseName,
                size: fileSize,
                fileSize: fileSize,
                sha256: entry.sha256 || '',
                trackingNumber: entry.trackingNumber || '',
                title: entry.title || '',
                revision: entry.revision || '',
                status: entry.status || '',
                extension: ext.toLowerCase()
            };
        });
        sortFilesInPlace(app.data.files);
        // Don't call updateFilesInJson here - it clears digest/signatures
        // The files are already in the JSON, we're just loading them into app.data.files
        updateDirectoryIndicator(app.data.selectedDirHandle ? app.data.selectedDirHandle.name : '');
        
        // Render the table to populate it with file data
        filesModule.render();
        
        if (!opts.filesOnly && app.modules.markdown && typeof app.modules.markdown.refresh === 'function') {
            app.modules.markdown.refresh();
        }
        // Apply field visibility after loading data to ensure UI stays in sync
        if (!opts.filesOnly && app.modules.visibility && typeof app.modules.visibility.applyFieldVisibility === 'function') {
            app.modules.visibility.applyFieldVisibility();
        }
    };

    app.registerInit(function () {
        updateDirectoryIndicator(app.data.selectedDirHandle ? app.data.selectedDirHandle.name : '');
        filesModule.bindActionButtons();
        filesModule.setupTableEditing();
    });
})(window.transmittalApp);
