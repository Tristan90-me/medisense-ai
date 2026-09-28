const multer = require('multer');

// Memory storage (not disk) because the buffer is immediately handed off to
// GridFS (backend/utils/gridfs.js) and to Gemini for analysis — nothing ever
// needs to live on the local filesystem. fileFilter + limits are a real
// security boundary against uncontrolled file uploads: don't loosen them.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, or WEBP images are allowed'));
    }
    cb(null, true);
  },
});

// multer/fileFilter errors (wrong type, too large, malformed multipart body)
// are passed to the callback rather than thrown, which bypasses Express's
// normal error-handling middleware chain. This wraps a configured multer
// middleware (e.g. upload.single('photo')) so those errors come back in the
// same { success: false, message } shape as every other error in this app.
const handleUploadErrors = (uploadMiddleware) => (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
};

module.exports = { upload, handleUploadErrors };
