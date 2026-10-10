'use strict';

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'projects.json');

let _cache = null;

/**
 * Load projects from data/projects.json (cached after first load).
 * @returns {Array} projects array
 */
function loadProjects() {
  if (_cache) return _cache;
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  _cache = JSON.parse(raw);
  return _cache;
}

/**
 * Score a project against the user's confirmed components.
 * Returns { project, score, availableComponents, missingComponents }.
 *
 * Scoring:
 *  +10 for each required component the user already has
 *  -2  for each required component the user is missing
 *  Projects with ≥1 available component are included.
 */
function recommendProjects(userComponents) {
  const normalise = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  const userNorm = userComponents.map(normalise);

  const projects = loadProjects();

  const scored = projects.map(project => {
    const available = [];
    const missing = [];

    for (const component of project.coreComponents) {
      const norm = normalise(component);
      // Substring match — "DHT11 sensor" matches user component "DHT11"
      const found = userNorm.some(u => norm.includes(u) || u.includes(norm));
      if (found) {
        available.push(component);
      } else {
        missing.push(component);
      }
    }

    const score = available.length * 10 - missing.length * 2;

    return {
      id: project.id,
      title: project.title,
      tagline: project.tagline,
      difficulty: project.difficulty,
      estimatedTime: project.estimatedTime,
      category: project.category,
      additionalCostINR: project.additionalCostINR,
      socialImpact: project.socialImpact,
      coreComponents: project.coreComponents,
      availableComponents: available,
      missingComponents: missing,
      matchScore: score,
      matchReason: buildMatchReason(available, missing)
    };
  });

  // Include projects where user has at least one matching component, sorted by score desc
  const results = scored
    .filter(r => r.availableComponents.length > 0)
    .sort((a, b) => b.matchScore - a.matchScore);

  // If no matches at all, return top 3 from catalogue (fallback)
  if (results.length === 0) {
    return scored
      .sort((a, b) => a.missingComponents.length - b.missingComponents.length)
      .slice(0, 3)
      .map(r => ({ ...r, matchReason: 'Suggested from catalogue — add more components for better matches.' }));
  }

  return results;
}

function buildMatchReason(available, missing) {
  if (available.length === 0) return 'No matching components found.';
  if (missing.length === 0) return `You have all ${available.length} required components — ready to build!`;
  return `You have ${available.length} of ${available.length + missing.length} required components. Only ${missing.length} more needed.`;
}

module.exports = { loadProjects, recommendProjects };
