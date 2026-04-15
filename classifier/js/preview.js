/**
 * Preview Module
 * Opens file preview in a separate popup window
 */
(function() {
    'use strict';

    let currentBlobUrl = null;
    let currentFile = null;
    let currentRowIndex = null;
    let previewWindow = null;

    // File type mappings
    const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.bmp', '.ico'];
    const TEXT_EXTENSIONS = ['.txt', '.md', '.json', '.xml', '.csv', '.log', '.html', '.css', '.js', '.ts', '.py', '.sh', '.bat', '.yaml', '.yml', '.ini', '.cfg', '.conf'];
    const PDF_EXTENSIONS = ['.pdf'];
    const ZIP_EXTENSIONS = ['.zip'];

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
     * Initialize preview module
     */
    function init() {
        // Listen for row focus events from selection module
        document.addEventListener('rowfocused', handleRowFocused);
        
        // Set up toggle button to open preview window
        const toggleBtn = document.getElementById('togglePreviewBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                if (currentFile) {
                    openPreviewWindow(currentFile);
                }
            });
        }
    }

    /**
     * Handle row focused event
     */
    function handleRowFocused(e) {
        const { rowIndex, file } = e.detail;
        
        currentRowIndex = rowIndex;
        
        if (file && file !== currentFile) {
            currentFile = file;
            
            // Update preview window if open
            if (previewWindow && !previewWindow.closed) {
                openPreviewWindow(file);
            }
        }
    }

    /**
     * Open preview in a separate popup window
     */
    async function openPreviewWindow(file) {
        if (!file) return;
        
        currentFile = file;
        
        try {
            const blob = await getFileBlob(file);
            
            // Clean up previous blob URL
            if (currentBlobUrl) {
                URL.revokeObjectURL(currentBlobUrl);
            }
            currentBlobUrl = URL.createObjectURL(blob);
            
            const fileName = file.originalFilename + file.extension;
            
            // Build preview HTML with toolbar
            const previewHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>${escapeHtml(fileName)} - Preview</title>
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
        iframe, img {
            flex: 1;
            width: 100%;
            border: none;
        }
        img {
            object-fit: contain;
            background: #f0f0f0;
        }
        pre {
            flex: 1;
            padding: 1rem;
            overflow: auto;
            background: #fafafa;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 0.9rem;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .unsupported {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #666;
        }
        .unsupported .icon { font-size: 3rem; margin-bottom: 1rem; }
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
        .docx-wrapper { padding: 1rem; }
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
        <h1>${escapeHtml(fileName)}</h1>
        <button class="btn" onclick="downloadFile()">Download</button>
    </div>
    ${await getPreviewContent(file, currentBlobUrl)}
    <script>
        var blobUrl = "${currentBlobUrl}";
        var fileName = "${escapeHtml(fileName).replace(/"/g, '\\"')}";
        
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
            
            // Reuse existing window if open, otherwise create new one
            if (previewWindow && !previewWindow.closed) {
                previewWindow.document.open();
                previewWindow.document.write(previewHtml);
                previewWindow.document.close();
                previewWindow.focus();
            } else {
                // Calculate window size
                const width = Math.round(screen.width * 0.6);
                const height = Math.round(screen.height * 0.8);
                const left = Math.round((screen.width - width) / 2);
                const top = Math.round((screen.height - height) / 2);
                
                previewWindow = window.open('', 'classifierPreview', 
                    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
                
                if (!previewWindow) {
                    // Popup blocked - fall back to new tab
                    window.open(currentBlobUrl, '_blank');
                    return;
                }
                
                previewWindow.document.write(previewHtml);
                previewWindow.document.close();
                previewWindow.focus();
            }
            
            // For office types, render content after window is ready
            const ext = file.extension.toLowerCase();
            if (ext === '.docx') {
                await renderDocxInWindow(file);
            } else if (ext === '.xlsx' || ext === '.xls') {
                await renderXlsxInWindow(file);
            }
        } catch (err) {
            console.error('Error opening preview:', err);
            alert(`Error opening preview: ${err.message}`);
        }
    }
    
    /**
     * Get preview content HTML based on file type
     */
    async function getPreviewContent(file, blobUrl) {
        const ext = file.extension.toLowerCase();
        const previewType = getPreviewType(ext);
        
        switch (previewType) {
            case 'pdf':
                return `<iframe src="${blobUrl}#view=FitV"></iframe>`;
            case 'image':
                return `<img src="${blobUrl}" alt="${escapeHtml(file.originalFilename)}" />`;
            case 'text':
                const text = await getFileText(file);
                const maxLength = 100000;
                const displayText = text.length > maxLength 
                    ? text.substring(0, maxLength) + '\n\n... (truncated)'
                    : text;
                return `<pre>${escapeHtml(displayText)}</pre>`;
            case 'docx':
            case 'xlsx':
                return `<div id="previewContent"><div class="loading">Loading preview...</div></div>`;
            default:
                return `
                    <div class="unsupported">
                        <div class="icon">📄</div>
                        <p>Preview not available for ${ext} files</p>
                        <p style="margin-top: 0.5rem;">Click Download to view in external application</p>
                    </div>
                `;
        }
    }
    
    /**
     * Get preview type from extension
     */
    function getPreviewType(ext) {
        if (PDF_EXTENSIONS.includes(ext)) return 'pdf';
        if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
        if (TEXT_EXTENSIONS.includes(ext)) return 'text';
        if (ext === '.docx') return 'docx';
        if (ext === '.xlsx' || ext === '.xls') return 'xlsx';
        if (ZIP_EXTENSIONS.includes(ext)) return 'zip';
        return 'none';
    }

    /**
     * Get MIME type from file extension
     */
    function getMimeType(ext) {
        const mimeTypes = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp',
            '.ico': 'image/x-icon',
            '.txt': 'text/plain',
            '.md': 'text/markdown',
            '.json': 'application/json',
            '.xml': 'application/xml',
            '.csv': 'text/csv',
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'text/javascript'
        };
        return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
    }
    
    /**
     * Get file content as blob (handles both real and virtual files)
     */
    async function getFileBlob(file) {
        if (file.isVirtual) {
            // Get from ZIP cache
            const cached = window.app.modules.scanner.getZipCache(file.zipPath);
            if (!cached) throw new Error('ZIP not found in cache');
            
            const zipEntry = cached.zip.file(file.zipEntryPath);
            if (!zipEntry) throw new Error('File not found in ZIP');
            
            // Get as arraybuffer and create blob with correct MIME type
            const arrayBuffer = await zipEntry.async('arraybuffer');
            const mimeType = getMimeType(file.extension);
            return new Blob([arrayBuffer], { type: mimeType });
        } else {
            // Get from file handle
            if (!file.handle) {
                throw new Error('File handle not available');
            }
            return await file.handle.getFile();
        }
    }
    
    /**
     * Get file content as text (handles both real and virtual files)
     */
    async function getFileText(file) {
        if (file.isVirtual) {
            const cached = window.app.modules.scanner.getZipCache(file.zipPath);
            if (!cached) throw new Error('ZIP not found in cache');
            
            const zipEntry = cached.zip.file(file.zipEntryPath);
            if (!zipEntry) throw new Error('File not found in ZIP');
            
            return await zipEntry.async('string');
        } else {
            if (!file.handle) {
                throw new Error('File handle not available');
            }
            const fileObj = await file.handle.getFile();
            return await fileObj.text();
        }
    }

    /**
     * Render a DOCX file in the preview window using docx-preview library
     */
    async function renderDocxInWindow(file) {
        const container = previewWindow.document.getElementById('previewContent');
        if (!container) return;
        
        try {
            await loadLibrary('https://cdn.jsdelivr.net/npm/jszip@3/dist/jszip.min.js');
            await loadLibrary('https://cdn.jsdelivr.net/npm/docx-preview@latest/dist/docx-preview.min.js');
            
            const blob = await getFileBlob(file);
            const arrayBuffer = await blob.arrayBuffer();
            
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
        const container = previewWindow.document.getElementById('previewContent');
        if (!container) return;
        
        try {
            await loadLibrary('https://cdn.jsdelivr.net/npm/xlsx@latest/dist/xlsx.full.min.js');
            
            const blob = await getFileBlob(file);
            const arrayBuffer = await blob.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            
            container.innerHTML = '';
            
            if (workbook.SheetNames.length > 1) {
                const tabs = previewWindow.document.createElement('div');
                tabs.className = 'sheet-tabs';
                workbook.SheetNames.forEach((name, i) => {
                    const tab = previewWindow.document.createElement('button');
                    tab.className = 'sheet-tab' + (i === 0 ? ' active' : '');
                    tab.textContent = name;
                    tab.onclick = () => {
                        tabs.querySelectorAll('.sheet-tab').forEach(t => t.classList.remove('active'));
                        tab.classList.add('active');
                        renderSheetInWindow(workbook, name, tableContainer);
                    };
                    tabs.appendChild(tab);
                });
                container.appendChild(tabs);
            }
            
            const tableContainer = previewWindow.document.createElement('div');
            tableContainer.style.flex = '1';
            tableContainer.style.overflow = 'auto';
            container.appendChild(tableContainer);
            
            renderSheetInWindow(workbook, workbook.SheetNames[0], tableContainer);
        } catch (err) {
            console.error('Error rendering XLSX:', err);
            container.innerHTML = `<div class="loading">Error rendering spreadsheet: ${err.message}<br>Click Download to view in Excel.</div>`;
        }
    }

    /**
     * Render a single sheet as an HTML table in the preview window
     */
    function renderSheetInWindow(workbook, sheetName, container) {
        const sheet = workbook.Sheets[sheetName];
        const html = XLSX.utils.sheet_to_html(sheet, { editable: false });
        container.innerHTML = html;
        const table = container.querySelector('table');
        if (table) table.className = 'xlsx-table';
    }

    /**
     * Escape HTML for safe display
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Download current file
     */
    async function downloadFile() {
        if (!currentFile) return;
        
        try {
            const blob = await getFileBlob(currentFile);
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = currentFile.originalFilename + currentFile.extension;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            console.error('Error downloading file:', err);
            alert('Error downloading file: ' + err.message);
        }
    }

    // Export module
    window.app.modules.preview = {
        init
    };
})();
