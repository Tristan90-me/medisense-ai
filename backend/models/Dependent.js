const mongoose = require('mongoose');

const DependentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  relationship: {
    type: String,
    required: true,
    enum: ['child', 'spouse', 'parent', 'sibling', 'other'],
  },
  dateOfBirth: { type: Date },
  sex: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
}, { timestamps: true });

module.exports = mongoose.model('Dependent', DependentSchema);
