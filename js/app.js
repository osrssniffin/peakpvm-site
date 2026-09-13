/**
 * OSRS Time Machine - Main Application Orchestrator & Router
 */

class App {
  constructor() {
    this.currentView = 'home';
    this.activeFilter = 'all';
    this.init();
  }

  async init() {
    // Load database
    const loaded = await window.dataStore.loadAll();
    if (!loaded) {
      console.error('Failed to initialize database.');
      return;
    }

    // Setup Sound UI Toggle
    this.setupSoundToggle();

    // Setup Global Search
    this.setupSearchModal();

    // Setup Global Keyboard Shortcuts
    this.setupKeyboardShortcuts();

    // Render Scrubber on Home
    if (window.timelineUI) {
      window.timelineUI.renderScrubber('home-scrubber-container', year => {
        this.handleYearSelect(year);
      });
      window.timelineUI.renderScrubber('timeline-scrubber-container', year => {
        this.handleYearSelect(year);
      });
    }

    // Render Today in History
    const today = window.dataStore.getTodayInHistory();
    if (today && window.museumUI) {
      window.museumUI.renderTodayInHistory(today, 'today-in-history-container');
    }

    // Render Exhibits & Eras
    if (window.museumUI) {
      window.museumUI.renderExhibits(window.dataStore.exhibits, 'museum-exhibits-container');
      window.museumUI.renderEras(window.dataStore.eras, 'eras-grid-container');
    }

    // Render Comparisons
    if (window.comparisonUI) {
      window.comparisonUI.renderAllComparisons(window.dataStore.getAllComparisons(), 'comparisons-list-container');
    }

    // Render Entity Browse
    this.renderBrowseGrid();

    // Attach Filter Listeners
    this.setupFilterButtons();

    // Setup Random Warp Button
    this.setupRandomWarp();

    // Listen to hash changes (Routing)
    window.addEventListener('hashchange', () => this.handleRouting());

    // Initial route
    this.handleRouting();
  }

  handleRouting() {
    const hash = window.location.hash.replace('#', '');
    const params = new URLSearchParams(hash);

    if (params.has('entity')) {
      const entityId = params.get('entity');
      this.showEntityDetail(entityId);
    } else if (params.has('year')) {
      const yr = parseInt(params.get('year'), 10);
      this.showTimelineView(yr);
    } else if (hash.startsWith('browse')) {
      const filterType = params.get('type') || 'all';
      this.showBrowseView(filterType);
    } else if (hash === 'comparisons') {
      this.showView('comparisons');
    } else if (hash === 'museum' || hash === 'exhibits') {
      this.showView('museum');
    } else if (hash === 'timeline') {
      this.showTimelineView(null);
    } else {
      this.showView('home');
    }
  }

  showView(viewName) {
    this.currentView = viewName;
    document.querySelectorAll('.page-view').forEach(view => {
      view.classList.toggle('active', view.id === `view-${viewName}`);
    });

    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href') || '';
      link.classList.toggle('active', href.includes(viewName) || (viewName === 'home' && href === '#'));
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showEntityDetail(entityId) {
    const entity = window.dataStore.getEntityById(entityId);
    if (!entity) {
      this.showToast('Entity not found in archives');
      this.showView('home');
      return;
    }

    const container = document.getElementById('entity-detail-content');
    if (!container) return;

    const events = window.dataStore.getEventsForEntity(entityId);
    const comps = window.dataStore.getComparisonByEntity(entityId);

    let html = `
      <div class="osrs-card" style="margin-bottom: 2rem;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1.5rem;">
          <div style="display:flex; align-items:center; gap:1.25rem;">
            <div class="entity-avatar-box" style="width:68px; height:68px; font-size:2.5rem;">
              ${entity.icon || '⚔️'}
            </div>
            <div>
              <div style="display:flex; gap:0.5rem; margin-bottom:0.35rem;">
                <span class="badge badge-era">${entity.releaseEra.replace('-era', '').toUpperCase()}</span>
                <span class="badge badge-rework">${entity.category}</span>
              </div>
              <h1 style="font-size:2rem; margin-bottom:0.35rem;">${entity.name}</h1>
              <p class="text-secondary" style="font-size:0.95rem;">Released: <strong>${entity.releaseDate}</strong></p>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.5rem;">
            <button class="btn-osrs btn-osrs-gold" id="btn-share-link">
              🔗 Share Entry
            </button>
            <span class="volatility-pill">⚡ Volatility Index: ${entity.volatilityScore}/100</span>
          </div>
        </div>
        <div style="margin-top:1.5rem; font-size:1.05rem; color:var(--text-primary); line-height:1.6;">
          ${entity.summary || entity.shortDescription}
        </div>
      </div>
    `;

    // Comparisons if present
    if (comps && comps.length > 0) {
      html += `
        <h2 style="font-size:1.4rem; margin: 2rem 0 1rem;">⚖️ Before vs After Evolution</h2>
        <div id="entity-comps-box"></div>
      `;
    }

    // Timeline Events
    html += `
      <h2 style="font-size:1.4rem; margin: 2.5rem 0 1rem;">📜 Chronological Patch History (${events.length} Updates)</h2>
      <div id="entity-events-feed"></div>
    `;

    container.innerHTML = html;

    // Render sub-components
    if (comps && comps.length > 0 && window.comparisonUI) {
      window.comparisonUI.renderAllComparisons(comps, 'entity-comps-box');
    }

    if (window.timelineUI) {
      window.timelineUI.renderVerticalFeed(events, 'entity-events-feed');
    }

    // Share button listener
    const shareBtn = document.getElementById('btn-share-link');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(window.location.href);
        this.showToast('Copied permanent link to clipboard!');
        if (window.soundFx) window.soundFx.playClick();
      });
    }

    this.showView('entity-detail');
  }

  showTimelineView(year) {
    this.showView('timeline');
    if (window.timelineUI) {
      window.timelineUI.setActiveYear(year);
      const events = year ? window.dataStore.getEventsByYear(year) : window.dataStore.timelineEvents;
      window.timelineUI.renderVerticalFeed(events, 'global-timeline-feed');
    }
  }

  showBrowseView(filterType = 'all') {
    this.activeFilter = filterType;
    this.renderBrowseGrid();
    this.showView('browse');
  }

  renderBrowseGrid() {
    const container = document.getElementById('browse-entities-grid');
    if (!container) return;

    let list = window.dataStore.entities;

    if (this.activeFilter !== 'all') {
      if (this.activeFilter === 'most-changed') {
        list = window.dataStore.getMostChanged(100);
      } else {
        list = list.filter(e => e.type.toLowerCase() === this.activeFilter || e.tags.includes(this.activeFilter));
      }
    }

    let html = '';
    list.forEach(item => {
      html += `
        <div class="entity-card" data-entity-id="${item.id}">
          <div class="entity-card-top">
            <div class="entity-avatar-box">${item.icon || '⚔️'}</div>
            <div>
              <div class="entity-category">${item.category}</div>
              <h3 class="entity-name">${item.name}</h3>
            </div>
          </div>
          <p class="entity-description">${item.shortDescription}</p>
          <div class="entity-card-bottom">
            <span>📅 ${item.releaseDate}</span>
            <span class="volatility-pill">⚡ ${item.changeCount} Updates</span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.entity-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.entityId;
        window.location.hash = `#entity=${id}`;
        if (window.soundFx) window.soundFx.playClick();
      });
    });
  }

  setupFilterButtons() {
    document.querySelectorAll('.filter-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.dataset.filter || 'all';
        this.renderBrowseGrid();
        if (window.soundFx) window.soundFx.playClick();
      });
    });
  }

  handleYearSelect(year) {
    if (year) {
      window.location.hash = `#year=${year}`;
    } else {
      window.location.hash = `#timeline`;
    }
  }

  setupSoundToggle() {
    const btn = document.getElementById('btn-sound-toggle');
    if (!btn) return;

    const updateLabel = () => {
      btn.innerHTML = window.soundFx.enabled ? '🔊 Audio ON' : '🔈 Audio OFF';
    };
    updateLabel();

    btn.addEventListener('click', () => {
      window.soundFx.toggle();
      updateLabel();
      this.showToast(window.soundFx.enabled ? 'Retro Audio Enabled' : 'Audio Muted');
    });
  }

  setupRandomWarp() {
    const warpButtons = document.querySelectorAll('.btn-random-warp');
    warpButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const rand = window.dataStore.getRandomEntity();
        if (rand) {
          if (window.soundFx) window.soundFx.playWarp();
          this.showToast(`Time Warping to ${rand.name}...`);
          window.location.hash = `#entity=${rand.id}`;
        }
      });
    });
  }

  setupSearchModal() {
    const overlay = document.getElementById('search-modal-overlay');
    const input = document.getElementById('global-search-input');
    const resultsContainer = document.getElementById('search-results-list');
    const triggerBtns = document.querySelectorAll('.btn-search-trigger');

    const openSearch = () => {
      if (overlay) {
        overlay.classList.add('active');
        if (input) {
          input.value = '';
          input.focus();
          this.renderSearchResults('', resultsContainer);
        }
        if (window.soundFx) window.soundFx.playClick();
      }
    };

    const closeSearch = () => {
      if (overlay) overlay.classList.remove('active');
    };

    triggerBtns.forEach(btn => btn.addEventListener('click', openSearch));

    if (overlay) {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeSearch();
      });
    }

    if (input && resultsContainer) {
      input.addEventListener('input', e => {
        this.renderSearchResults(e.target.value, resultsContainer);
      });
    }

    this.closeSearch = closeSearch;
  }

  renderSearchResults(query, container) {
    if (!query || !query.trim()) {
      container.innerHTML = `
        <li style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">
          Type to search items, bosses, patches, or historic mechanics...
        </li>
      `;
      return;
    }

    const { entities, events } = window.dataStore.search(query);

    if (entities.length === 0 && events.length === 0) {
      container.innerHTML = `
        <li style="padding:1rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">
          No matching archive entries found for "${query}".
        </li>
      `;
      return;
    }

    let html = '';

    entities.forEach(item => {
      html += `
        <li class="search-result-item" data-type="entity" data-id="${item.id}">
          <div class="search-item-info">
            <div class="search-item-icon">${item.icon || '⚔️'}</div>
            <div>
              <div class="search-item-title">${item.name}</div>
              <div class="search-item-sub">${item.category} • ${item.releaseDate}</div>
            </div>
          </div>
          <span class="badge badge-era">${item.type.toUpperCase()}</span>
        </li>
      `;
    });

    events.slice(0, 5).forEach(evt => {
      html += `
        <li class="search-result-item" data-type="event" data-entity-id="${evt.entityId}">
          <div class="search-item-info">
            <div class="search-item-icon">📜</div>
            <div>
              <div class="search-item-title">${evt.title}</div>
              <div class="search-item-sub">${evt.date} • ${evt.category}</div>
            </div>
          </div>
          <span class="badge badge-rework">PATCH</span>
        </li>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        const type = el.dataset.type;
        const targetId = type === 'entity' ? el.dataset.id : el.dataset.entityId;
        window.location.hash = `#entity=${targetId}`;
        this.closeSearch();
        if (window.soundFx) window.soundFx.playClick();
      });
    });
  }

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const overlay = document.getElementById('search-modal-overlay');
        if (overlay && overlay.classList.contains('active')) {
          this.closeSearch();
        } else {
          document.querySelector('.btn-search-trigger')?.click();
        }
      } else if (e.key === 'Escape') {
        this.closeSearch();
      }
    });
  }

  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>⚔️</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
