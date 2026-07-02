const express = require('express');
const requireAuth = require('../middleware/auth');
const Workspace = require('../models/workspace');
const User = require('../models/user');

const router = express.Router();

router.use(requireAuth); // every route below requires auth

// Create workspace
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Workspace name is required' });

    const workspace = await Workspace.create({
      name,
      ownerId: req.user._id,
      members: [{ userId: req.user._id, email: req.user.email, role: 'admin' }],
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

// Get a single workspace (must be a member)
router.get('/:id', async (req, res) => {
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
router.post('/:id/invite', async (req, res) => {
  try {
    const { email, role = 'member' } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const isAdmin = workspace.members.some(
      m => m.userId.toString() === req.user._id.toString() && m.role === 'admin'
    );
    if (!isAdmin) return res.status(403).json({ error: 'Only admins can invite members' });

    const alreadyMember = workspace.members.some(m => m.email === email);
    if (alreadyMember) return res.status(409).json({ error: 'User already a member' });

    // Link to an existing User doc if they've already signed in with Google before
    const existingUser = await User.findOne({ email });

    workspace.members.push({
      userId: existingUser?._id,
      email,
      role,
    });
    await workspace.save();

    res.json({ workspace });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a member's role
router.patch('/:id/members/:memberEmail/role', async (req, res) => {
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
router.delete('/:id/members/:memberEmail', async (req, res) => {
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

module.exports = router;