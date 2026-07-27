const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    email: { type: String, required: true },
    name: { type: String },
    title: { type: String }, // NEW — job role/title, e.g. "Developer", "Designer", "PM"
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    status: { type: String, enum: ['pending', 'active'], default: 'pending' },
  }],
  settings: {
    defaultIntegration: { type: String, enum: ['jira', 'linear', 'notion'], default: 'jira' },
    autoSendFollowUp: { type: Boolean, default: false },
    reminderLeadHours: { type: Number, default: 24 },
  },
}, { timestamps: true });

module.exports = mongoose.model('Workspace', workspaceSchema);