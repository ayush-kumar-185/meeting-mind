const express = require('express');
const requireAuth = require('../middleware/auth');
const   Workspace = require('../models/workspace');
const  Commitment = require('../models/commitment');
const validate = require('../middleware/validate');
const validateObjectId = require('../middleware/validateObjectId');
const { commitmentSchemas } = require('../validation/schemas');
const { verifyWorkspaceAccess } = require('../middleware/workspaceAuth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    let page = parseInt(req.query.page);
    if (isNaN(page) || page < 1) page = 1;
    let limit = parseInt(req.query.limit);
    if (isNaN(limit) || limit < 1) limit = 50;
    limit = Math.min(limit, 100);
    
    const skip = (page - 1) * limit;

    const workspaces = await Workspace.find({ 'members.userId': req.user._id }).select('_id');
    const workspaceIds = workspaces.map(w => w._id);

    const { status } = req.query;
    const filter = { workspaceId: { $in: workspaceIds } };
    
    if (status) filter.status = status;

    const commitments = await Commitment.find(filter)
      .sort({ deadline: 1 })
      .skip(skip)
      .limit(limit);

    res.json({ 
      commitments,
      pagination: {
        page,
        limit,
        hasMore: commitments.length === limit
      }
    });
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
    const commitment = await Commitment.findById(req.params.id);
    if (!commitment) return res.status(404).json({ error: 'Commitment not found' });
    if (!(await verifyWorkspaceAccess(req.user._id, commitment.workspaceId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    commitment.status = status;
    await commitment.save();
    res.json({ commitment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;