const EmergencyContact = require('../models/EmergencyContact');

exports.getContacts = async (req, res) => {
  try {
    const contacts = await EmergencyContact.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, contacts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createContact = async (req, res) => {
  try {
    const {
      name, relationship, phone, email, isPrimary,
    } = req.body;
    const contact = await EmergencyContact.create({
      user: req.user._id, name, relationship, phone, email, isPrimary,
    });
    res.status(201).json({ success: true, contact });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Deliberately allows multiple contacts with isPrimary: true simultaneously —
// the roadmap does not require exactly one primary contact, so no logic here
// unsets other contacts' isPrimary. Do not "fix" this as a bug.
exports.updateContact = async (req, res) => {
  try {
    const {
      name, relationship, phone, email, isPrimary,
    } = req.body;
    const contact = await EmergencyContact.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      {
        name, relationship, phone, email, isPrimary,
      },
      { returnDocument: 'after', runValidators: true }
    );
    if (!contact) return res.status(404).json({ success: false, message: 'Emergency contact not found' });
    res.json({ success: true, contact });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    const contact = await EmergencyContact.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!contact) return res.status(404).json({ success: false, message: 'Emergency contact not found' });
    res.json({ success: true, message: 'Emergency contact removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
