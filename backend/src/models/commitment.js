const mongoose = require('mongoose');

const commitmentSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true },
  madeBy: {
    name: { type: String, required: true },
    email: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  commitment: { type: String, required: true },
  deadline: Date,
  status: { type: String, enum: ['pending', 'fulfilled', 'broken', 'overdue'], default: 'pending' },
  followUpSentAt: Date,
  appearedInMeetings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Meeting' }],
}, { timestamps: true });

commitmentSchema.index({ workspaceId: 1, status: 1, deadline: 1 });

module.exports = mongoose.model('Commitment', commitmentSchema);