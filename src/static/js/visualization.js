/**
 * Visualization module - D3.js graph rendering with HTML cards and SVG links
 * 
 * Architecture:
 * - Cards are HTML elements positioned absolutely over the visualization area
 * - Links are SVG paths rendered behind the cards
 * - D3 force simulation positions both
 */

export class Visualization {
  constructor(workspace) {
    this.workspace = workspace;
    this.observations = [];
    this.selectedNode = null;
    this.selectedLink = null;
    this.linkMode = null; // { fromId: number } when in link mode

    this.svg = d3.select('#graph-svg');
    this.container = document.getElementById('visualization-area');
    this.cardsContainer = this.createCardsContainer();
    
    this.width = 2000;
    this.height = 2000;
    this.cards = new Map(); // nodeId -> HTML element

    this.setupEventListeners();
  }

  createCardsContainer() {
    // Container for HTML cards, positioned over SVG
    let container = document.getElementById('cards-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'cards-container';
      container.style.position = 'absolute';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '2000px';
      container.style.height = '2000px';
      container.style.pointerEvents = 'none'; // Allow clicks to pass through to SVG
      this.container.appendChild(container);
    }
    return container;
  }

  setupEventListeners() {
    // Double-click to create observation
    this.svg.on('dblclick', (event) => {
      if (event.target.tagName === 'svg') {
        const [x, y] = d3.pointer(event);
        this.createObservationAt(x, y);
      }
    });

    // Click on empty space to deselect
    this.svg.on('click', (event) => {
      if (event.target.tagName === 'svg') {
        this.cancelLinkMode();
        this.deselectAll();
      }
    });
  }

  async createObservationAt(x, y) {
    const newObs = await this.workspace.createObservation();
    if (newObs) {
      this.selectNode(newObs.id);
      this.workspace.detailPanel.open('observation', newObs.id);
      // Focus summary field
      setTimeout(() => {
        document.getElementById('detail-summary').focus();
        document.getElementById('detail-summary').select();
      }, 100);
    }
  }

  async render(observations) {
    this.observations = observations;

    // Show/hide empty state
    const emptyState = document.getElementById('empty-state');
    if (observations.length === 0) {
      emptyState.classList.remove('hidden');
      return;
    } else {
      emptyState.classList.add('hidden');
    }

    // Build links data
    const links = [];
    observations.forEach(obs => {
      obs.caused_by.forEach(causeId => {
        links.push({
          source: causeId,
          target: obs.id
        });
      });
    });

    // Use ELK layout algorithm
    await this.layoutWithELK(observations, links);

    // Build adjacency set for direct connections
    const adjacencySet = new Set();
    links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      adjacencySet.add(`${sourceId}-${targetId}`);
      adjacencySet.add(`${targetId}-${sourceId}`);
    });

    // Clear previous SVG elements
    this.svg.selectAll('g').remove();

    // Create SVG group for links only
    const linkGroup = this.svg.append('g').attr('class', 'links');

    // Render links as double lines with arrowheads inside each container
    const linkContainers = linkGroup.selectAll('.link-container')
      .data(links)
      .enter()
      .append('g')
      .attr('class', 'link-container')
      .on('click', (event, d) => {
        event.stopPropagation();
        this.selectLink(d.source, d.target);
      });

    // First line of the double track
    const linkElements1 = linkContainers.append('path')
      .attr('class', 'link link-track-1');

    // Second line of the double track
    const linkElements2 = linkContainers.append('path')
      .attr('class', 'link link-track-2');

    // Render chevron arrowheads as filled polygons (inside each link-container)
    const arrowElements = linkContainers.append('polygon')
      .attr('class', 'arrowhead');

    // Create/update HTML cards
    this.updateCards(observations);

    // Update visualization after layout
    this.updateVisualization(observations, links, linkElements1, linkElements2, arrowElements);
  }

  async layoutWithELK(observations, links) {
    const elk = new ELK();

    // Prepare ELK graph format
    const elkGraph = {
      id: "root",
      layoutOptions: {
        'elk.algorithm': 'disco',
        'elk.disco.componentCompaction.componentLayoutAlgorithm': 'stress',
        'elk.spacing.nodeNode': '150',
        'elk.stress.desiredEdgeLength': '300',
        'elk.stress.dimension': 'TWO_DIMENSIONAL'
      },
      children: observations.map(obs => ({
        id: obs.id.toString(),
        width: 180,
        height: 120
      })),
      edges: links.map((link, i) => ({
        id: `e${i}`,
        sources: [link.source.toString()],
        targets: [link.target.toString()]
      }))
    };

    // Run ELK layout
    const layouted = await elk.layout(elkGraph);

    // Apply positions to observations
    const nodeMap = new Map();
    layouted.children.forEach(child => {
      nodeMap.set(child.id, { x: child.x + child.width / 2, y: child.y + child.height / 2 });
    });

    const padding = 100;
    observations.forEach(obs => {
      const pos = nodeMap.get(obs.id.toString());
      if (pos) {
        obs.x = pos.x + padding;
        obs.y = pos.y + padding;
      }
    });

    // Calculate bounds and resize canvas
    if (observations.length > 0) {
      const xs = observations.map(obs => obs.x);
      const ys = observations.map(obs => obs.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      // Add padding around the diagram
      const cardWidth = 180;
      const cardHeight = 120;
      this.width = Math.max(2000, maxX - minX + cardWidth + padding * 2);
      this.height = Math.max(2000, maxY - minY + cardHeight + padding * 2);

      // Update SVG and cards container dimensions
      this.svg.attr('width', this.width).attr('height', this.height);
      this.cardsContainer.style.width = `${this.width}px`;
      this.cardsContainer.style.height = `${this.height}px`;
    }
  }

  updateVisualization(observations, links, linkElements1, linkElements2, arrowElements) {
    // Track separation distance
    const trackOffset = 6;
    
    // Helper function to calculate curve data
    const getCurveData = (d) => {
      const sourceNode = observations.find(obs => obs.id === d.source);
      const targetNode = observations.find(obs => obs.id === d.target);
      
      const midX = (sourceNode.x + targetNode.x) / 2;
      const midY = (sourceNode.y + targetNode.y) / 2;
      
      const dx = targetNode.x - sourceNode.x;
      const dy = targetNode.y - sourceNode.y;
      const linkLen = Math.sqrt(dx * dx + dy * dy);
      
      const perpX = -dy / linkLen;
      const perpY = dx / linkLen;
      
      const graphCenterX = this.width / 2;
      const graphCenterY = this.height / 2;
      const toGraphCenterX = graphCenterX - midX;
      const toGraphCenterY = graphCenterY - midY;
      
      const dot = perpX * toGraphCenterX + perpY * toGraphCenterY;
      const outwardSign = dot > 0 ? -1 : 1;
      
      const offsetAmount = Math.min(linkLen * 0.15, 60);
      const curveOffsetX = perpX * offsetAmount * outwardSign;
      const curveOffsetY = perpY * offsetAmount * outwardSign;
      
      const controlX = midX + curveOffsetX;
      const controlY = midY + curveOffsetY;
      
      return { sourceNode, targetNode, midX, midY, controlX, controlY, perpX, perpY, linkLen };
    };
    
    // Helper to create offset path
    const createOffsetPath = (d, offset) => {
      const curve = getCurveData(d);
      const offX = curve.perpX * offset;
      const offY = curve.perpY * offset;
      
      return `M${curve.sourceNode.x + offX},${curve.sourceNode.y + offY}Q${curve.controlX + offX},${curve.controlY + offY} ${curve.targetNode.x + offX},${curve.targetNode.y + offY}`;
    };
    
    // Update both track paths
    linkElements1.attr('d', d => createOffsetPath(d, trackOffset));
    linkElements2.attr('d', d => createOffsetPath(d, -trackOffset));
      
    // Store curve data for arrow calculation
    links.forEach(d => {
      const curve = getCurveData(d);
      d.controlX = curve.controlX;
      d.controlY = curve.controlY;
      d.sourceNode = curve.sourceNode;
      d.targetNode = curve.targetNode;
    });
    
    // Update chevron arrowhead positions
    arrowElements.attr('points', d => {
      const t = 0.5;
      const t1 = 1 - t;
      
      const arrowX = t1*t1*d.sourceNode.x + 2*t1*t*d.controlX + t*t*d.targetNode.x;
      const arrowY = t1*t1*d.sourceNode.y + 2*t1*t*d.controlY + t*t*d.targetNode.y;
      
      const tangentX = 2*t1*(d.controlX - d.sourceNode.x) + 2*t*(d.targetNode.x - d.controlX);
      const tangentY = 2*t1*(d.controlY - d.sourceNode.y) + 2*t*(d.targetNode.y - d.controlY);
      const tangentLen = Math.sqrt(tangentX*tangentX + tangentY*tangentY);
      
      const dirX = tangentX / tangentLen;
      const dirY = tangentY / tangentLen;
      
      const perpX = -dirY;
      const perpY = dirX;
      
      const chevronLength = 20;
      const chevronWidth = 18;
      
      const tipX = arrowX + dirX * 10;
      const tipY = arrowY + dirY * 10;
      
      const wingBackX = arrowX - dirX * chevronLength;
      const wingBackY = arrowY - dirY * chevronLength;
      
      const wing1X = wingBackX + perpX * chevronWidth;
      const wing1Y = wingBackY + perpY * chevronWidth;
      const wing2X = wingBackX - perpX * chevronWidth;
      const wing2Y = wingBackY - perpY * chevronWidth;
      
      return `${wing1X},${wing1Y} ${tipX},${tipY} ${wing2X},${wing2Y}`;
    });

    // Update HTML card positions
    observations.forEach(obs => {
      const card = this.cards.get(obs.id);
      if (card) {
        card.style.left = `${obs.x - 90}px`;
        card.style.top = `${obs.y - 60}px`;
      }
    });
  }

  updateCards(observations) {
    const existingIds = new Set(observations.map(obs => obs.id));
    
    // Remove cards that no longer exist
    for (const [id, card] of this.cards) {
      if (!existingIds.has(id)) {
        card.remove();
        this.cards.delete(id);
      }
    }

    // Create or update cards
    observations.forEach(obs => {
      let card = this.cards.get(obs.id);
      
      if (!card) {
        card = this.createCard(obs);
        this.cards.set(obs.id, card);
        this.cardsContainer.appendChild(card);
      } else {
        this.updateCardContent(card, obs);
      }
    });
  }

  createCard(obs) {
    const card = document.createElement('div');
    card.className = 'observation-card';
    card.dataset.id = obs.id;
    card.style.pointerEvents = 'auto';

    // Card content
    const content = document.createElement('div');
    content.className = 'card-content';
    
    const summary = document.createElement('div');
    summary.className = 'card-summary';
    summary.textContent = this.truncate(obs.summary, 60) || 'New Observation';
    
    const description = document.createElement('div');
    description.className = 'card-description';
    description.textContent = this.truncate(this.stripMarkdown(obs.description), 80);
    
    content.appendChild(summary);
    content.appendChild(description);
    card.appendChild(content);

    // Link button container (top center, sticking out)
    const linkBtnContainer = document.createElement('div');
    linkBtnContainer.className = 'card-link-button-container';
    
    const linkBtn = document.createElement('button');
    linkBtn.className = 'card-btn card-link-btn';
    linkBtn.innerHTML = '<i class="fa-solid fa-arrows-turn-to-dots"></i>';
    linkBtn.title = 'Create link (drag to another card)';
    linkBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.startLinkMode(obs.id);
    });
    
    linkBtnContainer.appendChild(linkBtn);
    card.appendChild(linkBtnContainer);
    
    // Delete button container (bottom center, sticking out)
    const deleteBtnContainer = document.createElement('div');
    deleteBtnContainer.className = 'card-delete-button-container';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'card-btn card-delete-btn';
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
    deleteBtn.title = 'Delete observation';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.workspace.detailPanel.triggerDeleteObservation();
    });
    
    deleteBtnContainer.appendChild(deleteBtn);
    card.appendChild(deleteBtnContainer);

    // Click handler
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.linkMode) {
        this.completeLinkCreation(obs.id);
      } else {
        this.selectNode(obs.id);
      }
    });

    // Make link button draggable for link creation
    this.setupLinkDrag(linkBtn, obs.id, card);

    return card;
  }

  setupLinkDrag(linkBtn, obsId, card) {
    let isDragging = false;
    
    linkBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      this.startLinkMode(obsId);
      
      const onMouseMove = (e) => {
        // Visual feedback could be added here
      };
      
      const onMouseUp = (e) => {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        // Find if we're over another card
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const targetCard = target?.closest('.observation-card');
        if (targetCard && targetCard !== card) {
          const targetId = parseInt(targetCard.dataset.id);
          this.completeLinkCreation(targetId);
        } else {
          this.cancelLinkMode();
        }
      };
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  updateCardContent(card, obs) {
    const summary = card.querySelector('.card-summary');
    const description = card.querySelector('.card-description');
    
    if (summary) {
      summary.textContent = this.truncate(obs.summary, 60) || 'New Observation';
    }
    if (description) {
      description.textContent = this.truncate(this.stripMarkdown(obs.description), 80);
    }
  }

  selectNode(nodeId) {
    this.selectedNode = nodeId;
    this.selectedLink = null;

    // Update card selection classes
    this.cards.forEach((card, id) => {
      if (id === nodeId) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });

    // Update SVG link selection
    d3.selectAll('.link-container').classed('selected', false);
    d3.selectAll('.arrowhead').classed('selected', false);

    this.workspace.detailPanel.open('observation', nodeId);
  }

  selectLink(fromId, toId) {
    this.selectedNode = null;
    this.selectedLink = { from: fromId, to: toId };

    // Remove card selection
    this.cards.forEach((card) => {
      card.classList.remove('selected');
    });

    // Update SVG link selection
    d3.selectAll('.link-container').classed('selected', false);
    d3.selectAll('.arrowhead').classed('selected', false);
    d3.selectAll('.link-container')
      .filter(d => d.source === fromId && d.target === toId)
      .classed('selected', true);
    d3.selectAll('.arrowhead')
      .filter(d => d.source === fromId && d.target === toId)
      .classed('selected', true);

    this.workspace.detailPanel.open('link', { from: fromId, to: toId });
  }

  deselectAll() {
    this.selectedNode = null;
    this.selectedLink = null;

    // Remove all card selections
    this.cards.forEach((card) => {
      card.classList.remove('selected');
    });

    // Remove all SVG link selections
    d3.selectAll('.link-container').classed('selected', false);
    d3.selectAll('.arrowhead').classed('selected', false);

    // Close detail panel
    this.workspace.detailPanel.close();
  }

  startLinkMode(fromId) {
    this.linkMode = { fromId };

    // Find observations already caused by fromId (can't link again)
    const alreadyLinkedIds = new Set(this.observations
      .filter(obs => obs.caused_by.includes(fromId))
      .map(obs => obs.id));

    // Find observations that cause fromId (can't create bidirectional link)
    const fromObservation = this.observations.find(obs => obs.id === fromId);
    const causingFromIds = new Set(fromObservation ? fromObservation.caused_by : []);

    // Visual feedback on cards
    this.cards.forEach((card, id) => {
      if (id === fromId || alreadyLinkedIds.has(id) || causingFromIds.has(id)) {
        card.classList.add('link-mode-dimmed');
      } else {
        card.classList.add('link-mode-available');
      }
    });
  }

  completeLinkCreation(toId) {
    if (!this.linkMode || this.linkMode.fromId === toId) {
      this.cancelLinkMode();
      return;
    }

    this.workspace.createLink(this.linkMode.fromId, toId);
    this.cancelLinkMode();
  }

  cancelLinkMode() {
    this.linkMode = null;
    this.cards.forEach((card) => {
      card.classList.remove('link-mode-available', 'link-mode-dimmed');
    });
  }

  truncate(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  stripMarkdown(text) {
    if (!text) return '';
    return text.replace(/[#*_`\[\]()]/g, '');
  }
}
