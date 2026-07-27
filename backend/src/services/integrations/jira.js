const axios = require('axios');
const { User } = require('../../models');

async function getValidJiraToken(userId) {
  const user = await User.findById(userId);
  if (!user?.integrations?.jira?.connected) {
    throw new Error('Jira not connected for this user');
  }

  try {
    const refreshRes = await axios.post('https://auth.atlassian.com/oauth/token', {
      grant_type: 'refresh_token',
      client_id: process.env.JIRA_CLIENT_ID,
      client_secret: process.env.JIRA_CLIENT_SECRET,
      refresh_token: user.integrations.jira.refreshToken,
    });

    const { access_token, refresh_token: newRefreshToken } = refreshRes.data;

    user.integrations.jira.accessToken = access_token;
    user.integrations.jira.refreshToken = newRefreshToken;
    await user.save();

    return { accessToken: access_token, cloudId: user.integrations.jira.cloudId };
  } catch (err) {
    console.error('Jira token refresh failed:', err.response?.data || err.message);
    throw new Error('Failed to refresh Jira token — user may need to reconnect');
  }
}

async function getFirstProjectKey(accessToken, cloudId) {
  const res = await axios.get(
    `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project/search`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.data.values?.length) {
    throw new Error('No Jira projects found — create a project in your Jira site first');
  }

  return res.data.values[0].key; // use the first project for simplicity
}

async function pushActionItemToJira(userId, actionItem) {
  const { accessToken, cloudId } = await getValidJiraToken(userId);
  const projectKey = await getFirstProjectKey(accessToken, cloudId);

  const priorityMap = { high: 'High', medium: 'Medium', low: 'Low' };

  const payload = {
    fields: {
      project: { key: projectKey },
      summary: actionItem.title,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: actionItem.description || 'Created from MeetingMind extraction.',
              },
            ],
          },
        ],
      },
      issuetype: { name: 'Task' },
      ...(actionItem.deadline && { duedate: actionItem.deadline.toISOString().split('T')[0] }),
    },
  };

  const res = await axios.post(
    `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue`,
    payload,
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
  );

  const issueKey = res.data.key; // e.g. "PROJ-123"
  const siteRes = await axios.get('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const siteUrl = siteRes.data.find(s => s.id === cloudId)?.url;

  return {
    tool: 'jira',
    externalId: issueKey,
    externalUrl: `${siteUrl}/browse/${issueKey}`,
  };
}

module.exports = { getValidJiraToken, pushActionItemToJira };