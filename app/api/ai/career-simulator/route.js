import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY missing' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const { profile, targetSkill } = await req.json();

    if (!profile || !targetSkill) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    const prompt = `Act as an AI Career Strategist for Connectify AI.
    Calculate a 6-month career growth roadmap if the user learns "${targetSkill}".
    
    User Profile:
    Name: ${profile.name}
    Title: ${profile.title}
    Current Skills: ${profile.skills?.join(', ')}

    Return a JSON object with:
    1. new_archetype: A combined archetype (e.g. "Fullstack UX Lead")
    2. income_growth: A percentage range (e.g., "15% - 25%")
    3. steps: An array of 3 objects (Month 1, Month 3, Month 6)
       Each step object: { month: "Month 1", title: "...", description: "..." }

    Return ONLY JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    let text = response.text.trim();
    
    let jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI failed to return valid JSON');
    
    return NextResponse.json({ roadmap: JSON.parse(jsonMatch[0]) });
  } catch (error) {
    console.error('Simulator Error:', error);
    return NextResponse.json({ error: 'Simulation failed' }, { status: 500 });
  }
}
