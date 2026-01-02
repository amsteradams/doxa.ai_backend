import Groq from 'groq-sdk';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_CHAT_MODEL = process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-20b';

const groq = new Groq({
  apiKey: GROQ_API_KEY,
});

export interface GroqUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface GroqResponse {
  content: string;
  usage: GroqUsage;
}

export async function callGroq(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<GroqResponse> {
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


