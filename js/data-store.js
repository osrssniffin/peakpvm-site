/**
 * OSRS Time Machine - Data Store & Search Engine
 */

class DataStore {
  constructor() {
    this.eras = [];
    this.entities = [];
    this.timelineEvents = [];
    this.comparisons = [];
    this.exhibits = [];
    this.isLoaded = false;
  }

  async loadAll() {
    try {
      const [erasRes, entitiesRes, eventsRes, compsRes, exhibitsRes] = await Promise.all([
        fetch('./data/eras.json'),
        fetch('./data/entities.json'),
        fetch('./data/timeline-events.json'),
        fetch('./data/comparisons.json'),
        fetch('./data/exhibits.json')
      ]);

      this.eras = await erasRes.json();
      this.entities = await entitiesRes.json();
      this.timelineEvents = await eventsRes.json();
      this.comparisons = await compsRes.json();
      this.exhibits = await exhibitsRes.json();
      this.isLoaded = true;

      // Sort timeline events chronologically
      this.timelineEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

      return true;
    } catch (err) {
      console.error('Failed loading OSRS Time Machine database:', err);
      return false;
    }
  }

  getEntityById(id) {
    return this.entities.find(e => e.id === id);
  }

  getEventsForEntity(entityId) {
    return this.timelineEvents.filter(evt => evt.entityId === entityId);
  }

  getEventsByYear(year) {
    return this.timelineEvents.filter(evt => evt.year === parseInt(year, 10));
  }

  getEventsByEra(eraId) {
    const era = this.eras.find(e => e.id === eraId);
    if (!era) return [];
    // If era has range, e.g. "2014 - 2015"
    return this.timelineEvents.filter(evt => {
      const entity = this.getEntityById(evt.entityId);
      return entity && entity.releaseEra === eraId;
    });
  }

  getComparisonByEntity(entityId) {
    return this.comparisons.filter(c => c.entityId === entityId);
  }

  getAllComparisons() {
    return this.comparisons;
  }

  search(query) {
    if (!query || !query.trim()) return [];
    const q = query.toLowerCase().trim();

    const matchedEntities = this.entities.filter(item => {
      return (
        item.name.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.tags.some(t => t.toLowerCase().includes(q)) ||
        item.shortDescription.toLowerCase().includes(q)
      );
    });

    const matchedEvents = this.timelineEvents.filter(evt => {
      return (
        evt.title.toLowerCase().includes(q) ||
        evt.summary.toLowerCase().includes(q) ||
        evt.tags.some(t => t.toLowerCase().includes(q))
      );
    });

    return {
      entities: matchedEntities,
      events: matchedEvents
    };
  }

  getMostChanged(limit = 6) {
    return [...this.entities]
      .sort((a, b) => b.volatilityScore - a.volatilityScore)
      .slice(0, limit);
  }

  getRandomEntity() {
    if (!this.entities.length) return null;
    const idx = Math.floor(Math.random() * this.entities.length);
    return this.entities[idx];
  }

  getTodayInHistory() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentDay = now.getDate();

    // Match month and day from event.date (YYYY-MM-DD)
    const match = this.timelineEvents.find(evt => {
      const parts = evt.date.split('-');
      return parseInt(parts[1], 10) === currentMonth && parseInt(parts[2], 10) === currentDay;
    });

    if (match) {
      const entity = this.getEntityById(match.entityId);
      return { event: match, entity };
    }

    // Fallback iconic milestone
    const fallbackEvent = this.timelineEvents.find(e => e.id === 'evt-bp-03') || this.timelineEvents[0];
    const entity = this.getEntityById(fallbackEvent.entityId);
    return { event: fallbackEvent, entity };
  }
}

window.dataStore = new DataStore();
