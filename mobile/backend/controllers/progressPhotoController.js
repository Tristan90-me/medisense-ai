const ProgressPhoto = require('../models/ProgressPhoto');
const { resolveDependentId } = require('../utils/resolveDependent');
const { uploadBuffer, deleteFile, getBucket } = require('../utils/gridfs');

// Kept in its own GridFS bucket, separate from symptom photos ('photos') —
// see utils/gridfs.js's bucketName parameter.
const BUCKET = 'progress-photos';

// POST /api/progress-photos — multipart/form-data, `photo` file field plus
// optional caption/dependent text fields. No AI analysis (unlike PhotoLog) —
// these are fitness before/after shots, not a symptom to interpret.
exports.uploadPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Photo is required' });
    const dependent = await resolveDependentId(req.body.dependent, req.user._id);
    const { caption } = req.body;
    const imageRef = await uploadBuffer(req.file.buffer, `progress-${Date.now()}`, req.file.mimetype, BUCKET);
    const progressPhoto = await ProgressPhoto.create({
      user: req.user._id, dependent, imageRef, mimeType: req.file.mimetype, caption,
    });
    res.status(201).json({ success: true, progressPhoto });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.getPhotos = async (req, res) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.dependent) filter.dependent = await resolveDependentId(req.query.dependent, req.user._id);
    const progressPhotos = await ProgressPhoto.find(filter).sort({ takenAt: -1 });
    res.json({ success: true, progressPhotos });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

// GET /api/progress-photos/:id/image — ownership checked before touching
// GridFS, same idiom as photoLogController.getPhotoImage.
exports.getPhotoImage = async (req, res) => {
  try {
    const progressPhoto = await ProgressPhoto.findOne({ _id: req.params.id, user: req.user._id });
    if (!progressPhoto) return res.status(404).json({ success: false, message: 'Photo not found' });

    res.set('Content-Type', progressPhoto.mimeType);
    const downloadStream = getBucket(BUCKET).openDownloadStream(progressPhoto.imageRef);
    downloadStream.on('error', () => {
      if (!res.headersSent) res.status(404).json({ success: false, message: 'Image file not found' });
    });
    downloadStream.pipe(res);
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

exports.deletePhoto = async (req, res) => {
  try {
    const progressPhoto = await ProgressPhoto.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!progressPhoto) return res.status(404).json({ success: false, message: 'Photo not found' });
    await deleteFile(progressPhoto.imageRef, BUCKET);
    res.json({ success: true, message: 'Photo removed' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};
