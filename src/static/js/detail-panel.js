/**
 * Detail Panel - Right side panel for editing observations and links
 */

export class DetailPanel {
  constructor(workspace) {
    this.workspace = workspace;
    this.currentType = null; // 'observation' or 'link'
    this.currentId = null;
    this.saveTimeout = null;
    this.isEditing = false;

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Close button
    document.getElementById('close-detail-panel').addEventListener('click', () => {
      this.close();
    });

    // Summary field auto-save
    const summaryField = document.getElementById('detail-summary');
    summaryField.addEventListener('input', () => {
      this.scheduleSave();
    });

    // Description markdown toggle
    const descContent = document.getElementById('detail-description');
    const descEdit = document.getElementById('detail-description-edit');

    descContent.addEventListener('click', () => {
      descEdit.value = this.workspace.getObservation(this.currentId).description;
      descContent.classList.add('hidden');
      descEdit.classList.remove('hidden');
      descEdit.focus();
    });

    descEdit.addEventListener('blur', () => {
      this.saveObservationField('description', descEdit.value);
      this.renderDescription(descEdit.value);
      descEdit.classList.add('hidden');
      descContent.classList.remove('hidden');
    });

    // Solution markdown toggle
    const solContent = document.getElementById('detail-solution');
    const solEdit = document.getElementById('detail-solution-edit');

    solContent.addEventListener('click', () => {
      solEdit.value = this.workspace.getObservation(this.currentId).solution || '';
      solContent.classList.add('hidden');
      solEdit.classList.remove('hidden');
      solEdit.focus();
    });

    solEdit.addEventListener('blur', () => {
      this.saveObservationField('solution', solEdit.value);
      this.renderSolution(solEdit.value);
      solEdit.classList.add('hidden');
      solContent.classList.remove('hidden');
    });

    // Attachments
    document.getElementById('add-attachment').addEventListener('click', () => {
      document.getElementById('attachment-file-input').click();
    });

    document.getElementById('attachment-file-input').addEventListener('change', (e) => {
      this.uploadAttachment(e.target.files[0]);
    });

    // Comments
    document.getElementById('add-comment').addEventListener('click', () => {
      this.addComment();
    });

    // Delete observation control
    this.setupDeleteControl(
      'delete-observation-btn',
      'delete-observation-confirm-label',
      'delete-observation-cancel',
      () => this.deleteObservation()
    );

    // Delete link control
    this.setupDeleteControl(
      'delete-link-btn',
      'delete-link-confirm-label',
      'delete-link-cancel',
      () => this.deleteLink()
    );
  }

  setupDeleteControl(btnId, labelId, cancelId, deleteCallback) {
    const btn = document.getElementById(btnId);
    const label = document.getElementById(labelId);
    const cancel = document.getElementById(cancelId);

    let confirmMode = false;

    btn.addEventListener('click', () => {
      if (!confirmMode) {
        // First click - show confirmation
        confirmMode = true;
        label.classList.remove('hidden');
        cancel.classList.remove('hidden');
      } else {
        // Second click - execute delete
        deleteCallback();
        confirmMode = false;
      }
    });

    cancel.addEventListener('click', () => {
      confirmMode = false;
      label.classList.add('hidden');
      cancel.classList.add('hidden');
    });
  }

  open(type, id) {
    this.currentType = type;
    this.currentId = id;

    document.getElementById('detail-panel').classList.remove('hidden');

    if (type === 'observation') {
      this.showObservationDetail(id);
    } else if (type === 'link') {
      this.showLinkDetail(id);
    }
  }

  close() {
    document.getElementById('detail-panel').classList.add('hidden');
    this.currentType = null;
    this.currentId = null;

    // Reset delete confirmations
    ['delete-observation', 'delete-link'].forEach(prefix => {
      document.getElementById(`${prefix}-confirm-label`).classList.add('hidden');
      document.getElementById(`${prefix}-cancel`).classList.add('hidden');
    });
  }

  showObservationDetail(obsId) {
    document.getElementById('observation-detail').classList.remove('hidden');
    document.getElementById('link-detail').classList.add('hidden');

    const obs = this.workspace.getObservation(obsId);

    // Summary
    document.getElementById('detail-summary').value = obs.summary;

    // Description
    this.renderDescription(obs.description);

    // Attachments
    this.renderAttachments(obs.attachments);

    // Comments
    this.renderComments(obs.comments);

    // Solution
    this.renderSolution(obs.solution);
  }

  showLinkDetail(linkData) {
    document.getElementById('observation-detail').classList.add('hidden');
    document.getElementById('link-detail').classList.remove('hidden');

    const fromObs = this.workspace.getObservation(linkData.from);
    const toObs = this.workspace.getObservation(linkData.to);

    document.getElementById('link-from-card').innerHTML = `
            <h4>${this.escapeHtml(fromObs.summary)}</h4>
            <p>${this.escapeHtml(this.truncate(fromObs.description, 100))}</p>
        `;

    document.getElementById('link-to-card').innerHTML = `
            <h4>${this.escapeHtml(toObs.summary)}</h4>
            <p>${this.escapeHtml(this.truncate(toObs.description, 100))}</p>
        `;
  }

  renderDescription(markdown) {
    const html = marked.parse(markdown || '');
    document.getElementById('detail-description').innerHTML = html;
  }

  renderSolution(markdown) {
    const html = marked.parse(markdown || '');
    document.getElementById('detail-solution').innerHTML = html;
  }

  renderAttachments(attachments) {
    const list = document.getElementById('detail-attachments');
    list.innerHTML = '';

    attachments.forEach(filename => {
      const item = document.createElement('li');
      item.className = 'attachment-item';
      item.innerHTML = `
                <a href="/api/projects/${this.workspace.projectId}/attachments/${filename}" target="_blank">${this.escapeHtml(filename)}</a>
                <button class="btn-icon btn-delete attachment-delete" data-filename="${filename}"><i class="fa-solid fa-xmark"></i></button>
            `;

      item.querySelector('.attachment-delete').addEventListener('click', () => {
        this.deleteAttachment(filename);
      });

      list.appendChild(item);
    });
  }

  renderComments(comments) {
    const container = document.getElementById('detail-comments');
    container.innerHTML = '';

    comments.forEach((comment, index) => {
      const card = document.createElement('div');
      card.className = 'comment-card';
      const html = marked.parse(comment);
      card.innerHTML = `
                ${html}
                <button class="btn-icon btn-delete comment-delete" data-index="${index}"><i class="fa-solid fa-xmark"></i></button>
            `;

      card.querySelector('.comment-delete').addEventListener('click', () => {
        this.deleteComment(index);
      });

      container.appendChild(card);
    });
  }

  scheduleSave() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveCurrentObservation();
    }, 500);
  }

  async saveCurrentObservation() {
    if (this.currentType !== 'observation') return;

    const summary = document.getElementById('detail-summary').value;
    await this.workspace.updateObservation(this.currentId, { summary });
    await this.workspace.reload();
  }

  async saveObservationField(field, value) {
    if (this.currentType !== 'observation') return;

    await this.workspace.updateObservation(this.currentId, { [field]: value });
    await this.workspace.reload();
  }

  async uploadAttachment(file) {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await this.workspace.app.apiCall(`/projects/${this.workspace.projectId}/attachments`, {
        method: 'POST',
        body: formData
      });

      const obs = this.workspace.getObservation(this.currentId);
      obs.attachments.push(file.name);
      await this.saveObservationField('attachments', obs.attachments);
      this.renderAttachments(obs.attachments);
    } catch (error) {
      alert('Failed to upload attachment: ' + error.message);
    }
  }

  async deleteAttachment(filename) {
    try {
      await this.workspace.app.apiCall(`/projects/${this.workspace.projectId}/attachments/${filename}`, {
        method: 'DELETE'
      });

      const obs = this.workspace.getObservation(this.currentId);
      obs.attachments = obs.attachments.filter(f => f !== filename);
      await this.saveObservationField('attachments', obs.attachments);
      this.renderAttachments(obs.attachments);
    } catch (error) {
      alert('Failed to delete attachment: ' + error.message);
    }
  }

  async addComment() {
    const obs = this.workspace.getObservation(this.currentId);
    obs.comments.push('New comment');
    await this.saveObservationField('comments', obs.comments);
    this.renderComments(obs.comments);
  }

  async deleteComment(index) {
    const obs = this.workspace.getObservation(this.currentId);
    obs.comments.splice(index, 1);
    await this.saveObservationField('comments', obs.comments);
    this.renderComments(obs.comments);
  }

  async deleteObservation() {
    const result = await this.workspace.deleteObservation(this.currentId);

    if (result === 'intermediate') {
      this.showDeleteModeDialog();
    }
  }

  showDeleteModeDialog() {
    const dialog = document.getElementById('delete-mode-dialog');
    dialog.classList.remove('hidden');

    const handleChoice = async (mode) => {
      await this.workspace.deleteObservation(this.currentId, mode);
      dialog.classList.add('hidden');
    };

    document.getElementById('delete-mode-stretch').onclick = () => handleChoice('stretch');
    document.getElementById('delete-mode-break').onclick = () => handleChoice('break');
    document.getElementById('delete-mode-cancel').onclick = () => {
      dialog.classList.add('hidden');
    };
  }

  triggerDeleteObservation() {
    document.getElementById('delete-observation-btn').click();
  }

  async deleteLink() {
    if (this.currentType !== 'link') return;

    await this.workspace.deleteLink(this.currentId.from, this.currentId.to);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  truncate(text, maxLength) {
    if (!text) return '';
    const stripped = text.replace(/[#*_`\[\]()]/g, '');
    return stripped.length > maxLength ? stripped.substring(0, maxLength) + '...' : stripped;
  }
}
