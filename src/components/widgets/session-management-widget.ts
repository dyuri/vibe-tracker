import type { User, SessionManagementWidgetElement } from '@/types';
import styles from '@/styles/components/widgets/session-management-widget.css?inline';

interface Session {
  name: string;
  title?: string;
  description?: string;
  public: boolean;
  created: string;
  updated: string;
}

interface SessionData {
  name?: string;
  title?: string;
  description?: string;
  public?: boolean;
}

interface PaginationData {
  page: number;
  totalPages: number;
  totalItems: number;
}

export default class SessionManagementWidget
  extends HTMLElement
  implements SessionManagementWidgetElement
{
  private user: User | null = null;
  private isAuthenticated: boolean = false;
  private sessions: Session[] = [];
  private currentPage: number = 1;
  private perPage: number = 20;
  private totalPages: number = 1;
  private editingSession: Session | null = null;

  // Auth state elements
  private notAuthenticated!: HTMLElement;
  private sessionContent!: HTMLElement;

  // Form elements
  private formTitle!: HTMLElement;
  private sessionForm!: HTMLFormElement;
  private sessionNameInput!: HTMLInputElement;
  private sessionTitleInput!: HTMLInputElement;
  private sessionDescriptionInput!: HTMLTextAreaElement;
  private sessionPublicInput!: HTMLInputElement;
  private submitBtn!: HTMLButtonElement;
  private cancelBtn!: HTMLButtonElement;
  private formMessage!: HTMLElement;

  // List elements
  private loading!: HTMLElement;
  private emptyState!: HTMLElement;
  private sessionList!: HTMLElement;
  private pagination!: HTMLElement;
  private paginationInfo!: HTMLElement;
  private prevBtn!: HTMLButtonElement;
  private nextBtn!: HTMLButtonElement;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    this.shadowRoot!.innerHTML = `
<style>${styles}</style>
      
      <div class="not-authenticated" id="not-authenticated">
        <h2>Please log in to manage your sessions</h2>
        <p>You need to be logged in to create and manage your tracking sessions.</p>
      </div>
      
      <div class="session-content" id="session-content">
        <!-- Session Form Section -->
        <div class="profile-section">
          <div class="section-title" id="form-title">Create New Session</div>
          
          <form id="session-form">
            <div class="form-group">
              <label for="session-name">Session Name *</label>
              <input type="text" id="session-name" placeholder="e.g., morning-run-2024" pattern="^[a-zA-Z0-9_-]+$" required>
              <small class="form-help-text">Only letters, numbers, hyphens, and underscores allowed</small>
            </div>
            
            <div class="form-group">
              <label for="session-title">Session Title</label>
              <input type="text" id="session-title" placeholder="e.g., Morning Run 2024">
            </div>
            
            <div class="form-group">
              <label for="session-description">Description</label>
              <textarea id="session-description" placeholder="Optional description of this session..."></textarea>
            </div>
            
            <div class="form-group">
              <div class="checkbox-group">
                <input type="checkbox" id="session-public">
                <label for="session-public">Make this session public</label>
              </div>
              <small class="form-help-text">Public sessions can be viewed by anyone</small>
            </div>
            
            <button type="submit" id="submit-btn">Create Session</button>
            <button type="button" id="cancel-btn" class="btn-secondary hidden">Cancel</button>
            <div id="form-message"></div>
          </form>
        </div>
        
        <!-- Sessions List Section -->
        <div class="profile-section">
          <div class="section-title">Your Sessions</div>
          
          <div id="loading" class="loading hidden">
            Loading sessions...
          </div>
          
          <div id="empty-state" class="empty-state hidden">
            <h3>No sessions yet</h3>
            <p>Create your first session above to start organizing your tracking data.</p>
          </div>
          
          <div class="session-list" id="session-list"></div>
          
          <div class="pagination hidden" id="pagination">
            <div class="pagination-info" id="pagination-info"></div>
            <button id="prev-btn" class="btn-secondary">← Previous</button>
            <button id="next-btn" class="btn-secondary">Next →</button>
          </div>
        </div>
      </div>
    `;

    this.setupElements();
    this.setupEventListeners();
    this.updateUI();

    // Listen for auth changes
    document.addEventListener('auth-change', (e: Event) => {
      const customEvent = e as CustomEvent;
      this.isAuthenticated = customEvent.detail.isAuthenticated;
      this.user = customEvent.detail.user;
      this.updateUI();
      if (this.isAuthenticated) {
        this.loadSessions();
      }
    });
  }

  setupElements(): void {
    // Auth state elements
    this.notAuthenticated = this.shadowRoot!.getElementById('not-authenticated')!;
    this.sessionContent = this.shadowRoot!.getElementById('session-content')!;

    // Form elements
    this.formTitle = this.shadowRoot!.getElementById('form-title')!;
    this.sessionForm = this.shadowRoot!.getElementById('session-form')! as HTMLFormElement;
    this.sessionNameInput = this.shadowRoot!.getElementById('session-name')! as HTMLInputElement;
    this.sessionTitleInput = this.shadowRoot!.getElementById('session-title')! as HTMLInputElement;
    this.sessionDescriptionInput = this.shadowRoot!.getElementById(
      'session-description'
    )! as HTMLTextAreaElement;
    this.sessionPublicInput = this.shadowRoot!.getElementById(
      'session-public'
    )! as HTMLInputElement;
    this.submitBtn = this.shadowRoot!.getElementById('submit-btn')! as HTMLButtonElement;
    this.cancelBtn = this.shadowRoot!.getElementById('cancel-btn')! as HTMLButtonElement;
    this.formMessage = this.shadowRoot!.getElementById('form-message')!;

    // List elements
    this.loading = this.shadowRoot!.getElementById('loading')!;
    this.emptyState = this.shadowRoot!.getElementById('empty-state')!;
    this.sessionList = this.shadowRoot!.getElementById('session-list')!;
    this.pagination = this.shadowRoot!.getElementById('pagination')!;
    this.paginationInfo = this.shadowRoot!.getElementById('pagination-info')!;
    this.prevBtn = this.shadowRoot!.getElementById('prev-btn')! as HTMLButtonElement;
    this.nextBtn = this.shadowRoot!.getElementById('next-btn')! as HTMLButtonElement;
  }

  setupEventListeners(): void {
    this.sessionForm.addEventListener('submit', (e: Event) => this.handleSubmit(e));
    this.cancelBtn.addEventListener('click', () => this.cancelEdit());
    this.prevBtn.addEventListener('click', () => this.previousPage());
    this.nextBtn.addEventListener('click', () => this.nextPage());

    // Auto-generate title from name
    this.sessionNameInput.addEventListener('input', () => {
      if (!this.editingSession && this.sessionNameInput.value && !this.sessionTitleInput.value) {
        this.sessionTitleInput.value = this.generateTitle(this.sessionNameInput.value);
      }
    });
  }

  connectedCallback(): void {
    this.initializeAuthState();
  }

  initializeAuthState(): void {
    if (window.authService) {
      this.isAuthenticated = window.authService.isAuthenticated();
      this.user = window.authService.user;
      this.updateUI();
      if (this.isAuthenticated) {
        this.loadSessions();
      }
    } else {
      setTimeout(() => this.initializeAuthState(), 10);
    }
  }

  updateUI(): void {
    if (this.isAuthenticated && this.user) {
      this.notAuthenticated.classList.add('hidden');
      this.sessionContent.classList.add('show');
    } else {
      this.notAuthenticated.classList.remove('hidden');
      this.sessionContent.classList.remove('show');
    }
  }

  generateTitle(sessionName: string): string {
    if (!sessionName) {
      return '';
    }

    // Convert snake_case and kebab-case to Title Case
    const words = sessionName.split(/[_-]+/);
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
  }

  async loadSessions(): Promise<void> {
    if (!this.isAuthenticated || !this.user) {
      return;
    }

    this.loading.classList.remove('hidden');
    this.emptyState.classList.add('hidden');
    this.sessionList.innerHTML = '';
    this.pagination.classList.add('hidden');

    try {
      const response = await fetch(
        `/api/sessions/${this.user.username}?page=${this.currentPage}&perPage=${this.perPage}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to load sessions: ${response.statusText}`);
      }

      const result = await response.json();
      // Handle standardized response format
      const data = result.data || result;

      // Handle paginated response format
      if (data.data && data.pagination) {
        // New standardized paginated format
        this.sessions = data.data;
        this.totalPages = data.pagination.totalPages;

        this.renderSessions();
        this.updatePagination({
          page: data.pagination.page,
          totalPages: data.pagination.totalPages,
          totalItems: data.pagination.totalItems,
        });
      } else {
        // Old direct format (fallback)
        this.sessions = data.sessions || data;
        this.totalPages = data.totalPages || 1;

        this.renderSessions();
        this.updatePagination(data);
      }
    } catch (error: any) {
      console.error('Error loading sessions:', error);
      this.showMessage(this.formMessage, error.message || 'Failed to load sessions', 'error');
    } finally {
      this.loading.classList.add('hidden');
    }
  }

  renderSessions(): void {
    if (this.sessions.length === 0) {
      this.emptyState.classList.remove('hidden');
      return;
    }

    this.sessionList.innerHTML = this.sessions
      .map(
        session => `
      <div class="session-item">
        <div class="session-info">
          <div class="session-name">${this.escapeHtml(session.name)}</div>
          ${session.title ? `<div class="session-title">${this.escapeHtml(session.title)}</div>` : ''}
          <div class="session-meta">
            <span class="${session.public ? 'public-indicator' : 'private-indicator'}">
              ${session.public ? 'Public' : 'Private'}
            </span>
            <span>Created: ${new Date(session.created).toLocaleDateString()}</span>
            ${session.updated !== session.created ? `<span>Updated: ${new Date(session.updated).toLocaleDateString()}</span>` : ''}
          </div>
        </div>
        <div class="session-actions">
          <button onclick="this.getRootNode().host.editSession('${session.name}')">Edit</button>
          <button class="btn-danger" onclick="this.getRootNode().host.deleteSession('${session.name}')">Delete</button>
        </div>
      </div>
    `
      )
      .join('');
  }

  updatePagination(data: PaginationData): void {
    if (data.totalPages <= 1) {
      this.pagination.classList.add('hidden');
      return;
    }

    this.pagination.classList.remove('hidden');
    this.paginationInfo.textContent = `Page ${data.page} of ${data.totalPages} (${data.totalItems} sessions)`;
    this.prevBtn.disabled = data.page <= 1;
    this.nextBtn.disabled = data.page >= data.totalPages;
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadSessions();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadSessions();
    }
  }

  async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();

    const name = this.sessionNameInput.value.trim();
    const title = this.sessionTitleInput.value.trim();
    const description = this.sessionDescriptionInput.value.trim();
    const isPublic = this.sessionPublicInput.checked;

    if (!name) {
      this.showMessage(this.formMessage, 'Session name is required', 'error');
      return;
    }

    // Validate session name format
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      this.showMessage(
        this.formMessage,
        'Session name can only contain letters, numbers, hyphens, and underscores',
        'error'
      );
      return;
    }

    this.submitBtn.disabled = true;
    this.submitBtn.textContent = this.editingSession ? 'Updating...' : 'Creating...';

    try {
      if (this.editingSession) {
        await this.updateSession(name, { title, description, public: isPublic });
      } else {
        await this.createSession({ name, title, description, public: isPublic });
      }

      this.resetForm();
      this.loadSessions();
      this.showMessage(
        this.formMessage,
        this.editingSession ? 'Session updated successfully!' : 'Session created successfully!',
        'success'
      );
    } catch (error: any) {
      this.showMessage(this.formMessage, error.message || 'Failed to save session', 'error');
    } finally {
      this.submitBtn.disabled = false;
      this.submitBtn.textContent = this.editingSession ? 'Update Session' : 'Create Session';
    }
  }

  async createSession(sessionData: SessionData): Promise<any> {
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
      },
      body: JSON.stringify(sessionData),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to create session');
    }

    const result = await response.json();
    // Handle standardized response format
    return result.data || result;
  }

  async updateSession(sessionName: string, sessionData: SessionData): Promise<any> {
    const response = await fetch(`/api/sessions/${this.user!.username}/${sessionName}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
      },
      body: JSON.stringify(sessionData),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to update session');
    }

    const result = await response.json();
    // Handle standardized response format
    return result.data || result;
  }

  async deleteSession(sessionName: string): Promise<void> {
    if (
      !confirm(
        `Are you sure you want to delete the session "${sessionName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${this.user!.username}/${sessionName}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete session');
      }

      this.loadSessions();
      this.showMessage(this.formMessage, 'Session deleted successfully!', 'success');
    } catch (error: any) {
      this.showMessage(this.formMessage, error.message || 'Failed to delete session', 'error');
    }
  }

  editSession(sessionName: string): void {
    const session = this.sessions.find(s => s.name === sessionName);
    if (!session) {
      return;
    }

    this.editingSession = session;
    this.formTitle.textContent = 'Edit Session';
    this.submitBtn.textContent = 'Update Session';
    this.cancelBtn.classList.remove('hidden');
    this.cancelBtn.classList.add('show-inline-block');

    // Populate form with session data
    this.sessionNameInput.value = session.name;
    this.sessionNameInput.disabled = true; // Don't allow changing the name
    this.sessionTitleInput.value = session.title || '';
    this.sessionDescriptionInput.value = session.description || '';
    this.sessionPublicInput.checked = session.public || false;

    // Scroll to form
    this.sessionForm.scrollIntoView({ behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.resetForm();
  }

  resetForm(): void {
    this.editingSession = null;
    this.formTitle.textContent = 'Create New Session';
    this.submitBtn.textContent = 'Create Session';
    this.cancelBtn.classList.add('hidden');
    this.cancelBtn.classList.remove('show-inline-block');

    this.sessionNameInput.disabled = false;
    this.sessionForm.reset();
    this.formMessage.textContent = '';
    this.formMessage.className = '';
  }

  showMessage(element: HTMLElement, message: string, type: string): void {
    element.textContent = message;
    element.className = type;

    // Clear message after 5 seconds
    setTimeout(() => {
      element.textContent = '';
      element.className = '';
    }, 5000);
  }

  escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define('session-management-widget', SessionManagementWidget);
