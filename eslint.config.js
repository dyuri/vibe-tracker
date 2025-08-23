import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,ts}'],
    ignores: ['dist/**', 'node_modules/**', 'pb_data/**', '**/*.min.js'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        allowImportExportEverywhere: true,
        // Remove strict TypeScript project requirement for hybrid approach
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        history: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        CustomEvent: 'readonly',
        HTMLElement: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        Event: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        clearTimeout: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        // Leaflet global
        L: 'readonly',
        // Custom Element globals
        customElements: 'readonly',
        HTMLElement: 'readonly',
        ShadowRoot: 'readonly',
        // Custom globals (from our app)
        authService: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      // Basic JavaScript rules
      'no-unused-vars': 'off', // Turn off base rule
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_' 
      }],
      
      // Code style
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      
      // Best practices
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-alert': 'warn',
      
      // TypeScript-specific (works with JSDoc too) - relaxed for hybrid approach
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'off', // Too strict for hybrid approach
      '@typescript-eslint/prefer-optional-chain': 'warn', // Warn instead of error
      
      // Custom Element specific
      'no-undef': 'error',
      
      // Import/Export
      'import/extensions': 'off', // We use .js extensions for TS compatibility
    },
  },
  {
    // Specific rules for src/types/ directory (pure TypeScript)
    files: ['src/types/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off', // Type definitions might not be directly used
      'no-undef': 'off', // Type files have different scoping
    },
  },
  {
    // Specific rules for public/ directory (JSDoc enhanced JS)
    files: ['public/**/*.js'],
    rules: {
      // Allow console.log in development files
      'no-console': 'off',
      // Be more lenient with any types in JSDoc
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Configuration files
    files: ['*.config.{js,ts}', 'eslint.config.js'],
    languageOptions: {
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
];