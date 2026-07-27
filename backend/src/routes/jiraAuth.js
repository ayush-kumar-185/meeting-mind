const express = require('express');
const axios = require('axios');
const requireAuth = require('../middleware/auth');
const { User } = require('../models');

const router = express.Router();

// Step 1: redirect user to Atlassian consent screen
router.get('/connect', requireAuth, (req, res) => {
  const scopes = ['read:jira-work', 'write:jira-work', 'offline_access'].join(' ');
  const state = req.user._id.toString(); // pass userId through state to identify on callback

  const authUrl = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${process.env.JIRA_CLIENT_ID}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(process.env.JIRA_CALLBACK_URL)}&state=${state}&response_type=code&prompt=consent`;

  res.redirect(authUrl);
});

// Step 2: Atlassian redirects back here with a code
router.get('/callback', async (req, res) => {
  const { code, state: userId } = req.query;

  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL}/dashboard/settings?jira_error=missing_code`);
  }

  try {
    // Exchange code for access + refresh tokens
    const tokenRes = await axios.post('https://auth.atlassian.com/oauth/token', {
      grant_type: 'authorization_code',
      client_id: process.env.JIRA_CLIENT_ID,
      client_secret: process.env.JIRA_CLIENT_SECRET,
      code,
      redirect_uri: process.env.JIRA_CALLBACK_URL,
    });

    const { access_token, refresh_token } = tokenRes.data;

    // Get accessible Jira sites (cloudId) for this token
    const resourcesRes = await axios.get('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!resourcesRes.data.length) {
      return res.redirect(`${process.env.FRONTEND_URL}/dashboard/settings?jira_error=no_sites`);
    }

    const cloudId = resourcesRes.data[0].id; // first available Jira site

    await User.findByIdAndUpdate(userId, {
      'integrations.jira.accessToken': access_token,
      'integrations.jira.refreshToken': refresh_token,
      'integrations.jira.cloudId': cloudId,
      'integrations.jira.connected': true,
    });

    res.redirect(`${process.env.FRONTEND_URL}/dashboard/settings?jira_connected=true`);
  } catch (err) {
    console.error('Jira OAuth error:', err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL}/dashboard/settings?jira_error=token_exchange_failed`);
  }
});

// Step 3: Disconnect Jira
router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $unset: { 'integrations.jira': '' }
    });
    res.json({ message: 'Jira disconnected successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;