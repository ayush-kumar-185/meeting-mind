const mongoose = require('mongoose');

const actionItemSchema = new mongoose.Schema({
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  assignee: {
    name: String, // null/undefined if unassigned
    email: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  title: { type: String, required: true },
  description: String,
  deadline: Date,
  priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  status: { type: String, enum: ['pending', 'in_progress', 'done', 'overdue'], default: 'pending' },
  pushedTo: [{
    tool: { type: String, enum: ['jira', 'linear', 'notion'] },
    externalId: String,
    externalUrl: String,
  }],
  reminderSentAt: Date,
}, { timestamps: true });

actionItemSchema.index({ meetingId: 1 });
actionItemSchema.index({ 'assignee.email': 1, status: 1 });

module.exports = mongoose.model('ActionItem', actionItemSchema);