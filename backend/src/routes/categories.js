const express = require('express');
const router = express.Router();
const CategoryService = require('../services/categoryService');
const MovieService = require('../services/movieService');
const { serverErrorMessage } = require('../utils/httpError');

router.get('/', async (req, res) => {
  try {
    const categories = await CategoryService.getAll();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const category = await CategoryService.getBySlug(req.params.slug);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const result = await MovieService.getAll({
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      category: req.params.slug,
      published: 1
    });

    res.json({ category, ...result });
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

module.exports = router;