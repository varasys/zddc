// Table management functionality

// Update file table
function updateFileTable() {
    const tbody = document.getElementById('filesTableBody');
    
    if (APP_STATE.filteredFiles.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="empty-table">
                    No files found matching the current filters.
                </td>
            </tr>
        `;
        cleanupUnusedBlobUrls(); // Clean up all blob URLs
        return;
    }
    
    // Group and sort files
    const grouped = groupFilesByTrackingNumber(APP_STATE.filteredFiles);
    const sorted = sortGroupedFiles(grouped);
    
    // Build table rows
    const rows = [];
    sorted.forEach(group => {
        rows.push(createFileGroupRow(group));
    });
    
    tbody.innerHTML = rows.join('');
    
    // Clean up blob URLs for files no longer visible
    cleanupUnusedBlobUrls();
}

// Create row for a file group
function createFileGroupRow(group) {
    const revisionsHtml = group.sortedRevisions.map(revision => 
        createRevisionHtml(group.trackingNumber, revision)
    ).join('');
    
    // Build titles column - each revision's title on its own line
    const titlesHtml = group.sortedRevisions.map(revision => {
        const titleClass = revision.hasModifier ? 'revision-title-modifier' : 'revision-title-base';
        return `<div class="${titleClass}">${escapeHtml(revision.title)}</div>`;
    }).join('');
    
    return `
        <tr>
            <td data-field="trackingNumber">${escapeHtml(group.trackingNumber)}</td>
            <td data-field="title">
                <div class="titles-container">
                    ${titlesHtml}
                </div>
            </td>
            <td data-field="revisions">
                <div class="revisions-container">
                    ${revisionsHtml}
                </div>
            </td>
        </tr>
    `;
}

// Create HTML for a revision
function createRevisionHtml(trackingNumber, revision) {
    const filesHtml = revision.files.map(file => 
        createFileHtml(file)
    ).join(' ');
    
    return `
        <div class="revision-group">
            <div class="revision-item">
                <span class="revision-info">
                    <span class="revision-id">${escapeHtml(revision.revision)}</span>
                    <span class="revision-status">(${escapeHtml(revision.status)})</span>
                </span>
                ${filesHtml}
            </div>
        </div>
    `;
}

// Create HTML for a file
function createFileHtml(file) {
    const checked = APP_STATE.selectedFiles.has(file.id) ? 'checked' : '';
    const fullPath = file.path || file.folderPath + '/' + file.name;
    
    // Handle files with path errors (Windows 260-char limit)
    if (file.hasPathError) {
        const errorTitle = `⚠️ Cannot access: Microsoft Windows path length limit (260 chars)\n\nPath: ${fullPath}\n\nUse 'subst' to map archive to a drive letter, or shorten folder names.`;
        return `
            <span class="revision-file">
                <input type="checkbox" 
                       data-file-id="${file.id}"
                       ${checked}
                       onchange="toggleFileSelection('${file.id}')">
                <span class="path-error-indicator" title="${escapeHtml(errorTitle)}">⚠️</span>
                <span class="file-link-disabled"
                      title="${escapeHtml(errorTitle)}">
                    <span class="file-ext">${escapeHtml(file.extension.toUpperCase())}</span>
                </span>
            </span>
        `;
    }
    
    return `
        <span class="revision-file">
            <input type="checkbox" 
                   data-file-id="${file.id}"
                   ${checked}
                   onchange="toggleFileSelection('${file.id}')">
            <a href="#" 
               class="file-link"
               data-file-id="${file.id}"
               data-file-name="${escapeHtml(file.name)}"
               title="${escapeHtml(fullPath)}">
                <span class="file-ext">${escapeHtml(file.extension.toUpperCase())}</span>
            </a>
        </span>
    `;
}

// Toggle file selection
function toggleFileSelection(fileId) {
    if (APP_STATE.selectedFiles.has(fileId)) {
        APP_STATE.selectedFiles.delete(fileId);
    } else {
        APP_STATE.selectedFiles.add(fileId);
    }
    updateStatusBar();
    updateSelectAllVisibleCheckbox();
}

// Toggle selection of all visible files based on checkbox state
function toggleSelectAllVisible(selectAll) {
    APP_STATE.filteredFiles.forEach(file => {
        if (selectAll) {
            APP_STATE.selectedFiles.add(file.id);
        } else {
            APP_STATE.selectedFiles.delete(file.id);
        }
    });
    
    updateFileTable();
    updateStatusBar();
    updateSelectAllVisibleCheckbox();
}

// Update the select all visible checkbox to reflect current state
function updateSelectAllVisibleCheckbox() {
    const checkbox = document.getElementById('selectAllVisibleCheckbox');
    if (!checkbox) return;
    
    const visibleCount = APP_STATE.filteredFiles.length;
    if (visibleCount === 0) {
        checkbox.checked = false;
        checkbox.indeterminate = false;
        return;
    }
    
    const selectedVisibleCount = APP_STATE.filteredFiles.filter(f => 
        APP_STATE.selectedFiles.has(f.id)
    ).length;
    
    if (selectedVisibleCount === 0) {
        checkbox.checked = false;
        checkbox.indeterminate = false;
    } else if (selectedVisibleCount === visibleCount) {
        checkbox.checked = true;
        checkbox.indeterminate = false;
    } else {
        checkbox.checked = false;
        checkbox.indeterminate = true;
    }
}

/**
 * Memory-efficient blob URL management
 * 
 * fileBlobCache: Maps file IDs to blob URLs for reuse
 * processedLinks: WeakSet tracks DOM elements that already have blob URLs
 *   - Automatically garbage collected when DOM elements are removed
 *   - Prevents redundant async operations on mouseover
 */
const fileBlobCache = new Map();
const processedLinks = new WeakSet();

/**
 * Get or create a blob URL for a file
 * @param {Object} file - File object with handle and metadata
 * @returns {Promise<string>} Blob URL
 */
async function getFileBlobUrl(file) {
    // HTTP mode: direct URL, no blob needed
    if (!file.handle && file.url) {
        return file.url;
    }
    
    // Return cached URL if available
    if (fileBlobCache.has(file.id)) {
        return fileBlobCache.get(file.id);
    }
    
    try {
        const fileHandle = file.handle;
        const fileData = await fileHandle.getFile();
        
        // Create blob with proper MIME type
        const mimeType = getMimeType(file.extension);
        const blob = new Blob([await fileData.arrayBuffer()], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        // Cache the URL
        fileBlobCache.set(file.id, url);
        
        return url;
    } catch (err) {
        console.error('Error creating blob URL:', err);
        throw err;
    }
}

/**
 * Clean up blob URLs for files no longer displayed
 */
function cleanupUnusedBlobUrls() {
    const displayedFileIds = new Set(APP_STATE.filteredFiles.map(f => f.id));
    
    for (const [fileId, url] of fileBlobCache.entries()) {
        if (!displayedFileIds.has(fileId)) {
            URL.revokeObjectURL(url);
            fileBlobCache.delete(fileId);
        }
    }
}

/**
 * Revoke all blob URLs and clear cache
 */
function cleanupAllBlobUrls() {
    for (const url of fileBlobCache.values()) {
        URL.revokeObjectURL(url);
    }
    fileBlobCache.clear();
}

// Track if event handlers are attached to avoid duplicates
let fileLinkHandlersAttached = false;

// Current file preview window reference
let filePreviewWindow = null;

// Extensions that support in-browser preview
const PREVIEW_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'xls'];

// Cache for lazily loaded CDN libraries
const loadedLibraries = new Map();

/**
 * Lazily load a script from CDN. Returns a promise that resolves when loaded.
 * Caches the promise so subsequent calls return immediately.
 */
function loadLibrary(url) {
    if (loadedLibraries.has(url)) return loadedLibraries.get(url);
    const promise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load library: ${url}`));
        document.head.appendChild(script);
    });
    loadedLibraries.set(url, promise);
    return promise;
}

/**
 * Check if file preview mode is enabled
 */
function isFilePreviewEnabled() {
    const toggle = document.getElementById('filePreviewToggle');
    return toggle && toggle.checked;
}

/**
 * Show file preview in a separate popup window
 * Supports PDF (iframe), DOCX (docx-preview), XLSX/XLS (SheetJS)
 */
async function showFilePreview(file) {
    const ext = file.extension.toLowerCase();
    
    try {
        const url = await getFileBlobUrl(file);
        
        // Base HTML shell for the preview window
        const previewHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>${escapeHtml(file.name)} - Preview</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            display: flex; 
            flex-direction: column; 
            height: 100vh; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .toolbar {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: #f5f5f5;
            border-bottom: 1px solid #ddd;
        }
        .toolbar h1 {
            flex: 1;
            font-size: 0.95rem;
            font-weight: 500;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .btn {
            padding: 0.4rem 0.8rem;
            font-size: 0.85rem;
            border: 1px solid #ccc;
            border-radius: 4px;
            background: white;
            cursor: pointer;
        }
        .btn:hover { background: #e8e8e8; }
        iframe {
            flex: 1;
            width: 100%;
            border: none;
        }
        #previewContent {
            flex: 1;
            overflow: auto;
        }
        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #666;
            font-size: 1.1rem;
        }
        /* docx-preview container */
        .docx-wrapper { padding: 1rem; }
        /* xlsx table styling */
        .xlsx-table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
        .xlsx-table th, .xlsx-table td {
            border: 1px solid #ddd;
            padding: 0.35rem 0.5rem;
            text-align: left;
            white-space: nowrap;
        }
        .xlsx-table th { background: #f0f0f0; font-weight: 600; position: sticky; top: 0; }
        .xlsx-table tr:nth-child(even) { background: #fafafa; }
        .xlsx-table tr:hover { background: #f0f7ff; }
        .sheet-tabs { display: flex; gap: 0; border-bottom: 1px solid #ddd; background: #f5f5f5; }
        .sheet-tab {
            padding: 0.4rem 1rem;
            cursor: pointer;
            border: 1px solid transparent;
            border-bottom: none;
            font-size: 0.85rem;
            background: transparent;
        }
        .sheet-tab:hover { background: #e8e8e8; }
        .sheet-tab.active {
            background: white;
            border-color: #ddd;
            border-bottom-color: white;
            margin-bottom: -1px;
            font-weight: 500;
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <h1>${escapeHtml(file.name)}</h1>
        <button class="btn" onclick="downloadFile()">Download</button>
    </div>
    ${ext === 'pdf' ? '<iframe src="' + url + '"></iframe>' : '<div id="previewContent"><div class="loading">Loading preview...</div></div>'}
    <script>
        var blobUrl = "${url}";
        var fileName = "${escapeHtml(file.name).replace(/"/g, '\\"')}";
        
        function downloadFile() {
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    <\/script>
</body>
</html>`;
        
        // Open or reuse the preview window
        if (filePreviewWindow && !filePreviewWindow.closed) {
            filePreviewWindow.document.open();
            filePreviewWindow.document.write(previewHtml);
            filePreviewWindow.document.close();
            filePreviewWindow.focus();
        } else {
            const width = Math.round(screen.width * 0.6);
            const height = Math.round(screen.height * 0.8);
            const left = Math.round((screen.width - width) / 2);
            const top = Math.round((screen.height - height) / 2);
            
            filePreviewWindow = window.open('', 'filePreview', 
                `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
            
            if (!filePreviewWindow) {
                window.open(url, '_blank');
                return;
            }
            
            filePreviewWindow.document.write(previewHtml);
            filePreviewWindow.document.close();
            filePreviewWindow.focus();
        }
        
        // For non-PDF types, render content into the preview window
        if (ext === 'docx') {
            await renderDocxInWindow(file);
        } else if (ext === 'xlsx' || ext === 'xls') {
            await renderXlsxInWindow(file);
        }
        
    } catch (err) {
        console.error('Error loading file preview:', err);
        alert(`Error loading preview: ${err.message}`);
    }
}

/**
 * Render a DOCX file in the preview window using docx-preview library
 */
async function renderDocxInWindow(file) {
    const container = filePreviewWindow.document.getElementById('previewContent');
    if (!container) return;
    
    try {
        await loadLibrary('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
        await loadLibrary('https://cdn.jsdelivr.net/npm/docx-preview@latest/dist/docx-preview.min.js');
        
        const arrayBuffer = await (file.handle
            ? file.handle.getFile().then(f => f.arrayBuffer())
            : fetch(file.url).then(r => r.arrayBuffer()));
        
        container.innerHTML = '';
        await window.docx.renderAsync(arrayBuffer, container);
    } catch (err) {
        console.error('Error rendering DOCX:', err);
        container.innerHTML = `<div class="loading">Error rendering DOCX: ${err.message}<br>Click Download to view in Word.</div>`;
    }
}

/**
 * Render an XLSX/XLS file in the preview window using SheetJS
 */
async function renderXlsxInWindow(file) {
    const container = filePreviewWindow.document.getElementById('previewContent');
    if (!container) return;
    
    try {
        await loadLibrary('https://cdn.jsdelivr.net/npm/xlsx@latest/dist/xlsx.full.min.js');
        
        const arrayBuffer = await (file.handle
            ? file.handle.getFile().then(f => f.arrayBuffer())
            : fetch(file.url).then(r => r.arrayBuffer()));
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        container.innerHTML = '';
        
        // Build sheet tabs if multiple sheets
        if (workbook.SheetNames.length > 1) {
            const tabs = filePreviewWindow.document.createElement('div');
            tabs.className = 'sheet-tabs';
            workbook.SheetNames.forEach((name, i) => {
                const tab = filePreviewWindow.document.createElement('button');
                tab.className = 'sheet-tab' + (i === 0 ? ' active' : '');
                tab.textContent = name;
                tab.onclick = () => {
                    tabs.querySelectorAll('.sheet-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    renderSheet(workbook, name, tableContainer);
                };
                tabs.appendChild(tab);
            });
            container.appendChild(tabs);
        }
        
        const tableContainer = filePreviewWindow.document.createElement('div');
        tableContainer.style.flex = '1';
        tableContainer.style.overflow = 'auto';
        container.appendChild(tableContainer);
        
        renderSheet(workbook, workbook.SheetNames[0], tableContainer);
    } catch (err) {
        console.error('Error rendering XLSX:', err);
        container.innerHTML = `<div class="loading">Error rendering spreadsheet: ${err.message}<br>Click Download to view in Excel.</div>`;
    }
}

/**
 * Render a single sheet as an HTML table
 */
function renderSheet(workbook, sheetName, container) {
    const sheet = workbook.Sheets[sheetName];
    const html = XLSX.utils.sheet_to_html(sheet, { editable: false });
    container.innerHTML = html;
    // Apply styling to the generated table
    const table = container.querySelector('table');
    if (table) table.className = 'xlsx-table';
}

/**
 * Setup event delegation for file links
 * Left-click: Download file (or preview if PDF and preview mode enabled)
 * Right-click: Allow "Open in new tab" with blob URL
 */
function setupFileLinkHandlers() {
    if (fileLinkHandlersAttached) return;
    
    const table = document.getElementById('filesTable');
    if (!table) {
        console.warn('Files table not found');
        return;
    }
    
    // Handle clicks - download file or show preview
    table.addEventListener('click', async (e) => {
        const link = e.target.closest('.file-link');
        if (!link) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const fileId = link.getAttribute('data-file-id');
        const fileName = link.getAttribute('data-file-name');
        
        if (!fileId || !fileName) {
            console.error('Invalid link data');
            return;
        }
        
        const file = APP_STATE.files.find(f => f.id === fileId);
        
        if (!file) {
            console.error(`File not found: ${fileId}`);
            alert('File not found. Please refresh and try again.');
            return;
        }
        
        // Check if file preview is enabled and file type is previewable
        if (isFilePreviewEnabled() && PREVIEW_EXTENSIONS.includes(file.extension.toLowerCase())) {
            await showFilePreview(file);
            return;
        }
        
        try {
            if (!file.handle && file.url) {
                // HTTP mode: open the file URL directly in a new tab
                window.open(file.url, '_blank');
            } else {
                // Local mode: create blob URL and trigger download
                const url = await getFileBlobUrl(file);
                const downloadLink = document.createElement('a');
                downloadLink.href = url;
                downloadLink.download = fileName;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            }
        } catch (err) {
            console.error('Error opening file:', err);
            alert(`Error opening file: ${err.message}`);
        }
    }, true); // Use capture phase
    
    // Handle mouseover - pre-load URL for fast right-click / middle-click
    table.addEventListener('mouseover', async (e) => {
        const link = e.target.closest('.file-link');
        if (!link) return;
        
        // Skip if already processed (prevents redundant operations)
        if (processedLinks.has(link)) return;
        
        const fileId = link.getAttribute('data-file-id');
        if (!fileId) return;
        
        const file = APP_STATE.files.find(f => f.id === fileId);
        if (!file) {
            console.warn(`File not found for pre-load: ${fileId}`);
            return;
        }
        
        try {
            if (!file.handle && file.url) {
                // HTTP mode: set href directly — no async needed
                link.href = file.url;
                link.target = '_blank';
                processedLinks.add(link);
            } else {
                // Local mode: pre-load blob URL asynchronously
                const url = await getFileBlobUrl(file);
                link.href = url;
                link.target = '_blank';
                processedLinks.add(link);
            }
        } catch (err) {
            console.error('Error pre-loading file link:', err);
            // Don't mark as processed so it can retry
        }
    }, true); // Use capture phase
    
    // Handle context menu - ensure blob URL is set (fallback if mouseover didn't fire)
    table.addEventListener('contextmenu', async (e) => {
        const link = e.target.closest('.file-link');
        if (!link) return;
        
        // If already processed, blob URL is set - allow context menu to work
        if (processedLinks.has(link)) return;
        
        const fileId = link.getAttribute('data-file-id');
        if (!fileId) return;
        
        const file = APP_STATE.files.find(f => f.id === fileId);
        if (!file) {
            console.warn(`File not found for context menu: ${fileId}`);
            return;
        }
        
        try {
            // Get blob URL and set it as href synchronously as possible
            const url = await getFileBlobUrl(file);
            link.href = url;
            link.target = '_blank';
            
            // Mark as processed
            processedLinks.add(link);
        } catch (err) {
            console.error('Error preparing file for context menu:', err);
            // Don't mark as processed so it can retry
        }
    }, true); // Use capture phase
    
    fileLinkHandlersAttached = true;
}

/**
 * Clean up resources when page unloads
 */
window.addEventListener('beforeunload', () => {
    cleanupAllBlobUrls();
});

// Get MIME type from extension
function getMimeType(extension) {
    const ext = extension.toLowerCase();
    const mimeTypes = {
        // Documents
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        
        // Text
        'txt': 'text/plain',
        'csv': 'text/csv',
        'html': 'text/html',
        'htm': 'text/html',
        'xml': 'text/xml',
        'json': 'application/json',
        
        // Code
        'js': 'text/javascript',
        'css': 'text/css',
        'py': 'text/plain',
        'java': 'text/plain',
        'cpp': 'text/plain',
        'c': 'text/plain',
        'h': 'text/plain',
        
        // Images
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'bmp': 'image/bmp',
        'svg': 'image/svg+xml',
        'webp': 'image/webp',
        'ico': 'image/x-icon',
        
        // Archives
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed',
        'tar': 'application/x-tar',
        'gz': 'application/gzip',
        
        // CAD
        'dwg': 'application/acad',
        'dxf': 'application/dxf',
        'dwf': 'model/vnd.dwf',
        'dgn': 'application/x-dgn',
        
        // Other
        'mp4': 'video/mp4',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'avi': 'video/x-msvideo',
        'mov': 'video/quicktime',
        'md': 'text/markdown',
        'log': 'text/plain',
        'ini': 'text/plain',
        'cfg': 'text/plain',
        'conf': 'text/plain',
        'yaml': 'text/yaml',
        'yml': 'text/yaml'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
}

// Sort table
function sortTable(field) {
    if (APP_STATE.sortField === field) {
        // Toggle direction
        APP_STATE.sortDirection = APP_STATE.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // New field, default to ascending
        APP_STATE.sortField = field;
        APP_STATE.sortDirection = 'asc';
    }
    
    updateSortIndicators();
    applyFilters(); // Re-apply filters which will trigger table update
}

// Update sort indicators
function updateSortIndicators() {
    // Remove all sort indicators
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.removeAttribute('data-sort');
    });
    
    // Add current sort indicator
    const th = document.querySelector(`th[data-field="${APP_STATE.sortField}"]`);
    if (th) {
        th.setAttribute('data-sort', APP_STATE.sortDirection);
    }
}

// Column resize functionality
let resizing = null;

function initializeColumnResize() {
    const handles = document.querySelectorAll('.resize-handle');
    handles.forEach(handle => {
        handle.addEventListener('mousedown', startResize);
    });
    
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
}

function startResize(e) {
    const th = e.target.parentElement;
    resizing = {
        th: th,
        startX: e.clientX,
        startWidth: th.offsetWidth
    };
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
}

function doResize(e) {
    if (!resizing) return;
    
    const diff = e.clientX - resizing.startX;
    const newWidth = Math.max(100, resizing.startWidth + diff);
    resizing.th.style.width = newWidth + 'px';
    
    // Update corresponding column
    const field = resizing.th.getAttribute('data-field');
    const cells = document.querySelectorAll(`td[data-field="${field}"]`);
    cells.forEach(cell => {
        cell.style.width = newWidth + 'px';
    });
}

function stopResize() {
    if (resizing) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        resizing = null;
    }
}
