/**
 * ZDDC shared theme toggle — light / dark / auto.
 * Persists choice to localStorage under 'zddc-theme'.
 * Works with all four tools regardless of their module pattern.
 * Expects: #theme-btn in the DOM (optional — skips gracefully if absent).
 *
 * Theme cycle: auto → light → dark → auto …
 * 'auto' honours the OS prefers-color-scheme media query (CSS handles it).
 * 'light' sets data-theme="light" on <html> (overrides dark media query).
 * 'dark'  sets data-theme="dark"  on <html>.
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'zddc-theme';
    var THEMES = ['auto', 'light', 'dark'];

    var LABELS = {
        auto:  '◐',
        light: '☀',
        dark:  '☾'
    };

    var TITLES = {
        auto:  'Theme: auto (follows OS)',
        light: 'Theme: light',
        dark:  'Theme: dark'
    };

    function load() {
        var stored = localStorage.getItem(STORAGE_KEY);
        return THEMES.indexOf(stored) !== -1 ? stored : 'auto';
    }

    function apply(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    function save(theme) {
        try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
    }

    function updateButton(btn, theme) {
        btn.textContent = LABELS[theme];
        btn.title = TITLES[theme];
        btn.setAttribute('aria-label', TITLES[theme]);
    }

    function next(theme) {
        return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    }

    function init() {
        var current = load();
        apply(current);

        var btn = document.getElementById('theme-btn');
        if (!btn) { return; }

        updateButton(btn, current);

        btn.addEventListener('click', function () {
            current = next(current);
            apply(current);
            save(current);
            updateButton(btn, current);
        });
    }

    /* Apply theme immediately (before DOM ready) to avoid flash */
    apply(load());

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
