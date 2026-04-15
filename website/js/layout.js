// Simple tab switching for ZDDC site
// Include via <script src="/js/layout.js"></script> at end of <body>

(function () {
  'use strict';

  // Theme system
  const themeKey = 'zddc-theme';
  const themes = ['system', 'light', 'dark'];
  let currentThemeIndex = 0;

  // SVG icons for theme toggle
  const icons = {
    system: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><polyline points="8 21 12 17 16 21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    light: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    dark: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
  };

  function getStoredTheme() {
    const stored = localStorage.getItem(themeKey);
    if (stored && themes.includes(stored)) {
      return stored;
    }
    return 'system';
  }

  function setThemeIndex(index) {
    currentThemeIndex = index;
    const theme = themes[index];
    applyTheme(theme);
  }

  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem(themeKey, theme);
    updateToggleIcon();
  }

  function updateToggleIcon() {
    const btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    const theme = themes[currentThemeIndex];
    btn.innerHTML = icons[theme];
    btn.setAttribute('aria-label', 'Toggle theme (current: ' + theme + ')');
  }

  function cycleTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    setThemeIndex(currentThemeIndex);
  }

  function createToggle() {
    const toggle = document.createElement('button');
    toggle.className = 'theme-toggle';
    toggle.setAttribute('aria-label', 'Toggle theme');
    toggle.onclick = cycleTheme;
    return toggle;
  }

  // Apply stored theme early (before DOM queries)
  const storedTheme = getStoredTheme();
  currentThemeIndex = themes.indexOf(storedTheme);
  if (currentThemeIndex === -1) currentThemeIndex = 0;
  applyTheme(storedTheme);

  // Create and inject toggle button after DOM ready
  document.addEventListener('DOMContentLoaded', function () {
    const toggle = createToggle();
    const headerNav = document.querySelector('.header-nav');
    
    if (headerNav) {
      // Priority 1: .header-nav — insert as first child
      headerNav.insertBefore(toggle, headerNav.firstChild);
    } else {
      const navTabs = document.querySelector('.nav-tabs');
      if (navTabs) {
        // Priority 2: .nav-tabs — insert as sibling AFTER .nav-tabs
        navTabs.parentNode.insertBefore(toggle, navTabs.nextSibling);
      } else {
        const headerContent = document.querySelector('.header-content');
        if (headerContent) {
          // Priority 3: .header-content — append as last child
          headerContent.appendChild(toggle);
        }
      }
    }
    updateToggleIcon();
  });

  // Tab switching (unchanged)
  document.querySelectorAll('button[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('button[data-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const tab = btn.dataset.tab;
      if (tab === 'reference') {
        if (window.location.pathname.endsWith('index.html')) {
          window.location.hash = '';
        }
      }
    });
  });
})();
