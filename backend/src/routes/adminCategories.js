const express = require('express');
const router = express.Router();
const CategoryService = require('../services/categoryService');
const { authenticateAdmin } = require('../middleware/auth');
const { serverErrorMessage } = require('../utils/httpError');

router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const categories = await CategoryService.getAll();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name required' });

    const category = await CategoryService.create(name);
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name required' });

    const category = await CategoryService.update(parseInt(req.params.id), name);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    res.json(category);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const deleted = await CategoryService.delete(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ error: 'Category not found' });
    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ error: serverErrorMessage(error) });
  }
});

module.exports = router;