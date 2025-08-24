/**
 * @typedef {import('../src/types/index.js').ThemeToggleElement} ThemeToggleElement
 */

/**
 * Theme Toggle Web Component
 * Provides a toggle switch for light/dark theme with system preference detection
 * @extends {HTMLElement}
 * @implements {ThemeToggleElement}
 */
export default class ThemeToggle extends HTMLElement {
  /**
   * Creates a new ThemeToggle component
   */
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    /** @type {HTMLButtonElement} */
    this.toggleButton = null;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          font-family: var(--font-family-base, sans-serif);
          display: inline-block;
        }
        
        .theme-toggle {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-full);
          padding: var(--spacing-xs);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          box-shadow: var(--shadow-light);
          transition: var(--transition-base);
          position: relative;
          overflow: hidden;
        }
        
        .theme-toggle:hover {
          background-color: var(--bg-tertiary);
          box-shadow: var(--shadow-medium);
        }
        
        .theme-icon {
          font-size: 18px;
          color: var(--text-primary);
          transition: var(--transition-base);
          position: absolute;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
        }
        
        .sun-icon {
          opacity: 1;
          transform: rotate(0deg) scale(1);
        }
        
        .moon-icon {
          opacity: 0;
          transform: rotate(180deg) scale(0.8);
        }
        
        :host(.dark) .sun-icon {
          opacity: 0;
          transform: rotate(-180deg) scale(0.8);
        }
        
        :host(.dark) .moon-icon {
          opacity: 1;
          transform: rotate(0deg) scale(1);
        }
        
        /* Tooltip */
        .theme-toggle:hover::before {
          content: attr(data-tooltip);
          position: absolute;
          bottom: -35px;
          left: 50%;
          transform: translateX(-50%);
          background-color: var(--bg-panel);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-sm);
          padding: var(--spacing-xs) var(--spacing-sm);
          font-size: var(--font-size-base);
          white-space: nowrap;
          box-shadow: var(--shadow-medium);
          z-index: 1000;
          opacity: 1;
          pointer-events: none;
        }
        
        .theme-toggle::before {
          opacity: 0;
          transition: opacity 0.2s ease;
        }
      </style>
      
      <button class="theme-toggle" data-tooltip="Switch theme">
        <span class="theme-icon sun-icon">☀️</span>
        <span class="theme-icon moon-icon">🌙</span>
      </button>
    `;

    this.toggleButton = this.shadowRoot.querySelector('.theme-toggle');
    this.setupEventListeners();
    this.initializeTheme();
  }

  connectedCallback() {
    // Update tooltip based on current theme
    this.updateTooltip();
  }

  /**
   * Sets up event listeners for the toggle button and theme change events
   * @private
   */
  setupEventListeners() {
    this.toggleButton.addEventListener('click', () => {
      this.toggleTheme();
    });

    // Listen for theme changes from other sources
    document.addEventListener('theme-change', _e => {
      this.updateTooltip();
    });
  }

  /**
   * Initializes the theme based on localStorage or system preference
   * @private
   */
  initializeTheme() {
    // Check localStorage first, then system preference
    const savedTheme = localStorage.getItem('theme');
    let theme;

    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      theme = savedTheme;
    } else {
      // Check system preference
      const prefersDark =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = prefersDark ? 'dark' : 'light';
    }

    this.applyTheme(theme);

    // Listen for system theme changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', e => {
        // Only auto-switch if user hasn't manually set a preference
        const userPreference = localStorage.getItem('theme');
        if (!userPreference) {
          const newTheme = e.matches ? 'dark' : 'light';
          this.applyTheme(newTheme);
        }
      });
    }
  }

  /**
   * Toggles between light and dark theme
   */
  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    this.applyTheme(newTheme);

    // Save user preference
    localStorage.setItem('theme', newTheme);
  }

  /**
   * Applies the specified theme to the document and component
   * @param {'light'|'dark'} theme - The theme to apply
   */
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    // Update component class for shadow DOM styling
    if (theme === 'dark') {
      this.classList.add('dark');
    } else {
      this.classList.remove('dark');
    }

    // Update tooltip
    this.updateTooltip();

    // Dispatch theme change event for other components
    const event = new CustomEvent('theme-change', {
      detail: { theme },
      bubbles: true,
      composed: true,
    });
    document.dispatchEvent(event);
  }

  updateTooltip() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const tooltipText = currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
    this.toggleButton.setAttribute('data-tooltip', tooltipText);
  }

  /**
   * Gets the current theme
   * @returns {'light'|'dark'} The current theme
   */
  getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  /**
   * Sets the theme programmatically
   * @param {'light'|'dark'} theme - The theme to set
   */
  setTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      this.applyTheme(theme);
      localStorage.setItem('theme', theme);
    }
  }
}

customElements.define('theme-toggle', ThemeToggle);
