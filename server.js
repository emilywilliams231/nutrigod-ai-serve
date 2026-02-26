const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

// Get API key from environment variable (set in Render)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/suggest-meals', async (req, res) => {
  const { remainingCals, remainingProtein, remainingCarbs, remainingFat, userGoal, eatenToday } = req.body;

  const prompt = `
    Based on the following nutritional needs, suggest 3 realistic meals (breakfast, lunch, dinner) that together would fit the remaining daily needs. For each meal, provide:
    - Meal name
    - Brief description
    - Estimated macros (calories, protein, carbs, fat)
    - Why it's a good choice

    Remaining calories: ${remainingCals} kcal
    Remaining protein: ${remainingProtein}g
    Remaining carbs: ${remainingCarbs}g
    Remaining fat: ${remainingFat}g
    User's goal: ${userGoal}
    Already eaten today: ${eatenToday.join(', ') || 'nothing yet'}

    Format the response in a friendly, easy-to-read way. Use bullet points.
  `;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ suggestions: text });
  } catch (error) {
    console.error('AI error:', error);
    res.status(500).json({ error: 'AI service error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
