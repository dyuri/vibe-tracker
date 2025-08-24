import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', 'pb_data/**', '**/*.min.js', 'build/**', 'coverage/**'],
  },
  {
    files: ['**/*.{js,ts}'],
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
        navigator: 'readonly',
        MutationObserver: 'readonly',
        URLSearchParams: 'readonly',
        // Leaflet global
        L: 'readonly',
        // Custom Element globals
        customElements: 'readonly',
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
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Code style
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],

      // Best practices
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-alert': 'warn',

      // TypeScript-specific (works with JSDoc too) - relaxed for hybrid approach
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      // Disable rules that require type information for our hybrid approach
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',

      // Custom Element specific
      'no-undef': 'error',
    },
  },
  {
    // Test files configuration
    files: ['tests/**/*.{js,ts}', '**/*.test.{js,ts}', '**/*.spec.{js,ts}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        // Node.js globals for test environment
        global: 'writable',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        // Vitest globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        // Browser globals still needed for mocking
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      // More relaxed rules for test files
      '@typescript-eslint/no-explicit-any': 'off',
      'no-undef': 'error',
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
    // Specific rules for public/ directory (TypeScript files)
    files: ['public/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        // Only custom globals that aren't part of standard browser/DOM APIs
        // Leaflet global
        L: 'readonly',
        // Custom globals (from our app)
        authService: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      // Allow console.log in development files
      'no-console': 'off',
      // Be more lenient with any types in JSDoc
      '@typescript-eslint/no-explicit-any': 'off',
      // Disable no-undef for TypeScript files since TypeScript handles this
      'no-undef': 'off',
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
