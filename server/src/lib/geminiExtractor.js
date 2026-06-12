const { GoogleGenerativeAI } = require("@google/generative-ai");

let _genAI = null;
function getClient() {
  if (!_genAI) _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return _genAI;
}

const EXTRACTION_PROMPT = `You are analyzing a YouTube video transcript to extract stock ticker mentions and general market commentary.

Rules:
- Extract picks when the company name is clearly stated and identifiable (e.g. Apple, Tesla, Nvidia, Microsoft), even if the exact ticker was not spoken.
- Provide your best guess at the ticker — it will be validated against a symbol database, so correctness matters but an honest attempt is fine.
- Do NOT hallucinate obscure or ambiguous companies — only include a pick if you are confident in the company identity. Return an empty mentions array if no specific stocks are discussed.
- For each mention, capture the company name as spoken, the ticker symbol, sentiment expressed, and detailed notes.
- sentiment must be exactly one of: bullish, bearish, neutral
- conviction must be exactly one of: low, medium, high — or null if not expressed
- price_target is a number if mentioned, otherwise null
- timestamp_seconds is the approximate video time (in seconds) of the first mention
- notes must be detailed: include the specific catalysts, price levels, support/resistance zones, risks, comparisons, or earnings details the YouTuber actually discussed. Write 2–5 sentences. Do NOT write a vague one-liner.
- general_summary captures everything the YouTuber said about the broader market, macro events, or topics not tied to a specific stock (e.g. Fed policy, CPI data, inflation, interest rates, geopolitical events, tariffs, sector rotations, market sentiment). Write 2–5 sentences covering all macro themes discussed. If the video has no general market commentary, return null.

Return ONLY valid JSON in this exact shape:
{
  "general_summary": "string | null",
  "mentions": [
    {
      "company_name": "string",
      "ticker": "string",
      "sentiment": "bullish|bearish|neutral",
      "conviction": "low|medium|high|null",
      "price_target": number|null,
      "notes": "detailed notes on what was said about this stock",
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
    if (!Array.isArray(parsed?.mentions)) return { general_summary: null, mentions: [] };

    return {
      general_summary: parsed.general_summary || null,
      mentions: parsed.mentions.filter(
        (m) => m && typeof m.ticker === "string" && m.ticker.trim().length > 0,
      ),
    };
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
