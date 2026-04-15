/**
 * Column Resize Module
 * Handles resizable table columns
 */
(function() {
    'use strict';

    let resizingColumn = null;
    let startX = 0;
    let startWidth = 0;

    /**
     * Initialize column resizing
     */
    function init() {
        const table = window.app.dom.spreadsheet;
        const headers = table.querySelectorAll('thead th');
        
        headers.forEach(th => {
            // Skip if resize handle already exists
            if (th.querySelector('.column-resizer')) return;
            
            // Add resize handle
            const resizer = document.createElement('div');
            resizer.className = 'column-resizer';
            th.appendChild(resizer);
            
            // Mouse down on resizer
            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                resizingColumn = th;
                startX = e.pageX;
                startWidth = th.offsetWidth;
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            });
        });
    }

    /**
     * Handle mouse move during resize
     */
    function handleMouseMove(e) {
        if (!resizingColumn) return;
        
        const diff = e.pageX - startX;
        const newWidth = Math.max(50, startWidth + diff);
        
        resizingColumn.style.width = newWidth + 'px';
        resizingColumn.style.minWidth = newWidth + 'px';
        resizingColumn.style.maxWidth = newWidth + 'px';
    }

    /**
     * Handle mouse up - end resize
     */
    function handleMouseUp() {
        resizingColumn = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }

    // Export module
    window.app.modules.resize = {
        init
    };
})();
