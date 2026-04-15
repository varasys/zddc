/**
 * Application initialization
 */

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    // Check File System API availability and update UI
    initializeApiAvailability();
    
    setupEventListeners();
    initializeFileNavResizer();
    setupTocDepthSelector();
    startFileChangeMonitoring();
    
    // Show scratchpad in file tree on startup
    renderFileTree();
    

});

/**
 * Initialize UI based on File System API availability
 */
function initializeApiAvailability() {
    const selectDirectoryBtn = document.getElementById('select-directory');
    const welcomeHint = document.getElementById('welcome-hint');
    const welcomeFirefox = document.getElementById('welcome-firefox');
    
    if (!hasFileSystemAccess) {
        // Disable file system buttons in Firefox and other unsupported browsers
        if (selectDirectoryBtn) {
            selectDirectoryBtn.disabled = true;
            selectDirectoryBtn.title = 'File System API not supported in this browser';
        }
        // Show Firefox warning, hide normal hint
        if (welcomeHint) welcomeHint.classList.add('hidden');
        if (welcomeFirefox) welcomeFirefox.classList.remove('hidden');
        
    }
}
