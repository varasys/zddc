(function (app) {
    'use strict';

    // ── Targeted drop zones ─────────────────────────────────────────────────
    // Shows contextual zone outlines when anything is dragged over the window.
    // Emphasises zones that can accept the dragged data type.
    // Hands off actual processing to existing module helpers.

    var dropZonesModule = app.modules.dropZones = {};

    // ── Data-transfer classification ────────────────────────────────────────
    // Returns { hasImage, hasHtmlJson, hasPossibleDir }
    // NOTE: MIME types ARE accessible on items during dragenter/dragover,
    // but filenames are not. Directories have kind === 'file' and type === ''.
    function classifyTransfer(dt) {
        var hasImage = false;
        var hasHtmlJson = false;
        var hasPossibleDir = false;

        if (!dt || !dt.items) {
            return { hasImage: hasImage, hasHtmlJson: hasHtmlJson, hasPossibleDir: hasPossibleDir };
        }

        var items = dt.items;
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.kind !== 'file') { continue; }
            var t = (item.type || '').toLowerCase();
            if (t.indexOf('image/') === 0) {
                hasImage = true;
            } else if (t === 'text/html' || t === 'application/json') {
                hasHtmlJson = true;
            } else if (t === '') {
                // Could be a directory or a file with no MIME (e.g. .json on some OSes)
                hasPossibleDir = true;
            }
        }
        return { hasImage: hasImage, hasHtmlJson: hasHtmlJson, hasPossibleDir: hasPossibleDir };
    }

    // ── Eligibility per zone type ───────────────────────────────────────────
    function zoneIsEligible(zoneType, cls) {
        var inEditMode = (app.state && app.state.mode === 'edit');
        switch (zoneType) {
            case 'logo-left':
            case 'logo-right':
                return cls.hasImage && inEditMode;
            case 'header':
                // Accept HTML/JSON imports; also allow unknown-type files (hasPossibleDir)
                // so that dragging a JSON with no MIME still lights up the header zone.
                return (cls.hasHtmlJson || cls.hasPossibleDir) && inEditMode;
            case 'file-table':
                // Directories and HTML/JSON imports are always eligible here.
                // (Verify works in both edit and published mode.)
                // Pure image-only drops are not accepted here.
                return cls.hasHtmlJson || cls.hasPossibleDir;
            default:
                return false;
        }
    }

    // ── Zone visibility helpers ─────────────────────────────────────────────
    function getAllZones() {
        return document.querySelectorAll('[data-drop-zone]');
    }

    function showZones(cls) {
        getAllZones().forEach(function (el) {
            var zoneType = el.getAttribute('data-drop-zone');
            var eligible = zoneIsEligible(zoneType, cls);
            el.classList.add('dz-visible');
            el.classList.toggle('dz-eligible', eligible);
            el.classList.toggle('dz-ineligible', !eligible);
        });
    }

    function hideZones() {
        getAllZones().forEach(function (el) {
            el.classList.remove('dz-visible', 'dz-eligible', 'dz-ineligible', 'dz-hover');
        });
    }

    // ── Window-level drag tracking ──────────────────────────────────────────
    // Use relatedTarget to distinguish real enter/leave from child-element noise.
    // relatedTarget is null when the drag crosses the window boundary.
    // Note: this approach is reliable in Chromium-based browsers. Firefox has
    // a known quirk where relatedTarget may not be null at true window boundary
    // in all cases; zones may not appear in Firefox. Acceptable given the app's
    // primary target is Chromium.

    document.addEventListener('dragenter', function (e) {
        e.preventDefault();
        if (e.relatedTarget === null) {
            showZones(classifyTransfer(e.dataTransfer));
        }
    });

    document.addEventListener('dragleave', function (e) {
        if (e.relatedTarget === null) {
            hideZones();
        }
    });

    document.addEventListener('dragover', function (e) { e.preventDefault(); });

    document.addEventListener('drop', function (e) {
        // Default handler: prevent browser navigation. Specific zones handle drops.
        e.preventDefault();
        hideZones();
    });

    // ── Per-zone drop handler: HTML / JSON import ───────────────────────────
    async function handleDataFileDrop(file, sourceName) {
        var dataModule = app.modules.data;
        if (!dataModule) { return; }
        var name = (sourceName || '').toLowerCase();
        try {
            var text = await file.text();
            var data = null;
            if (name.endsWith('.json')) {
                data = JSON.parse(text);
            } else {
                // HTML: extract embedded JSON using the shared helper from data.js
                if (dataModule.extractJsonFromHtml) {
                    data = dataModule.extractJsonFromHtml(text);
                }
            }
            if (!data) {
                if (dataModule.setStatus) { dataModule.setStatus('Dropped file does not contain transmittal data', 'error'); }
                return;
            }
            await dataModule.applyLoadedData(data, sourceName || 'dropped');
        } catch (err) {
            console.error('[transmittal] drop-zones: file drop failed', err);
            if (dataModule.setStatus) {
                dataModule.setStatus('Failed to import: ' + (err && err.message ? err.message : err), 'error');
            }
        }
    }

    // ── Per-zone drop handler: directory ────────────────────────────────────
    async function handleDirectoryDrop(item) {
        var dataModule = app.modules.data;
        var filesModule = app.modules.files;
        if (!item || typeof item.getAsFileSystemHandle !== 'function') { return false; }
        try {
            var handle = await item.getAsFileSystemHandle();
            if (!handle || handle.kind !== 'directory') { return false; }
            if (typeof handle.requestPermission === 'function') {
                await handle.requestPermission({ mode: 'readwrite' });
            }
            app.data.selectedDirHandle = handle;
            if (filesModule && filesModule.updateDirectoryIndicator) {
                filesModule.updateDirectoryIndicator();
            }
            if (dataModule && dataModule.setStatus) {
                dataModule.setStatus('Directory: ' + handle.name, 'info');
            }
            var isPublished = !!app.state.published;
            var hasFiles = app.data.files && app.data.files.length > 0;
            if (isPublished || hasFiles) {
                document.dispatchEvent(new CustomEvent('transmittal:verify-directory'));
            } else {
                document.dispatchEvent(new CustomEvent('transmittal:scan-directory'));
            }
            return true;
        } catch (err) {
            console.warn('[transmittal] drop-zones: getAsFileSystemHandle failed', err);
            return false;
        }
    }

    // ── Wire a single zone element ──────────────────────────────────────────
    function wireZone(el) {
        var zoneType = el.getAttribute('data-drop-zone');

        el.addEventListener('dragover', function (e) {
            var cls = classifyTransfer(e.dataTransfer);
            if (zoneIsEligible(zoneType, cls)) {
                e.preventDefault();
                e.stopPropagation();
                el.classList.add('dz-hover');
            }
        });

        el.addEventListener('dragleave', function (e) {
            // Only remove hover if we're actually leaving this element
            // (not just moving to a child element within it)
            if (!el.contains(e.relatedTarget)) {
                el.classList.remove('dz-hover');
            }
        });

        el.addEventListener('drop', async function (e) {
            var cls = classifyTransfer(e.dataTransfer);
            if (!zoneIsEligible(zoneType, cls)) { return; }
            e.preventDefault();
            e.stopPropagation();
            hideZones();

            // ── Logo zones ──────────────────────────────────────────
            if (zoneType === 'logo-left' || zoneType === 'logo-right') {
                var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                if (!file) { return; }
                var imgId = zoneType === 'logo-left' ? 'left-logo' : 'right-logo';
                if (app.modules.logos && app.modules.logos.applyLogoFile) {
                    await app.modules.logos.applyLogoFile(imgId, file);
                }
                return;
            }

            // ── Header zone: HTML or JSON import only ───────────────
            if (zoneType === 'header') {
                var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                if (!file) { return; }
                var name = (file.name || '').toLowerCase();
                if (!name.endsWith('.html') && !name.endsWith('.htm') && !name.endsWith('.json')) {
                    if (app.modules.data && app.modules.data.setStatus) {
                        app.modules.data.setStatus('Drop an HTML or JSON transmittal file here', 'error');
                    }
                    return;
                }
                await handleDataFileDrop(file, file.name);
                return;
            }

            // ── File-table zone: directory or HTML/JSON ─────────────
            if (zoneType === 'file-table') {
                var ftItems = e.dataTransfer && e.dataTransfer.items;
                var ftFirstItem = ftItems && ftItems.length > 0 ? ftItems[0] : null;
                // Grab file synchronously before async work
                var ftFile = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];

                // Try directory first
                if (ftFirstItem) {
                    var wasDir = await handleDirectoryDrop(ftFirstItem);
                    if (wasDir) { return; }
                }

                // Fall back to file-based import
                if (!ftFile) { return; }
                var ftName = (ftFile.name || '').toLowerCase();
                if (!ftName.endsWith('.html') && !ftName.endsWith('.htm') && !ftName.endsWith('.json')) {
                    if (app.modules.data && app.modules.data.setStatus) {
                        app.modules.data.setStatus('Drop a folder, HTML, or JSON file here', 'error');
                    }
                    return;
                }
                await handleDataFileDrop(ftFile, ftFile.name);
            }
        });
    }

    // ── Initialization ──────────────────────────────────────────────────────
    app.registerInit(function () {
        document.querySelectorAll('[data-drop-zone]').forEach(wireZone);
    });

    dropZonesModule.classifyTransfer = classifyTransfer;
    dropZonesModule.zoneIsEligible = zoneIsEligible;

})(window.transmittalApp);
