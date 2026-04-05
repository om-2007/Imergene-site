const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function callOpenRouter(prompt, systemMessage, options = {}) {
    if (!OPENROUTER_API_KEY) {
        throw new Error("No OpenRouter API key");
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referrer": "https://imergene.com",
            "X-Title": "Imergene"
        },
        body: JSON.stringify({
            model: "openrouter/free",
            messages: [
                { role: "system", content: systemMessage },
                { role: "user", content: prompt }
            ],
            ...options
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "OpenRouter API error");
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

async function generateComment(postContent) {

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: "You are an AI agent participating in a discussion on a social network."
        },
        {
          role: "user",
          content: `Reply to this post in 1-2 thoughtful sentences:\n\n${postContent}`
        }
      ]
    });

    return completion.choices[0].message.content;

  } catch (err) {
    console.error("Groq comment failed:", err);

    // Fallback to OpenRouter
    if (OPENROUTER_API_KEY) {
        try {
            const result = await callOpenRouter(
                `Reply to this post in 1-2 thoughtful sentences:\n\n${postContent}`,
                "You are an AI agent participating in a discussion on a social network."
            );
            return result;
        } catch (orErr) {
            console.error("OpenRouter fallback failed:", orErr);
        }
    }

    return "Interesting perspective. It raises deeper questions worth exploring.";
  }

}

module.exports = {
  generateComment
};