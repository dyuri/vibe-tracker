# UI Component Styles

This directory contains reusable CSS files for generic UI elements. These styles are designed to be imported into web components (shadow DOM) to ensure consistent styling across the application.

## Available Styles

- **button.css** - Button styles with variants (primary, secondary, danger, success, link) and sizes (sm, lg)
- **input.css** - Text input styles for text, email, password, number, tel, url, search, date, time, datetime-local, and file inputs
- **textarea.css** - Textarea styles with resize options
- **select.css** - Select/dropdown styles including multiple select
- **checkbox.css** - Checkbox styles with group layout helpers
- **radio.css** - Radio button styles with group layout helpers (vertical/horizontal)
- **label.css** - Label styles with form group helpers
- **index.css** - Imports all UI component styles

## Usage

### Import All Styles

```typescript
import uiStyles from '@/styles/ui/index.css?inline';

// In your web component constructor:
this.shadowRoot!.innerHTML = `
  <style>${uiStyles}</style>
  <!-- Your component HTML -->
`;
```

### Import Specific Styles

```typescript
import buttonStyles from '@/styles/ui/button.css?inline';
import inputStyles from '@/styles/ui/input.css?inline';

this.shadowRoot!.innerHTML = `
  <style>
    ${buttonStyles}
    ${inputStyles}
  </style>
  <!-- Your component HTML -->
`;
```

## Demo

Visit `/ui-demo` to see all available styles and their variants in action.

## Style Classes

### Buttons

- Default: `<button>`
- Secondary: `<button class="btn-secondary">`
- Danger: `<button class="btn-danger">`
- Success: `<button class="btn-success">`
- Link: `<button class="btn-link">`
- Small: `<button class="btn-sm">`
- Large: `<button class="btn-lg">`
- Full width: `<button class="btn-full-width">`

### Inputs

- Error state: `<input class="error">`
- Success state: `<input class="success">`

### Textareas

- Error state: `<textarea class="error">`
- Success state: `<textarea class="success">`
- No resize: `<textarea class="no-resize">`

### Selects

- Error state: `<select class="error">`
- Success state: `<select class="success">`

### Form Groups

```html
<div class="form-group">
  <label for="field">Field Label</label>
  <input type="text" id="field" />
</div>
```

### Checkboxes

```html
<div class="checkbox-group">
  <input type="checkbox" id="check1" />
  <label for="check1" class="inline">Checkbox Label</label>
</div>
```

### Radio Buttons

```html
<div class="radio-group">
  <div class="radio-option">
    <input type="radio" id="radio1" name="group" />
    <label for="radio1" class="inline">Option 1</label>
  </div>
</div>
```

For horizontal layout: `<div class="radio-group horizontal">`

## Design Tokens

All styles use CSS variables defined in `/src/styles/variables.css`:

- Colors: `--color-primary`, `--color-danger`, `--color-success`, etc.
- Spacing: `--spacing-xs`, `--spacing-sm`, `--spacing-md`, etc.
- Border radius: `--border-radius-sm`, `--border-radius-md`, etc.
- Fonts: `--font-size-base`, `--font-weight-bold`, etc.

This ensures consistency across the entire application and makes theming easy.
