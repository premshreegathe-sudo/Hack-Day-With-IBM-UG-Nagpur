'use strict';

const express = require('express');
const router = express.Router();
const { loadProjects } = require('../services/recommendationService');

// GET /api/projects
// Optional query params: ?difficulty=beginner&category=agriculture&budget=500
router.get('/', (req, res) => {
  try {
    let projects = loadProjects();

    const { difficulty, category, budget } = req.query;

    if (difficulty) {
      projects = projects.filter(
        p => p.difficulty.toLowerCase() === difficulty.toLowerCase()
      );
    }

    if (category) {
      projects = projects.filter(
        p => p.category.toLowerCase().includes(category.toLowerCase())
      );
    }

    if (budget) {
      const maxBudget = parseInt(budget, 10);
      if (!isNaN(maxBudget)) {
        projects = projects.filter(p => p.additionalCostINR <= maxBudget);
      }
    }

    // Return summary fields only (not full detail)
    const summaries = projects.map(p => ({
      id: p.id,
      title: p.title,
      tagline: p.tagline,
      difficulty: p.difficulty,
      estimatedTime: p.estimatedTime,
      category: p.category,
      additionalCostINR: p.additionalCostINR,
      socialImpact: p.socialImpact,
      coreComponents: p.coreComponents
    }));

    res.json({ projects: summaries, total: summaries.length });
  } catch (err) {
    console.error('[projects] GET /api/projects error:', err.message);
    res.status(500).json({ error: 'Failed to load projects.' });
  }
});

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  try {
    const projects = loadProjects();
    const project = projects.find(p => p.id === req.params.id);

    if (!project) {
      return res.status(404).json({ error: `Project '${req.params.id}' not found.` });
    }

    res.json({ project });
  } catch (err) {
    console.error('[projects] GET /api/projects/:id error:', err.message);
    res.status(500).json({ error: 'Failed to load project.' });
  }
});

// POST /api/recommend
// Body: { components: string[] }
router.post('/recommend', (req, res) => {
  try {
    const { components } = req.body;

    if (!components || !Array.isArray(components) || components.length === 0) {
      return res.status(400).json({
        error: 'Provide a non-empty "components" array in the request body.'
      });
    }

    const { recommendProjects } = require('../services/recommendationService');
    const results = recommendProjects(components);

    res.json({
      projects: results,
      total: results.length,
      mode: 'local-catalogue'
    });
  } catch (err) {
    console.error('[projects] POST /api/recommend error:', err.message);
    res.status(500).json({ error: 'Recommendation failed.' });
  }
});

module.exports = router;
