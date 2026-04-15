/**
 * Pane resizing functionality
 */

/**
 * Make an element resizable by dragging its resizer
 * @param {HTMLElement} resizer - The resizer element
 * @param {HTMLElement} pane - The pane to resize
 */
function makeResizable(resizer, pane) {
    const initialWidth = pane.offsetWidth;

    let x = 0;
    let paneWidth = initialWidth;

    const mouseDownHandler = function (e) {
        x = e.clientX;
        paneWidth = pane.offsetWidth;

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);

        resizer.classList.add('active');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    const mouseMoveHandler = function (e) {
        const dx = e.clientX - x;
        const newWidth = Math.max(150, paneWidth + dx);

        pane.style.width = `${newWidth}px`;
    };

    const mouseUpHandler = function () {
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);

        resizer.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    };

    resizer.addEventListener('mousedown', mouseDownHandler);
}

/**
 * Initialize the file navigation pane resizer
 */
function initializeFileNavResizer() {
    const fileNavResizer = document.querySelector('.pane-resizer[data-resizer-for="file-nav"]');

    if (fileNavResizer && !fileNavResizer.hasAttribute('data-resizer-initialized')) {
        fileNavResizer.setAttribute('data-resizer-initialized', 'true');

        let x = 0;
        let navWidth = 0;

        const mouseDownHandler = function (e) {
            x = e.clientX;

            const navPane = document.getElementById('file-nav');
            navWidth = navPane.getBoundingClientRect().width;

            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);

            fileNavResizer.classList.add('bg-blue-500');
        };

        const mouseMoveHandler = function (e) {
            const dx = e.clientX - x;

            const navPane = document.getElementById('file-nav');

            const newWidth = navWidth + dx;

            if (newWidth >= 200) {
                navPane.style.width = `${newWidth}px`;
            }
        };

        const mouseUpHandler = function () {
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);

            fileNavResizer.classList.remove('bg-blue-500');
        };

        fileNavResizer.addEventListener('mousedown', mouseDownHandler);
    }
}

