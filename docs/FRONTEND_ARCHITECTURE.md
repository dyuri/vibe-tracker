# Frontend Architecture Guide

## Overview

The Vibe Tracker frontend is built using modern web technologies with a focus on maintainability, type safety, and performance. This document outlines the current architecture and development practices.

## Technology Stack

- **TypeScript** - Full type safety with modern ES2020+ features
- **Web Components** - Native custom elements with Shadow DOM encapsulation
- **Vite** - Modern build tool with HMR and optimized production builds
- **ESLint + Prettier** - Code quality and consistent formatting
- **Vitest** - Unit testing framework with jsdom environment
- **Playwright** - End-to-end testing (available)

## Project Structure

```
src/
├── apps/                    # Application entry points
│   ├── app.ts              # Main app (map view)
│   ├── profile-app.ts      # Profile management app
│   ├── sessions-app.ts     # Session management app
│   └── theme-init.ts       # Theme initialization utility
├── components/             # Reusable UI components
│   ├── widgets/           # Feature-complete widgets
│   │   ├── login-widget.ts        # Authentication widget
│   │   ├── location-widget.ts     # Geolocation controls
│   │   ├── map-widget.ts          # Leaflet map integration
│   │   ├── profile-widget.ts      # User profile management
│   │   ├── session-management-widget.ts # Session CRUD
│   │   ├── theme-toggle.ts        # Dark/light theme toggle
│   │   └── index.ts               # Barrel exports
│   ├── ui/                # Low-level UI components
│   │   ├── avatar-marker.ts       # Map marker utilities
│   │   └── index.ts               # Barrel exports
│   └── index.ts           # Main components barrel export
├── services/              # Business logic and API integration
│   ├── auth-service.ts    # Authentication service
│   └── index.ts           # Barrel exports
├── styles/                # CSS organization
│   ├── variables.css      # CSS custom properties & theming
│   ├── base.css          # Base HTML/body styles
│   ├── components/       # Component-specific styles
│   │   ├── layout.css    # Shared layout components
│   │   ├── widgets.css   # Widget positioning
│   │   └── widgets/      # Individual widget styles
│   ├── pages/            # Page-specific styles
│   └── main.css          # Main CSS entry point
├── types/                 # TypeScript type definitions
│   ├── api.ts            # API response types
│   ├── dom.ts            # DOM and custom element types
│   ├── location.ts       # Location and session types
│   ├── user.ts           # User and authentication types
│   └── index.ts          # Barrel exports
├── utils/                # Utility functions
│   ├── utils.ts          # General utilities
│   └── index.ts          # Barrel exports
└── tests/                # Test files and utilities
```

## Architecture Patterns

### Web Components Architecture

All UI widgets are implemented as native Web Components with:

- **Custom Elements** - Registered with `customElements.define()`
- **Shadow DOM** - Style and markup encapsulation
- **TypeScript Interfaces** - Typed component contracts
- **Event-Driven Communication** - Custom events for component interaction

Example widget structure:

```typescript
export default class MyWidget extends HTMLElement implements MyWidgetElement {
  private shadowRoot: ShadowRoot;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    // Component initialization
  }

  connectedCallback() {
    // DOM manipulation and event listeners
  }

  disconnectedCallback() {
    // Cleanup
  }
}

customElements.define('my-widget', MyWidget);
```

### Type System

Comprehensive TypeScript types ensure:

- **API Contract Safety** - Types match Go backend models
- **Component Interfaces** - Typed component APIs
- **Event Typing** - Custom events with typed payloads
- **DOM Element Extensions** - Enhanced HTMLElement interfaces

### Path Mapping & Barrel Exports

Clean import structure using:

- **Path Mappings** - `@/types`, `@/components`, `@/services`, etc.
- **Barrel Exports** - Single import points for related modules
- **Tree Shaking** - Optimized bundle sizes

Example imports:

```typescript
import type { User, LocationResponse } from '@/types';
import { AuthService } from '@/services';
import { createMarker } from '@/components/ui';
```

### CSS Architecture

Modular CSS organization:

- **CSS Variables** - Consistent theming and spacing
- **Component Isolation** - External CSS files for web components
- **Responsive Design** - Mobile-first approach
- **Dark Mode** - Complete theme system

### Build System

Modern build pipeline with Vite:

- **Hot Module Replacement** - Instant development feedback
- **TypeScript Compilation** - Full type checking
- **Code Splitting** - Multiple entry points for different apps
- **Asset Optimization** - Minification and compression
- **Go Backend Integration** - Proxy configuration for API calls

## Development Workflow

### Local Development

```bash
# Terminal 1: Start Go backend
go run . serve --dev

# Terminal 2: Start Vite dev server
npm run dev

# Access app at http://localhost:3000
# API calls proxied to http://localhost:8090
```

### Code Quality

Automated quality checks:

- **Pre-commit Hooks** - Lint-staged with TypeScript checking
- **ESLint** - TypeScript-aware linting rules
- **Prettier** - Consistent code formatting
- **Type Checking** - Full TypeScript compilation

### Testing Strategy

- **Unit Tests** - Vitest for services and utilities
- **Component Tests** - Web Components testing setup
- **E2E Tests** - Playwright for critical user flows
- **Type Safety** - Compile-time error prevention

## Performance Considerations

### Bundle Optimization

- **Tree Shaking** - Dead code elimination
- **Code Splitting** - Separate bundles for different apps
- **Dynamic Imports** - Lazy loading for non-critical features
- **Asset Optimization** - Efficient resource loading

### Runtime Performance

- **Web Components** - Efficient DOM updates with Shadow DOM
- **Event Delegation** - Optimized event handling
- **CSS Variables** - Performance-friendly theming
- **Service Worker Ready** - Prepared for caching strategies

## Security

### Current Security Measures

- **TypeScript** - Type safety reduces runtime vulnerabilities
- **Shadow DOM** - Style isolation prevents CSS injection
- **Input Validation** - Type checking and validation
- **Token Handling** - Secure authentication token management

### Planned Enhancements

- **Content Security Policy** - Enhanced CSP configuration
- **Dependency Scanning** - Automated vulnerability checks
- **Input Sanitization** - Additional XSS prevention

## Deployment

### Build Process

```bash
npm run build    # Creates optimized production build
npm run analyze  # Bundle size analysis
npm run lint     # Code quality checks
npm run test     # Run test suites
```

### Production Integration

- **Vite Build** - Creates dist/ directory with optimized assets
- **Go Backend** - Serves built frontend from dist/
- **Docker Support** - Multi-stage build process
- **CI/CD Ready** - GitHub Actions compatible

## Future Roadmap

### Phase 4 (Current)

- [ ] PWA Implementation with Workbox
- [ ] Web Vitals monitoring
- [ ] Enhanced error boundaries
- [ ] Offline functionality

### Future Phases

- [ ] Advanced state management
- [ ] Component library expansion
- [ ] Performance monitoring dashboard
- [ ] Advanced PWA features (background sync, push notifications)

## Development Guidelines

### Code Style

- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Write comprehensive JSDoc comments for public APIs
- Prefer composition over inheritance
- Use semantic HTML and accessible markup

### Component Guidelines

- Each component should have a single responsibility
- Use Shadow DOM for style encapsulation
- Implement proper cleanup in `disconnectedCallback`
- Use typed custom events for component communication
- Follow established naming conventions

### Testing Guidelines

- Write unit tests for all business logic
- Mock external dependencies appropriately
- Test error conditions and edge cases
- Use meaningful test descriptions
- Maintain good test coverage

## Troubleshooting

### Common Issues

1. **Import Errors** - Check path mappings in `vite.config.ts` and `tsconfig.json`
2. **Type Errors** - Ensure all types are properly imported from `@/types`
3. **Build Failures** - Run `npm run lint` and `npx tsc --noEmit` to check for issues
4. **HMR Issues** - Restart Vite dev server, check for circular dependencies

### Performance Issues

1. **Slow Build Times** - Check for unnecessary file inclusions
2. **Large Bundle Size** - Use `npm run analyze` to identify large dependencies
3. **Runtime Performance** - Use browser dev tools for profiling

## Contributing

### Getting Started

1. Read this architecture guide
2. Set up development environment
3. Run the test suite to ensure everything works
4. Make incremental changes with tests
5. Follow the established patterns and conventions

### Pull Request Guidelines

- Include tests for new functionality
- Update documentation for architecture changes
- Ensure all quality checks pass
- Follow semantic commit conventions
- Keep changes focused and atomic
