const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  date: { type: Date, default: Date.now },
  duration: Number, // minutes
  attendees: [{
    name: { type: String, required: true },
    email: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],
  rawTranscript: { type: String, required: true },
  status: { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing' },
  summary: String,
  decisions: [String],
  unresolvedIssues: [String],
  roiScore: {
    totalCost: Number,
    decisionsCount: Number,
    actionItemsCount: Number,
    efficiencyScore: Number,
  },
}, { timestamps: true });

meetingSchema.index({ workspaceId: 1, createdAt: -1 });

module.exports = mongoose.model('Meeting', meetingSchema);