/**
 * Utility functions
 */

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function () {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Get file type icon based on file extension
 * @param {string} fileName - Name of the file
 * @returns {string} Emoji icon for the file type
 */
function getFileTypeIcon(fileName) {
    const extension = fileName.toLowerCase().split('.').pop();
    
    const iconMap = {
        // Documents
        'md': '📝',
        'markdown': '📝',
        'txt': '📄',
        'rtf': '📄',
        'doc': '📘',
        'docx': '📘',
        'odt': '📘',
        
        // Web files
        'html': '🌐',
        'htm': '🌐',
        'css': '🎨',
        'js': '⚡',
        'json': '📋',
        'xml': '📊',
        'yaml': '⚙️',
        'yml': '⚙️',
        
        // PDFs and presentations
        'pdf': '📕',
        'ppt': '📊',
        'pptx': '📊',
        'odp': '📊',
        
        // Spreadsheets
        'xls': '📗',
        'xlsx': '📗',
        'csv': '📊',
        'ods': '📗',
        
        // Images
        'png': '🖼️',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'gif': '🖼️',
        'svg': '🖼️',
        'webp': '🖼️',
        'bmp': '🖼️',
        
        // Archives
        'zip': '📦',
        'rar': '📦',
        'tar': '📦',
        'gz': '📦',
        '7z': '📦',
        
        // Code files
        'py': '🐍',
        'java': '☕',
        'cpp': '⚙️',
        'c': '⚙️',
        'h': '⚙️',
        'php': '🔧',
        'rb': '💎',
        'go': '🔵',
        'rs': '🦀',
        'swift': '🧡',
        'kt': '💜',
        
        // Configuration
        'ini': '⚙️',
        'conf': '⚙️',
        'cfg': '⚙️',
        'env': '⚙️',
        
        // Other
        'log': '📃',
        'sql': '🗄️',
        'db': '🗄️',
        'sqlite': '🗄️',
    };
    
    return iconMap[extension] || '📄';
}
