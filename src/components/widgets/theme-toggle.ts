import type { ThemeToggleElement } from '@/types';
import styles from '@/styles/components/widgets/theme-toggle.css?inline';

type Theme = 'light' | 'dark';

/**
 * Theme Toggle Web Component
 * Provides a toggle switch for light/dark theme with system preference detection
 */
export default class ThemeToggle extends HTMLElement implements ThemeToggleElement {
  private toggleButton!: HTMLButtonElement;

  /**
   * Creates a new ThemeToggle component
   */
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.shadowRoot!.innerHTML = `
      <style>${styles}</style>
      
      <button class="theme-toggle" data-tooltip="Switch theme">
        <span class="theme-icon sun-icon">☀️</span>
        <span class="theme-icon moon-icon">🌙</span>
      </button>
    `;

    this.toggleButton = this.shadowRoot!.querySelector('.theme-toggle')!;
    this.setupEventListeners();
    this.initializeTheme();
  }

  connectedCallback(): void {
    // Update tooltip based on current theme
    this.updateTooltip();
  }

  /**
   * Sets up event listeners for the toggle button and theme change events
   */
  private setupEventListeners(): void {
    this.toggleButton.addEventListener('click', () => {
      this.toggleTheme();
    });

    // Listen for theme changes from other sources
    document.addEventListener('theme-change', () => {
      this.updateTooltip();
    });
  }

  /**
   * Initializes the theme based on localStorage or system preference
   */
  private initializeTheme(): void {
    // Check localStorage first, then system preference
    const savedTheme = localStorage.getItem('theme');
    let theme: Theme;

    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      theme = savedTheme as Theme;
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
      mediaQuery.addEventListener('change', (e: MediaQueryListEvent) => {
        // Only auto-switch if user hasn't manually set a preference
        const userPreference = localStorage.getItem('theme');
        if (!userPreference) {
          const newTheme: Theme = e.matches ? 'dark' : 'light';
          this.applyTheme(newTheme);
        }
      });
    }
  }

  /**
   * Toggles between light and dark theme
   */
  toggleTheme(): void {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme: Theme = currentTheme === 'light' ? 'dark' : 'light';

    this.applyTheme(newTheme);

    // Save user preference
    localStorage.setItem('theme', newTheme);
  }

  /**
   * Applies the specified theme to the document and component
   */
  applyTheme(theme: Theme): void {
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

  updateTooltip(): void {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const tooltipText = currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
    this.toggleButton.setAttribute('data-tooltip', tooltipText);
  }

  /**
   * Gets the current theme
   */
  getCurrentTheme(): Theme {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    return theme as Theme;
  }

  /**
   * Sets the theme programmatically
   */
  setTheme(theme: Theme): void {
    if (theme === 'light' || theme === 'dark') {
      this.applyTheme(theme);
      localStorage.setItem('theme', theme);
    }
  }
}

customElements.define('theme-toggle', ThemeToggle);
