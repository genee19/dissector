/**
 * Project Selector screen controller
 */

export class ProjectSelector {
  constructor(app) {
    this.app = app;
    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('create-new-project').addEventListener('click', () => {
      this.showCreateDialog();
    });

    document.getElementById('confirm-create-project').addEventListener('click', () => {
      this.createProject();
    });

    document.getElementById('cancel-create-project').addEventListener('click', () => {
      this.hideCreateDialog();
    });
  }

  async load() {
    const projects = await this.app.apiCall('/projects');
    this.renderProjects(projects);
  }

  renderProjects(projects) {
    const container = document.getElementById('projects-container');
    container.innerHTML = '';

    if (projects.length === 0) {
      container.innerHTML = '<p style="color: var(--color-text-muted)">No projects yet. Create one to get started!</p>';
      return;
    }

    projects.forEach(project => {
      const card = document.createElement('div');
      card.className = 'project-card';
      card.innerHTML = `
                <h3>${this.escapeHtml(project.name)}</h3>
                <div class="meta">
                    ${this.escapeHtml(project.creator)} • ${this.formatDate(project.updated_at)}
                </div>
                ${project.summary ? `<p style="margin-top: 8px; color: var(--color-text-muted)">${this.escapeHtml(project.summary)}</p>` : ''}
            `;
      card.addEventListener('click', () => {
        this.app.openProject(project.id);
      });
      container.appendChild(card);
    });
  }

  showCreateDialog() {
    document.getElementById('create-project-dialog').classList.remove('hidden');
    document.getElementById('new-project-name').value = '';
    document.getElementById('new-project-creator').value = '';
    document.getElementById('new-project-summary').value = '';
    document.getElementById('new-project-name').focus();
  }

  hideCreateDialog() {
    document.getElementById('create-project-dialog').classList.add('hidden');
  }

  async createProject() {
    const name = document.getElementById('new-project-name').value.trim();
    const creator = document.getElementById('new-project-creator').value.trim() || 'Anonymous';
    const summary = document.getElementById('new-project-summary').value.trim();

    if (!name) {
      alert('Please enter a project name');
      return;
    }

    try {
      const project = await this.app.apiCall('/projects', {
        method: 'POST',
        body: { name, creator, summary }
      });

      this.hideCreateDialog();
      this.app.openProject(project.id);
    } catch (error) {
      alert('Failed to create project: ' + error.message);
    }
  }

  formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return diffMins === 0 ? 'just now' : `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
