/**
 * Event listeners setup
 */

/**
 * Set up all event listeners for the application
 */
function setupEventListeners() {
    // Select directory button
    const selectDirectoryBtn = document.getElementById('select-directory');
    if (selectDirectoryBtn) {
        selectDirectoryBtn.addEventListener('click', openDirectory);
    }

    // Save All button
    const saveAllBtn = document.getElementById('save-all');
    if (saveAllBtn) {
        saveAllBtn.addEventListener('click', saveAllFiles);
    }

    // Warn when leaving with unsaved changes
    window.addEventListener('beforeunload', function (e) {
        let hasUnsavedChanges = false;

        editorInstances.forEach((instanceData) => {
            if (instanceData.isDirty) {
                hasUnsavedChanges = true;
            }
        });

        if (hasUnsavedChanges) {
            e.preventDefault();
            return 'You have unsaved changes. If you leave now, your changes will be lost.';
        }
    });
}

/**
 * Set up TOC depth selector
 */
function setupTocDepthSelector() {
    const depthSelector = document.getElementById('toc-depth-selector');
    if (!depthSelector) return;

    depthSelector.value = tocMaxDepth.toString();

    depthSelector.addEventListener('change', function () {
        tocMaxDepth = parseInt(this.value, 10);

        if (currentFileHandle && currentFileHandle.name.match(/\.(md|markdown)$/i)) {
            const filePath = currentFileHandle.name;
            const instance = editorInstances.get(filePath);

            if (instance && instance.editor && instance.tocContainer) {
                const content = instance.editor.getMarkdown();

                try {
                    window.updateToc(content, instance.tocContainer, instance.editor, tocMaxDepth);
                } catch (error) {
                    console.error('Error updating TOC depth:', error);
                }
            }
        }
    });
}
