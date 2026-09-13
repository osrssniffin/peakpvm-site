/**
 * OSRS Time Machine - Museum & Nostalgia UI Engine
 */

class MuseumUI {
  renderExhibits(exhibits, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = '<div class="exhibits-grid">';

    exhibits.forEach(ex => {
      html += `
        <div class="exhibit-card" id="${ex.id}">
          <div class="exhibit-icon-header">${ex.icon || '🏛️'}</div>
          <div style="display:flex; gap:0.5rem; margin-bottom:0.6rem;">
            <span class="badge badge-era">${ex.year}</span>
            <span class="badge badge-rework">${ex.badge || ex.category}</span>
          </div>
          <h3 class="exhibit-title">${ex.title}</h3>
          <h4 class="exhibit-subtitle">${ex.subtitle}</h4>
          <p class="exhibit-summary">${ex.summary}</p>
          
          ${ex.keyTakeaways ? `
            <ul class="exhibit-takeaways">
              ${ex.keyTakeaways.map(t => `<li>${t}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;
  }

  renderEras(eras, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = '<div class="entity-grid">';

    eras.forEach(era => {
      html += `
        <div class="osrs-card" style="border-top: 3px solid ${era.color};">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
            <span class="badge badge-era">${era.years}</span>
          </div>
          <h3 style="font-size:1.2rem; color:var(--gold-100); margin-bottom:0.4rem;">${era.name}</h3>
          <p style="font-size:0.85rem; color:var(--gold-500); font-style:italic; margin-bottom:0.75rem;">"${era.tagline}"</p>
          <p style="font-size:0.85rem; color:var(--text-secondary); line-height:1.5; margin-bottom:1rem;">${era.description}</p>
          
          ${era.milestones ? `
            <ul style="list-style:none; display:flex; flex-direction:column; gap:0.4rem; font-size:0.8rem; color:var(--text-muted);">
              ${era.milestones.map(m => `<li>⚔️ ${m}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;
  }

  renderTodayInHistory(todayData, containerId) {
    const container = document.getElementById(containerId);
    if (!container || !todayData) return;

    const { event, entity } = todayData;

    container.innerHTML = `
      <div class="history-banner-widget">
        <div class="history-banner-content">
          <div class="history-icon-badge">📅</div>
          <div class="history-text-col">
            <h4>Today in OSRS History: ${event.title} (${event.date})</h4>
            <p>${event.summary}</p>
          </div>
        </div>
        <div style="display:flex; gap:0.6rem;">
          ${entity ? `<a href="#entity=${entity.id}" class="btn-osrs btn-osrs-gold" style="font-size:0.8rem; padding:0.45rem 0.9rem;">View ${entity.name}</a>` : ''}
        </div>
      </div>
    `;
  }
}

window.museumUI = new MuseumUI();
