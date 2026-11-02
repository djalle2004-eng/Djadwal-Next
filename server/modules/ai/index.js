const { executeQuery, getPgPool } = require('../../database.js');

const aiRateLimitMap = new Map();

async function handleAiAssist(req, res) {
  try {
    const clientIp = req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const limitWindowMs = 60 * 1000;
    const maxRequestsPerWindow = 15;

    let rateData = aiRateLimitMap.get(clientIp);
    if (!rateData || now > rateData.resetTime) {
      rateData = { count: 1, resetTime: now + limitWindowMs };
      aiRateLimitMap.set(clientIp, rateData);
    } else {
      rateData.count++;
      if (rateData.count > maxRequestsPerWindow) {
        return res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'تجاوزت الحد المسموح به من طلبات المساعد الذكي. يرجى الانتظار دقيقة واحدة قبل المحاولة مجددًا.'
        });
      }
    }

    const { prompt, model = 'gemini-1.5-pro' } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'نص الطلب (prompt) مطلوب ويجب أن يكون نصًا صالحًا.'
      });
    }

    const MAX_PROMPT_LENGTH = 4000;
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({
        error: 'PAYLOAD_TOO_LARGE',
        message: `حجم النص يتجاوز الحد المسموح به (${MAX_PROMPT_LENGTH} حرف).`
      });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY;

    if (!geminiKey && !openRouterKey) {
      return res.status(503).json({
        error: 'AI_UNAVAILABLE',
        message: 'خدمة المساعد الذكي غير مهيأة على الخادم. يرجى ضبط مفتاح GEMINI_API_KEY في ملف التكوين.'
      });
    }

    if (geminiKey) {
      const chosenModel = model || 'gemini-1.5-pro';
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${chosenModel}:generateContent?key=${geminiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.2
          }
        })
      });

      if (!response.ok) {
        const errData = await response.text();
        return res.status(response.status).json({
          error: 'AI_PROVIDER_ERROR',
          message: `خطأ من مزود الذكاء الاصطناعي: ${errData}`
        });
      }

      const data = await response.json();
      const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return res.json({ result: generatedText });
    }

    if (openRouterKey) {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openRouterKey}`,
          'HTTP-Referer': 'https://djadwal.edu',
          'X-Title': 'Djadwal Scheduling System'
        },
        body: JSON.stringify({
          model: model || 'google/gemini-flash-1.5',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2048,
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const errData = await response.text();
        return res.status(response.status).json({
          error: 'AI_PROVIDER_ERROR',
          message: `خطأ من مزود الذكاء الاصطناعي: ${errData}`
        });
      }

      const data = await response.json();
      const generatedText = data?.choices?.[0]?.message?.content || '';
      return res.json({ result: generatedText });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getDatabaseStatus(req, res) {
  try {
    const readSource = process.env.FEATURE_READ_SOURCE || 'postgres';
    const dualWrite = process.env.FEATURE_DUAL_WRITE !== 'false';
    const pool = getPgPool();
    const isPostgresReady = Boolean(pool);

    res.json({
      activeEngine: readSource === 'postgres' ? 'Neon PostgreSQL' : 'Turso SQLite',
      readSource,
      dualWriteEnabled: dualWrite,
      isNeonConnected: isPostgresReady,
      isTursoConnected: Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  handleAiAssist,
  getDatabaseStatus
};

