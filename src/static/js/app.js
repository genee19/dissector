/**
 * Main application controller for Dissector visual tool
 */

import { ProjectSelector } from './project-selector.js';
import { Workspace } from './workspace.js';

class App {
  constructor() {
    this.currentScreen = 'selector';
    this.currentProject = null;

    this.projectSelector = new ProjectSelector(this);
    this.workspace = new Workspace(this);

    this.init();
  }

  init() {
    // Check URL for project slug
    const path = window.location.pathname;
    const projectMatch = path.match(/^\/project\/([^\/]+)/);
    
    if (projectMatch && projectMatch[1]) {
      // Load project from URL
      this.openProject(projectMatch[1]);
    } else {
      // Show project selector
      this.showProjectSelector();
    }
    
    // Handle browser back/forward navigation
    window.addEventListener('popstate', (event) => {
      if (event.state && event.state.projectId) {
        this.openProject(event.state.projectId, false);
      } else {
        this.showProjectSelector();
      }
    });
  }

  showProjectSelector() {
    document.getElementById('project-selector').classList.remove('hidden');
    document.getElementById('project-workspace').classList.add('hidden');
    this.currentScreen = 'selector';
    this.currentProject = null;
    this.projectSelector.load();
    
    // Update URL to root
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
  }

  openProject(projectId, updateHistory = true) {
    this.currentProject = projectId;
    document.getElementById('project-selector').classList.add('hidden');
    document.getElementById('project-workspace').classList.remove('hidden');
    this.currentScreen = 'workspace';
    this.workspace.load(projectId);
    
    // Update URL with project slug
    if (updateHistory) {
      const newUrl = `/project/${projectId}`;
      window.history.pushState({ projectId }, '', newUrl);
    }
  }

  async apiCall(endpoint, options = {}) {
    const baseUrl = 'http://localhost:5010/api';
    const url = `${baseUrl}${endpoint}`;

    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const finalOptions = { ...defaultOptions, ...options };

    if (finalOptions.body && typeof finalOptions.body === 'object' && !(finalOptions.body instanceof FormData)) {
      finalOptions.body = JSON.stringify(finalOptions.body);
    }

    if (finalOptions.body instanceof FormData) {
      delete finalOptions.headers['Content-Type'];
    }

    const response = await fetch(url, finalOptions);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return await response.json();
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});

export { App };
