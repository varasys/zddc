// Export functionality

// Escape a single value for RFC-4180 CSV
function csvCell(value) {
    const str = String(value == null ? '' : value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

// Convert an array of row arrays to a CSV string
function rowsToCSV(rows) {
    return rows.map(row => row.map(csvCell).join(',')).join('\n');
}

// Export selected files to CSV
function exportCSV() {
    if (APP_STATE.selectedFiles.size === 0) {
        alert('No files selected for export.');
        return;
    }
    
    const headers = ['Tracking Number', 'Title', 'Revision', 'Status', 'Extension', 'Size', 'Size (bytes)', 'Path', 'Modified'];
    const rows = [headers];
    
    // Add data rows for selected files only
    APP_STATE.files.forEach(file => {
        if (!APP_STATE.selectedFiles.has(file.id)) return;
        
        rows.push([
            file.trackingNumber || '',
            file.title || '',
            file.revision || '',
            file.status || '',
            file.extension || '',
            formatFileSize(file.size),
            file.size != null ? file.size : '',
            file.path,
            file.modified ? new Date(file.modified).toLocaleString() : '—'
        ]);
    });
    
    downloadFile(rowsToCSV(rows), 'archive-export.csv', 'text/csv');
}

// Download selected files as ZIP
async function downloadSelected() {
    if (APP_STATE.selectedFiles.size === 0) {
        alert('No files selected for download.');
        return;
    }
    
    // Check if JSZip is loaded
    if (typeof JSZip === 'undefined') {
        // Dynamically load JSZip
        await loadJSZip();
    }
    
    const zip = new JSZip();
    const selectedFiles = [];
    
    // Get selected file objects
    APP_STATE.files.forEach(file => {
        if (APP_STATE.selectedFiles.has(file.id)) {
            selectedFiles.push(file);
        }
    });
    
    // Show progress
    showProgress('Preparing ZIP file...', 0, selectedFiles.length);
    
    try {
        // Add files to ZIP
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            showProgress(`Adding ${file.name}...`, i + 1, selectedFiles.length);
            
            try {
                let arrayBuffer;
                if (file.handle) {
                    // Local mode: read via File System Access API
                    const fileData = await file.handle.getFile();
                    arrayBuffer = await fileData.arrayBuffer();
                } else if (file.url) {
                    // HTTP mode: fetch from server
                    const resp = await fetch(file.url);
                    if (!resp.ok) throw new Error('HTTP ' + resp.status);
                    arrayBuffer = await resp.arrayBuffer();
                } else {
                    throw new Error('No file handle or URL available');
                }
                
                // Create folder structure in ZIP
                const relativePath = file.path.substring(file.path.indexOf('/') + 1); // Remove root directory
                zip.file(relativePath, arrayBuffer);
            } catch (err) {
                console.error(`Error adding file ${file.name}:`, err);
            }
        }
        
        showProgress('Generating ZIP...', selectedFiles.length, selectedFiles.length);
        
        // Generate ZIP
        const blob = await zip.generateAsync({ 
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        
        // Download
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        downloadBlob(blob, `archive-${timestamp}.zip`);
        
        hideProgress();
        
    } catch (err) {
        hideProgress();
        console.error('Error creating ZIP:', err);
        alert('Error creating ZIP file: ' + err.message);
    }
}

// Load JSZip library dynamically
function loadJSZip() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Show progress indicator
function showProgress(message, current, total) {
    let progressDiv = document.getElementById('progressIndicator');
    
    if (!progressDiv) {
        progressDiv = document.createElement('div');
        progressDiv.id = 'progressIndicator';
        progressDiv.className = 'progress-indicator';
        document.body.appendChild(progressDiv);
    }
    
    const percentage = Math.round((current / total) * 100);
    
    progressDiv.innerHTML =
        '<div class="progress-indicator__message">' + escapeHtml(message) + '</div>' +
        '<div class="progress-indicator__track">' +
            '<div class="progress-indicator__fill" style="width:' + percentage + '%"></div>' +
        '</div>' +
        '<div class="progress-indicator__label">' + current + ' / ' + total + '</div>';
}

// Hide progress indicator
function hideProgress() {
    const progressDiv = document.getElementById('progressIndicator');
    if (progressDiv) {
        progressDiv.remove();
    }
}

// Download file utility
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    downloadBlob(blob, filename);
}

// Download blob utility
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Export to HTML report
function exportHTMLReport() {
    // Group files by tracking number
    const grouped = groupFilesByTrackingNumber(APP_STATE.filteredFiles);
    const sorted = sortGroupedFiles(grouped);
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Archive Report - ${new Date().toLocaleDateString()}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .revision { font-family: monospace; }
        .status { color: #666; font-size: 0.9em; }
        @media print {
            body { margin: 0; }
            h1 { font-size: 18pt; }
            table { font-size: 10pt; }
        }
    </style>
</head>
<body>
    <h1>Archive Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    <p>Total Files: ${APP_STATE.filteredFiles.length}</p>
    
    <table>
        <thead>
            <tr>
                <th>Tracking Number</th>
                <th>Title</th>
                <th>Revisions</th>
            </tr>
        </thead>
        <tbody>
            ${sorted.map(group => `
                <tr>
                    <td>${escapeHtml(group.trackingNumber)}</td>
                    <td>${escapeHtml(group.title)}</td>
                    <td>
                        ${group.sortedRevisions.map(rev => `
                            <div>
                                <span class="revision">${escapeHtml(rev.revision)}</span>
                                <span class="status">(${escapeHtml(rev.status)})</span>
                                ${rev.files.map(f => f.extension.toUpperCase()).join(', ')}
                            </div>
                        `).join('')}
                    </td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;
    
    downloadFile(html, 'archive-report.html', 'text/html');
}
