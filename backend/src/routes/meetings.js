const express = require('express');
const requireAuth = require('../middleware/auth');
const  Meeting = require('../models/meeting');
const Workspace  = require('../models/workspace');
const { extractFromTranscript } = require('../services/ai/extractor');
const { extractionQueue } = require('../lib/queue');
const { sendFollowUpsForMeeting } = require('../services/email/followUp');
const validate = require('../middleware/validate');
const validateObjectId = require('../middleware/validateObjectId');
const { meetingSchemas } = require('../validation/schemas');

const router = express.Router();

router.use(requireAuth);

// Create a meeting (transcript paste) — now with extraction
router.post('/', validate(meetingSchemas.create), async (req, res) => {
  try {
    const { title, rawTranscript, attendees = [], workspaceId ,duration} = req.body;

    if (!title || !rawTranscript) {
      return res.status(400).json({ error: 'Title and transcript are required' });
    }

    let resolvedWorkspaceId = workspaceId;
    if (!resolvedWorkspaceId) {
      const workspace = await Workspace.findOne({ 'members.userId': req.user._id });
      if (!workspace) {
        return res.status(400).json({ error: 'No workspace found. Create one first.' });
      }
      resolvedWorkspaceId = workspace._id;
    }

    // Create meeting in "processing" state first so we don't lose the transcript if extraction fails
    const meeting = await Meeting.create({
      workspaceId: resolvedWorkspaceId,
      createdBy: req.user._id,
      title,
      rawTranscript,
      attendees,
      duration,
      status: 'processing',
    });
    

    // Enqueue extraction — worker picks it up async
    await extractionQueue.add('extract', { meetingId: meeting._id.toString() }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    res.status(201).json({ meeting });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// List meetings for the user's workspace(s)
router.get('/', async (req, res) => {
  try {
    const workspaces = await Workspace.find({ 'members.userId': req.user._id }).select('_id');
    const workspaceIds = workspaces.map(w => w._id);

    const meetings = await Meeting.find({ workspaceId: { $in: workspaceIds } })
      .sort({ createdAt: -1 })
      .select('title date status createdAt attendees');

    res.json({ meetings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single meeting detail
router.get('/:id', validateObjectId('id'), async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    res.json({ meeting });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post('/:id/send-followups', validateObjectId('id'), async (req, res) => {
  try {
    const results = await sendFollowUpsForMeeting(req.params.id);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const { ActionItem, Commitment } = require('../models');

router.delete('/:id', validateObjectId('id'), async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    // Confirm the requester actually belongs to this meeting's workspace
    const workspace = await Workspace.findOne({
      _id: meeting.workspaceId,
      'members.userId': req.user._id,
    });
    if (!workspace) return res.status(403).json({ error: 'Not authorized to delete this meeting' });

    // Clean up related records so nothing orphaned is left behind
    await ActionItem.deleteMany({ meetingId: meeting._id });
    await Commitment.deleteMany({ meetingId: meeting._id });
    await Meeting.findByIdAndDelete(meeting._id);

    res.json({ message: 'Meeting and related data deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;