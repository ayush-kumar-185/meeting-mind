const { Workspace } = require('../models');

/**
 * Checks if a user is an active or pending member of a given workspace.
 * @param {string} userId - The user's ID
 * @param {string} workspaceId - The workspace ID to verify
 * @returns {boolean} True if authorized, false otherwise
 */
async function verifyWorkspaceAccess(userId, workspaceId) {
  if (!workspaceId || !userId) return false;
  
  const workspace = await Workspace.findOne({
    _id: workspaceId,
    'members.userId': userId
  });
  
  return !!workspace;
}

module.exports = { verifyWorkspaceAccess };
