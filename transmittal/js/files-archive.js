(function (app) {
    'use strict';

    var dom = app.dom;
    var util = app.util;
    var filesModule = app.modules.files;

    var ARCHIVE_DIR_NAME = '.archive';

    function sanitizeUrlSegment(value, fallback) {
        var str = (value || '').toString().trim();
        if (!str) {
            return fallback;
        }
        var cleaned = str
            .replace(/[^A-Za-z0-9._~-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');
        return cleaned || fallback;
    }

    function encodeRelativePath(path) {
        return path.split('/').map(function (segment) {
            return encodeURIComponent(segment);
        }).join('/');
    }

    function buildRedirectHtml(targetHref, displayName) {
        var safeHrefAttr = util.escapeHtmlAttribute(targetHref);
        var safeLabel = util.escapeHtml(displayName || targetHref);
        return '<!DOCTYPE html>\n' +
            '<html lang="en">\n' +
            '<head>\n' +
            '<meta charset="utf-8">\n' +
            '<meta http-equiv="refresh" content="0; url=' + safeHrefAttr + '">\n' +
            '<title>' + safeLabel + '</title>\n' +
            '</head>\n' +
            '<body>\n' +
            '<p>Redirecting to <a href="' + safeHrefAttr + '">' + safeLabel + '</a>.</p>\n' +
            '</body>\n' +
            '</html>\n';
    }

    async function ensureArchiveDirectory(rootHandle) {
        return rootHandle.getDirectoryHandle(ARCHIVE_DIR_NAME, { create: true });
    }

    async function writeRedirectFile(directoryHandle, filename, html) {
        var fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
        var writable = await fileHandle.createWritable();
        await writable.write(new Blob([html], { type: 'text/html' }));
        await writable.close();
    }

    function groupFilesByTracking(files) {
        var map = new Map();
        files.forEach(function (file) {
            var key = file.trackingNumber || '';
            if (!map.has(key)) {
                map.set(key, []);
            }
            map.get(key).push(file);
        });
        return map;
    }

    function determineLatestByTracking(grouped) {
        var latest = new Map();
        grouped.forEach(function (files, tracking) {
            if (!files || !files.length) {
                return;
            }
            var sorted = files.slice().sort(function (a, b) {
                var revisionCompare = util.compareRevisionPriority(a.revision, b.revision);
                if (revisionCompare !== 0) {
                    return revisionCompare;
                }
                var pathCompare = (a.path || '').localeCompare(b.path || '');
                if (pathCompare !== 0) {
                    return pathCompare;
                }
                return (a.name || '').localeCompare(b.name || '');
            });
            latest.set(tracking, sorted[sorted.length - 1]);
        });
        return latest;
    }

    function buildRedirectFilenames(file) {
        var trackingSegment = sanitizeUrlSegment(file.trackingNumber || '', 'tracking');
        var rawRevision = (file.revision || '').trim();
        var revisionSegment = rawRevision ? sanitizeUrlSegment(rawRevision, 'rev') : '';
        var rawHash = (file.sha256 || '').trim();
        var hashSegment = rawHash ? sanitizeUrlSegment(rawHash, 'hash') : '';
        var htmlSuffix = '.html';

        var revisionFilename = revisionSegment ? (trackingSegment + '_' + revisionSegment + htmlSuffix) : '';
        var hashFilename = hashSegment ? (hashSegment + htmlSuffix) : '';
        var latestFilename = trackingSegment + htmlSuffix;

        return {
            latestFilename: latestFilename,
            revisionFilename: revisionFilename,
            hashFilename: hashFilename
        };
    }

    async function resolveFileMetadata(entry) {
        var parsed = filesModule.parseFilename(entry.name || entry.path || '');
        if (!parsed.trackingNumber) {
            return null;
        }
        var file = await entry.handle.getFile();
        var sha256 = await util.hashFile(file);
        return {
            path: entry.path,
            name: file.name,
            extension: parsed.extension || (file.name.split('.').pop() || ''),
            trackingNumber: parsed.trackingNumber,
            revision: parsed.revision,
            status: parsed.status,
            title: parsed.title,
            sha256: sha256,
            size: file.size
        };
    }

    function buildRelativeHref(relativePath) {
        var encoded = encodeRelativePath(relativePath);
        return '../' + encoded;
    }

    async function createRedirectFiles(archiveHandle, file, isLatest) {
        var filenames = buildRedirectFilenames(file);
        var href = buildRelativeHref(file.path);
        var html = buildRedirectHtml(href, file.name);

        var writes = [];
        if (filenames.revisionFilename) {
            writes.push(writeRedirectFile(archiveHandle, filenames.revisionFilename, html));
        }
        if (filenames.hashFilename) {
            writes.push(writeRedirectFile(archiveHandle, filenames.hashFilename, html));
        }
        if (isLatest) {
            writes.push(writeRedirectFile(archiveHandle, filenames.latestFilename, html));
        }

        await Promise.all(writes);
        return true;
    }

    async function pickIndexDirectory() {
        if (typeof window.showDirectoryPicker !== 'function') {
            throw new Error('File System Access API showDirectoryPicker is required');
        }
        return window.showDirectoryPicker();
    }

    filesModule.generateArchiveRedirects = async function generateArchiveRedirects() {
        var rootHandle;
        try {
            rootHandle = await pickIndexDirectory();
        } catch (err) {
            if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
                console.log('[transmittal] Create Index cancelled.');
                return;
            }
            throw err;
        }

        var overallStart = filesModule.nowMs();
        var entries = await filesModule.collectDirectoryEntries(rootHandle);
        if (!entries.length) {
            console.log('[transmittal] Create Index: No files found.');
            return;
        }

        var archiveHandle = await ensureArchiveDirectory(rootHandle);
        var files = [];
        for (var i = 0; i < entries.length; i++) {
            try {
                var metadata = await resolveFileMetadata(entries[i]);
                if (metadata) {
                    files.push(metadata);
                }
            } catch (err) {
                console.warn('[transmittal] create-index skip', entries[i].path, err);
            }
        }
        if (!files.length) {
            console.log('[transmittal] Create Index: No ZDDC files found.');
            return;
        }

        var grouped = groupFilesByTracking(files);
        var latest = determineLatestByTracking(grouped);

        var writePromises = files.map(function (file) {
            var isLatest = latest.get(file.trackingNumber) === file;
            return createRedirectFiles(archiveHandle, file, isLatest)
                .catch(function (err) {
                    console.error('[transmittal] create-index write failed', file.path, err);
                    return null;
                });
        });

        var results = await Promise.all(writePromises);
        var created = results.filter(function (result) { return result !== null; }).length;

        var totalElapsed = filesModule.nowMs() - overallStart;
        console.log('[transmittal] Create Index: Generated redirects for ' + created + ' files in ' + filesModule.formatDuration(totalElapsed) + '.');
    };
})(window.transmittalApp);
