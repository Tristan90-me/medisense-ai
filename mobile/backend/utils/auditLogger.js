// Scaffolded ahead of the admin-expansion phase that introduces
// backend/models/AuditLog.js and starts actually calling this. Kept as an
// explicit call at each sensitive admin write site (not generic middleware)
// because a useful audit entry needs meaningful, action-specific metadata
// that middleware can't infer on its own.
//
// The model is required lazily inside the function (not at module load) so
// this file can be imported safely before AuditLog.js exists.
const logAdminAction = async ({ actor, action, targetType, targetId, metadata = {}, ip }) => {
  const AuditLog = require("../models/AuditLog");
  await AuditLog.create({ actor, action, targetType, targetId, metadata, ip });
};

module.exports = { logAdminAction };
