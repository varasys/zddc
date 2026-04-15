/**
 * File tree rendering and navigation
 */

// Cache for lazily loaded CDN libraries
const loadedLibraries = new Map();

/**
 * Lazily load a script from CDN. Returns a promise that resolves when loaded.
 * Caches the promise so subsequent calls return immediately.
 */
function loadLibrary(url) {
    if (loadedLibraries.has(url)) return loadedLibraries.get(url);
    const promise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load library: ${url}`));
        document.head.appendChild(script);
    });
    loadedLibraries.set(url, promise);
    return promise;
}

/**
 * Render the file tree in the UI
 */
function renderFileTree() {
    const fileTreeElement = document.getElementById('file-tree');
    if (!fileTreeElement) return;

    fileTreeElement.innerHTML = '';
    
    // Always show scratchpad at top
    const scratchpadElement = document.createElement('div');
    scratchpadElement.className = 'file-item px-4 py-2 cursor-pointer rounded whitespace-nowrap overflow-hidden hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 mb-2';
    scratchpadElement.dataset.type = 'file';
    scratchpadElement.dataset.path = SCRATCHPAD_ID;
    scratchpadElement.dataset.name = 'Scratchpad';
    scratchpadElement.innerHTML = '<div class="ml-4"><div class="filename-main">📝 Scratchpad</div><div class="filename-secondary">Quick editing (no file)</div></div>';
    
    scratchpadElement.addEventListener('click', (event) => {
        event.stopPropagation();
        openScratchpad();
        
        // Update active state
        document.querySelectorAll('.file-item').forEach(el => el.classList.remove('active-file'));
        scratchpadElement.classList.add('active-file');
    });
    
    fileTreeElement.appendChild(scratchpadElement);

    function createFileTreeHTML(directory, parentElement, path = '') {
        if (!directory || !directory.entries) return;

        // Sort entries: files first, then directories, alphabetically
        const sortedEntries = Object.entries(directory.entries).sort((a, b) => {
            const [nameA, itemA] = a;
            const [nameB, itemB] = b;

            if (itemA.type !== itemB.type) {
                return itemA.type === 'file' ? -1 : 1;
            }

            return nameA.localeCompare(nameB);
        });

        for (const [name, item] of sortedEntries) {
            if (item.type === 'directory') {
                const dirElement = document.createElement('div');
                dirElement.className = 'directory-item px-4 py-2 cursor-pointer rounded whitespace-nowrap overflow-hidden text-ellipsis hover:bg-gray-100 dark:hover:bg-gray-800';
                dirElement.dataset.type = 'directory';
                const currentPath = path ? `${path}/${name}` : name;
                dirElement.dataset.path = currentPath;

                const dirIcon = document.createElement('span');
                dirIcon.className = 'dir-icon mr-1';
                dirIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';

                const dirName = document.createElement('span');
                dirName.textContent = `📁 ${name}`;

                dirElement.appendChild(dirIcon);
                dirElement.appendChild(dirName);
                parentElement.appendChild(dirElement);

                const contentsElement = document.createElement('div');
                contentsElement.className = 'directory-contents ml-4';
                parentElement.appendChild(contentsElement);

                dirElement.addEventListener('click', (event) => {
                    event.stopPropagation();
                    dirElement.classList.toggle('collapsed');

                    const contents = dirElement.nextElementSibling;
                    if (contents && contents.classList.contains('directory-contents')) {
                        contents.style.display = dirElement.classList.contains('collapsed') ? 'none' : 'block';
                    }
                });

                createFileTreeHTML(item, contentsElement, currentPath);
            } else if (item.type === 'file') {
                const fileElement = document.createElement('div');
                fileElement.className = 'file-item px-4 py-2 cursor-pointer rounded whitespace-nowrap overflow-hidden hover:bg-gray-100 dark:hover:bg-gray-800';
                fileElement.dataset.type = 'file';
                const filePath = path ? `${path}/${name}` : name;
                fileElement.dataset.path = filePath;
                fileElement.dataset.name = name;

                const fileIcon = getFileTypeIcon(name);
                
                let fileNameDisplay;
                if (name.includes(' - ')) {
                    const parts = name.split(' - ');
                    fileNameDisplay = `
                    <div class="ml-4">
                        <div class="filename-main">${fileIcon} ${parts[1]}</div>
                        <div class="filename-secondary">${parts[0]}</div>
                    </div>
                `;
                } else {
                    fileNameDisplay = `<span class="ml-4">${fileIcon} ${name}</span>`;
                }

                fileElement.innerHTML = fileNameDisplay;

                fileElement.addEventListener('click', (event) => {
                    event.stopPropagation();
                    handleFileClick(item.handle, filePath, fileElement);
                });

                parentElement.appendChild(fileElement);
            }
        }
    }

    createFileTreeHTML(fileTree, fileTreeElement);
}

/**
 * Handle click on a file in the file tree
 * @param {FileSystemFileHandle} fileHandle - The file handle
 * @param {string} filePath - Path of the file
 * @param {HTMLElement} fileElement - The clicked element
 */
async function handleFileClick(fileHandle, filePath, fileElement) {
    try {
        currentFileHandle = fileHandle;

        // Remove active class from all file items
        const allFileItems = document.querySelectorAll('.file-item');
        allFileItems.forEach(item => {
            item.classList.remove('active-file');
            item.style.backgroundColor = '';
            item.style.color = '';
        });

        // Add active class to clicked file
        fileElement.classList.add('active-file');
        fileElement.style.backgroundColor = '#3b82f6';
        fileElement.style.color = 'white';

        await displayFileContent(fileHandle, filePath);

    } catch (error) {
        console.error('Error handling file click:', error);
        alert(`Error opening file: ${error.message}`);
    }
}

/**
 * Display file content in main area
 * @param {FileSystemFileHandle} fileHandle - File handle
 * @param {string} filePath - Path of the file
 */
async function displayFileContent(fileHandle, filePath) {
    try {
        currentFileHandle = fileHandle;

        const file = await fileHandle.getFile();
        const fileName = file.name;
        const lastModified = file.lastModified;

        document.getElementById('welcome-screen').classList.add('hidden');
        document.getElementById('content-container').classList.remove('hidden');

        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
        const isImage = imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));

        const isHtml = fileName.toLowerCase().endsWith('.html') || fileName.toLowerCase().endsWith('.htm');
        const isDocx = fileName.toLowerCase().endsWith('.docx');
        const isXlsx = fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls');

        if (isImage) {
            displayImagePreview(file, filePath, fileName, fileHandle, lastModified);
        } else if (isHtml) {
            displayHtmlPreview(file, filePath, fileName, fileHandle, lastModified);
        } else if (isDocx) {
            displayDocxPreview(file, filePath, fileName, fileHandle, lastModified);
        } else if (isXlsx) {
            displayXlsxPreview(file, filePath, fileName, fileHandle, lastModified);
        } else {
            const content = await file.text();

            if (fileName.toLowerCase().endsWith('.md')) {
                initializeEditor(content, true, filePath, fileName, fileHandle, lastModified);
            } else {
                initializeEditor(content, false, filePath, fileName, fileHandle, lastModified);
            }
        }
    } catch (error) {
        console.error('Error displaying file content:', error);
        alert(`Error opening file: ${error.message}`);
    }
}

/**
 * Display image preview
 */
async function displayImagePreview(file, filePath, fileName, fileHandle, lastModified) {
    const contentContainer = document.getElementById('content-container');
    if (!contentContainer) {
        alert('Error: content-container element not found!');
        return;
    }

    document.querySelectorAll('.file-view-container').forEach(container => {
        container.style.display = 'none';
    });

    if (editorInstances.has(filePath)) {
        const existingInstance = editorInstances.get(filePath);
        if (existingInstance.fileViewContainer) {
            existingInstance.fileViewContainer.style.display = 'flex';
        }
        return;
    }

    const fileViewContainer = document.createElement('div');
    fileViewContainer.className = 'file-view-container flex flex-col h-full';

    const fileHeader = document.createElement('div');
    fileHeader.className = 'file-header flex justify-between items-center px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium border-b border-gray-200 dark:border-gray-700';

    const fileTitle = document.createElement('span');
    fileTitle.textContent = fileName || 'No file selected';
    fileHeader.appendChild(fileTitle);

    fileViewContainer.appendChild(fileHeader);

    const imageContainer = document.createElement('div');
    imageContainer.className = 'image-preview-container flex-1 overflow-auto p-4';

    const imageElement = document.createElement('img');
    imageElement.className = 'image-preview';
    imageElement.alt = fileName;

    const objectUrl = URL.createObjectURL(file);
    imageElement.src = objectUrl;

    imageContainer.appendChild(imageElement);
    fileViewContainer.appendChild(imageContainer);

    contentContainer.appendChild(fileViewContainer);

    const instanceData = {
        fileViewContainer: fileViewContainer,
        fileHandle: fileHandle,
        lastModified: lastModified,
        isDirty: false,
        objectUrl: objectUrl
    };

    editorInstances.set(filePath, instanceData);
}

/**
 * Display HTML preview in sandboxed iframe
 */
async function displayHtmlPreview(file, filePath, fileName, fileHandle, lastModified) {
    const contentContainer = document.getElementById('content-container');
    if (!contentContainer) {
        alert('Error: content-container element not found!');
        return;
    }

    document.querySelectorAll('.file-view-container').forEach(container => {
        container.style.display = 'none';
    });

    if (editorInstances.has(filePath)) {
        const existingInstance = editorInstances.get(filePath);
        if (existingInstance.fileViewContainer) {
            existingInstance.fileViewContainer.style.display = 'flex';
        }
        return;
    }

    const htmlContent = await file.text();

    const fileViewContainer = document.createElement('div');
    fileViewContainer.className = 'file-view-container flex flex-col h-full';

    const fileHeader = document.createElement('div');
    fileHeader.className = 'file-header flex justify-between items-center px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium border-b border-gray-200 dark:border-gray-700';

    const fileTitle = document.createElement('span');
    fileTitle.textContent = fileName || 'No file selected';
    fileHeader.appendChild(fileTitle);

    fileViewContainer.appendChild(fileHeader);

    const htmlContainer = document.createElement('div');
    htmlContainer.className = 'html-preview-container flex-1 overflow-hidden';

    const iframe = document.createElement('iframe');
    iframe.className = 'html-preview-iframe w-full h-full border-0';

    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups allow-modals');
    iframe.setAttribute('loading', 'lazy');

    iframe.srcdoc = htmlContent;

    htmlContainer.appendChild(iframe);
    fileViewContainer.appendChild(htmlContainer);

    contentContainer.appendChild(fileViewContainer);

    const instanceData = {
        fileViewContainer: fileViewContainer,
        fileHandle: fileHandle,
        lastModified: lastModified,
        isDirty: false,
        iframe: iframe
    };

    editorInstances.set(filePath, instanceData);

    iframe.addEventListener('load', () => {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (iframeDoc) {
                iframeDoc.addEventListener('click', function (e) {
                    const link = e.target.closest('a');
                    if (link && link.getAttribute('href')) {
                        const href = link.getAttribute('href');
                        if (href.startsWith('#')) {
                            e.preventDefault();
                            const targetId = href.substring(1);
                            const targetElement = iframeDoc.getElementById(targetId);
                            if (targetElement) {
                                targetElement.scrollIntoView({ behavior: 'smooth' });
                            }
                        }
                    }
                });
            }
        } catch (error) {
            console.log('Cannot access iframe content for navigation handling:', error);
        }
    });
}

/**
 * Display DOCX preview in main content area
 */
async function displayDocxPreview(file, filePath, fileName, fileHandle, lastModified) {
    const contentContainer = document.getElementById('content-container');
    if (!contentContainer) {
        alert('Error: content-container element not found!');
        return;
    }

    document.querySelectorAll('.file-view-container').forEach(container => {
        container.style.display = 'none';
    });

    if (editorInstances.has(filePath)) {
        const existingInstance = editorInstances.get(filePath);
        if (existingInstance.fileViewContainer) {
            existingInstance.fileViewContainer.style.display = 'flex';
        }
        return;
    }

    const fileViewContainer = document.createElement('div');
    fileViewContainer.className = 'file-view-container flex flex-col h-full';

    const fileHeader = document.createElement('div');
    fileHeader.className = 'file-header flex justify-between items-center px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium border-b border-gray-200 dark:border-gray-700';

    const fileTitle = document.createElement('span');
    fileTitle.textContent = fileName || 'No file selected';
    fileHeader.appendChild(fileTitle);

    fileViewContainer.appendChild(fileHeader);

    const docxContainer = document.createElement('div');
    docxContainer.className = 'flex-1 overflow-auto p-4';
    docxContainer.innerHTML = '<div style="text-align:center;padding:2rem;color:#666;">Loading preview...</div>';
    fileViewContainer.appendChild(docxContainer);

    contentContainer.appendChild(fileViewContainer);

    const instanceData = {
        fileViewContainer: fileViewContainer,
        fileHandle: fileHandle,
        lastModified: lastModified,
        isDirty: false
    };
    editorInstances.set(filePath, instanceData);

    try {
        await loadLibrary('https://cdn.jsdelivr.net/npm/jszip@3/dist/jszip.min.js');
        await loadLibrary('https://cdn.jsdelivr.net/npm/docx-preview@latest/dist/docx-preview.min.js');

        const arrayBuffer = await file.arrayBuffer();
        docxContainer.innerHTML = '';
        await window.docx.renderAsync(arrayBuffer, docxContainer);
    } catch (err) {
        console.error('Error rendering DOCX:', err);
        docxContainer.innerHTML = `<div style="text-align:center;padding:2rem;color:#c00;">Error rendering DOCX: ${err.message}</div>`;
    }
}

/**
 * Display XLSX/XLS preview in main content area
 */
async function displayXlsxPreview(file, filePath, fileName, fileHandle, lastModified) {
    const contentContainer = document.getElementById('content-container');
    if (!contentContainer) {
        alert('Error: content-container element not found!');
        return;
    }

    document.querySelectorAll('.file-view-container').forEach(container => {
        container.style.display = 'none';
    });

    if (editorInstances.has(filePath)) {
        const existingInstance = editorInstances.get(filePath);
        if (existingInstance.fileViewContainer) {
            existingInstance.fileViewContainer.style.display = 'flex';
        }
        return;
    }

    const fileViewContainer = document.createElement('div');
    fileViewContainer.className = 'file-view-container flex flex-col h-full';

    const fileHeader = document.createElement('div');
    fileHeader.className = 'file-header flex justify-between items-center px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium border-b border-gray-200 dark:border-gray-700';

    const fileTitle = document.createElement('span');
    fileTitle.textContent = fileName || 'No file selected';
    fileHeader.appendChild(fileTitle);

    fileViewContainer.appendChild(fileHeader);

    const xlsxContainer = document.createElement('div');
    xlsxContainer.className = 'flex-1 overflow-auto';
    xlsxContainer.innerHTML = '<div style="text-align:center;padding:2rem;color:#666;">Loading preview...</div>';
    fileViewContainer.appendChild(xlsxContainer);

    contentContainer.appendChild(fileViewContainer);

    const instanceData = {
        fileViewContainer: fileViewContainer,
        fileHandle: fileHandle,
        lastModified: lastModified,
        isDirty: false
    };
    editorInstances.set(filePath, instanceData);

    try {
        await loadLibrary('https://cdn.jsdelivr.net/npm/xlsx@latest/dist/xlsx.full.min.js');

        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        xlsxContainer.innerHTML = '';

        if (workbook.SheetNames.length > 1) {
            const tabs = document.createElement('div');
            tabs.style.cssText = 'display:flex;gap:0;border-bottom:1px solid #ddd;background:#f5f5f5;';
            const tableArea = document.createElement('div');
            tableArea.className = 'flex-1 overflow-auto';

            workbook.SheetNames.forEach((name, i) => {
                const tab = document.createElement('button');
                tab.textContent = name;
                tab.style.cssText = 'padding:0.4rem 1rem;cursor:pointer;border:1px solid transparent;border-bottom:none;font-size:0.85rem;background:transparent;';
                if (i === 0) tab.style.cssText += 'background:white;border-color:#ddd;border-bottom-color:white;margin-bottom:-1px;font-weight:500;';
                tab.onclick = () => {
                    tabs.querySelectorAll('button').forEach(t => { t.style.background = 'transparent'; t.style.borderColor = 'transparent'; t.style.fontWeight = 'normal'; });
                    tab.style.cssText = 'padding:0.4rem 1rem;cursor:pointer;border:1px solid #ddd;border-bottom-color:white;font-size:0.85rem;background:white;margin-bottom:-1px;font-weight:500;';
                    renderXlsxSheet(workbook, name, tableArea);
                };
                tabs.appendChild(tab);
            });

            xlsxContainer.appendChild(tabs);
            xlsxContainer.appendChild(tableArea);
            renderXlsxSheet(workbook, workbook.SheetNames[0], tableArea);
        } else {
            renderXlsxSheet(workbook, workbook.SheetNames[0], xlsxContainer);
        }
    } catch (err) {
        console.error('Error rendering XLSX:', err);
        xlsxContainer.innerHTML = `<div style="text-align:center;padding:2rem;color:#c00;">Error rendering spreadsheet: ${err.message}</div>`;
    }
}

/**
 * Render a single XLSX sheet as an HTML table
 */
function renderXlsxSheet(workbook, sheetName, container) {
    const sheet = workbook.Sheets[sheetName];
    const html = XLSX.utils.sheet_to_html(sheet, { editable: false });
    container.innerHTML = html;
    const table = container.querySelector('table');
    if (table) {
        table.style.cssText = 'border-collapse:collapse;width:100%;font-size:0.85rem;';
        table.querySelectorAll('th,td').forEach(cell => {
            cell.style.cssText = 'border:1px solid #ddd;padding:0.35rem 0.5rem;text-align:left;white-space:nowrap;';
        });
        table.querySelectorAll('th').forEach(th => {
            th.style.background = '#f0f0f0';
            th.style.fontWeight = '600';
        });
    }
}

/**
 * Update status bar counts
 */
function updateStatusCounts(folderCount, fileCount) {
    const folderCountElement = document.getElementById('folder-count');
    const fileCountElement = document.getElementById('file-count');

    if (folderCountElement) {
        folderCountElement.textContent = `${folderCount} folder${folderCount !== 1 ? 's' : ''}`;
    }

    if (fileCountElement) {
        fileCountElement.textContent = `${fileCount} file${fileCount !== 1 ? 's' : ''}`;
    }

    updateUnsavedCount();
}

/**
 * Update unsaved count in status bar
 */
function updateUnsavedCount() {
    const unsavedCountElement = document.getElementById('unsaved-count');
    if (!unsavedCountElement) return;

    let dirtyCount = 0;
    editorInstances.forEach(instance => {
        if (instance.isDirty) {
            dirtyCount++;
        }
    });

    unsavedCountElement.textContent = `${dirtyCount} unsaved`;

    if (dirtyCount > 0) {
        unsavedCountElement.classList.add('text-amber-500', 'font-medium');
    } else {
        unsavedCountElement.classList.remove('text-amber-500', 'font-medium');
    }
}

/**
 * Update file dirty status indicator in tree
 */
function updateFileDirtyStatus(filePath, isDirty) {
    const fileElement = document.querySelector(`.file-item[data-path="${filePath}"]`);
    if (!fileElement) return;

    if (isDirty) {
        if (!fileElement.querySelector('.dirty-indicator')) {
            const indicator = document.createElement('span');
            indicator.className = 'dirty-indicator ml-1 text-amber-500 font-bold';
            indicator.textContent = '●';
            fileElement.appendChild(indicator);
        }
        fileElement.classList.add('is-dirty');
    } else {
        const indicator = fileElement.querySelector('.dirty-indicator');
        if (indicator) {
            fileElement.removeChild(indicator);
        }
        fileElement.classList.remove('is-dirty');
    }
}
