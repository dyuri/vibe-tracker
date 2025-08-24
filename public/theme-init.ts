// Theme initialization without UI toggle
// This applies the saved theme from localStorage and respects system preferences
// without showing a theme toggle button

type Theme = 'light' | 'dark';

function initializeTheme(): void {
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

  // Apply theme
  document.documentElement.setAttribute('data-theme', theme);

  // Listen for system theme changes
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't manually set a preference
      const userPreference = localStorage.getItem('theme');
      if (!userPreference) {
        const newTheme: Theme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
      }
    });
  }
}

// Initialize theme immediately
initializeTheme();
