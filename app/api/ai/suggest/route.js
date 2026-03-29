import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

export async function POST(request) {
  try {
    const { search, location } = await request.json();

    if (!search && !location) {
      return NextResponse.json({ error: 'Search term or location required' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on the server.' }, 
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `Based on the user's search intent, perform two tasks:
    1. Find 5 to 8 real professional or social media profiles (LinkedIn, Twitter, Github, personal sites) of people matching:
       - Search Term / Skills: ${search || 'Not specified'}
       - Location: ${location || 'Not specified'}
       If you cannot find exact matches, find the closest possible relevant people in or near that location.
    2. Generate helpful AI Insights including related alternative search terms they could try, and a short piece of advice.

    Output the result STRICTLY as a raw JSON object with NO markdown formatting (no \`\`\`json wrappers) containing "profiles" (an array) and "insights" (an object).
    Each profile object must have: id (unique short string), name, title, location, skills (array of 3-5 strings), bio (short string), link (valid URL).
    The insights object must have: relatedSearches (array of 3-6 strings), and advice (short string).`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    const rawText = response.text.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(rawText);
    return NextResponse.json(parsed);

  } catch (error) {
    console.error('AI Suggestion Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch AI suggestions' }, { status: 500 });
  }
}
