(function (app) {
    'use strict';

    const dom = app.dom;
    
    // Convert existing state to reactive state
    if (app.createReactiveState) {
        const oldState = app.state;
        app.state = app.createReactiveState({
            mode: oldState.mode || 'edit',
            published: oldState.published || false,
            dirty: oldState.dirty || false
        });
        
        // Subscribe to state changes to automatically update UI
        app.state.subscribe(function(property, newValue, oldValue) {
            // Auto-apply state changes
            if (property === 'mode' || property === 'published') {
                state.updateHiddenFields();
                state.apply();
                // Sync preview checkbox to current mode
                if (app.modules.files && app.modules.files.syncPreviewCheckbox) {
                    app.modules.files.syncPreviewCheckbox();
                }
            }
            
            if (property === 'dirty') {
                // Could update UI indicator here
            }
        });
    }
    
    const state = app.state;

    state.updateHiddenFields = function updateHiddenFields() {
        const modeInput = dom.qs('#mode');
        const publishedInput = dom.qs('#published');
        if (modeInput) {
            modeInput.value = state.mode;
        }
        if (publishedInput) {
            publishedInput.value = state.published ? 'true' : 'false';
        }
    };

    function toggleEditOnlyElements() {
        const isEdit = state.mode === 'edit';
        dom.qsa('[data-edit-only]').forEach(function (element) {
            const value = element.getAttribute('data-edit-only');
            if (value === 'true') {
                dom.show(element, isEdit);
            } else if (value === 'false') {
                dom.show(element, !isEdit);
            }
        });
    }

    function updateDirectoryDependentControls() {
        const isEdit = state.mode === 'edit';
        const hasDirectory = !!app.data.selectedDirHandle;
        dom.qsa('[data-requires-directory="true"]').forEach(function (element) {
            const shouldDisable = !(isEdit && hasDirectory);
            if ('disabled' in element) {
                element.disabled = shouldDisable;
            } else {
                if (shouldDisable) {
                    element.setAttribute('aria-disabled', 'true');
                } else {
                    element.removeAttribute('aria-disabled');
                }
            }
        });
    }

    function updateResponseDueVisibility() {
        var typeDisplay = dom.qs('#type-display');
        var typeHidden = dom.qs('#type');
        var wrapper = dom.qs('#response-due-wrapper');
        if (!wrapper) { return; }
        var typeVal = '';
        if (typeDisplay) {
            typeVal = (typeDisplay.textContent || '').trim();
        } else if (typeHidden) {
            typeVal = (typeHidden.value || '').trim();
        }
        var isSubmittal = typeVal.toLowerCase() === 'submittal';
        if (isSubmittal) {
            wrapper.classList.remove('hidden');
        } else {
            wrapper.classList.add('hidden');
        }
    }

    state.apply = function applyState() {
        updateResponseDueVisibility();
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(function (element) {
            const noDisable = element.hasAttribute('data-no-disable') || (!!element.closest('thead') && !!element.closest('.filter-row'));
            element.disabled = (state.mode !== 'edit') && !noDisable;
        });

        ['#owner-name', '#project-name', '#project-number', '#type-display'].forEach(function (selector) {
            const element = dom.qs(selector);
            if (element) {
                element.contentEditable = (state.mode === 'edit') ? 'true' : 'false';
            }
        });

        const remarksTextarea = dom.qs('#remarks');
        const remarksContainer = dom.qs('#remarks-render-container');
        var mdEditor = app.modules.markdownEditor;
        const isEdit = (state.mode === 'edit') && !state.published;

        if (remarksTextarea) { remarksTextarea.hidden = true; }

        if (mdEditor) {
            if (isEdit) {
                // Show rendered preview with click-to-edit; editor loads on first click
                mdEditor.bindRenderClick();
                mdEditor.setRenderClickable(true);
                mdEditor.showRendered();
            } else {
                // View mode: destroy editor, show static rendered HTML
                mdEditor.destroy();
                mdEditor.setRenderClickable(false);
                mdEditor.refreshRender();
                if (remarksContainer) { remarksContainer.hidden = false; }
            }
        } else if (remarksContainer) {
            remarksContainer.hidden = false;
        }

        const titleInput = dom.qs('#title');
        if (titleInput) {
            const empty = !(titleInput.value || '').trim();
            titleInput.hidden = (state.mode === 'view' && empty);
        }

        // From field: input in edit mode, rendered mailto link in view mode
        const fromInput = dom.qs('#from');
        const fromRender = dom.qs('#from-render');
        if (fromInput && fromRender) {
            if (isEdit) {
                fromInput.hidden = false;
                fromRender.classList.add('hidden');
                fromRender.hidden = true;
            } else {
                fromInput.hidden = true;
                fromRender.classList.remove('hidden');
                fromRender.hidden = false;
                if (app.modules.emailTags && app.modules.emailTags.renderFrom) {
                    app.modules.emailTags.renderFrom();
                }
            }
        }

        // To field: input in edit mode, rendered mailto links in view mode
        const toInput = dom.qs('#to');
        const toRender = dom.qs('#to-render');
        if (toInput && toRender) {
            if (isEdit) {
                toInput.hidden = false;
                toRender.classList.add('hidden');
                toRender.hidden = true;
            } else {
                toInput.hidden = true;
                toRender.classList.remove('hidden');
                toRender.hidden = false;
                if (app.modules.emailTags && app.modules.emailTags.render) {
                    app.modules.emailTags.render();
                }
            }
        }

        // Logo placeholders: show in edit mode when no logo loaded
        document.querySelectorAll('.logo-cell').forEach(function (cell) {
            var img = cell.querySelector('.logo-img');
            var placeholder = cell.querySelector('.logo-placeholder');
            if (!placeholder) { return; }
            var hasLogo = img && img.getAttribute('src');
            if (hasLogo) {
                cell.classList.add('has-logo');
            } else {
                cell.classList.remove('has-logo');
            }
            if (state.mode === 'edit' && !hasLogo) {
                placeholder.classList.remove('hidden');
            } else {
                placeholder.classList.add('hidden');
            }
        });

        toggleEditOnlyElements();
        updateDirectoryDependentControls();

        if (app.modules.advanced && app.modules.advanced.updateWorkflowHint) {
            app.modules.advanced.updateWorkflowHint();
        }
    };

    state.detectState = function detectState() {
        var data = app.json.parse();
        var envelope = (data && data.envelope) || {};
        var payload = (data && data.payload) || {};
        var presentation = (data && data.presentation) || {};

        if (envelope.digest) { return 'published'; }

        var hasDate = !!(payload.date && payload.date.trim());
        if (hasDate) { return 'draft'; }

        var hasHeader = !!(payload.client || payload.project || payload.projectNumber ||
            presentation.leftLogo || presentation.rightLogo);
        if (hasHeader) { return 'template'; }

        return 'clean';
    };

    app.registerInit(function () {
        state.updateHiddenFields();
        toggleEditOnlyElements();
        updateDirectoryDependentControls();
        var typeInput = dom.qs('#type');
        if (typeInput) {
            typeInput.addEventListener('input', updateResponseDueVisibility);
        }
        updateResponseDueVisibility();
    });
})(window.transmittalApp);
