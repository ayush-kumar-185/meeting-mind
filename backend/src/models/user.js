const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  avatarUrl: String,
  timezone: { type: String, default: 'UTC' },
  integrations: {
    jira: {
      accessToken: String,
      refreshToken: String,
      cloudId: String,
      connected: { type: Boolean, default: false },
    },
    linear: {
      accessToken: String,
      connected: { type: Boolean, default: false },
    },
    notion: {
      accessToken: String,
      connected: { type: Boolean, default: false },
    },
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);