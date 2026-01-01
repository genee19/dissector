/**
 * Workspace controller - manages the project editing interface
 */

import { Visualization } from './visualization.js';
import { DetailPanel } from './detail-panel.js';

export class Workspace {
  constructor(app) {
    this.app = app;
    this.projectId = null;
    this.projectData = null;
    this.saveTimeout = null;

    this.visualization = new Visualization(this);
    this.detailPanel = new DetailPanel(this);

    this.setupEventListeners();
  }

  setupEventListeners() {
    document.getElementById('back-to-selector').addEventListener('click', () => {
      this.app.showProjectSelector();
    });

    // Metadata fields with auto-save debounce
    ['project-name', 'project-creator', 'project-summary'].forEach(fieldId => {
      const field = document.getElementById(fieldId);
      field.addEventListener('input', () => {
        this.scheduleMetadataSave();
      });
    });
  }

  async load(projectId) {
    this.projectId = projectId;

    try {
      this.projectData = await this.app.apiCall(`/projects/${projectId}`);
      this.renderMetadata();
      this.visualization.render(this.projectData.observations);
    } catch (error) {
      alert('Failed to load project: ' + error.message);
      this.app.showProjectSelector();
    }
  }

  renderMetadata() {
    document.getElementById('project-name').value = this.projectData.name;
    document.getElementById('project-creator').value = this.projectData.creator;
    document.getElementById('project-summary').value = this.projectData.summary;
  }

  scheduleMetadataSave() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveMetadata();
    }, 500);
  }

  async saveMetadata() {
    const name = document.getElementById('project-name').value;
    const creator = document.getElementById('project-creator').value;
    const summary = document.getElementById('project-summary').value;

    try {
      await this.app.apiCall(`/projects/${this.projectId}`, {
        method: 'PUT',
        body: { name, creator, summary }
      });
    } catch (error) {
      console.error('Failed to save metadata:', error);
    }
  }

  async reload() {
    await this.load(this.projectId);
  }

  getObservation(id) {
    return this.projectData.observations.find(obs => obs.id === id);
  }

  async createObservation(summary = 'New Observation') {
    try {
      const newObs = await this.app.apiCall(`/projects/${this.projectId}/observations`, {
        method: 'POST',
        body: { summary, description: '' }
      });

      await this.reload();
      return newObs;
    } catch (error) {
      console.error('Failed to create observation:', error);
      return null;
    }
  }

  async updateObservation(obsId, updates) {
    try {
      await this.app.apiCall(`/projects/${this.projectId}/observations/${obsId}`, {
        method: 'PUT',
        body: updates
      });
    } catch (error) {
      console.error('Failed to update observation:', error);
    }
  }

  async deleteObservation(obsId, mode = 'break') {
    try {
      await this.app.apiCall(`/projects/${this.projectId}/observations/${obsId}`, {
        method: 'DELETE',
        body: { mode }
      });

      await this.reload();
      this.detailPanel.close();
    } catch (error) {
      if (error.message.includes('intermediate_node')) {
        return 'intermediate';
      }
      console.error('Failed to delete observation:', error);
      alert('Failed to delete observation: ' + error.message);
    }
  }

  async createLink(fromId, toId) {
    try {
      await this.app.apiCall(`/projects/${this.projectId}/links`, {
        method: 'POST',
        body: { from_id: fromId, to_id: toId }
      });

      await this.reload();
    } catch (error) {
      console.error('Failed to create link:', error);
    }
  }

  async deleteLink(fromId, toId) {
    try {
      await this.app.apiCall(`/projects/${this.projectId}/links`, {
        method: 'DELETE',
        body: { from_id: fromId, to_id: toId }
      });

      await this.reload();
      this.detailPanel.close();
    } catch (error) {
      console.error('Failed to delete link:', error);
    }
  }
}
