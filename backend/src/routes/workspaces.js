const express = require('express');
const requireAuth = require('../middleware/auth');
const Workspace = require('../models/workspace');
const User = require('../models/user');
const { sendInviteEmail } = require('../services/email/invite');
const { Meeting, ActionItem, Commitment, MeetingPattern } = require('../models');
const validate = require('../middleware/validate');
const validateObjectId = require('../middleware/validateObjectId');
const { workspaceSchemas } = require('../validation/schemas');

const router = express.Router();

router.use(requireAuth); // every route below requires auth

// Create workspace
router.post('/', validate(workspaceSchemas.create), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Workspace name is required' });

    const workspace = await Workspace.create({
      name,
      ownerId: req.user._id,
      members: [{ userId: req.user._id, email: req.user.email, name: req.user.name, role: 'admin', status: 'active' }],
    });

    res.status(201).json({ workspace });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List workspaces the current user belongs to
router.get('/', async (req, res) => {
  try {
    const workspaces = await Workspace.find({ 'members.userId': req.user._id })
      .sort({ createdAt: -1 });
    res.json({ workspaces });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List pending invites addressed to the current signed-in user
// MUST be registered before '/:id' to avoid any ambiguity with route matching
router.get('/invites/pending', async (req, res) => {
  try {
    const workspaces = await Workspace.find({
      members: {
        $elemMatch: { email: req.user.email, status: 'pending' },
      },
    }).select('name members ownerId');

    const invites = workspaces.map(ws => {
      const member = ws.members.find(m => m.email === req.user.email && m.status === 'pending');
      return { workspaceId: ws._id, workspaceName: ws.name, role: member.role };
    });

    res.json({ invites });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a single workspace (must be a member)
router.get('/:id', validateObjectId('id'), async (req, res) => {
  try {
    const workspace = await Workspace.findOne({
      _id: req.params.id,
      'members.userId': req.user._id,
    });
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    res.json({ workspace });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Invite a member by email
router.post('/:id/invite', validateObjectId('id'), validate(workspaceSchemas.invite), async (req, res) => {
  try {
    const { email, name,title, role = 'member' } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    if (email.toLowerCase() === req.user.email.toLowerCase()) {
      return res.status(400).json({ error: "You can't invite yourself" });
    }

    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const isAdmin = workspace.members.some(
      m => m.userId?.toString() === req.user._id.toString() && m.role === 'admin'
    );
    if (!isAdmin) return res.status(403).json({ error: 'Only admins can invite members' });

    const alreadyMember = workspace.members.some(m => m.email === email);
    if (alreadyMember) return res.status(409).json({ error: 'User already invited or a member' });

    const existingUser = await User.findOne({ email });

    workspace.members.push({
      userId: existingUser?._id,
      email,
      name: name || existingUser?.name || email.split('@')[0],
      title,
      role,
      status: 'pending',
    });
    await workspace.save();

    // Send the invite email — don't let a failed send block the invite itself
    try {
      await sendInviteEmail({
        toEmail: email,
        toName: name,
        inviterName: req.user.name,
        workspaceName: workspace.name,
        role,
      });
    } catch (emailErr) {
      console.error('Failed to send invite email:', emailErr.message);
      // invite still succeeds even if the email fails — don't roll back the membership
    }

    res.json({ workspace });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// Accept an invite
router.post('/:id/accept-invite', validateObjectId('id'), async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const member = workspace.members.find(m => m.email === req.user.email);
    if (!member) return res.status(404).json({ error: 'No invite found for this account' });
    if (member.status === 'active') return res.status(409).json({ error: 'Already an active member' });

    member.status = 'active';
    member.userId = req.user._id; // link now that they've signed in and accepted
    await workspace.save();

    res.json({ workspace });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Decline an invite
router.post('/:id/decline-invite', validateObjectId('id'), async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const member = workspace.members.find(m => m.email === req.user.email);
    if (!member) return res.status(404).json({ error: 'No invite found for this account' });
    if (member.status !== 'pending') {
      return res.status(409).json({ error: 'This invite is no longer pending' });
    }

    // Remove the member entry entirely — a declined invite shouldn't leave a stale record behind
    workspace.members = workspace.members.filter(m => m.email !== req.user.email);
    await workspace.save();

    res.json({ message: 'Invite declined' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a member's role
router.patch('/:id/members/:memberEmail/role', validateObjectId('id'), validate(workspaceSchemas.updateRole), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin or member' });
    }

    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const isAdmin = workspace.members.some(
      m => m.userId?.toString() === req.user._id.toString() && m.role === 'admin'
    );
    if (!isAdmin) return res.status(403).json({ error: 'Only admins can change roles' });

    const member = workspace.members.find(m => m.email === req.params.memberEmail);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    member.role = role;
    await workspace.save();

    res.json({ workspace });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove a member
router.delete('/:id/members/:memberEmail', validateObjectId('id'), async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const isAdmin = workspace.members.some(
      m => m.userId?.toString() === req.user._id.toString() && m.role === 'admin'
    );
    if (!isAdmin) return res.status(403).json({ error: 'Only admins can remove members' });

    workspace.members = workspace.members.filter(m => m.email !== req.params.memberEmail);
    await workspace.save();

    res.json({ workspace });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a workspace — owner only (more restrictive than admin, since this is fully destructive)
router.delete('/:id', validateObjectId('id'), async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    if (workspace.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the workspace owner can delete it' });
    }

    // Cascade delete everything scoped to this workspace
    const meetings = await Meeting.find({ workspaceId: workspace._id }).select('_id');
    const meetingIds = meetings.map(m => m._id);

    await ActionItem.deleteMany({ workspaceId: workspace._id });
    await Commitment.deleteMany({ workspaceId: workspace._id });
    await MeetingPattern.deleteMany({ workspaceId: workspace._id });
    await Meeting.deleteMany({ workspaceId: workspace._id });
    await Workspace.findByIdAndDelete(workspace._id);

    res.json({ message: 'Workspace and all related data deleted', deletedMeetings: meetingIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;