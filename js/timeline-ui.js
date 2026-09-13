/**
 * OSRS Time Machine - Timeline & Scrubber UI Engine
 */

class TimelineUI {
  constructor() {
    this.years = [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
    this.activeYear = null;
  }

  renderScrubber(containerId, onYearSelect) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = `
      <div class="timeline-scrubber-wrapper">
        <div class="scrubber-header">
          <div class="scrubber-title">
            <span>⏳</span>
            <span>OSRS Chronological Scrubber (2013 — Present)</span>
          </div>
          <div class="scrubber-controls">
            <button class="btn-osrs btn-osrs-stone" id="btn-scrub-all" style="font-size: 0.75rem; padding: 0.4rem 0.8rem;">
              Show All Eras
            </button>
          </div>
        </div>
        <div class="timeline-track-container">
          <div class="timeline-track-line"></div>
          <div class="timeline-track-progress" id="timeline-progress-bar" style="width: 100%;"></div>
          <div class="timeline-nodes-row">
    `;

    this.years.forEach((yr, index) => {
      html += `
        <button class="timeline-year-node ${this.activeYear === yr ? 'active' : ''}" data-year="${yr}">
          <div class="node-bullet"></div>
          <span class="node-year-label">${yr}</span>
        </button>
      `;
    });

    html += `
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Attach click events
    container.querySelectorAll('.timeline-year-node').forEach(node => {
      node.addEventListener('click', () => {
        const yr = parseInt(node.dataset.year, 10);
        this.setActiveYear(yr);
        if (window.soundFx) window.soundFx.playClick();
        if (onYearSelect) onYearSelect(yr);
      });
    });

    const scrubAllBtn = container.querySelector('#btn-scrub-all');
    if (scrubAllBtn) {
      scrubAllBtn.addEventListener('click', () => {
        this.clearActiveYear();
        if (window.soundFx) window.soundFx.playClick();
        if (onYearSelect) onYearSelect(null);
      });
    }
  }

  setActiveYear(year) {
    this.activeYear = year;
    const nodes = document.querySelectorAll('.timeline-year-node');
    nodes.forEach(n => {
      const yr = parseInt(n.dataset.year, 10);
      n.classList.toggle('active', yr === year);
    });

    const progressBar = document.getElementById('timeline-progress-bar');
    if (progressBar && year) {
      const index = this.years.indexOf(year);
      const pct = ((index + 1) / this.years.length) * 100;
      progressBar.style.width = `${pct}%`;
    }
  }

  clearActiveYear() {
    this.activeYear = null;
    document.querySelectorAll('.timeline-year-node').forEach(n => n.classList.remove('active'));
    const progressBar = document.getElementById('timeline-progress-bar');
    if (progressBar) progressBar.style.width = '100%';
  }

  renderVerticalFeed(events, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!events || events.length === 0) {
      container.innerHTML = `
        <div class="osrs-card" style="text-align: center; padding: 3rem;">
          <p class="text-secondary">No recorded timeline events match the selected criteria.</p>
        </div>
      `;
      return;
    }

    let html = '<div class="chronology-feed">';

    events.forEach(evt => {
      const entity = window.dataStore ? window.dataStore.getEntityById(evt.entityId) : null;
      const categoryBadge = this.getCategoryBadge(evt.category, evt.categoryLabel || evt.category);

      html += `
        <div class="chronology-item" id="${evt.id}">
          <div class="chronology-node-point"></div>
          <div class="chronology-card">
            <div class="event-header">
              <div class="event-date-row">
                <span>📅 ${evt.date}</span>
                ${entity ? `<a href="#entity=${entity.id}" class="badge badge-era">${entity.icon || '⚔️'} ${entity.name}</a>` : ''}
              </div>
              ${categoryBadge}
            </div>
            <h3 class="event-title">${evt.title}</h3>
            <p class="event-summary">${evt.summary}</p>
            ${evt.details ? `<div class="event-details">${evt.details}</div>` : ''}
            
            ${evt.before && evt.after ? `
              <div class="event-diff-box">
                <div class="diff-panel diff-before">
                  <span class="diff-label">Before Update</span>
                  <div>${evt.before}</div>
                </div>
                <div class="diff-panel diff-after">
                  <span class="diff-label">After Update</span>
                  <div>${evt.after}</div>
                </div>
              </div>
            ` : ''}

            ${evt.quote ? `
              <blockquote class="event-quote">
                "${evt.quote}"
                ${evt.quoteAuthor ? `<span class="quote-author">— ${evt.quoteAuthor}</span>` : ''}
              </blockquote>
            ` : ''}
          </div>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;
  }

  getCategoryBadge(category, label) {
    const cat = (category || '').toLowerCase();
    let badgeClass = 'badge-qol';
    if (cat.includes('buff')) badgeClass = 'badge-buff';
    else if (cat.includes('nerf')) badgeClass = 'badge-nerf';
    else if (cat.includes('rebalance') || cat.includes('rework')) badgeClass = 'badge-rebalance';
    else if (cat.includes('drop')) badgeClass = 'badge-droptable';
    else if (cat.includes('release')) badgeClass = 'badge-release';

    return `<span class="badge ${badgeClass}">${label}</span>`;
  }
}

window.timelineUI = new TimelineUI();
