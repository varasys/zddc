(function (app) {
    'use strict';

    var dom = app.dom;
    var util = app.util;
    var filesModule = app.modules.files;

    // Blob URL cache keyed by file path
    var blobCache = new Map();

    // Current preview popup window reference
    var previewWindow = null;

    // Extensions that support rich in-browser preview
    var PREVIEW_EXTENSIONS = ['pdf', 'docx', 'xlsx', 'xls'];

    // Extensions that preview as images
    var IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'];

    // Cache for lazily loaded CDN libraries
    var loadedLibraries = new Map();

    var MIME_TYPES = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'txt': 'text/plain',
        'csv': 'text/csv',
        'html': 'text/html',
        'htm': 'text/html',
        'xml': 'text/xml',
        'json': 'application/json',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'bmp': 'image/bmp',
        'svg': 'image/svg+xml',
        'webp': 'image/webp',
        'ico': 'image/x-icon',
        'zip': 'application/zip',
        'mp4': 'video/mp4',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'md': 'text/markdown'
    };

    function getMimeType(ext) {
        return MIME_TYPES[(ext || '').toLowerCase()] || 'application/octet-stream';
    }

    function loadLibrary(url) {
        if (loadedLibraries.has(url)) {
            return loadedLibraries.get(url);
        }
        var promise = new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = function () {
                reject(new Error('Failed to load library: ' + url));
            };
            document.head.appendChild(script);
        });
        loadedLibraries.set(url, promise);
        return promise;
    }

    function isPreviewable(ext) {
        var lower = (ext || '').toLowerCase();
        return PREVIEW_EXTENSIONS.indexOf(lower) !== -1 || IMAGE_EXTENSIONS.indexOf(lower) !== -1;
    }

    function hasFileSource(file) {
        return !!(file.fileHandle || file.zipEntry);
    }

    async function getFileArrayBuffer(file) {
        if (file.fileHandle) {
            var fileData = await file.fileHandle.getFile();
            return fileData.arrayBuffer();
        }
        if (file.zipEntry) {
            return file.zipEntry.async('arraybuffer');
        }
        throw new Error('No file source available');
    }

    async function getFileBlobUrl(file) {
        var cacheKey = file.path || file.name || '';
        if (blobCache.has(cacheKey)) {
            return blobCache.get(cacheKey);
        }
        var arrayBuffer = await getFileArrayBuffer(file);
        var mimeType = getMimeType(file.extension);
        var blob = new Blob([arrayBuffer], { type: mimeType });
        var url = URL.createObjectURL(blob);
        blobCache.set(cacheKey, url);
        return url;
    }

    function cleanupBlobUrls() {
        blobCache.forEach(function (url) {
            URL.revokeObjectURL(url);
        });
        blobCache.clear();
    }

    function buildPreviewHtml(file, url) {
        var ext = (file.extension || '').toLowerCase();
        var safeName = util.escapeHtml(file.name || file.path || 'file');
        var safeHref = util.escapeHtmlAttribute(url);

        var contentHtml;
        if (ext === 'pdf') {
            contentHtml = '<iframe src="' + safeHref + '"></iframe>';
        } else {
            contentHtml = '<div id="previewContent"><div class="loading">Loading preview...</div></div>';
        }

        return '<!DOCTYPE html>\n' +
            '<html>\n' +
            '<head>\n' +
            '<title>' + safeName + ' - Preview</title>\n' +
            '<style>\n' +
            '* { margin: 0; padding: 0; box-sizing: border-box; }\n' +
            'body { display: flex; flex-direction: column; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }\n' +
            '.toolbar { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: #f5f5f5; border-bottom: 1px solid #ddd; }\n' +
            '.toolbar h1 { flex: 1; font-size: 0.95rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n' +
            '.btn { padding: 0.4rem 0.8rem; font-size: 0.85rem; border: 1px solid #ccc; border-radius: 4px; background: white; cursor: pointer; }\n' +
            '.btn:hover { background: #e8e8e8; }\n' +
            'iframe { flex: 1; width: 100%; border: none; }\n' +
            '#previewContent { flex: 1; overflow: auto; }\n' +
            '.loading { display: flex; align-items: center; justify-content: center; height: 100%; color: #666; font-size: 1.1rem; }\n' +
            '.docx-wrapper { padding: 1rem; }\n' +
            '.xlsx-table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }\n' +
            '.xlsx-table th, .xlsx-table td { border: 1px solid #ddd; padding: 0.35rem 0.5rem; text-align: left; white-space: nowrap; }\n' +
            '.xlsx-table th { background: #f0f0f0; font-weight: 600; position: sticky; top: 0; }\n' +
            '.xlsx-table tr:nth-child(even) { background: #fafafa; }\n' +
            '.xlsx-table tr:hover { background: #f0f7ff; }\n' +
            '.sheet-tabs { display: flex; gap: 0; border-bottom: 1px solid #ddd; background: #f5f5f5; }\n' +
            '.sheet-tab { padding: 0.4rem 1rem; cursor: pointer; border: 1px solid transparent; border-bottom: none; font-size: 0.85rem; background: transparent; }\n' +
            '.sheet-tab:hover { background: #e8e8e8; }\n' +
            '.sheet-tab.active { background: white; border-color: #ddd; border-bottom-color: white; margin-bottom: -1px; font-weight: 500; }\n' +
            'img.preview-image { max-width: 100%; max-height: 100%; object-fit: contain; margin: auto; display: block; }\n' +
            '</style>\n' +
            '</head>\n' +
            '<body>\n' +
            '<div class="toolbar">\n' +
            '<h1>' + safeName + '</h1>\n' +
            '<button class="btn" onclick="downloadFile()">Download</button>\n' +
            '</div>\n' +
            contentHtml + '\n' +
            '<script>\n' +
            'var blobUrl = "' + url.replace(/"/g, '\\"') + '";\n' +
            'var fileName = "' + safeName.replace(/"/g, '\\"') + '";\n' +
            'function downloadFile() {\n' +
            '  var a = document.createElement("a");\n' +
            '  a.href = blobUrl;\n' +
            '  a.download = fileName;\n' +
            '  document.body.appendChild(a);\n' +
            '  a.click();\n' +
            '  document.body.removeChild(a);\n' +
            '}\n' +
            '</' + 'script>\n' +
            '</body>\n' +
            '</html>';
    }

    async function renderDocxInWindow(file) {
        var container = previewWindow.document.getElementById('previewContent');
        if (!container) {
            return;
        }
        try {
            await loadLibrary('https://cdn.jsdelivr.net/npm/jszip@3/dist/jszip.min.js');
            await loadLibrary('https://cdn.jsdelivr.net/npm/docx-preview@latest/dist/docx-preview.min.js');
            var arrayBuffer = await getFileArrayBuffer(file);
            container.innerHTML = '';
            await window.docx.renderAsync(arrayBuffer, container);
        } catch (err) {
            console.error('[transmittal] Error rendering DOCX:', err);
            container.innerHTML = '<div class="loading">Error rendering DOCX: ' + util.escapeHtml(err.message || '') + '<br>Click Download to view in Word.</div>';
        }
    }

    async function renderXlsxInWindow(file) {
        var container = previewWindow.document.getElementById('previewContent');
        if (!container) {
            return;
        }
        try {
            await loadLibrary('https://cdn.jsdelivr.net/npm/xlsx@latest/dist/xlsx.full.min.js');
            var arrayBuffer = await getFileArrayBuffer(file);
            var workbook = XLSX.read(arrayBuffer, { type: 'array' });
            container.innerHTML = '';

            var tableContainer = previewWindow.document.createElement('div');
            tableContainer.style.flex = '1';
            tableContainer.style.overflow = 'auto';

            if (workbook.SheetNames.length > 1) {
                var tabs = previewWindow.document.createElement('div');
                tabs.className = 'sheet-tabs';
                workbook.SheetNames.forEach(function (name, i) {
                    var tab = previewWindow.document.createElement('button');
                    tab.className = 'sheet-tab' + (i === 0 ? ' active' : '');
                    tab.textContent = name;
                    tab.addEventListener('click', function () {
                        tabs.querySelectorAll('.sheet-tab').forEach(function (t) {
                            t.classList.remove('active');
                        });
                        tab.classList.add('active');
                        renderSheet(workbook, name, tableContainer);
                    });
                    tabs.appendChild(tab);
                });
                container.appendChild(tabs);
            }

            container.appendChild(tableContainer);
            renderSheet(workbook, workbook.SheetNames[0], tableContainer);
        } catch (err) {
            console.error('[transmittal] Error rendering XLSX:', err);
            container.innerHTML = '<div class="loading">Error rendering spreadsheet: ' + util.escapeHtml(err.message || '') + '<br>Click Download to view in Excel.</div>';
        }
    }

    function renderSheet(workbook, sheetName, container) {
        var sheet = workbook.Sheets[sheetName];
        var html = XLSX.utils.sheet_to_html(sheet, { editable: false });
        container.innerHTML = html;
        var table = container.querySelector('table');
        if (table) {
            table.className = 'xlsx-table';
        }
    }

    async function renderImageInWindow(file, url) {
        var container = previewWindow.document.getElementById('previewContent');
        if (!container) {
            return;
        }
        container.innerHTML = '';
        var img = previewWindow.document.createElement('img');
        img.className = 'preview-image';
        img.src = url;
        img.alt = file.name || '';
        container.appendChild(img);
    }

    async function showFilePreview(file) {
        var ext = (file.extension || '').toLowerCase();
        try {
            var url = await getFileBlobUrl(file);
            var html = buildPreviewHtml(file, url);

            if (previewWindow && !previewWindow.closed) {
                previewWindow.document.open();
                previewWindow.document.write(html);
                previewWindow.document.close();
                previewWindow.focus();
            } else {
                var width = Math.round(screen.width * 0.6);
                var height = Math.round(screen.height * 0.8);
                var left = Math.round((screen.width - width) / 2);
                var top = Math.round((screen.height - height) / 2);
                previewWindow = window.open('', 'filePreview',
                    'width=' + width + ',height=' + height + ',left=' + left + ',top=' + top + ',resizable=yes,scrollbars=yes');
                if (!previewWindow) {
                    window.open(url, '_blank');
                    return;
                }
                previewWindow.document.write(html);
                previewWindow.document.close();
                previewWindow.focus();
            }

            if (ext === 'docx') {
                await renderDocxInWindow(file);
            } else if (ext === 'xlsx' || ext === 'xls') {
                await renderXlsxInWindow(file);
            } else if (IMAGE_EXTENSIONS.indexOf(ext) !== -1) {
                await renderImageInWindow(file, url);
            }
        } catch (err) {
            console.error('[transmittal] Error loading file preview:', err);
            alert('Error loading preview: ' + (err && err.message ? err.message : err));
        }
    }

    // --- Load files for preview (directory or ZIP) ---

    function updatePreviewStatus(text) {
        var el = dom.qs('#preview-status');
        if (el) {
            el.textContent = text;
        }
    }

    function matchFilesToSources(sourceEntries) {
        var files = app.data.files || [];
        if (!files.length || !sourceEntries.length) {
            return 0;
        }

        // Build lookup by relative path and by filename
        var byPath = new Map();
        var byName = new Map();
        sourceEntries.forEach(function (entry) {
            if (entry.path) {
                byPath.set(entry.path, entry);
            }
            if (entry.name) {
                // Only use filename match if unique
                if (byName.has(entry.name)) {
                    byName.set(entry.name, null); // Mark as ambiguous
                } else {
                    byName.set(entry.name, entry);
                }
            }
        });

        var matched = 0;
        files.forEach(function (file) {
            var source = null;
            // Try path match first
            if (file.path && byPath.has(file.path)) {
                source = byPath.get(file.path);
            }
            // Fall back to name match
            if (!source && file.name) {
                var nameMatch = byName.get(file.name);
                if (nameMatch) {
                    source = nameMatch;
                }
            }
            if (source) {
                if (source.fileHandle) {
                    file.fileHandle = source.fileHandle;
                }
                if (source.zipEntry) {
                    file.zipEntry = source.zipEntry;
                }
                matched += 1;
            }
        });
        return matched;
    }

    async function loadFromDirectory() {
        if (typeof window.showDirectoryPicker !== 'function') {
            alert('Your browser does not support directory selection. Try Chrome or Edge.');
            return;
        }
        var dirHandle;
        try {
            dirHandle = await window.showDirectoryPicker();
        } catch (err) {
            if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
                return;
            }
            throw err;
        }
        updatePreviewStatus('Scanning directory...');
        var entries = await filesModule.collectDirectoryEntries(dirHandle);
        var sourceEntries = entries.map(function (entry) {
            return { path: entry.path, name: entry.name, fileHandle: entry.handle };
        });
        var matched = matchFilesToSources(sourceEntries);
        if (matched > 0) {
            filesLoadedForPreview = true;
            updatePreviewStatus('from "' + dirHandle.name + '" — ' + matched + ' of ' + (app.data.files || []).length + ' files matched');
            filesModule.render();
        } else {
            updatePreviewStatus('No matching files found in "' + dirHandle.name + '"');
        }
    }

    async function loadFromZip() {
        return new Promise(function (resolve) {
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = '.zip';
            input.addEventListener('change', async function () {
                var zipFile = input.files && input.files[0];
                if (!zipFile) {
                    resolve();
                    return;
                }
                try {
                    updatePreviewStatus('Loading ZIP...');
                    await loadLibrary('https://cdn.jsdelivr.net/npm/jszip@3/dist/jszip.min.js');
                    var arrayBuffer = await zipFile.arrayBuffer();
                    var zip = await JSZip.loadAsync(arrayBuffer);
                    var sourceEntries = [];
                    zip.forEach(function (relativePath, zipEntry) {
                        if (zipEntry.dir) {
                            return;
                        }
                        // Strip the outermost folder if all entries share one
                        var name = relativePath.split('/').pop();
                        sourceEntries.push({
                            path: relativePath,
                            name: name,
                            zipEntry: zipEntry
                        });
                    });

                    // Try stripping common prefix for better path matching
                    if (sourceEntries.length > 0) {
                        var firstPath = sourceEntries[0].path;
                        var prefix = firstPath.indexOf('/') !== -1 ? firstPath.substring(0, firstPath.indexOf('/') + 1) : '';
                        if (prefix) {
                            var allSharePrefix = sourceEntries.every(function (e) {
                                return e.path.indexOf(prefix) === 0;
                            });
                            if (allSharePrefix) {
                                sourceEntries.forEach(function (e) {
                                    e.path = e.path.substring(prefix.length);
                                });
                            }
                        }
                    }

                    var matched = matchFilesToSources(sourceEntries);
                    if (matched > 0) {
                        filesLoadedForPreview = true;
                        updatePreviewStatus('from "' + zipFile.name + '" — ' + matched + ' of ' + (app.data.files || []).length + ' files matched');
                        filesModule.render();
                    } else {
                        updatePreviewStatus('No matching files found in "' + zipFile.name + '"');
                    }
                } catch (err) {
                    console.error('[transmittal] Error loading ZIP:', err);
                    updatePreviewStatus('Failed to load ZIP: ' + (err && err.message ? err.message : err));
                }
                resolve();
            });
            input.click();
        });
    }

    // Track whether files have been loaded for preview in view mode
    var filesLoadedForPreview = false;

    function isPreviewEnabled() {
        var checkbox = dom.qs('#preview-toggle');
        return checkbox && checkbox.checked;
    }

    function syncCheckboxToMode() {
        var checkbox = dom.qs('#preview-toggle');
        if (!checkbox) {
            return;
        }
        if (app.state.mode === 'edit') {
            checkbox.checked = true;
            checkbox.disabled = true;
            updatePreviewStatus('');
        } else {
            checkbox.disabled = false;
            if (!filesLoadedForPreview) {
                checkbox.checked = false;
                updatePreviewStatus('');
            }
        }
    }

    function showSourcePicker() {
        var bar = dom.qs('#preview-bar');
        var existing = dom.qs('#preview-load-menu');
        if (existing) {
            existing.remove();
            return;
        }
        var menu = document.createElement('div');
        menu.id = 'preview-load-menu';
        menu.style.cssText = 'position:absolute;z-index:50;background:white;border:1px solid #ccc;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.15);padding:0.25rem 0;min-width:160px;';

        function addOption(label, handler) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = label;
            btn.style.cssText = 'display:block;width:100%;text-align:left;padding:0.4rem 0.75rem;border:none;background:none;cursor:pointer;font-size:0.8rem;';
            btn.addEventListener('mouseenter', function () { btn.style.background = '#f0f0f0'; });
            btn.addEventListener('mouseleave', function () { btn.style.background = 'none'; });
            btn.addEventListener('click', function () {
                menu.remove();
                handler();
            });
            menu.appendChild(btn);
        }

        addOption('Select Directory', function () {
            loadFromDirectory().then(function () {
                if (!filesLoadedForPreview) {
                    uncheckPreview();
                }
            }).catch(function (err) {
                console.error('[transmittal] loadFromDirectory failed', err);
                updatePreviewStatus('Failed: ' + (err && err.message ? err.message : err));
                uncheckPreview();
            });
        });

        addOption('Select ZIP File', function () {
            loadFromZip().then(function () {
                if (!filesLoadedForPreview) {
                    uncheckPreview();
                }
            }).catch(function (err) {
                console.error('[transmittal] loadFromZip failed', err);
                updatePreviewStatus('Failed: ' + (err && err.message ? err.message : err));
                uncheckPreview();
            });
        });

        if (bar) {
            bar.style.position = 'relative';
            menu.style.top = '1.5rem';
            menu.style.left = '0';
            bar.appendChild(menu);
        }

        function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu, true);
            }
        }
        setTimeout(function () {
            document.addEventListener('click', closeMenu, true);
        }, 0);
    }

    function uncheckPreview() {
        var checkbox = dom.qs('#preview-toggle');
        if (checkbox) {
            checkbox.checked = false;
        }
    }

    function bindPreviewBar() {
        var checkbox = dom.qs('#preview-toggle');
        if (!checkbox) {
            return;
        }
        checkbox.addEventListener('change', function () {
            if (app.state.mode === 'edit') {
                checkbox.checked = true;
                return;
            }
            if (checkbox.checked) {
                if (!filesLoadedForPreview) {
                    showSourcePicker();
                }
            } else {
                updatePreviewStatus('');
            }
        });
        syncCheckboxToMode();
    }

    // Expose on filesModule
    filesModule.isPreviewable = isPreviewable;
    filesModule.hasFileSource = hasFileSource;
    filesModule.isPreviewEnabled = isPreviewEnabled;
    filesModule.syncPreviewCheckbox = syncCheckboxToMode;
    filesModule.showFilePreview = showFilePreview;
    filesModule.cleanupBlobUrls = cleanupBlobUrls;
    filesModule.getFileArrayBuffer = getFileArrayBuffer;
    filesModule.getFileBlobUrl = getFileBlobUrl;
    filesModule.loadLibrary = loadLibrary;
    filesModule.getMimeType = getMimeType;

    app.registerInit(function () {
        bindPreviewBar();
        window.addEventListener('beforeunload', cleanupBlobUrls);
    });
})(window.transmittalApp);
