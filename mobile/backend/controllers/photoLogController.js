const PhotoLog = require('../models/PhotoLog');
const Session = require('../models/Session');
const { resolveDependentId } = require('../utils/resolveDependent');
const { uploadBuffer, deleteFile, getBucket } = require('../utils/gridfs');
const { analyzePhoto } = require('../utils/gemini');

// POST /api/photo-log — multipart/form-data with a `photo` file field plus
// optional caption/bodyRegion/dependent/subjectSex/linkedSessionId text fields.
exports.uploadPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Photo is required' });

    const dependent = await resolveDependentId(req.body.dependent, req.user._id);
    const {
      caption, bodyRegion, subjectSex, linkedSessionId,
    } = req.body;

    const imageRef = await uploadBuffer(req.file.buffer, `photo-${Date.now()}`, req.file.mimetype);

    // Give the model whatever context is available — helps it read a visual
    // presentation more specifically than the image alone would.
    const contextParts = [];
    if (bodyRegion) contextParts.push(`Body region: ${bodyRegion}`);
    if (subjectSex) contextParts.push(`Subject: ${subjectSex}`);
    if (caption) contextParts.push(`Note from patient: ${caption}`);

    // A Gemini failure (including the currently-known-invalid API key) must
    // never fail the whole upload — the photo itself is still valuable
    // without an AI read on it. Isolated in its own try/catch on purpose.
    let aiAnalysis;
    try {
      aiAnalysis = await analyzePhoto(req.file.buffer, req.file.mimetype, contextParts.join('. '));
    } catch (err) {
      console.warn('Photo analysis failed, saving photo without aiAnalysis:', err.message);
    }

    const photoLog = await PhotoLog.create({
      user: req.user._id,
      dependent,
      // subjectSex only means anything when this isn't a saved dependent —
      // the upload form only ever sends one or the other, but guard here too.
      subjectSex: dependent ? null : subjectSex || null,
      imageRef,
      mimeType: req.file.mimetype,
      caption,
      bodyRegion,
      linkedSessionId: linkedSessionId || null,
      aiAnalysis,
    });

    res.status(201).json({ success: true, photoLog });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// GET /api/photo-log?dependent=<id> — same "omit -> union across self + all
// dependents" pattern as medicationController.getMedications. Never filters
// out flagged photos. Metadata only — no image bytes (see getPhotoImage).
exports.getPhotos = async (req, res) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.dependent) {
      filter.dependent = await resolveDependentId(req.query.dependent, req.user._id);
    }
    const photoLogs = await PhotoLog.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, photoLogs });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// GET /api/photo-log/:id — single doc, metadata only.
exports.getPhoto = async (req, res) => {
  try {
    const photoLog = await PhotoLog.findOne({ _id: req.params.id, user: req.user._id });
    if (!photoLog) return res.status(404).json({ success: false, message: 'Photo not found' });
    res.json({ success: true, photoLog });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// GET /api/photo-log/:id/image — streams the raw bytes. Ownership check
// happens BEFORE touching GridFS (looking up the PhotoLog by id + owner) —
// the raw GridFS file id alone carries no owner reference, so this is the
// only place ownership can be enforced.
exports.getPhotoImage = async (req, res) => {
  try {
    const photoLog = await PhotoLog.findOne({ _id: req.params.id, user: req.user._id });
    if (!photoLog) return res.status(404).json({ success: false, message: 'Photo not found' });

    res.set('Content-Type', photoLog.mimeType);
    const downloadStream = getBucket().openDownloadStream(photoLog.imageRef);
    downloadStream.on('error', () => {
      if (!res.headersSent) res.status(404).json({ success: false, message: 'Image file not found' });
    });
    downloadStream.pipe(res);
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// PATCH /api/photo-log/:id/link-session — records that a symptom-check
// session was started from this photo (surfaced back on the photo's detail
// view as "Linked to a check-in"). Validates the session is real and owned
// by the same user before linking, so a photo can never point at a session
// that doesn't actually belong to this account.
exports.linkSession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = await Session.findOne({ _id: sessionId, user: req.user._id });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const photoLog = await PhotoLog.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { linkedSessionId: sessionId },
      { returnDocument: 'after' }
    );
    if (!photoLog) return res.status(404).json({ success: false, message: 'Photo not found' });

    res.json({ success: true, photoLog });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// DELETE /api/photo-log/:id — removes the PhotoLog row and cascades to the
// underlying GridFS file (which is meaningless once orphaned).
exports.deletePhoto = async (req, res) => {
  try {
    const photoLog = await PhotoLog.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!photoLog) return res.status(404).json({ success: false, message: 'Photo not found' });
    await deleteFile(photoLog.imageRef);
    res.json({ success: true, message: 'Photo removed' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};
