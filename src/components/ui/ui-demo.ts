import uiStyles from '@/styles/ui/index.css?inline';

/**
 * UI Demo Component
 * Showcases all available UI styles for buttons, inputs, checkboxes, etc.
 */
export default class UiDemo extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.shadowRoot!.innerHTML = `
      <style>
        ${uiStyles}

        :host {
          display: block;
          font-family: var(--font-family-base, sans-serif);
          max-width: 1200px;
          margin: 0 auto;
          padding: var(--spacing-xl);
        }

        .demo-section {
          background-color: var(--bg-panel);
          border: 1px solid var(--border-light);
          border-radius: var(--border-radius-md);
          padding: var(--spacing-lg);
          margin-bottom: var(--spacing-xl);
          box-shadow: var(--shadow-light);
        }

        .demo-title {
          font-size: var(--font-size-xlarge);
          font-weight: var(--font-weight-bold);
          margin: 0 0 var(--spacing-md) 0;
          color: var(--text-primary);
          border-bottom: 2px solid var(--color-primary);
          padding-bottom: var(--spacing-xs);
        }

        .demo-group {
          margin-bottom: var(--spacing-lg);
        }

        .demo-group:last-child {
          margin-bottom: 0;
        }

        .demo-label {
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-bold);
          color: var(--text-secondary);
          margin-bottom: var(--spacing-sm);
          display: block;
        }

        .demo-row {
          display: flex;
          gap: var(--spacing-md);
          flex-wrap: wrap;
          align-items: center;
          margin-bottom: var(--spacing-md);
        }

        .demo-item {
          flex: 0 0 auto;
        }

        .demo-description {
          font-size: var(--font-size-small);
          color: var(--text-muted);
          margin-top: var(--spacing-xs);
          font-style: italic;
        }

        .demo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: var(--spacing-lg);
        }

        code {
          background-color: var(--bg-secondary);
          padding: 2px 6px;
          border-radius: var(--border-radius-sm);
          font-family: monospace;
          font-size: var(--font-size-small);
          color: var(--color-primary);
        }

        h1 {
          font-size: 2rem;
          margin: 0 0 var(--spacing-md) 0;
          color: var(--text-primary);
        }

        .page-header {
          text-align: center;
          margin-bottom: var(--spacing-xxl);
        }

        .page-header p {
          color: var(--text-muted);
          font-size: var(--font-size-large);
        }
      </style>

      <div class="page-header">
        <h1>UI Component Demo</h1>
        <p>Showcase of all available UI styles</p>
      </div>

      <!-- Buttons -->
      <div class="demo-section">
        <h2 class="demo-title">Buttons</h2>

        <div class="demo-group">
          <div class="demo-label">Button Variants</div>
          <div class="demo-row">
            <button>Primary Button</button>
            <button class="btn-secondary">Secondary Button</button>
            <button class="btn-danger">Danger Button</button>
            <button class="btn-success">Success Button</button>
            <button class="btn-link">Link Button</button>
          </div>
          <div class="demo-description">
            Use <code>btn-secondary</code>, <code>btn-danger</code>, <code>btn-success</code>, or <code>btn-link</code> classes
          </div>
        </div>

        <div class="demo-group">
          <div class="demo-label">Button Sizes</div>
          <div class="demo-row">
            <button class="btn-sm">Small Button</button>
            <button>Default Button</button>
            <button class="btn-lg">Large Button</button>
          </div>
          <div class="demo-description">
            Use <code>btn-sm</code> or <code>btn-lg</code> classes
          </div>
        </div>

        <div class="demo-group">
          <div class="demo-label">Button States</div>
          <div class="demo-row">
            <button>Normal</button>
            <button disabled>Disabled</button>
          </div>
          <div class="demo-description">
            Add <code>disabled</code> attribute
          </div>
        </div>

        <div class="demo-group">
          <div class="demo-label">Full Width Button</div>
          <button class="btn-full-width">Full Width Button</button>
          <div class="demo-description">
            Use <code>btn-full-width</code> class
          </div>
        </div>
      </div>

      <!-- Text Inputs -->
      <div class="demo-section">
        <h2 class="demo-title">Text Inputs</h2>

        <div class="demo-grid">
          <div class="demo-group">
            <label for="demo-text">Text Input</label>
            <input type="text" id="demo-text" placeholder="Enter text...">
          </div>

          <div class="demo-group">
            <label for="demo-email">Email Input</label>
            <input type="email" id="demo-email" placeholder="email@example.com">
          </div>

          <div class="demo-group">
            <label for="demo-password">Password Input</label>
            <input type="password" id="demo-password" placeholder="Password">
          </div>

          <div class="demo-group">
            <label for="demo-number">Number Input</label>
            <input type="number" id="demo-number" placeholder="123">
          </div>

          <div class="demo-group">
            <label for="demo-date">Date Input</label>
            <input type="date" id="demo-date">
          </div>

          <div class="demo-group">
            <label for="demo-file">File Input</label>
            <input type="file" id="demo-file">
          </div>
        </div>

        <div class="demo-group">
          <div class="demo-label">Input States</div>
          <div class="demo-grid">
            <div>
              <label for="demo-normal">Normal</label>
              <input type="text" id="demo-normal" value="Normal input">
            </div>

            <div>
              <label for="demo-disabled">Disabled</label>
              <input type="text" id="demo-disabled" value="Disabled input" disabled>
            </div>

            <div>
              <label for="demo-error">Error State</label>
              <input type="text" id="demo-error" class="error" value="Invalid input">
              <div class="demo-description">Use <code>error</code> class</div>
            </div>

            <div>
              <label for="demo-success">Success State</label>
              <input type="text" id="demo-success" class="success" value="Valid input">
              <div class="demo-description">Use <code>success</code> class</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Textarea -->
      <div class="demo-section">
        <h2 class="demo-title">Textarea</h2>

        <div class="demo-grid">
          <div class="demo-group">
            <label for="demo-textarea">Normal Textarea</label>
            <textarea id="demo-textarea" placeholder="Enter long text..."></textarea>
          </div>

          <div class="demo-group">
            <label for="demo-textarea-disabled">Disabled Textarea</label>
            <textarea id="demo-textarea-disabled" disabled>Disabled content</textarea>
          </div>

          <div class="demo-group">
            <label for="demo-textarea-error">Error Textarea</label>
            <textarea id="demo-textarea-error" class="error">Error content</textarea>
            <div class="demo-description">Use <code>error</code> class</div>
          </div>

          <div class="demo-group">
            <label for="demo-textarea-no-resize">No Resize</label>
            <textarea id="demo-textarea-no-resize" class="no-resize" placeholder="Cannot be resized"></textarea>
            <div class="demo-description">Use <code>no-resize</code> class</div>
          </div>
        </div>
      </div>

      <!-- Select -->
      <div class="demo-section">
        <h2 class="demo-title">Select / Dropdown</h2>

        <div class="demo-grid">
          <div class="demo-group">
            <label for="demo-select">Normal Select</label>
            <select id="demo-select">
              <option>Option 1</option>
              <option>Option 2</option>
              <option>Option 3</option>
            </select>
          </div>

          <div class="demo-group">
            <label for="demo-select-disabled">Disabled Select</label>
            <select id="demo-select-disabled" disabled>
              <option>Option 1</option>
              <option>Option 2</option>
            </select>
          </div>

          <div class="demo-group">
            <label for="demo-select-error">Error Select</label>
            <select id="demo-select-error" class="error">
              <option>Option 1</option>
              <option>Option 2</option>
            </select>
            <div class="demo-description">Use <code>error</code> class</div>
          </div>

          <div class="demo-group">
            <label for="demo-select-multiple">Multiple Select</label>
            <select id="demo-select-multiple" multiple>
              <option>Option 1</option>
              <option>Option 2</option>
              <option>Option 3</option>
              <option>Option 4</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Checkboxes -->
      <div class="demo-section">
        <h2 class="demo-title">Checkboxes</h2>

        <div class="demo-group">
          <div class="demo-label">Standard Checkboxes</div>
          <div class="checkbox-group">
            <input type="checkbox" id="demo-check1">
            <label for="demo-check1" class="inline">Checkbox 1</label>
          </div>
          <div class="checkbox-group">
            <input type="checkbox" id="demo-check2" checked>
            <label for="demo-check2" class="inline">Checkbox 2 (checked)</label>
          </div>
          <div class="checkbox-group">
            <input type="checkbox" id="demo-check3" disabled>
            <label for="demo-check3" class="inline">Checkbox 3 (disabled)</label>
          </div>
          <div class="checkbox-group">
            <input type="checkbox" id="demo-check4" checked disabled>
            <label for="demo-check4" class="inline">Checkbox 4 (checked & disabled)</label>
          </div>
          <div class="demo-description">
            Use <code>checkbox-group</code> class wrapper and <code>inline</code> class on label
          </div>
        </div>
      </div>

      <!-- Radio Buttons -->
      <div class="demo-section">
        <h2 class="demo-title">Radio Buttons</h2>

        <div class="demo-group">
          <div class="demo-label">Vertical Radio Group</div>
          <div class="radio-group">
            <div class="radio-option">
              <input type="radio" id="demo-radio1" name="demo-radio" checked>
              <label for="demo-radio1" class="inline">Radio 1 (selected)</label>
            </div>
            <div class="radio-option">
              <input type="radio" id="demo-radio2" name="demo-radio">
              <label for="demo-radio2" class="inline">Radio 2</label>
            </div>
            <div class="radio-option">
              <input type="radio" id="demo-radio3" name="demo-radio" disabled>
              <label for="demo-radio3" class="inline">Radio 3 (disabled)</label>
            </div>
          </div>
          <div class="demo-description">
            Use <code>radio-group</code> and <code>radio-option</code> classes
          </div>
        </div>

        <div class="demo-group">
          <div class="demo-label">Horizontal Radio Group</div>
          <div class="radio-group horizontal">
            <div class="radio-option">
              <input type="radio" id="demo-radio-h1" name="demo-radio-h">
              <label for="demo-radio-h1" class="inline">Option A</label>
            </div>
            <div class="radio-option">
              <input type="radio" id="demo-radio-h2" name="demo-radio-h" checked>
              <label for="demo-radio-h2" class="inline">Option B</label>
            </div>
            <div class="radio-option">
              <input type="radio" id="demo-radio-h3" name="demo-radio-h">
              <label for="demo-radio-h3" class="inline">Option C</label>
            </div>
          </div>
          <div class="demo-description">
            Add <code>horizontal</code> class to <code>radio-group</code>
          </div>
        </div>
      </div>

      <!-- Form Groups -->
      <div class="demo-section">
        <h2 class="demo-title">Form Groups</h2>

        <div class="demo-group">
          <div class="demo-label">Standard Form Layout</div>
          <div class="form-group">
            <label for="demo-form-name">Full Name</label>
            <input type="text" id="demo-form-name" placeholder="John Doe">
          </div>

          <div class="form-group">
            <label for="demo-form-email" class="required">Email</label>
            <input type="email" id="demo-form-email" placeholder="john@example.com">
            <span class="label-help">We'll never share your email with anyone else.</span>
          </div>

          <div class="form-group">
            <label for="demo-form-message">Message</label>
            <textarea id="demo-form-message" placeholder="Your message here..."></textarea>
          </div>

          <div class="form-group">
            <div class="checkbox-group">
              <input type="checkbox" id="demo-form-agree">
              <label for="demo-form-agree" class="inline">I agree to the terms and conditions</label>
            </div>
          </div>

          <button>Submit Form</button>
          <button class="btn-secondary">Cancel</button>

          <div class="demo-description">
            Use <code>form-group</code> class for consistent spacing.
            Add <code>required</code> class to label for required fields.
            Use <code>label-help</code> class for help text.
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('ui-demo', UiDemo);
