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

app.post('/api/suggest-meals', async (req, res) => {
  const { remainingCals, remainingProtein, remainingCarbs, remainingFat, userGoal, eatenToday, followup } = req.body;

  // Build the user prompt
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

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY not set in environment');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: SYSTEM_PROMPT }]
            },
            {
              role: "user",
              parts: [{ text: userPrompt }]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      if (response.status === 429) {
        return res.status(429).json({ error: 'Quota exceeded. Please try again later or enable billing.' });
      }
      return res.status(500).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No suggestions available.';

    res.json({ suggestions: text });
  } catch (error) {
    console.error('AI error:', error.message);
    res.status(500).json({ error: 'AI service error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
