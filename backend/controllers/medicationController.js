const Medication = require('../models/Medication');
const { resolveDependentId } = require('../utils/resolveDependent');
const { computeAdherence } = require('../utils/computeAdherence');

// Attaches the computed adherence summary and strips the raw doseLog array
// (which only grows over the lifetime of a medication — the client never
// needs more than the summary) before a medication goes out over the wire.
const serializeMedication = (medication) => {
  const obj = medication.toObject();
  obj.adherence = computeAdherence(medication);
  delete obj.doseLog;
  return obj;
};

// GET /api/medications?dependent=<id>
// With `dependent`, scopes to that one person (self or a specific dependent).
// Without it, returns the union across self AND every dependent under this
// account in one call — a caregiver managing a household benefits from one
// unified list, and the client groups it by person. active:false records are
// deliberately never filtered out here — this is a tracker, not a
// disappearing to-do list.
exports.getMedications = async (req, res) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.dependent) {
      filter.dependent = await resolveDependentId(req.query.dependent, req.user._id);
    }
    const medications = await Medication.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, medications: medications.map(serializeMedication) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.createMedication = async (req, res) => {
  try {
    const dependent = await resolveDependentId(req.body.dependent, req.user._id);
    const {
      name, dosage, frequency, startDate, endDate, reminderTimes, active,
    } = req.body;
    const medication = await Medication.create({
      user: req.user._id, dependent, name, dosage, frequency, startDate, endDate, reminderTimes, active,
    });
    res.status(201).json({ success: true, medication: serializeMedication(medication) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.updateMedication = async (req, res) => {
  try {
    const updates = { ...req.body };
    if ('dependent' in updates) {
      updates.dependent = await resolveDependentId(updates.dependent, req.user._id);
    }
    const medication = await Medication.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updates,
      { returnDocument: 'after', runValidators: true }
    );
    if (!medication) return res.status(404).json({ success: false, message: 'Medication not found' });
    res.json({ success: true, medication: serializeMedication(medication) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// POST /api/medications/:id/log-dose
// Appends one "taken" entry, timestamped now — no backdating, this is a
// "mark it the moment you take it" log, not a historical editor.
exports.logDose = async (req, res) => {
  try {
    const medication = await Medication.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $push: { doseLog: { takenAt: new Date() } } },
      { returnDocument: 'after' }
    );
    if (!medication) return res.status(404).json({ success: false, message: 'Medication not found' });
    res.status(201).json({ success: true, medication: serializeMedication(medication) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.deleteMedication = async (req, res) => {
  try {
    const medication = await Medication.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!medication) return res.status(404).json({ success: false, message: 'Medication not found' });
    res.json({ success: true, message: 'Medication removed' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};
