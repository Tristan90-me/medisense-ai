const Exercise = require('../models/Exercise');

// GET /api/exercises/search?q=&category=&equipment= — all params optional;
// an empty query returns the whole (seeded) library, paged by the limit.
exports.search = async (req, res) => {
  try {
    const {
      q, category, equipment,
    } = req.query;
    const filter = {};
    if (q) filter.$text = { $search: q };
    if (category) filter.category = category;
    if (equipment) filter.equipment = equipment;
    const exercises = await Exercise.find(filter).sort({ name: 1 }).limit(50);
    res.json({ success: true, exercises });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getExercise = async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);
    if (!exercise) return res.status(404).json({ success: false, message: 'Exercise not found' });
    res.json({ success: true, exercise });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
