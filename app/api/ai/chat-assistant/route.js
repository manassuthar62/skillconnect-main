import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY missing' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const { mode, text, recentMessages } = await req.json();

    if (mode === 'rewrite') {
      if (!text) return NextResponse.json({ error: 'Text required' }, { status: 400 });
      
      const prompt = `Fix the grammar and improve the tone of this chat message to make it sound natural, polite, and professional but concise. 
      Keep the meaning same. Keep it under 2 sentences. Don't add quotes or conversational filler. Original message: "${text}"`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', 
        contents: prompt,
      });
      
      return NextResponse.json({ result: response.text.trim() });
    } 
    else if (mode === 'suggest_replies') {
      if (!recentMessages || recentMessages.length === 0) {
        return NextResponse.json({ error: 'Context required' }, { status: 400 });
      }

      const conversation = recentMessages.map(m => `${m.role}: ${m.text}`).join('\n');
      const prompt = `Based on this chat conversation, suggest 3 short, natural, and quick reply options for the current user to send. 
      Return ONLY a JSON array of strings, for example: ["Yes, sure!", "Let me check.", "Thanks!"]. Keep replies under 5 words each.
      Conversation:
      ${conversation}`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      
      let rawText = response.text.trim();
      if (rawText.startsWith('```json')) {
        rawText = rawText.replace(/```json\n?|\n?```/g, '').trim();
      }
      
      try {
        const replies = JSON.parse(rawText);
        return NextResponse.json({ result: replies });
      } catch (e) {
        // Fallback if AI doesn't return clean JSON
        return NextResponse.json({ result: ["Okay!", "Thanks", "Sure"] });
      }
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (error) {
    console.error('Chat Assistant AI error:', error);
    if (error.status === 429) {
      return NextResponse.json({ error: 'AI is busy (Rate Limit). Try again in 1 minute.' }, { status: 429 });
    }
    return NextResponse.json({ error: error.message || 'AI processing failed' }, { status: 500 });
  }
}
