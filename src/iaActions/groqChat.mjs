import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_CHAT_MODEL = process.env.GROQ_CHAT_MODEL || 'llama3-8b-8192';

const groq = new Groq({
  apiKey: GROQ_API_KEY,
});

export async function callGroq(messages) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  if (!GROQ_CHAT_MODEL) {
    throw new Error('GROQ_CHAT_MODEL is not configured');
  }

  const completion = await groq.chat.completions.create({
    model: GROQ_CHAT_MODEL,
    messages: messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    temperature: 1.5,
  });

  const content = completion.choices[0]?.message?.content || '';
  const usage = completion.usage || {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };

  return {
    content,
    usage: {
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
    },
  };
}




