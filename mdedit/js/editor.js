/**
 * Toast UI Editor initialization and management
 */

/**
 * Initialize or update the Toast UI Editor for a file
 * @param {string} content - Content to display
 * @param {boolean} isMarkdown - Whether content is markdown
 * @param {string} filePath - Path of the file
 * @param {string} fileName - Name of the file
 * @param {FileSystemFileHandle} fileHandle - File handle for saving
 * @param {number} lastModified - Timestamp of last modification
 */
function initializeEditor(content, isMarkdown = true, filePath = '', fileName = '', fileHandle = null, lastModified = null) {
    // Parse front matter
    let frontMatterData = {};
    let markdownBody = content;
    
    if (isMarkdown && content) {
        try {
            const parsed = parseFrontMatter(content);
            frontMatterData = parsed.data;
            markdownBody = parsed.content;
        } catch (error) {
            console.error('Failed to parse front matter:', error);
        }
    }
    
    const contentContainer = document.getElementById('content-container');
    if (!contentContainer) {
        alert('Error: content-container element not found!');
        return;
    }

    // Hide all file view containers
    document.querySelectorAll('.file-view-container').forEach(container => {
        container.style.display = 'none';
    });

    // Check if file already has an instance
    if (editorInstances.has(filePath)) {
        const existingInstance = editorInstances.get(filePath);
        if (existingInstance.fileViewContainer) {
            existingInstance.fileViewContainer.style.display = 'flex';
        }
        return existingInstance.editor;
    }

    // Create file view container
    const fileViewContainer = document.createElement('div');
    fileViewContainer.className = 'file-view-container flex flex-col h-full';

    // Create file header
    const fileHeader = document.createElement('div');
    fileHeader.className = 'file-header flex justify-between items-center px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium border-b border-gray-200 dark:border-gray-700';

    const fileTitle = document.createElement('span');
    fileTitle.textContent = fileName || 'No file selected';
    fileHeader.appendChild(fileTitle);

    // Button container for alignment
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex gap-2';

    // Determine if this is a scratchpad (no file handle)
    const isScratchpad = !fileHandle;

    // Save button (or Save As for scratchpads)
    const saveButton = document.createElement('button');
    saveButton.className = 'bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1 rounded';
    saveButton.textContent = isScratchpad ? 'Save As...' : 'Save File';
    saveButton.disabled = !isScratchpad; // Scratchpads can always save
    buttonContainer.appendChild(saveButton);

    // Reload button (only for files, not scratchpads)
    let reloadButton = null;
    if (!isScratchpad) {
        reloadButton = document.createElement('button');
        reloadButton.className = 'bg-gray-500 hover:bg-gray-600 text-white text-xs px-3 py-1 rounded';
        reloadButton.textContent = 'Reload from Disk';
        reloadButton.title = 'Reload file from disk (discards unsaved changes)';
        buttonContainer.appendChild(reloadButton);
    }

    fileHeader.appendChild(buttonContainer);

    fileViewContainer.appendChild(fileHeader);

    // Content area
    const contentArea = document.createElement('div');
    contentArea.className = 'flex flex-col flex-1 overflow-hidden';
    
    // Front matter section (markdown only)
    let frontMatterTextarea = null;
    if (isMarkdown) {
        const frontMatterSection = document.createElement('div');
        frontMatterSection.className = 'border-b border-gray-200 dark:border-gray-700';
        
        const frontMatterHeader = document.createElement('div');
        frontMatterHeader.className = 'px-4 py-1 bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center';
        
        const headerText = document.createElement('span');
        headerText.textContent = 'YAML Front Matter';
        frontMatterHeader.appendChild(headerText);
        
        const toggleButton = document.createElement('button');
        toggleButton.className = 'text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors';
        toggleButton.textContent = 'Hide';
        frontMatterHeader.appendChild(toggleButton);
        
        frontMatterTextarea = document.createElement('textarea');
        frontMatterTextarea.className = 'w-full h-24 px-4 py-2 font-mono text-sm border-0 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100';
        frontMatterTextarea.placeholder = 'title: Document Title\ndate: 2024-01-01\ntags: [example]';
        
        // Set front matter content
        if (frontMatterData && Object.keys(frontMatterData).length > 0) {
            try {
                let yamlText = '';
                for (const [key, value] of Object.entries(frontMatterData)) {
                    if (Array.isArray(value)) {
                        yamlText += `${key}: [${value.map(v => `"${v}"`).join(', ')}]\n`;
                    } else {
                        yamlText += `${key}: ${value}\n`;
                    }
                }
                frontMatterTextarea.value = yamlText.trim();
            } catch (error) {
                console.warn('Failed to stringify front matter:', error);
                frontMatterTextarea.value = '';
            }
        }
        
        // Toggle visibility
        let isCollapsed = false;
        toggleButton.addEventListener('click', () => {
            isCollapsed = !isCollapsed;
            frontMatterTextarea.style.display = isCollapsed ? 'none' : 'block';
            toggleButton.textContent = isCollapsed ? 'Show' : 'Hide';
        });
        
        frontMatterSection.appendChild(frontMatterHeader);
        frontMatterSection.appendChild(frontMatterTextarea);
        contentArea.appendChild(frontMatterSection);
    }
    
    // Editor area with TOC
    const editorArea = document.createElement('div');
    editorArea.className = 'flex flex-row flex-1 overflow-hidden';

    // TOC pane (markdown only)
    let tocContainer = null;
    if (isMarkdown) {
        const tocPane = document.createElement('div');
        tocPane.className = 'toc-pane bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-auto';
        tocPane.style.width = '325px';
        tocPane.style.minWidth = '150px';

        const tocHeader = document.createElement('div');
        tocHeader.className = 'toc-header px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium border-b border-gray-200 dark:border-gray-700';

        const tocTitle = document.createElement('span');
        tocTitle.textContent = 'Table of Contents';
        tocHeader.appendChild(tocTitle);

        const tocDepthSelector = document.createElement('select');
        tocDepthSelector.className = 'toc-depth-selector';
        tocDepthSelector.innerHTML = `
            <option value="6">All Levels</option>
            <option value="1">H1 Only</option>
            <option value="2">H1-H2</option>
            <option value="3" selected>H1-H3</option>
            <option value="4">H1-H4</option>
            <option value="5">H1-H5</option>
        `;
        tocHeader.appendChild(tocDepthSelector);

        tocPane.appendChild(tocHeader);

        tocContainer = document.createElement('div');
        tocContainer.className = 'toc-container toc-content p-4 h-full overflow-auto';
        tocPane.appendChild(tocContainer);

        editorArea.appendChild(tocPane);

        // TOC resizer
        const tocResizer = document.createElement('div');
        tocResizer.className = 'pane-resizer bg-gray-200 dark:bg-gray-700 transition-colors relative z-10 w-1 cursor-col-resize hover:bg-blue-500';
        tocResizer.setAttribute('data-resizer-for', 'toc-pane');
        contentArea.appendChild(tocResizer);

        makeResizable(tocResizer, tocPane);

        // TOC depth selector event
        tocDepthSelector.addEventListener('change', function () {
            const depth = parseInt(this.value);
            if (window.updateToc && editorInstance) {
                const currentContent = editorInstance.getMarkdown();
                window.updateToc(currentContent, tocContainer, editorInstance, depth);
            }
        });
    }

    // Editor container
    const editorContainer = document.createElement('div');
    editorContainer.className = 'editor-instance flex-1 overflow-hidden';
    editorArea.appendChild(editorContainer);
    
    contentArea.appendChild(editorArea);
    fileViewContainer.appendChild(contentArea);
    contentContainer.appendChild(fileViewContainer);

    // Check Toast UI availability
    if (typeof toastui === 'undefined') {
        alert('Error: Toast UI library not loaded!');
        editorContainer.innerHTML = '<div style="padding: 20px; background: #ffeeee; color: red;">Error: Toast UI library not loaded!</div>';
        return;
    }

    let editorInstance;

    try {
        // Initialize Toast UI Editor
        const editor = new toastui.Editor({
            el: editorContainer,
            height: '100%',
            initialEditType: 'markdown',
            previewStyle: 'vertical',
            initialValue: markdownBody,
            toolbarItems: [
                ['heading', 'bold', 'italic', 'strike'],
                ['hr', 'quote'],
                ['ul', 'ol', 'task', 'indent', 'outdent'],
                ['table', 'image', 'link'],
                ['code', 'codeblock']
            ]
        });

        editorInstance = editor;
        
        if (!isMarkdown) {
            editorInstance.changeMode('wysiwyg');
        }

        // Generate initial TOC
        if (isMarkdown && window.updateToc && tocContainer) {
            try {
                window.updateToc(markdownBody, tocContainer, editorInstance, tocMaxDepth);
            } catch (error) {
                console.error('Error generating TOC:', error);
            }

            const debouncedUpdateToc = debounce(() => {
                const currentContent = editorInstance.getMarkdown();
                window.updateToc(currentContent, tocContainer, editorInstance, tocMaxDepth);
            }, 300);

            editorInstance.on('change', () => {
                debouncedUpdateToc();

                const instanceData = editorInstances.get(filePath);
                if (instanceData && !instanceData.isDirty) {
                    instanceData.isDirty = true;
                    updateFileDirtyStatus(filePath, true);
                    updateUnsavedCount();
                }
                saveButton.disabled = false;
            });
        } else {
            editorInstance.on('change', () => {
                const instanceData = editorInstances.get(filePath);
                if (instanceData && !instanceData.isDirty) {
                    instanceData.isDirty = true;
                    updateFileDirtyStatus(filePath, true);
                    updateUnsavedCount();
                }
                saveButton.disabled = false;
            });
        }

        // Front matter change listener
        if (frontMatterTextarea) {
            frontMatterTextarea.addEventListener('input', () => {
                const instanceData = editorInstances.get(filePath);
                if (instanceData && !instanceData.isDirty) {
                    instanceData.isDirty = true;
                    updateFileDirtyStatus(filePath, true);
                    updateUnsavedCount();
                }
                saveButton.disabled = false;
            });
        }

        // Button event listeners
        saveButton.addEventListener('click', async () => {
            if (isScratchpad) {
                // For scratchpads, use Save As
                const content = editorInstance.getMarkdown();
                const savedHandle = await saveFileAs(content, 'untitled.md');
                if (savedHandle && hasFileSystemAccess) {
                    // Check if saved to current directory - add to file tree
                    if (directoryHandle) {
                        try {
                            // Try to get the file from the directory to verify it's there
                            const checkHandle = await directoryHandle.getFileHandle(savedHandle.name);
                            // File is in current directory, add to tree
                            fileTree.entries[savedHandle.name] = {
                                name: savedHandle.name,
                                type: 'file',
                                handle: checkHandle
                            };
                            renderFileTree();

                        } catch (e) {
                            // File not in current directory, that's fine
                        }
                    }
                    // Clear scratchpad content after successful save
                    editorInstance.setMarkdown('');
                    saveButton.disabled = true;
                    const instanceData = editorInstances.get(filePath);
                    if (instanceData) {
                        instanceData.isDirty = false;
                    }
                }
            } else {
                saveFile(filePath);
            }
        });

        if (reloadButton) {
            reloadButton.addEventListener('click', async () => {
                await reloadFileFromDisk(filePath);
            });
        }

        // Store instance data
        const instanceData = {
            editor: editor,
            fileViewContainer: fileViewContainer,
            tocContainer: tocContainer,
            saveButton: saveButton,
            reloadButton: reloadButton,
            frontMatterTextarea: frontMatterTextarea,
            frontMatterData: frontMatterData,
            fileHandle: fileHandle,
            lastModified: lastModified,
            isDirty: false
        };

        editorInstances.set(filePath, instanceData);

        return editorInstance;
    } catch (error) {
        console.error('Error initializing editor:', error);
        alert(`Error initializing Toast UI Editor: ${error}`);
        return null;
    }
}
