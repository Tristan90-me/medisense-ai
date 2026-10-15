const Appointment = require('../models/Appointment');
const { resolveDependentId } = require('../utils/resolveDependent');

// GET /api/appointments?dependent=<id>
// With `dependent`, scopes to that one person. Without it, returns the
// union across self AND every dependent under this account — same
// household-list convention as GET /api/medications.
exports.getAppointments = async (req, res) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.dependent) {
      filter.dependent = await resolveDependentId(req.query.dependent, req.user._id);
    }
    const appointments = await Appointment.find(filter).sort({ dateTime: 1 });
    res.json({ success: true, appointments });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.createAppointment = async (req, res) => {
  try {
    const dependent = await resolveDependentId(req.body.dependent, req.user._id);
    const {
      doctorName, specialty, dateTime, location, notes,
    } = req.body;
    const appointment = await Appointment.create({
      user: req.user._id, dependent, doctorName, specialty, dateTime, location, notes,
    });
    res.status(201).json({ success: true, appointment });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.updateAppointment = async (req, res) => {
  try {
    const updates = { ...req.body };
    if ('dependent' in updates) {
      updates.dependent = await resolveDependentId(updates.dependent, req.user._id);
    }
    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updates,
      { returnDocument: 'after', runValidators: true }
    );
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
    res.json({ success: true, appointment });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
    res.json({ success: true, message: 'Appointment removed' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};
