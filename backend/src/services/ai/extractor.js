const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: {
    responseMimeType: 'application/json',
  },
});

async function extractFromTranscript(transcript, attendees = []) {
  const prompt = buildExtractionPrompt(transcript, attendees);

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse AI response as JSON: ${err.message}`);
  }
}

function buildExtractionPrompt(transcript, attendees) {
  const attendeeList = attendees.length
    ? `Attendees in this meeting: ${attendees.map(a => a.name).join(', ')}.`
    : 'No attendee list provided — infer names from the transcript.';

  return `You are an expert meeting analyst. Extract structured data from the meeting transcript below.

${attendeeList}

Return ONLY valid JSON matching this exact schema, no markdown, no preamble:
{
  "summary": "2-3 sentence summary",
  "decisions": ["decision 1", "decision 2"],
  "unresolvedIssues": ["issue 1"],
  "actionItems": [
    { "title": "", "description": "", "assignee": "name or null", "deadline": "YYYY-MM-DD or null", "priority": "high|medium|low" }
  ],
  "commitments": [
    { "madeBy": "name", "commitment": "", "deadline": "YYYY-MM-DD or null" }
  ]
}

If an action item has no clear owner, set assignee to null — do not guess.

TRANSCRIPT:
${transcript}`;
}

module.exports = { extractFromTranscript };