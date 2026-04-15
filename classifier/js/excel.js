/**
 * Excel Integration Module
 * Toast notifications and hash export
 */
(function() {
    'use strict';

    /**
     * Show toast notification
     */
    function showToast(message, type = 'info') {
        // Remove existing toast
        const existing = document.querySelector('.toast');
        if (existing) {
            existing.remove();
        }

        // Create toast
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            toast.classList.add('toast-fade');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    /**
     * Export SHA256 hashes in sha256sum format
     */
    async function exportHashes() {
        const files = window.app.modules.store.getDisplayFiles();
        if (files.length === 0) {
            alert('No files to export');
            return;
        }

        // Check if SHA256 is enabled
        if (!window.app.calculateSha256) {
            alert('Please enable SHA256 checkbox first and wait for hashes to calculate');
            return;
        }

        try {
            // Build sha256sum format: hash *filepath
            const lines = [];
            
            // Get root path
            const rootPath = await getFullPath(window.app.rootHandle);
            
            for (const file of files) {
                if (!file.sha256 || file.sha256 === 'calculating...' || file.sha256 === 'error') {
                    continue; // Skip files without calculated hash
                }
                
                // Get full path from root
                const folderPath = await getFullPath(file.folderHandle);
                const fullPath = `${folderPath}/${file.originalFilename}${file.extension}`;
                
                // Format: hash *filepath (asterisk indicates binary mode)
                lines.push(`${file.sha256} *${fullPath}`);
            }

            if (lines.length === 0) {
                alert('No SHA256 hashes available. Enable SHA256 and wait for calculation to complete.');
                return;
            }

            // Create output
            const output = lines.join('\n');

            // Generate filename with timestamp
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5); // YYYY-MM-DDTHH-MM-SS
            const filename = `sha256sums_${timestamp}.txt`;

            // Download as file
            const blob = new Blob([output], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Show success message
            showToast(`✓ Downloaded ${lines.length} hash(es) to ${filename}`, 'success');

        } catch (err) {
            console.error('Error exporting hashes:', err);
            alert('Error exporting hashes: ' + err.message);
        }
    }

    /**
     * Get full path from directory handle (all the way to root)
     */
    async function getFullPath(dirHandle) {
        const parts = [];
        let current = dirHandle;
        
        // Walk up to root - collect ALL parent folders
        while (current) {
            parts.unshift(current.name);
            
            try {
                // Try to get parent
                if (typeof current.getParent === 'function') {
                    const parent = await current.getParent();
                    if (parent && parent !== current) {
                        current = parent;
                        continue;
                    }
                }
                break;
            } catch {
                break;
            }
        }
        
        return parts.join('/');
    }

    // Export module
    window.app.modules.excel = {
        showToast,
        exportHashes
    };
})();
