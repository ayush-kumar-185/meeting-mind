const express = require('express');
const requireAuth = require('../middleware/auth');
const  ActionItem= require('../models/actionItem');
const  Workspace  = require('../models/workspace');
const { pushActionItemToJira } = require('../services/integrations/jira');
const validate = require('../middleware/validate');
const validateObjectId = require('../middleware/validateObjectId');
const { actionItemSchemas } = require('../validation/schemas');

const router = express.Router();

router.use(requireAuth);

// List action items for a meeting
router.get('/meeting/:meetingId', validateObjectId('meetingId'), async (req, res) => {
  try {
    const items = await ActionItem.find({ meetingId: req.params.meetingId })
      .sort({ createdAt: 1 });
    res.json({ actionItems: items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all action items across the user's workspaces (for the Action Items tab)
router.get('/', async (req, res) => {
  try {
    const workspaces = await Workspace.find({ 'members.userId': req.user._id }).select('_id');
    const workspaceIds = workspaces.map(w => w._id);

    const { status, scope } = req.query; // scope: 'mine' (default) | 'all'
    const filter = { workspaceId: { $in: workspaceIds } };

    if (status) filter.status = status;

    if (scope !== 'all') {
      filter['assignee.email'] = req.user.email; // default: only items assigned to me
    }

    const items = await ActionItem.find(filter).sort({ deadline: 1, createdAt: -1 });
    res.json({ actionItems: items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an action item (edit text, reassign, change deadline/priority)
router.patch('/:id', validateObjectId('id'), validate(actionItemSchemas.update), async (req, res) => {
  try {
    const allowedFields = ['title', 'description', 'assignee', 'deadline', 'priority'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const item = await ActionItem.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!item) return res.status(404).json({ error: 'Action item not found' });

    res.json({ actionItem: item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update status only (quick action — mark done/in-progress)
router.patch('/:id/status', validateObjectId('id'), validate(actionItemSchemas.updateStatus), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'in_progress', 'done', 'overdue'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const item = await ActionItem.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Action item not found' });

    res.json({ actionItem: item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a false-positive extraction
router.delete('/:id', validateObjectId('id'), async (req, res) => {
  try {
    const item = await ActionItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Action item not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Push an action item to Jira
router.post('/:id/push/jira', validateObjectId('id'), async (req, res) => {
  try {
    const item = await ActionItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Action item not found' });

    const alreadyPushed = item.pushedTo.some(p => p.tool === 'jira');
    if (alreadyPushed) {
      return res.status(409).json({ error: 'Already pushed to Jira' });
    }

    const pushResult = await pushActionItemToJira(req.user._id, item);

    item.pushedTo.push(pushResult);
    await item.save();

    res.json({ actionItem: item });
  } catch (err) {
    console.error('Jira push failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;