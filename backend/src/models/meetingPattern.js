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
}, { timestamps: true });

meetingPatternSchema.index({ workspaceId: 1, resolved: 1 });

module.exports = mongoose.model('MeetingPattern', meetingPatternSchema);