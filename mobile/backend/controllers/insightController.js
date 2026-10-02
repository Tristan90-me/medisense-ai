const { resolveDependentId } = require('../utils/resolveDependent');
const { gatherDay } = require('../utils/dailyDashboard');
const { analyzeMeal, suggestFromEnergyContext, dailyTip } = require('../utils/gemini');

// POST /api/insights/estimate-meal-photo — multipart/form-data, `photo` file
// field plus optional `context` text. Returns a rough nutrition estimate to
// prefill a quick-add (see mealController.logMeal's kind: 'quick_add') —
// does NOT create a MealLog itself, so the user reviews/edits before saving.
exports.estimateMealPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Photo is required' });
    const estimate = await analyzeMeal(req.file.buffer, req.file.mimetype, req.body.context || '');
    res.json({ success: true, estimate });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// GET /api/insights/suggestion?kind=meal|workout&dependent= — one Gemini
// suggestion grounded in today's Daily Energy Ledger (utils/dailyDashboard.js
// reuses the exact same gathering as the dashboard, so the suggestion is
// always consistent with what the user sees on screen).
exports.getSuggestion = async (req, res) => {
  try {
    const dependent = req.query.dependent ? await resolveDependentId(req.query.dependent, req.user._id) : null;
    const kind = req.query.kind === 'workout' ? 'workout' : 'meal';
    const day = await gatherDay({ user: req.user._id, dependent });
    const suggestion = await suggestFromEnergyContext(day.energy, kind);
    res.json({ success: true, kind, suggestion });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// GET /api/insights/tip — not personalized, just a rotating wellness tip.
exports.getDailyTip = async (req, res) => {
  try {
    const tip = await dailyTip();
    res.json({ success: true, tip });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
