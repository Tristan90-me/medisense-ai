const CustomFood = require('../models/CustomFood');
const { searchFoods, lookupFoodByBarcode } = require('../utils/foodApi');

// GET /api/foods/search?q=
// Searches the shared FoodItem cache plus live Open Food Facts + USDA
// FoodData Central, then this user's own custom foods (never shared across
// accounts, so searched separately and merged in).
exports.search = async (req, res) => {
  try {
    const q = req.query.q.trim();
    const [foods, customFoods] = await Promise.all([
      searchFoods(q),
      CustomFood.find({ user: req.user._id, $text: { $search: q } }).limit(10),
    ]);
    res.json({ success: true, foods, customFoods });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/foods/barcode/:code
exports.barcodeSearch = async (req, res) => {
  try {
    const food = await lookupFoodByBarcode(req.params.code);
    if (!food) return res.status(404).json({ success: false, message: 'No product found for that barcode' });
    res.json({ success: true, food });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Custom foods (user-owned) ────────────────────────────────────────────────
exports.listCustomFoods = async (req, res) => {
  try {
    const customFoods = await CustomFood.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, customFoods });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createCustomFood = async (req, res) => {
  try {
    const {
      name, brand, per100g, servingOptions,
    } = req.body;
    const customFood = await CustomFood.create({
      user: req.user._id, name, brand, per100g, servingOptions,
    });
    res.status(201).json({ success: true, customFood });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCustomFood = async (req, res) => {
  try {
    const customFood = await CustomFood.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { returnDocument: 'after', runValidators: true },
    );
    if (!customFood) return res.status(404).json({ success: false, message: 'Custom food not found' });
    res.json({ success: true, customFood });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteCustomFood = async (req, res) => {
  try {
    const customFood = await CustomFood.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!customFood) return res.status(404).json({ success: false, message: 'Custom food not found' });
    res.json({ success: true, message: 'Custom food removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
