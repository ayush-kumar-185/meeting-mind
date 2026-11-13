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

const PATTERN_SIMILARITY_THRESHOLD = 0.85;

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-2' });
async function generateEmbedding(text) {
  try {
    const result = await embeddingModel.embedContent({
      content: { role: 'user', parts: [{ text }] },
      outputDimensionality: 768
    });
    const values = result.embedding.values;
    if (!values || values.length !== 768) {
      console.error(`Embedding API returned invalid dimension: ${values ? values.length : 'null'}`);
      return null;
    }
    return values;
  } catch (error) {
    console.error('Embedding API failure:', error.message);
    return null; // Handle failure safely
  }
}

async function detectResolutions(activePatterns, recentMeetings) {
  if (!activePatterns || activePatterns.length === 0 || !recentMeetings || recentMeetings.length === 0) {
    return [];
  }
  
  const patternSummaries = activePatterns.map(p => ({
    patternId: p._id.toString(),
    description: p.description,
    type: p.type
  }));
  
  const meetingSummaries = recentMeetings.map(m => ({
    meetingId: m._id.toString(),
    title: m.title,
    date: m.date,
    decisions: m.decisions,
    unresolvedIssues: m.unresolvedIssues
  }));
  
  const prompt = `You are analyzing recent meeting summaries to determine if any active unresolved issues/patterns have been explicitly resolved.

Active Patterns:
${JSON.stringify(patternSummaries, null, 2)}

Recent Meetings:
${JSON.stringify(meetingSummaries, null, 2)}

Rules for resolution:
1. A pattern is resolved ONLY if there is explicit evidence it has been fixed, closed, or successfully addressed.
2. Discussion, investigation, or planning to fix it is NOT resolution.
3. If it's still failing, it is NOT resolved.
4. Prefer phrases like: fixed, resolved, successfully addressed, no longer occurring, deployed a fix.

Return ONLY valid JSON, no markdown, no preamble:
{
  "resolvedPatterns": [
    {
      "patternId": "...",
      "meetingId": "...",
      "evidence": "..."
    }
  ]
}

If nothing is resolved, return { "resolvedPatterns": [] }.`;

  const result = await model.generateContent(prompt);
  const cleaned = stripFences(result.response.text());
  const parsed = JSON.parse(cleaned);
  return parsed.resolvedPatterns || [];
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
1. "recurring_blocker" — A problem that repeatedly blocks progress or causes recurring technical/business failures across 2+ different meetings.
2. "unresolved_topic" — A question, decision, ambiguity, or issue that remains unresolved and requires clarification or resolution across 2+ different meetings.
3. "repeated_commitment" — A similar type of promise/commitment appearing repeatedly (may indicate an accountability gap)

Only report patterns with clear evidence across multiple meetings — do not invent patterns from a single meeting or force a match that isn't really there.

CRITICAL INSTRUCTION FOR DESCRIPTIONS:
The 'description' MUST represent the underlying problem itself.
- Make it concise, specific, and factual (maximum ~15 words).
- Focus on WHAT the underlying issue is, NOT the meeting history.
- DO NOT mention occurrence counts, previous meetings, or whether the issue was resolved.
- DO NOT include long narrative context.
- BAD: "The Jira authentication problem is a persistent topic that repeatedly surfaces in meetings..."
- GOOD: "Jira authentication and token renewal failures"
- BAD: "The team repeatedly discusses delayed API performance and has decided several times to investigate it..."
- GOOD: "API response latency under concurrent load"


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

  let existingPatterns = await MeetingPattern.find({ workspaceId, resolved: false });
  
  try {
    const resolutions = await detectResolutions(existingPatterns, meetings);
    for (const res of resolutions) {
      if (!res.patternId || !res.meetingId || !res.evidence) continue;
      
      const pattern = existingPatterns.find(p => p._id.toString() === res.patternId);
      const meeting = meetings.find(m => m._id.toString() === res.meetingId);
      
      if (pattern && meeting) {
        pattern.resolved = true;
        pattern.resolvedAt = new Date();
        pattern.resolvedMeetingId = meeting._id;
        pattern.resolutionEvidence = res.evidence;
        await pattern.save();
      }
    }
  } catch (err) {
    console.error('Resolution detection failed:', err.message);
  }
  
  existingPatterns = existingPatterns.filter(p => !p.resolved);

  const result = await model.generateContent(prompt);
  const cleaned = stripFences(result.response.text());
  const parsed = JSON.parse(cleaned);

  const created = [];

  for (const p of parsed.patterns || []) {
    let existing = null;
    const newEmbedding = await generateEmbedding(p.description);

    if (newEmbedding) {
      let maxSim = -1;
      let bestMatch = null;
      for (const ep of existingPatterns) {
        if (!ep.embedding || ep.embedding.length === 0) continue; // Skip candidates without embedding
        const sim = cosineSimilarity(newEmbedding, ep.embedding);
        if (sim > maxSim) {
          maxSim = sim;
          bestMatch = ep;
        }
      }
      if (maxSim >= PATTERN_SIMILARITY_THRESHOLD) {
        existing = bestMatch;
      }
    }

    // Fallback to exact match (Stage 1 behavior) if embedding fails or no semantic match
    if (!existing) {
      existing = existingPatterns.find(ep => ep.type === p.type && ep.description === p.description);
    }

    if (existing) {
      // Prevent duplicate occurrences
      let hasNewOccurrences = false;
      const now = new Date();
      
      for (const mId of p.meetingIds) {
        const isDuplicate = existing.occurrences.some(o => o.meetingId.toString() === mId.toString());
        if (!isDuplicate) {
          existing.occurrences.push({
            meetingId: mId,
            detectedAt: now,
            issueText: p.description
          });
          hasNewOccurrences = true;
        }
      }

      if (hasNewOccurrences) {
        existing.occurrenceCount = existing.occurrences.length;
        existing.lastDetectedAt = now;
      }
      
      existing.meetingIds = [...new Set([...existing.meetingIds.map(String), ...p.meetingIds])];
      existing.lastSeenAt = now;
      await existing.save();
      created.push(existing);
    } else {
      const now = new Date();
      const occurrences = p.meetingIds.map(mId => ({
        meetingId: mId,
        detectedAt: now,
        issueText: p.description
      }));

      const pattern = await MeetingPattern.create({
        workspaceId,
        type: p.type,
        description: p.description,
        meetingIds: p.meetingIds,
        occurrences,
        occurrenceCount: occurrences.length,
        firstDetectedAt: now,
        lastDetectedAt: now,
        embedding: newEmbedding || undefined
      });
      existingPatterns.push(pattern); // Add to in-memory list for subsequent matches in the same run
      created.push(pattern);
    }
  }

  return { patternsFound: created.length, patterns: created };
}

module.exports = { detectPatternsForWorkspace };