const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// System prompt to guide the AI's behaviour
const SYSTEM_PROMPT = `
You are a helpful nutrition and recipe assistant. Your task is to suggest meal ideas that fit the user's remaining daily macros (calories, protein, carbs, fat). 
You should:
- Suggest 3 meal ideas (can be breakfast, lunch, dinner, or snacks) that together would approximately meet the remaining needs.
- Include a variety of cuisines, **especially Nigerian dishes** (e.g., jollof rice, egusi soup, moi moi, yam porridge, etc.) when appropriate.
- Keep recipes simple, with common, accessible ingredients that are easy to find in any grocery store or local market.
- For each meal, provide:
    - Meal name
    - Brief description (2‑3 sentences)
    - Estimated macros (calories, protein, carbs, fat)
    - Why it's a good choice for the user's goals
- If the user provides a follow‑up query (e.g., "suggest something with chicken" or "more Nigerian dishes"), incorporate that request into your response.
- Be friendly, encouraging, and informative.
`;

// Define providers in the order you want them tried
const providers = [
  {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    model: 'llama3-8b-8192', // Fast, free, and capable
    buildBody: (system, user) => ({
      model: providers[0].model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  },
  {
    name: 'Cerebras',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    headers: {
      'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    model: 'llama3.1-8b', // Free tier model on Cerebras
    buildBody: (system, user) => ({
      model: providers[1].model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  },
  {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    model: 'mistralai/mixtral-8x7b-instruct', // Free model with good performance
    buildBody: (system, user) => ({
      model: providers[2].model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  },
  {
    name: 'Gemini',
    // Gemini uses a different endpoint and format – we keep your original logic
    buildBody: (system, user) => ({
      contents: [
        { role: 'user', parts: [{ text: system }] },
        { role: 'user', parts: [{ text: user }] }
      ]
    }),
  }
];

app.post('/api/suggest-meals', async (req, res) => {
  const { remainingCals, remainingProtein, remainingCarbs, remainingFat, userGoal, eatenToday, followup } = req.body;

  // Build the user prompt (exactly as you had it)
  let userPrompt = `
Remaining daily needs:
- Calories: ${remainingCals} kcal
- Protein: ${remainingProtein}g
- Carbs: ${remainingCarbs}g
- Fat: ${remainingFat}g
User's goal: ${userGoal}
Already eaten today: ${eatenToday?.join(', ') || 'nothing yet'}
`;

  if (followup) {
    userPrompt += `\nFollow‑up request: ${followup}`;
  }

  userPrompt += `\nPlease suggest 3 meal ideas that fit these macros. Include Nigerian dishes where appropriate.`;

  // Try each provider in order
  for (const provider of providers) {
    try {
      console.log(`Trying provider: ${provider.name}`);

      let response;
      if (provider.name === 'Gemini') {
        // Gemini special case
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          console.error('GEMINI_API_KEY not set, skipping Gemini');
          continue;
        }
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(provider.buildBody(SYSTEM_PROMPT, userPrompt)),
        });
      } else {
        // OpenAI‑compatible providers
        response = await fetch(provider.url, {
          method: 'POST',
          headers: provider.headers,
          body: JSON.stringify(provider.buildBody(SYSTEM_PROMPT, userPrompt)),
        });
      }

      if (response.status === 429) {
        console.log(`${provider.name} rate limited, trying next...`);
        continue; // skip to next provider
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${provider.name} error (${response.status}): ${errorText}`);
        continue; // try next provider
      }

      const data = await response.json();
      let suggestions;

      if (provider.name === 'Gemini') {
        suggestions = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No suggestions available.';
      } else {
        suggestions = data.choices[0].message.content;
      }

      console.log(`Success with ${provider.name}`);
      return res.json({ suggestions });

    } catch (error) {
      console.error(`${provider.name} fetch error:`, error.message);
      // continue to next provider
    }
  }

  // All providers failed
  console.error('All AI providers failed');
  res.status(503).json({ error: 'All AI providers are currently unavailable. Please try again later.' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
