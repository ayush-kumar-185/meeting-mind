const express = require('express');
const requireAuth = require('../middleware/auth');
const { MeetingPattern, Workspace } = require('../models');
const { detectPatternsForWorkspace } = require('../services/ai/patternDetector');
const validateObjectId = require('../middleware/validateObjectId');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const workspaces = await Workspace.find({ 'members.userId': req.user._id }).select('_id');
    const workspaceIds = workspaces.map(w => w._id);

    const patterns = await MeetingPattern.find({ workspaceId: { $in: workspaceIds }, resolved: false })
      .sort({ lastSeenAt: -1 });
    res.json({ patterns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual trigger — for testing/demo, since waiting a real week isn't practical
router.post('/scan/:workspaceId', validateObjectId('workspaceId'), async (req, res) => {
  try {
    const result = await detectPatternsForWorkspace(req.params.workspaceId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/resolve', validateObjectId('id'), async (req, res) => {
  try {
    const pattern = await MeetingPattern.findByIdAndUpdate(req.params.id, { resolved: true }, { new: true });
    if (!pattern) return res.status(404).json({ error: 'Pattern not found' });
    res.json({ pattern });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;