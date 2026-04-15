(function (app) {
    'use strict';

    var dom = app.dom;
    var util = app.util;

    var verification = app.modules.verification = {};

    // ── Directory scanning for file hash verification ────
    verification.scanDirectoryForFiles = async function scanDirectoryForFiles(dirHandle, basePath) {
        var base = basePath || '';
        var files = [];

        for await (var entry of dirHandle.values()) {
            if (entry.kind === 'file') {
                var file = await entry.getFile();
                var sha256 = await util.hashFile(file);
                var path = base ? base + '/' + entry.name : entry.name;
                files.push({ name: entry.name, path: path, sha256: sha256, size: file.size });
            } else if (entry.kind === 'directory') {
                var subPath = base ? base + '/' + entry.name : entry.name;
                var subFiles = await verification.scanDirectoryForFiles(entry, subPath);
                for (var j = 0; j < subFiles.length; j++) { files.push(subFiles[j]); }
            }
        }

        return files;
    };

})(window.transmittalApp);
