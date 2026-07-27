const { GoogleGenerativeAI } = require('@google/generative-ai');
const Meeting = require('../../models/meeting');
const MeetingPattern  = require('../../models/meetingPattern');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
});

function stripFences(text) {
  return text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
}

async function detectPatternsForWorkspace(workspaceId) {
  const meetings = await Meeting.find({ workspaceId, status: 'ready' })
    .sort({ date: -1 })
    .limit(10) // last 10 meetings — enough context without an oversized prompt
    .select('_id title date unresolvedIssues decisions');

  if (meetings.length < 3) {
    return { skipped: true, reason: 'Need at least 3 processed meetings to detect patterns' };
  }

  const meetingSummaries = meetings.map(m => ({
    id: m._id.toString(),
    title: m.title,
    date: m.date,
    unresolvedIssues: m.unresolvedIssues,
    decisions: m.decisions,
  }));

  const prompt = `You are analyzing a team's meeting history to find recurring patterns.

Here are summaries of their last ${meetings.length} meetings (most recent first):
${JSON.stringify(meetingSummaries, null, 2)}

Identify:
1. "recurring_blocker" — the same unresolved issue or blocker appearing across 2+ different meetings
2. "unresolved_topic" — a topic that keeps getting discussed/decided on but never seems to close
3. "repeated_commitment" — a similar type of promise/commitment appearing repeatedly (may indicate an accountability gap)

Only report patterns with clear evidence across multiple meetings — do not invent patterns from a single meeting or force a match that isn't really there.

Return ONLY valid JSON, no markdown, no preamble:
{
  "patterns": [
    {
      "type": "recurring_blocker|unresolved_topic|repeated_commitment",
      "description": "plain description of the pattern",
      "meetingIds": ["id1", "id2"]
    }
  ]
}

If no genuine patterns exist, return { "patterns": [] } — do not fabricate content to fill the response.`;

  const result = await model.generateContent(prompt);
  const cleaned = stripFences(result.response.text());
  const parsed = JSON.parse(cleaned);

  const created = [];
  for (const p of parsed.patterns || []) {
    // avoid duplicate patterns — check if a similar unresolved one already exists
    const existing = await MeetingPattern.findOne({
      workspaceId,
      type: p.type,
      description: p.description,
      resolved: false,
    });

    if (existing) {
      existing.meetingIds = [...new Set([...existing.meetingIds.map(String), ...p.meetingIds])];
      existing.lastSeenAt = new Date();
      await existing.save();
      created.push(existing);
    } else {
      const pattern = await MeetingPattern.create({
        workspaceId,
        type: p.type,
        description: p.description,
        meetingIds: p.meetingIds,
      });
      created.push(pattern);
    }
  }

  return { patternsFound: created.length, patterns: created };
}

module.exports = { detectPatternsForWorkspace };