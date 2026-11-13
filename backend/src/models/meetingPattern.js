const mongoose = require('mongoose');

const meetingPatternSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  type: {
    type: String,
    enum: ['recurring_blocker', 'unresolved_topic', 'repeated_commitment'],
    required: true,
  },
  description: { type: String, required: true },
  meetingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' }],
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false },
  resolvedAt: { type: Date },
  resolvedMeetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' },
  resolutionEvidence: { type: String },
  
  // Stage 1 Tracking
  title: { type: String },
  occurrences: [{
    meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true },
    detectedAt: { type: Date, default: Date.now },
    issueText: { type: String }
  }],
  occurrenceCount: { type: Number, default: 0 },
  firstDetectedAt: { type: Date },
  lastDetectedAt: { type: Date },
  
  // Stage 2 Tracking
  embedding: { type: [Number] }
}, { timestamps: true });

meetingPatternSchema.index({ workspaceId: 1, resolved: 1 });

module.exports = mongoose.model('MeetingPattern', meetingPatternSchema);