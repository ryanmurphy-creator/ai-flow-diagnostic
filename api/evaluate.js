// Vercel Serverless Function: POST /api/evaluate
// Evaluates a user-described task against the AI Flow Framework using Claude

const SYSTEM_PROMPT = `You are an expert analyst of the AI Flow Framework, a model for understanding when working with AI produces creative partnership vs. frustration or wasted time.

The framework maps tasks on two dimensions:
- AI CAPABILITY (0-10): How genuinely capable current AI is at this category of task
- TASK COMPLEXITY (0-10): How much human judgment, nuance, stakes, and iteration the task requires

## AI Capability Reference Scores
- Coding & scripting: 7-9 (AI solves 70-88% of real engineering tasks per SWE-bench)
- Summarization & extraction: 8 (fast, reliable, accurate)
- Research & synthesis: 6-7 (strong but hallucinates on specifics)
- Data analysis & transformation: 6-8 (depends on structure and query complexity)
- Writing in a specific voice/style: 2-4 (reverts to generic prose, poor at mimicking authentic voice)
- Presentation & visual design: 2-4 (generic layouts, missing taste and brand sense)
- Strategic judgment & recommendation: 3-5 (plausible but uncalibrated to real context)
- Factual recall about specific people/events: 3-5 (3-9% hallucination on general knowledge, 33%+ on obscure)
- Image generation for branded use: 3-5 (good for ideation, poor for final production)
- Video editing & production: 4-6 (improving rapidly, still requires heavy guidance)
- Complex negotiation or persuasion: 3-5 (lacks contextual intelligence)
- Legal/medical/financial analysis: 4-6 (useful for research, risky for final decisions)

## Task Complexity Factors (each adds to score)
- Requires unique personal judgment or taste (high = +2-3)
- Many interdependent decisions involved (high = +2)
- High stakes if output is wrong (high = +2)
- Requires deep domain expertise to evaluate quality (high = +1-2)
- Requires significant iteration and refinement for good results (high = +1-2)
- Highly context-dependent or personalized (high = +1-2)

## Zone Mapping
Map capability and complexity scores to zones:
- AI Flow: capability 7-10, complexity 7-10 — absorbed, creative partnership
- Jagged Frontier: capability 5-7, complexity 7-10 — exciting, unpredictable, vibe coding territory
- False Promise: capability 1-4, complexity 6-10 — annoyed, should've done it myself
- Stuck Spinning: capability 1-4, complexity 4-6 — confused, this should be working
- Waste of Time: capability 1-4, complexity 1-4 — defeated, it can't even do this
- Comfort Zone: capability 4-7, complexity 1-4 — productive but losing critical thinking
- Easy Wins: capability 7-10, complexity 1-4 — convenient, saved me 10 minutes
- Cruise Mode: capability 7-10, complexity 4-7 — comfortable, running on autopilot

## Response Format
You MUST respond with valid JSON only, no other text. Use exactly this structure:
{
  "zone": "Zone Name Here",
  "capability": 7,
  "complexity": 8,
  "explanation": "2-3 sentence explanation of why this task lands in this zone, referencing specific AI limitations or strengths for this task type.",
  "advice": "1-2 sentence practical suggestion for how to approach this task given where it lands."
}

Zone name must be exactly one of: "AI Flow", "Jagged Frontier", "False Promise", "Stuck Spinning", "Waste of Time", "Comfort Zone", "Easy Wins", "Cruise Mode"

Be direct, specific, and honest. Don't sugarcoat. The user wants a real assessment.

STRICT FORMATTING RULE: Never use em dashes (— or --) anywhere in your response. Use commas, periods, or colons instead.`;

const PRIMARY_MODEL = 'claude-sonnet-4-6';
const FALLBACK_MODEL = 'claude-haiku-4-5-20251001';
const PRIMARY_RETRIES = 3;

// Calls the Anthropic API with the given model. Returns { ok, status, data }.
async function callClaude(model, task, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Evaluate this task against the AI Flow Framework:\n\n"${task.trim()}"`
        }
      ]
    }),
    signal: AbortSignal.timeout(20000)
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { task } = req.body || {};

  if (!task || typeof task !== 'string' || task.trim().length < 5) {
    return res.status(400).json({ error: 'Please describe your task in a bit more detail.' });
  }

  if (task.length > 1000) {
    return res.status(400).json({ error: 'Task description is too long (max 1000 characters).' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured.' });
  }

  try {
    let result = null;

    // Try primary model up to PRIMARY_RETRIES times, stopping early on non-529 errors
    for (let attempt = 1; attempt <= PRIMARY_RETRIES; attempt++) {
      const { ok, status, data } = await callClaude(PRIMARY_MODEL, task, apiKey);

      if (ok) {
        result = data;
        break;
      }

      console.error(`Primary model attempt ${attempt} failed — status ${status}:`, data);

      // Only retry on 529 overloaded; any other error fails immediately
      if (status !== 529) {
        return res.status(502).json({ error: 'AI evaluation failed. Please try again.' });
      }

      // 529: if retries remain, loop again; otherwise fall through to fallback
    }

    // If primary model exhausted all retries with 529, try fallback model once
    if (!result) {
      console.log('Primary model overloaded after retries — trying fallback model');
      const { ok, status, data } = await callClaude(FALLBACK_MODEL, task, apiKey);

      if (!ok) {
        console.error(`Fallback model failed — status ${status}:`, data);
        return res.status(502).json({ error: 'AI evaluation failed. Please try again.' });
      }

      result = data;
    }

    const rawContent = result.content?.[0]?.text || '';

    // Parse JSON from response
    let parsed;
    try {
      // Strip any markdown code fences if present
      const cleaned = rawContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse Claude response:', rawContent);
      return res.status(500).json({ error: 'Could not parse evaluation. Please try again.' });
    }

    // Validate zone name
    const validZones = ['AI Flow', 'Jagged Frontier', 'False Promise', 'Stuck Spinning', 'Waste of Time', 'Comfort Zone', 'Easy Wins', 'Cruise Mode'];
    if (!validZones.includes(parsed.zone)) {
      console.error('Invalid zone in response:', parsed.zone);
      return res.status(500).json({ error: 'Evaluation returned an invalid zone. Please try again.' });
    }

    // Validate numeric scores
    parsed.capability = Math.max(0, Math.min(10, Number(parsed.capability) || 5));
    parsed.complexity = Math.max(0, Math.min(10, Number(parsed.complexity) || 5));

    return res.status(200).json({
      zone: parsed.zone,
      capability: parsed.capability,
      complexity: parsed.complexity,
      explanation: parsed.explanation || '',
      advice: parsed.advice || ''
    });

  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return res.status(504).json({ error: 'Evaluation timed out. Please try again.' });
    }
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
