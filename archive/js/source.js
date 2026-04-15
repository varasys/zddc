// Source abstraction — local (File System Access API) and HTTP (Caddy JSON browse)
//
// Shared utility used by both source implementations
function getDisplayPath(fullPath) {
    if (fullPath.length <= 100) {
        return fullPath;
    }
    const parts = fullPath.split('/');
    if (parts.length > 3) {
        return parts[0] + '/.../' + parts.slice(-2).join('/');
    }
    return '...' + fullPath.substring(fullPath.length - 80);
}

// createSource(type, options) returns a source object:
//   source.type       — 'local' | 'http'
//   source.canWrite   — boolean
//   source.scan(rootIdentifier, callbacks) — Promise; walks tree calling:
//       callbacks.onGroupingFolder(folder)     folder: { name, path, displayPath, handle? }
//       callbacks.onTransmittalFolder(folder)  folder: { name, path, displayPath, handle?, url? }
//       callbacks.onFile(file)                 file:   full file object (parsed + metadata)
//       callbacks.onProgress(message)
//   source.fetchFile(fileRef) — Promise<ArrayBuffer>

function createSource(type, options) {
    if (type === 'local') {
        return createLocalSource();
    } else if (type === 'http') {
        return createHttpSource(options.baseUrl);
    }
    throw new Error('Unknown source type: ' + type);
}

// ---------------------------------------------------------------------------
// Local source — wraps File System Access API
// ---------------------------------------------------------------------------

function createLocalSource() {
    return {
        type: 'local',
        canWrite: true,

        scan: function(dirHandle, callbacks) {
            return scanLocalRecursive(dirHandle, dirHandle.name, 0, callbacks);
        },

        fetchFile: function(fileRef) {
            return fileRef.handle.getFile().then(function(f) {
                return f.arrayBuffer();
            });
        }
    };
}

async function scanLocalRecursive(dirHandle, currentPath, depth, callbacks) {
    if (currentPath.length > 200) {
        console.warn('Path too long, skipping deeper scan: ' + currentPath);
        return;
    }
    if (depth > 10) {
        console.warn('Directory depth limit reached at: ' + currentPath);
        return;
    }

    callbacks.onProgress('Scanning ' + currentPath + '...');

    const entries = [];
    try {
        for await (const entry of dirHandle.values()) {
            entries.push(entry);
        }
    } catch (err) {
        console.warn('Could not read directory ' + currentPath + ':', err);
        return;
    }

    for (const entry of entries) {
        if (entry.kind === 'directory') {
            const subPath = currentPath + '/' + entry.name;
            try {
                if (isTransmittalFolder(entry.name)) {
                    const folder = {
                        name: entry.name,
                        path: subPath,
                        displayPath: getDisplayPath(subPath),
                        handle: entry
                    };
                    callbacks.onTransmittalFolder(folder);
                    await scanLocalTransmittalFolder(entry, subPath, 0, subPath, callbacks);
                } else {
                    const folder = {
                        name: entry.name,
                        path: subPath,
                        displayPath: entry.name,
                        handle: entry
                    };
                    callbacks.onGroupingFolder(folder);
                    await scanLocalRecursive(entry, subPath, depth + 1, callbacks);
                }
            } catch (err) {
                console.warn('Could not process directory ' + entry.name + ':', err);
            }
        } else if (entry.kind === 'file') {
            // File directly in a grouping folder — assign to the Outstanding virtual transmittal.
            // actualPath records the real containing folder for grouping-folder-scoped filtering.
            try {
                const file = await entry.getFile();
                const parsed = parseFileName(file.name);

                if (!parsed.trackingNumber) {
                    console.warn('File does not match ZDDC naming convention: ' + file.name);
                }

                const fullPath = currentPath + '/' + file.name;
                const displayPath = fullPath.length > 250
                    ? '...' + fullPath.substring(fullPath.length - 200)
                    : fullPath;

                callbacks.onFile({
                    id: crypto.randomUUID(),
                    name: file.name,
                    path: fullPath,
                    displayPath: displayPath,
                    url: null,
                    size: file.size,
                    modified: file.lastModified,
                    handle: entry,
                    folderPath: '__outstanding__',
                    actualPath: currentPath,
                    hasPathError: false,
                    ...parsed
                });
            } catch (fileErr) {
                const fullPath = currentPath + '/' + entry.name;
                const displayPath = fullPath.length > 250
                    ? '...' + fullPath.substring(fullPath.length - 200)
                    : fullPath;
                const parsed = parseFileName(entry.name);

                callbacks.onFile({
                    id: crypto.randomUUID(),
                    name: entry.name,
                    path: fullPath,
                    displayPath: displayPath,
                    url: null,
                    size: null,
                    modified: null,
                    handle: null,
                    folderPath: '__outstanding__',
                    actualPath: currentPath,
                    hasPathError: true,
                    pathErrorMessage: fileErr.message || 'File access error',
                    ...parsed
                });

                console.warn('Could not access file ' + entry.name + ' (path error):', fileErr.message);
            }
        }
    }
}

async function scanLocalTransmittalFolder(dirHandle, folderPath, depth, transmittalPath, callbacks) {
    if (depth > 10) {
        console.warn('Directory depth limit reached in transmittal folder: ' + folderPath);
        return;
    }

    try {
        if (folderPath.length > 240) {
            console.warn('Path approaching Windows limit (' + folderPath.length + ' chars): ' + folderPath);
        }

        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file') {
                try {
                    const file = await entry.getFile();
                    const parsed = parseFileName(file.name);

                    if (!parsed.trackingNumber) {
                        console.warn('File does not match ZDDC naming convention: ' + file.name);
                    }

                    const fullPath = folderPath + '/' + file.name;
                    const displayPath = fullPath.length > 250
                        ? '...' + fullPath.substring(fullPath.length - 200)
                        : fullPath;

                    callbacks.onFile({
                        id: crypto.randomUUID(),
                        name: file.name,
                        path: fullPath,
                        displayPath: displayPath,
                        url: null,
                        size: file.size,
                        modified: file.lastModified,
                        handle: entry,
                        folderPath: transmittalPath,
                        actualPath: folderPath,
                        hasPathError: false,
                        ...parsed
                    });
                } catch (fileErr) {
                    const fullPath = folderPath + '/' + entry.name;
                    const displayPath = fullPath.length > 250
                        ? '...' + fullPath.substring(fullPath.length - 200)
                        : fullPath;
                    const parsed = parseFileName(entry.name);

                    callbacks.onFile({
                        id: crypto.randomUUID(),
                        name: entry.name,
                        path: fullPath,
                        displayPath: displayPath,
                        url: null,
                        size: null,
                        modified: null,
                        handle: null,
                        folderPath: transmittalPath,
                        actualPath: folderPath,
                        hasPathError: true,
                        pathErrorMessage: fileErr.message || 'File access error',
                        ...parsed
                    });

                    console.warn('Could not access file ' + entry.name + ' (path error):', fileErr.message);
                }
            } else if (entry.kind === 'directory') {
                const subPath = folderPath + '/' + entry.name;
                try {
                    await scanLocalTransmittalFolder(entry, subPath, depth + 1, transmittalPath, callbacks);
                } catch (err) {
                    console.warn('Could not scan subdirectory ' + entry.name + ' in ' + folderPath + ':', err);
                }
            }
        }
    } catch (err) {
        console.error('Error scanning folder ' + folderPath + ':', err);
    }
}

// ---------------------------------------------------------------------------
// HTTP source — uses Caddy JSON browse (Accept: application/json)
// ---------------------------------------------------------------------------

function createHttpSource(baseUrl) {
    // Normalise: ensure baseUrl ends with /
    const root = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';

    return {
        type: 'http',
        canWrite: false,

        scan: function(rootUrl, callbacks) {
            const scanRoot = (rootUrl && rootUrl !== root) ? rootUrl : root;
            return scanHttpRecursive(scanRoot, root, 0, null, callbacks);
        },

        fetchFile: function(fileRef) {
            return fetch(fileRef.url).then(function(r) {
                if (!r.ok) throw new Error('HTTP ' + r.status + ' fetching ' + fileRef.url);
                return r.arrayBuffer();
            });
        }
    };
}

async function scanHttpRecursive(dirUrl, rootUrl, depth, transmittalPath, callbacks) {
    if (depth > 10) {
        console.warn('HTTP directory depth limit reached at: ' + dirUrl);
        return;
    }

    let items;
    try {
        // Caddy returns JSON when the Accept header requests it
        const resp = await fetch(dirUrl, {
            headers: { 'Accept': 'application/json' }
        });
        if (!resp.ok) {
            throw new Error('HTTP ' + resp.status + ' listing ' + dirUrl);
        }
        // Caddy encodes listing.Items directly — a bare JSON array of fileInfo objects
        // fileInfo fields: name (dirs have trailing "/"), size, url, mod_time, mode, is_dir, is_symlink
        items = await resp.json();
        if (!Array.isArray(items)) {
            throw new Error('Unexpected response format (expected JSON array)');
        }
    } catch (err) {
        console.warn('Could not fetch directory listing for ' + dirUrl + ':', err);
        return;
    }

    // Collect subdirectory scan promises so siblings run in parallel
    const subdirPromises = [];

    for (const item of items) {
        // Caddy appends "/" to directory names; strip it to get the bare name for matching
        const rawName = item.name.endsWith('/') ? item.name.slice(0, -1) : item.name;

        // Skip hidden files
        if (rawName.startsWith('.')) continue;

        const isDir = item.is_dir === true;
        const itemUrl = resolveHttpUrl(dirUrl, rawName, isDir);
        const logicalPath = urlToLogicalPath(itemUrl, rootUrl);

        if (isDir) {
            if (transmittalPath !== null) {
                // Inside a transmittal folder — recurse into subdirectories
                subdirPromises.push(
                    scanHttpRecursive(itemUrl, rootUrl, depth + 1, transmittalPath, callbacks)
                );
            } else if (isTransmittalFolder(rawName)) {
                const folder = {
                    name: rawName,
                    path: logicalPath,
                    displayPath: getDisplayPath(logicalPath),
                    handle: null,
                    url: itemUrl
                };
                callbacks.onTransmittalFolder(folder);
                subdirPromises.push(
                    scanHttpRecursive(itemUrl, rootUrl, depth + 1, logicalPath, callbacks)
                );
            } else {
                const folder = {
                    name: rawName,
                    path: logicalPath,
                    displayPath: rawName,
                    handle: null,
                    url: itemUrl
                };
                callbacks.onGroupingFolder(folder);
                subdirPromises.push(
                    scanHttpRecursive(itemUrl, rootUrl, depth + 1, null, callbacks)
                );
            }
        } else {
            // It's a file
            if (transmittalPath === null) {
                // File directly in a grouping folder — assign to Outstanding virtual transmittal.
                // actualPath records the real containing folder for grouping-folder-scoped filtering.
                const dirLogicalPath = urlToLogicalPath(dirUrl, rootUrl);
                const parsed = parseFileName(rawName);
                if (!parsed.trackingNumber) {
                    console.warn('File does not match ZDDC naming convention: ' + rawName);
                }

                const modified = item.mod_time ? new Date(item.mod_time).getTime() : null;

                callbacks.onFile({
                    id: crypto.randomUUID(),
                    name: rawName,
                    path: logicalPath,
                    displayPath: logicalPath,
                    url: itemUrl,
                    size: item.size || null,
                    modified: modified,
                    handle: null,
                    folderPath: '__outstanding__',
                    actualPath: dirLogicalPath,
                    hasPathError: false,
                    ...parsed
                });
            } else {
                // Inside a transmittal folder
                const parsed = parseFileName(rawName);
                if (!parsed.trackingNumber) {
                    console.warn('File does not match ZDDC naming convention: ' + rawName);
                }

                // mod_time is an ISO 8601 string from Go's time.Time.UTC()
                const modified = item.mod_time ? new Date(item.mod_time).getTime() : null;

                callbacks.onFile({
                    id: crypto.randomUUID(),
                    name: rawName,
                    path: logicalPath,
                    displayPath: logicalPath,
                    url: itemUrl,
                    size: item.size || null,
                    modified: modified,
                    handle: null,
                    folderPath: transmittalPath,
                    actualPath: logicalPath.substring(0, logicalPath.lastIndexOf('/')),
                    hasPathError: false,
                    ...parsed
                });
            }
        }
    }

    // Wait for all sibling subdirectory scans to complete in parallel
    if (subdirPromises.length > 0) {
        await Promise.all(subdirPromises);
    }
}

// Build an absolute URL for an item inside a directory listing URL
function resolveHttpUrl(dirUrl, name, isDir) {
    const base = dirUrl.endsWith('/') ? dirUrl : dirUrl + '/';
    const encoded = encodeURIComponent(name);
    return base + encoded + (isDir ? '/' : '');
}

// Convert an absolute item URL to a logical relative path (for display / filtering)
function urlToLogicalPath(itemUrl, rootUrl) {
    const root = rootUrl.endsWith('/') ? rootUrl : rootUrl + '/';
    let rel = itemUrl;
    if (rel.startsWith(root)) {
        rel = rel.substring(root.length);
    }
    // Decode percent-encoding for display
    try { rel = decodeURIComponent(rel); } catch (e) { /* leave encoded */ }
    // Strip trailing slash for directories
    if (rel.endsWith('/')) rel = rel.slice(0, -1);
    return rel;
}
