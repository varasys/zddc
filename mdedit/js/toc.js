/**
 * Table of Contents generation and scroll functionality
 */

/**
 * Scroll to header service - uses line numbers for reliable targeting
 */
const ScrollToHeaderService = {
    /**
     * Scroll to a specific header in the editor by line number
     * @param {Object} editorInstance - Toast UI Editor instance
     * @param {string} headerText - Text content of the header (for highlighting)
     * @param {number} lineIndex - 0-based line index of the header in markdown
     */
    scrollToHeader(editorInstance, headerText, lineIndex) {
        if (!editorInstance) {
            console.warn('Editor instance not available for scrolling');
            return;
        }

        try {
            const editorElements = editorInstance.getEditorElements();
            const isWysiwygMode = editorInstance.isWysiwygMode();

            if (isWysiwygMode) {
                // In WYSIWYG mode, find header by text (no line numbers available)
                const wysiwygEditor = editorElements.wwEditor;
                if (wysiwygEditor) {
                    const headers = wysiwygEditor.querySelectorAll('h1, h2, h3, h4, h5, h6');
                    for (const header of headers) {
                        if (header.textContent.trim() === headerText.trim()) {
                            header.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            this._highlightHeader(header);
                            break;
                        }
                    }
                }
            } else {
                // In markdown mode, use line number to position cursor, then scroll preview
                const lineNumber = lineIndex + 1; // Convert to 1-based
                
                // Move cursor to the heading line in the editor
                try {
                    editorInstance.setSelection([lineNumber, 1], [lineNumber, 1]);
                } catch (e) {
                    console.debug('Could not set selection:', e);
                }

                // Scroll preview to matching header
                const previewElement = editorElements.mdPreview;
                if (previewElement) {
                    const headers = previewElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
                    let headerIndex = 0;
                    
                    // Count which header this is (by matching text)
                    for (const header of headers) {
                        if (header.textContent.trim() === headerText.trim()) {
                            header.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            this._highlightHeader(header);
                            break;
                        }
                        headerIndex++;
                    }
                }
            }
        } catch (error) {
            console.error('Error scrolling to header:', error);
        }
    },

    /**
     * Highlight header briefly for visual feedback
     * @param {HTMLElement} headerElement - Header to highlight
     */
    _highlightHeader(headerElement) {
        if (!headerElement) return;
        
        headerElement.style.transition = 'background-color 0.3s ease';
        headerElement.style.backgroundColor = '#fef3c7';
        
        setTimeout(() => {
            headerElement.style.backgroundColor = '';
            setTimeout(() => {
                headerElement.style.transition = '';
            }, 300);
        }, 1500);
    }
};

/**
 * Generate and update the TOC from markdown content
 * @param {string} content - Markdown content
 * @param {HTMLElement} tocContainer - Container for the TOC
 * @param {Object} editorInstance - Toast UI Editor instance
 * @param {number} maxDepth - Maximum heading level (1-6)
 */
function updateToc(content, tocContainer, editorInstance, maxDepth = 6) {
    if (content === undefined || content === null || !tocContainer) {
        console.warn('Missing required params for updateToc');
        return;
    }

    tocContainer.innerHTML = '';

    const tocList = document.createElement('ul');
    tocList.className = 'toc-list pl-0 text-sm';

    if (!content.trim()) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'text-gray-500 p-4';
        emptyMessage.textContent = 'This file is empty.';
        tocContainer.appendChild(emptyMessage);
        return;
    }

    const headings = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
        const match = line.match(/^(#{1,6})\s+(.+)$/);
        if (match) {
            const level = match[1].length;
            let text = match[2].trim();
            
            // Clean markdown formatting
            text = text
                .replace(/\\(.)/g, '$1')
                .replace(/\*\*(.*?)\*\*/g, '$1')
                .replace(/\*(.*?)\*/g, '$1')
                .replace(/`(.*?)`/g, '$1')
                .replace(/\[(.*?)\]\(.*?\)/g, '$1')
                .replace(/~~(.*?)~~/g, '$1')
                .trim();
            
            const id = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
            
            headings.push({
                level,
                text,
                id,
                lineIndex: index
            });
        }
    });

    let currentList = tocList;
    let currentLevel = 0;
    let listsStack = [tocList];

    const filteredHeadings = headings.filter(heading => heading.level <= maxDepth);

    if (filteredHeadings.length === 0) {
        const noHeadings = document.createElement('p');
        noHeadings.className = 'text-gray-500 p-4';
        noHeadings.textContent = maxDepth === 6 ? 'No headings found in this document.' :
            'No headings at or below level H' + maxDepth + ' found.';
        tocContainer.appendChild(noHeadings);
        return;
    }

    filteredHeadings.forEach(heading => {
        const li = document.createElement('li');
        li.className = `toc-item toc-level-${heading.level} py-1`;

        const a = document.createElement('a');
        a.innerHTML = heading.text;
        a.href = '#';
        a.className = 'text-blue-600 hover:text-blue-800 hover:underline cursor-pointer';
        a.dataset.headerText = heading.text;
        a.dataset.lineIndex = heading.lineIndex;

        a.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (editorInstance && ScrollToHeaderService) {
                try {
                    ScrollToHeaderService.scrollToHeader(
                        editorInstance, 
                        heading.text, 
                        parseInt(heading.lineIndex)
                    );
                } catch (error) {
                    console.error('Error in ScrollToHeaderService.scrollToHeader:', error);
                }
            }
        });

        li.appendChild(a);

        if (heading.level > currentLevel) {
            const nestedUl = document.createElement('ul');
            nestedUl.className = 'pl-4 mt-1';
            listsStack[listsStack.length - 1].appendChild(nestedUl);
            listsStack.push(nestedUl);
            currentList = nestedUl;
            currentLevel = heading.level;
        } else if (heading.level < currentLevel) {
            while (heading.level < currentLevel && listsStack.length > 1) {
                listsStack.pop();
                currentLevel--;
            }
            currentList = listsStack[listsStack.length - 1];
        }

        currentList.appendChild(li);
    });

    tocContainer.appendChild(tocList);
}

// Export globally
window.updateToc = updateToc;
