const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/suggest-meals', async (req, res) => {
  const { remainingCals, remainingProtein, remainingCarbs, remainingFat, userGoal, eatenToday } = req.body;

  const prompt = `
    Based on the following nutritional needs, suggest 3 simple, easy-to-make meals (breakfast, lunch, dinner) that together would fit the remaining daily needs. Use only common, accessible ingredients that are easy to find in any grocery store. For each meal, provide:
    - Meal name
    - Brief description (2-3 sentences)
    - Estimated macros (calories, protein, carbs, fat)
    - Why it's a good choice

    Remaining calories: ${remainingCals} kcal
    Remaining protein: ${remainingProtein}g
    Remaining carbs: ${remainingCarbs}g
    Remaining fat: ${remainingFat}g
    User's goal: ${userGoal}
    Already eaten today: ${eatenToday.join(', ') || 'nothing yet'}

    Keep the recipes very simple, with 5 ingredients max per meal. Avoid fancy or hard-to-find items. Make it realistic for a busy person to prepare.

    Format the response in a friendly, easy-to-read way. Use bullet points.
  `;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY not set in environment');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
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
