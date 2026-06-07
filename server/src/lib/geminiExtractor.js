const { GoogleGenerativeAI } = require("@google/generative-ai");

let _genAI = null;
function getClient() {
  if (!_genAI) _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return _genAI;
}

const EXTRACTION_PROMPT = `You are analyzing a YouTube video transcript to extract stock ticker mentions.

Rules:
- Only extract tickers that are EXPLICITLY stated or are completely unambiguous from context.
- Do NOT guess tickers from company names alone unless the ticker was actually spoken.
- Do NOT hallucinate — return an empty array if no specific stocks are discussed.
- For each mention, capture the company name as spoken, the ticker symbol, sentiment expressed, and the YouTuber's reasoning/notes.
- sentiment must be exactly one of: bullish, bearish, neutral
- conviction must be exactly one of: low, medium, high — or null if not expressed
- price_target is a number if mentioned, otherwise null
- timestamp_seconds is the approximate video time (in seconds) of the first mention

Return ONLY valid JSON in this exact shape:
{
  "mentions": [
    {
      "company_name": "string",
      "ticker": "string",
      "sentiment": "bullish|bearish|neutral",
      "conviction": "low|medium|high|null",
      "price_target": number|null,
      "notes": "string summarizing what was said",
      "timestamp_seconds": number
    }
  ]
}

Transcript:
`;

// Returns an array of mention objects, or [] on any failure.
async function extractPicks(formattedTranscript) {
  try {
    const model = getClient().getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(
      EXTRACTION_PROMPT + formattedTranscript,
    );
    const raw = result.response.text();

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.mentions)) return [];

    return parsed.mentions.filter(
      (m) => m && typeof m.ticker === "string" && m.ticker.trim().length > 0,
    );
  } catch (err) {
    console.error("Gemini extraction failed:", err.message);
    throw err;
  }
}

async function extractPicksDebug(formattedTranscript) {
  try {
    const model = getClient().getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(
      EXTRACTION_PROMPT + formattedTranscript,
    );
    const rawText = result.response.text();
    let parsed = null;
    let parseError = null;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      parseError = e.message;
    }
    return { rawText, parsed, parseError, apiError: null };
  } catch (err) {
    return {
      rawText: null,
      parsed: null,
      parseError: null,
      apiError: err.message,
    };
  }
}

module.exports = { extractPicks, extractPicksDebug };
