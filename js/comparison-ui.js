/**
 * OSRS Time Machine - Before/After Visual Comparison Lab UI
 */

class ComparisonUI {
  renderComparisonCard(comp, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const entity = window.dataStore ? window.dataStore.getEntityById(comp.entityId) : null;

    let html = `
      <div class="comparison-module" id="${comp.id}">
        <div class="comparison-header">
          <div class="comparison-title-box">
            <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.4rem;">
              <span class="badge badge-era">${comp.eraBadge || 'Historical Comparison'}</span>
              <span class="badge badge-rebalance">${comp.category}</span>
            </div>
            <h3>${comp.title}</h3>
            <p>${comp.description}</p>
          </div>
          ${entity ? `
            <a href="#entity=${entity.id}" class="btn-osrs btn-osrs-stone" style="font-size:0.8rem; padding:0.4rem 0.8rem;">
              ${entity.icon || '⚔️'} View ${entity.name} Codex
            </a>
          ` : ''}
        </div>
    `;

    if (comp.type === 'stats' && comp.statComparison) {
      html += `
        <div class="table-responsive">
          <table class="stat-matrix-table">
            <thead>
              <tr>
                <th>Attribute / Metric</th>
                <th>${comp.leftLabel || 'Before Update'}</th>
                <th>${comp.rightLabel || 'After Update'}</th>
                <th>Meta Impact</th>
              </tr>
            </thead>
            <tbody>
      `;

      comp.statComparison.forEach(row => {
        let diffBadgeClass = 'stat-diff-neutral';
        if (row.type === 'buff') diffBadgeClass = 'stat-diff-buff';
        else if (row.type === 'nerf') diffBadgeClass = 'stat-diff-nerf';

        html += `
          <tr>
            <td class="stat-name">${row.stat}</td>
            <td><span class="stat-before-val">${row.before}</span></td>
            <td><span class="stat-after-val">${row.after}</span></td>
            <td><span class="stat-diff-tag ${diffBadgeClass}">${row.diff}</span></td>
          </tr>
        `;
      });

      html += `
            </tbody>
          </table>
        </div>
      `;
    } else if (comp.type === 'droptable' && comp.dropItems) {
      html += `
        <div class="drop-comparison-grid">
      `;

      comp.dropItems.forEach(item => {
        html += `
          <div class="drop-item-card">
            <div class="drop-item-header">
              <span class="drop-item-name">📦 ${item.name}</span>
            </div>
            <div class="drop-rates-row">
              <span style="color:#fca5a5;">${item.before}</span>
              <span class="drop-arrow">➔</span>
              <span style="color:#86efac;">${item.after}</span>
            </div>
            <div class="drop-impact-tag">${item.impact}</div>
          </div>
        `;
      });

      html += `</div>`;
    }

    if (comp.notes) {
      html += `
        <div class="parchment-box" style="margin-top:1rem; font-size:0.85rem; color:var(--gold-300);">
          <strong>Historical Note:</strong> ${comp.notes}
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;
  }

  renderAllComparisons(comparisons, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    comparisons.forEach(comp => {
      const wrapper = document.createElement('div');
      wrapper.id = `wrapper-${comp.id}`;
      container.appendChild(wrapper);
      this.renderComparisonCard(comp, wrapper.id);
    });
  }
}

window.comparisonUI = new ComparisonUI();
