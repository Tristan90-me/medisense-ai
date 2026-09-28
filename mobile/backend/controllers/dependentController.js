const Dependent = require('../models/Dependent');
const HealthProfile = require('../models/HealthProfile');

exports.getDependents = async (req, res) => {
  try {
    const dependents = await Dependent.find({ owner: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, dependents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createDependent = async (req, res) => {
  try {
    const { name, relationship, dateOfBirth, sex } = req.body;
    const dependent = await Dependent.create({
      owner: req.user._id, name, relationship, dateOfBirth, sex,
    });
    res.status(201).json({ success: true, dependent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateDependent = async (req, res) => {
  try {
    const { name, relationship, dateOfBirth, sex } = req.body;
    const dependent = await Dependent.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { name, relationship, dateOfBirth, sex },
      { returnDocument: 'after', runValidators: true }
    );
    if (!dependent) return res.status(404).json({ success: false, message: 'Dependent not found' });
    res.json({ success: true, dependent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Hard-deletes the dependent and their associated HealthProfile row (that
// profile is meaningless once orphaned). Sessions/Medications/HealthScore
// rows referencing this dependent are deliberately NOT cascade-deleted —
// they're retained as inaccessible historical records, matching this
// codebase's existing posture of never hard-deleting audit-adjacent data.
exports.deleteDependent = async (req, res) => {
  try {
    const dependent = await Dependent.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!dependent) return res.status(404).json({ success: false, message: 'Dependent not found' });
    await HealthProfile.deleteOne({ user: req.user._id, dependent: dependent._id });
    res.json({ success: true, message: 'Dependent removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
