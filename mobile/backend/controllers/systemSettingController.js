const SystemSetting = require('../models/SystemSetting');
const { chat } = require('../utils/gemini');
const { logAdminAction } = require('../utils/auditLogger');

// GET /admin/settings — returns every setting document (small, low-cardinality
// collection; not paginated).
exports.getSettings = async (req, res) => {
  try {
    const settings = await SystemSetting.find();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /admin/settings/:key — upserts a single setting by key.
exports.updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const setting = await SystemSetting.findOneAndUpdate(
      { key },
      { value: req.body.value, updatedBy: req.user._id },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );

    // Never log the full value for a key like 'systemPrompt' — it can be a
    // large free-text blob. Just the key and a size hint.
    try {
      await logAdminAction({
        actor: req.user._id,
        action: 'settings.update',
        targetType: 'SystemSetting',
        targetId: null,
        metadata: { key, valueLength: JSON.stringify(req.body.value).length },
        ip: req.ip,
      });
    } catch (logErr) {
      console.error('logAdminAction failed (settings.update):', logErr.message);
    }

    res.json({ success: true, setting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /admin/settings/preview-prompt — lets an admin see how a DRAFT
// (unsaved) system prompt behaves before committing it, per the roadmap's
// requirement that this be a required preview/test step given it directly
// controls emergency-detection wording. Never persists anything.
exports.previewPrompt = async (req, res) => {
  try {
    const { prompt } = req.body;
    const result = await chat(
      [{ role: 'user', content: 'I have a mild headache, what should I do?' }],
      null,
      prompt
    );
    res.json({ success: true, preview: result.text });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
