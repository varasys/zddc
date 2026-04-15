/**
 * File system operations using File System Access API
 */

/**
 * Open the scratchpad editor
 */
function openScratchpad() {
    // Check if scratchpad already exists
    if (editorInstances.has(SCRATCHPAD_ID)) {
        // Just show it
        const instance = editorInstances.get(SCRATCHPAD_ID);
        document.getElementById('welcome-screen').classList.add('hidden');
        document.getElementById('content-container').classList.remove('hidden');
        
        // Hide all other editors, show scratchpad
        editorInstances.forEach((data, path) => {
            if (data.fileViewContainer) {
                data.fileViewContainer.style.display = path === SCRATCHPAD_ID ? 'flex' : 'none';
            }
        });
        return;
    }
    
    // Hide welcome screen, show content container
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('content-container').classList.remove('hidden');
    
    // Initialize editor with no file handle
    initializeEditor('', true, SCRATCHPAD_ID, 'Scratchpad', null, null);
    
    // Mark as scratchpad
    const instance = editorInstances.get(SCRATCHPAD_ID);
    if (instance) {
        instance.isScratchpad = true;
    }
    
    console.log('Opened scratchpad');
}

/**
 * Save file using Save As dialog (for scratchpads or new saves)
 * @param {string} content - Content to save
 * @param {string} suggestedName - Suggested filename
 * @returns {Promise<FileSystemFileHandle|null>} File handle if saved, null otherwise
 */
async function saveFileAs(content, suggestedName = 'untitled.md') {
    if (hasFileSystemAccess) {
        try {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: suggestedName,
                types: [{
                    description: 'Markdown files',
                    accept: { 'text/markdown': ['.md', '.markdown'] }
                }]
            });
            
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
            
            console.log(`File saved as: ${fileHandle.name}`);
            return fileHandle;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Save cancelled by user');
                return null;
            }
            throw error;
        }
    } else {
        // Fallback: download as blob
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = suggestedName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log(`File downloaded as: ${suggestedName}`);
        return null;
    }
}

/**
 * Open directory picker and handle selection
 */
async function openDirectory() {
    try {
        if (!('showDirectoryPicker' in window)) {
            throw new Error('The File System API is not supported in this browser.');
        }

        directoryHandle = await window.showDirectoryPicker();
        console.log('Directory selected:', directoryHandle.name);

        updateDirectoryStatus(directoryHandle.name);
        await readDirectory(directoryHandle);

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('User cancelled the directory selection');
        } else {
            console.error('Error selecting directory:', error);
            alert(`Error: ${error.message}`);
        }
    }
}

/**
 * Update UI to show selected directory
 * @param {string} directoryName - Name of the selected directory
 */
function updateDirectoryStatus(directoryName) {
    const selectDirectoryBtn = document.getElementById('select-directory');
    if (selectDirectoryBtn) {
        selectDirectoryBtn.textContent = `Directory: ${directoryName}`;
    }
}

/**
 * Read directory contents and build tree structure
 * @param {FileSystemDirectoryHandle} dirHandle - Directory handle
 * @param {Object} parentNode - Parent node in tree (for recursion)
 * @returns {Object} Statistics about the directory
 */
async function readDirectory(dirHandle, parentNode = null) {
    if (parentNode === null) {
        fileTree = {
            name: dirHandle.name,
            type: 'directory',
            handle: dirHandle,
            entries: {}
        };

        const fileTreeElement = document.getElementById('file-tree');
        if (fileTreeElement) {
            fileTreeElement.innerHTML = '';
        }

        parentNode = fileTree;
    }

    try {
        let stats = { folderCount: 0, fileCount: 0 };

        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file' && !entry.name.startsWith('_')) {
                parentNode.entries[entry.name] = {
                    name: entry.name,
                    type: 'file',
                    handle: entry
                };
                stats.fileCount++;
            } else if (entry.kind === 'directory' && !entry.name.startsWith('_')) {
                const dirNode = {
                    name: entry.name,
                    type: 'directory',
                    handle: entry,
                    entries: {}
                };

                parentNode.entries[entry.name] = dirNode;

                const subStats = await readDirectory(entry, dirNode);
                stats.folderCount += subStats.folderCount + 1;
                stats.fileCount += subStats.fileCount;
            }
        }

        if (parentNode === fileTree) {
            renderFileTree();
            updateStatusCounts(stats.folderCount, stats.fileCount);
        }

        return stats;
    } catch (error) {
        console.error('Error reading directory:', error);
        return { folderCount: 0, fileCount: 0 };
    }
}

/**
 * Save a file by its path
 * @param {string} filePath - Path of the file to save
 * @returns {Promise<boolean>} Whether save was successful
 */
async function saveFile(filePath) {
    if (!filePath && currentFileHandle) {
        filePath = currentFileHandle.name;
    } else if (!filePath) {
        alert('No file is currently open');
        return false;
    }

    try {
        const editorInstance = editorInstances.get(filePath);
        if (!editorInstance) {
            throw new Error('No editor instance found for this file');
        }

        if (!editorInstance.isDirty) {
            console.log(`File ${filePath} is not dirty, skipping save`);
            return true;
        }

        const fileHandle = editorInstance.fileHandle;
        if (!fileHandle) {
            throw new Error('No file handle available for this file');
        }

        // Check for external modifications
        const file = await fileHandle.getFile();
        const currentLastModified = file.lastModified;
        const storedLastModified = editorInstance.lastModified;

        if (storedLastModified && currentLastModified !== storedLastModified) {
            const confirmSave = confirm(
                'Warning: This file has been modified outside of the application since you opened it. ' +
                'Saving will overwrite those changes. Do you want to continue?'
            );

            if (!confirmSave) {
                console.log('Save aborted by user due to external file modifications');
                return false;
            }
        }

        // Get markdown content from editor
        const markdownContent = editorInstance.editor.getMarkdown();
        
        // Get front matter from textarea
        let frontMatterData = {};
        if (editorInstance.frontMatterTextarea) {
            const frontMatterText = editorInstance.frontMatterTextarea.value.trim();
            if (frontMatterText) {
                try {
                    const yamlContent = `---\n${frontMatterText}\n---\n`;
                    const parsed = parseFrontMatter(yamlContent);
                    frontMatterData = parsed.data;
                } catch (error) {
                    console.error('Error parsing front matter:', error);
                    throw new Error(`Invalid YAML front matter: ${error.message}`);
                }
            }
        }

        // Apply before save hooks
        frontMatterData = await applyBeforeSaveHooks(frontMatterData, markdownContent, fileHandle);

        // Combine front matter with markdown
        const finalContent = frontMatterData && Object.keys(frontMatterData).length > 0
            ? stringifyFrontMatter(markdownContent, frontMatterData)
            : markdownContent;

        // Write to file
        const writable = await fileHandle.createWritable();
        await writable.write(finalContent);
        await writable.close();

        // Update state
        const updatedFile = await fileHandle.getFile();
        editorInstance.lastModified = updatedFile.lastModified;
        editorInstance.isDirty = false;
        updateFileDirtyStatus(filePath, false);
        updateUnsavedCount();

        if (editorInstance.saveButton) {
            editorInstance.saveButton.disabled = true;
        }

        console.log(`File ${filePath} saved successfully!`);
        
        await applyAfterSaveHooks(frontMatterData, markdownContent, fileHandle);
        
        return true;
    } catch (error) {
        console.error(`Error saving file ${filePath}:`, error);
        alert(`Error saving file: ${error.message}`);
        return false;
    }
}

/**
 * Save all files with unsaved changes
 * @returns {Promise<{saved: number, failed: number}>}
 */
async function saveAllFiles() {
    let saved = 0;
    let failed = 0;

    const dirtyFiles = [];
    editorInstances.forEach((instance, filePath) => {
        if (instance.isDirty) {
            dirtyFiles.push(filePath);
        }
    });

    if (dirtyFiles.length === 0) {
        console.log('No files with unsaved changes');
        return { saved, failed };
    }

    for (const filePath of dirtyFiles) {
        try {
            const success = await saveFile(filePath);
            if (success) {
                saved++;
            } else {
                failed++;
            }
        } catch (error) {
            console.error(`Error saving file ${filePath}:`, error);
            failed++;
        }
    }

    if (failed === 0) {
        console.log(`All ${saved} files saved successfully`);
    } else {
        console.log(`Saved ${saved} files, ${failed} files failed to save`);
    }

    return { saved, failed };
}

/**
 * Reload file from disk
 * @param {string} filePath - Path of file to reload
 * @returns {Promise<boolean>} Whether reload was successful
 */
async function reloadFileFromDisk(filePath) {
    try {
        const editorInstance = editorInstances.get(filePath);
        if (!editorInstance) {
            throw new Error('No editor instance found for this file');
        }

        if (editorInstance.isDirty) {
            const confirmReload = confirm(
                'This file has unsaved changes. Reloading will discard all changes. ' +
                'Do you want to continue?'
            );
            
            if (!confirmReload) {
                console.log('Reload cancelled by user');
                return false;
            }
        }

        const fileHandle = editorInstance.fileHandle;
        if (!fileHandle) {
            throw new Error('No file handle available for this file');
        }

        const file = await fileHandle.getFile();
        const fileContent = await file.text();
        
        editorInstance.lastModified = file.lastModified;

        if (filePath.endsWith('.md') || filePath.endsWith('.markdown')) {
            const parsed = parseFrontMatter(fileContent);
            
            if (editorInstance.frontMatterTextarea) {
                const frontMatterYaml = stringifyFrontMatterToTextarea(parsed.data);
                editorInstance.frontMatterTextarea.value = frontMatterYaml;
            }
            
            let currentScrollTop = 0;
            try {
                currentScrollTop = editorInstance.editor.getScrollTop();
            } catch (error) {
                console.debug('Could not get scroll position:', error);
            }

            editorInstance.editor.setMarkdown(parsed.content);

            setTimeout(() => {
                try {
                    editorInstance.editor.setScrollTop(currentScrollTop);
                } catch (error) {
                    console.debug('Could not restore scroll position:', error);
                }
            }, 100);
            
            if (editorInstance.tocContainer && window.updateToc) {
                try {
                    window.updateToc(parsed.content, editorInstance.tocContainer, editorInstance.editor, tocMaxDepth);
                } catch (error) {
                    console.error('Error updating TOC during reload:', error);
                }
            }
        } else {
            editorInstance.editor.setMarkdown(fileContent);
        }

        editorInstance.isDirty = false;
        updateFileDirtyStatus(filePath, false);
        updateUnsavedCount();

        if (editorInstance.saveButton) {
            editorInstance.saveButton.disabled = true;
        }

        console.log(`File ${filePath} reloaded successfully from disk!`);
        return true;
    } catch (error) {
        console.error(`Error reloading file ${filePath}:`, error);
        alert(`Error reloading file: ${error.message}`);
        return false;
    }
}

/**
 * Before save hook - apply modifications before saving
 */
async function applyBeforeSaveHooks(frontMatter, markdownContent, fileHandle) {
    frontMatter.lastModified = new Date().toISOString();
    
    if (!frontMatter.title) {
        const firstHeading = markdownContent.match(/^#\s+(.+)$/m);
        if (firstHeading) {
            frontMatter.title = firstHeading[1];
        }
    }
    
    const customTags = (markdownContent.match(/<(deliverable|meeting|report|trkno)>/g) || []).length;
    if (customTags > 0) {
        frontMatter.customTagCount = customTags;
    }
    
    return frontMatter;
}

/**
 * After save hook - perform actions after saving
 */
async function applyAfterSaveHooks(frontMatter, markdownContent, fileHandle) {
    const tags = ['deliverable', 'meeting', 'report', 'trkno'];
    const preservedTags = tags.filter(tag => markdownContent.includes(`<${tag}>`));
    if (preservedTags.length > 0) {
        console.log(`Preserved custom tags: ${preservedTags.join(', ')}`);
    }
}

/**
 * Start monitoring files for external changes
 */
function startFileChangeMonitoring() {
    setInterval(async () => {
        for (const [filePath, editorInstance] of editorInstances) {
            try {
                const fileHandle = editorInstance.fileHandle;
                if (!fileHandle) continue;

                const file = await fileHandle.getFile();
                const currentLastModified = file.lastModified;
                const storedLastModified = editorInstance.lastModified;

                if (storedLastModified && currentLastModified !== storedLastModified) {
                    console.log(`File ${filePath} changed externally`);
                    
                    const action = confirm(
                        `File "${filePath}" has been modified by another application.\n\n` +
                        'Click OK to reload from disk (discards unsaved changes)\n' +
                        'Click Cancel to keep current version'
                    );

                    if (action) {
                        await reloadFileFromDisk(filePath);
                    } else {
                        editorInstance.lastModified = currentLastModified;
                    }
                }
            } catch (error) {
                console.debug(`Error checking file ${filePath}:`, error.message);
            }
        }
    }, 3000);
}
