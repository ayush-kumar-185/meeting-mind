const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.2, // low temp — we want consistent structured output, not creativity
  },
});

function stripFences(text) {
  return text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
}

function validateExtraction(data) {
  const errors = [];
  if (typeof data.summary !== 'string') errors.push('summary missing or not a string');
  if (!Array.isArray(data.decisions)) errors.push('decisions missing or not an array');
  if (!Array.isArray(data.unresolvedIssues)) errors.push('unresolvedIssues missing or not an array');
  if (!Array.isArray(data.actionItems)) errors.push('actionItems missing or not an array');
  if (!Array.isArray(data.commitments)) errors.push('commitments missing or not an array');

  if (Array.isArray(data.actionItems)) {
    data.actionItems.forEach((item, i) => {
      if (!item.title) errors.push(`actionItems[${i}] missing title`);
    });
  }

  return errors;
}

async function extractFromTranscript(transcript, attendees = [], retries = 2) {
  if (transcript && transcript.length > 100000) {
    throw new Error('Transcript exceeds the maximum allowed length of 100,000 characters.');
  }
  const prompt = buildExtractionPrompt(transcript, attendees);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const rawText = result.response.text();
      const cleaned = stripFences(rawText);

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        throw new Error(`JSON parse failed: ${parseErr.message}`);
      }

      const validationErrors = validateExtraction(parsed);
      if (validationErrors.length > 0) {
        throw new Error(`Schema validation failed: ${validationErrors.join('; ')}`);
      }

      return parsed;
    } catch (err) {
      const isLastAttempt = attempt === retries;
      console.error(`Extraction attempt ${attempt + 1} failed: ${err.message}`);
      if (isLastAttempt) {
        throw new Error(`AI extraction failed after ${retries + 1} attempts: ${err.message}`);
      }
      // brief backoff before retry
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

function buildExtractionPrompt(transcript, attendees) {
  const attendeeList = attendees.length
    ? `Attendees in this meeting: ${attendees.map(a => a.name).join(', ')}. Only assign action items to these people — if the owner is unclear or not one of these names, set assignee to null.`
    : 'No attendee list provided — infer names from the transcript, or use null if unclear.';

  return `You are an expert meeting analyst. Extract structured data from the meeting transcript below.

${attendeeList}

Return ONLY valid JSON matching this exact schema, no markdown, no preamble, no explanation:
{
  "summary": "2-3 sentence summary of what the meeting was about",
  "decisions": ["concrete decisions that were made"],
  "unresolvedIssues": ["open questions, undecided topics, unresolved conflicts, or unclear investigations (NOT concrete tasks)"],
  "actionItems": [
    { "title": "short imperative title", "description": "one sentence of context", "assignee": "name or null", "deadline": "YYYY-MM-DD or null", "priority": "high|medium|low" }
  ],
  "commitments": [
    { "madeBy": "name", "commitment": "what they explicitly committed to doing", "deadline": "YYYY-MM-DD or null" }
  ]
}

Rules:
- CLASSIFICATION DISTINCTION:
  - Action Item: A concrete task that needs to be DONE (e.g. "We need to verify Redis"). Even if it's unassigned, if it's a concrete task, it's an Action Item.
  - Unresolved Issue: A topic that needs to be decided, clarified, or agreed upon (e.g. "We haven't decided whether to deploy on Friday"). DO NOT classify unassigned Action Items as Unresolved Issues.
  - Decision: If an issue reaches a conclusion (e.g. "We decided to deploy Monday"), it is a Decision, NOT an Unresolved Issue.
  - Commitment: If a person explicitly commits to a task (e.g. "Ayush: I'll complete testing by Friday"), capture it as BOTH an Action Item AND a Commitment.
- If no clear owner is stated for an action item, set assignee to null. Do not guess based on who talks most.
- If no deadline is mentioned, set deadline to null. Do not invent dates.
- decisions and unresolvedIssues can be empty arrays if none exist — do not fabricate content to fill them.
- priority: infer from urgency language in the transcript (e.g. "urgent", "ASAP" = high; casual mentions = low). Default to "medium" if unclear.

TRANSCRIPT:
${transcript}`;
}

module.exports = { extractFromTranscript };