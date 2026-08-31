const Dependent = require('../models/Dependent');

// Resolves an optional dependentId (from a query/body param) to the value to
// use in a { user, dependent } Mongo filter — null means "self". Throws a
// 404-shaped error (not 403) when the id doesn't belong to the requesting
// user, so callers never confirm or deny that another user's dependent
// exists — matches this codebase's existing generic-rejection posture.
const resolveDependentId = async (dependentId, ownerId) => {
  if (!dependentId) return null;
  const dependent = await Dependent.findOne({ _id: dependentId, owner: ownerId });
  if (!dependent) {
    const err = new Error('Dependent not found');
    err.statusCode = 404;
    throw err;
  }
  return dependent._id;
};

module.exports = { resolveDependentId };
