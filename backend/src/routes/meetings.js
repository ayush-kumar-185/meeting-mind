const express = require('express');
const requireAuth = require('../middleware/auth');
const  Meeting = require('../models/meeting');
const Workspace  = require('../models/workspace');
const { extractFromTranscript } = require('../services/ai/extractor');
const { extractionQueue, emailQueue } = require('../lib/queue');
const validate = require('../middleware/validate');
const validateObjectId = require('../middleware/validateObjectId');
const { meetingSchemas } = require('../validation/schemas');
const { verifyWorkspaceAccess } = require('../middleware/workspaceAuth');
const rateLimit = require('../middleware/rateLimit');

const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const os = require('os');
const fs = require('fs');

const upload = multer({
  storage: multer.diskStorage({ dest: os.tmpdir() }),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const router = express.Router();

router.use(requireAuth);
router.use(rateLimit(100, 60)); // Standard limit for all meeting endpoints

router.post('/parse-transcript', rateLimit(10, 60), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { mimetype, path: tempPath, originalname } = req.file;
    let text = '';

    try {
      const buffer = await fs.promises.readFile(tempPath);

      if (mimetype === 'text/plain') {
        text = buffer.toString('utf-8');
      } else if (mimetype === 'application/pdf') {
        try {
          const pdfData = await pdfParse(buffer);
          text = pdfData.text;
        } catch (err) {
          return res.status(400).json({ error: 'We couldn\'t extract text from this PDF. Please try another file or paste the transcript manually.' });
        }
      } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || originalname.endsWith('.docx')) {
        try {
          const docxData = await mammoth.extractRawText({ buffer });
          text = docxData.value;
        } catch (err) {
          return res.status(400).json({ error: 'Failed to extract text from DOCX. It might be corrupted.' });
        }
      } else {
        return res.status(400).json({ error: 'Unsupported file type. Please upload a TXT, DOCX, or PDF transcript.' });
      }

      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'No readable transcript was found in this file.' });
      }

      res.json({ text: text.trim(), wordCount: text.trim().split(/\s+/).length, fileName: originalname });
    } finally {
      await fs.promises.unlink(tempPath).catch(err => console.error('Failed to cleanup temp file:', err));
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse file. ' + err.message });
  }
});

// Create a meeting (transcript paste) — now with extraction
router.post('/', rateLimit(10, 60), validate(meetingSchemas.create), async (req, res) => {
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
    let page = parseInt(req.query.page);
    if (isNaN(page) || page < 1) page = 1;
    let limit = parseInt(req.query.limit);
    if (isNaN(limit) || limit < 1) limit = 50;
    limit = Math.min(limit, 100);
    
    const skip = (page - 1) * limit;

    const workspaces = await Workspace.find({ 'members.userId': req.user._id }).select('_id');
    const workspaceIds = workspaces.map(w => w._id);

    const meetings = await Meeting.find({ workspaceId: { $in: workspaceIds } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('title date status createdAt attendees');

    res.json({ 
      meetings,
      pagination: {
        page,
        limit,
        hasMore: meetings.length === limit
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single meeting detail
router.get('/:id', validateObjectId('id'), async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (!(await verifyWorkspaceAccess(req.user._id, meeting.workspaceId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    res.json({ meeting });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post('/:id/send-followups', rateLimit(10, 60), validateObjectId('id'), async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (!(await verifyWorkspaceAccess(req.user._id, meeting.workspaceId))) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    let queuedCount = 0;
    for (const attendee of meeting.attendees) {
      if (attendee.email) {
        await emailQueue.add('send-email', 
          { meetingId: meeting._id.toString(), attendee },
          { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
        );
        queuedCount++;
      }
    }

    // Return 202 Accepted, preserving the legacy frontend expectation of `{ results }` if possible, 
    // but clearly indicating they are queued.
    res.status(202).json({ 
      message: 'Follow-up emails queued for delivery',
      results: [{ message: `${queuedCount} emails queued` }] // Minimal frontend shim
    });
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