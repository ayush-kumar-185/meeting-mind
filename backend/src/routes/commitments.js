const express = require('express');
const requireAuth = require('../middleware/auth');
const   Workspace = require('../models/workspace');
const  Commitment = require('../models/commitment');
const validate = require('../middleware/validate');
const validateObjectId = require('../middleware/validateObjectId');
const { commitmentSchemas } = require('../validation/schemas');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const workspaces = await Workspace.find({ 'members.userId': req.user._id }).select('_id');
    const workspaceIds = workspaces.map(w => w._id);

    const { status } = req.query;
    const filter = { workspaceId: { $in: workspaceIds } };
    if (status) filter.status = status;

    const commitments = await Commitment.find(filter).sort({ deadline: 1 });
    res.json({ commitments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/status', validateObjectId('id'), validate(commitmentSchemas.updateStatus), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'fulfilled', 'broken', 'overdue'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const commitment = await Commitment.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!commitment) return res.status(404).json({ error: 'Commitment not found' });
    res.json({ commitment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;