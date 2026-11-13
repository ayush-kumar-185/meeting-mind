const express = require('express');
const requireAuth = require('../middleware/auth');
const  ActionItem= require('../models/actionItem');
const  Workspace  = require('../models/workspace');
const { jiraQueue } = require('../lib/queue');
const validate = require('../middleware/validate');
const validateObjectId = require('../middleware/validateObjectId');
const { actionItemSchemas } = require('../validation/schemas');
const { verifyWorkspaceAccess } = require('../middleware/workspaceAuth');
const Meeting = require('../models/meeting');
const rateLimit = require('../middleware/rateLimit');

const router = express.Router();

router.use(requireAuth);
router.use(rateLimit(100, 60)); // Standard limit for all action item endpoints

// List action items for a meeting
router.get('/meeting/:meetingId', validateObjectId('meetingId'), async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (!(await verifyWorkspaceAccess(req.user._id, meeting.workspaceId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }

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
    let page = parseInt(req.query.page);
    if (isNaN(page) || page < 1) page = 1;
    let limit = parseInt(req.query.limit);
    if (isNaN(limit) || limit < 1) limit = 50;
    limit = Math.min(limit, 100);
    
    const skip = (page - 1) * limit;

    const workspaces = await Workspace.find({ 'members.userId': req.user._id }).select('_id');
    const workspaceIds = workspaces.map(w => w._id);

    const { status, scope } = req.query; // scope: 'mine' (default) | 'all'
    const filter = { workspaceId: { $in: workspaceIds } };

    if (status) filter.status = status;

    if (scope !== 'all') {
      filter['assignee.email'] = req.user.email; // default: only items assigned to me
    }

    const items = await ActionItem.find(filter)
      .sort({ deadline: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ 
      actionItems: items,
      pagination: {
        page,
        limit,
        hasMore: items.length === limit
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an action item (edit text, reassign, change deadline/priority)
router.patch('/:id', validateObjectId('id'), validate(actionItemSchemas.update), async (req, res) => {
  try {
    const item = await ActionItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Action item not found' });
    if (!(await verifyWorkspaceAccess(req.user._id, item.workspaceId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const allowedFields = ['title', 'description', 'assignee', 'deadline', 'priority'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) item[field] = req.body[field];
    }
    
    await item.save();

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

    const item = await ActionItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Action item not found' });
    if (!(await verifyWorkspaceAccess(req.user._id, item.workspaceId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    item.status = status;
    await item.save();

    res.json({ actionItem: item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a false-positive extraction
router.delete('/:id', validateObjectId('id'), async (req, res) => {
  try {
    const item = await ActionItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Action item not found' });
    if (!(await verifyWorkspaceAccess(req.user._id, item.workspaceId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await ActionItem.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Push an action item to Jira
router.post('/:id/push/jira', rateLimit(10, 60), validateObjectId('id'), async (req, res) => {
  try {
    const item = await ActionItem.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Action item not found' });
    if (!(await verifyWorkspaceAccess(req.user._id, item.workspaceId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const alreadyPushed = item.pushedTo.some(p => p.tool === 'jira');
    if (alreadyPushed) {
      return res.status(409).json({ error: 'Already pushed to Jira' });
    }

    await jiraQueue.add('push-jira', 
      { actionItemId: item._id.toString(), userId: req.user._id.toString() },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
    );

    res.status(202).json({ 
      message: 'Jira push queued',
      actionItem: item // return existing item, frontend will have to poll or assume success for V1
    });
  } catch (err) {
    console.error('Jira push failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;