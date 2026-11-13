const express = require('express');
const requireAuth = require('../middleware/auth');
const { MeetingPattern, Workspace } = require('../models');
const { detectPatternsForWorkspace } = require('../services/ai/patternDetector');
const validateObjectId = require('../middleware/validateObjectId');
const { verifyWorkspaceAccess } = require('../middleware/workspaceAuth');
const rateLimit = require('../middleware/rateLimit');

const router = express.Router();
router.use(requireAuth);
router.use(rateLimit(100, 60)); // Standard limit

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

    const patterns = await MeetingPattern.find({ workspaceId: { $in: workspaceIds }, resolved: false })
      .sort({ score: -1, lastSeenAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ 
      patterns,
      pagination: {
        page,
        limit,
        hasMore: patterns.length === limit
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/scan', rateLimit(2, 60), async (req, res) => {
  try {
    const workspaces = await Workspace.find({ 'members.userId': req.user._id }).select('_id');
    if (!workspaces.length) {
       return res.status(400).json({ error: 'No workspaces found for user' });
    }

    let totalCreated = 0;
    let allPatterns = [];
    let skippedCount = 0;

    for (const ws of workspaces) {
      const result = await detectPatternsForWorkspace(ws._id);
      if (result.skipped) {
        skippedCount++;
      } else {
        totalCreated += result.patternsFound || 0;
        allPatterns = allPatterns.concat(result.patterns || []);
      }
    }

    if (skippedCount === workspaces.length) {
       return res.json({ skipped: true, reason: 'Need at least 3 processed meetings in a single workspace to detect patterns' });
    }

    res.json({ patternsFound: totalCreated, patterns: allPatterns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/resolve', validateObjectId('id'), async (req, res) => {
  try {
    const pattern = await MeetingPattern.findById(req.params.id);
    if (!pattern) return res.status(404).json({ error: 'Pattern not found' });
    if (!(await verifyWorkspaceAccess(req.user._id, pattern.workspaceId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    pattern.resolved = true;
    pattern.resolvedAt = new Date();
    await pattern.save();
    
    res.json({ pattern });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;