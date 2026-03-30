import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY missing' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const { profile } = await req.json();

    if (!profile) {
      return NextResponse.json({ error: 'Profile data required' }, { status: 400 });
    }

    const prompt = `Analyze this professional profile and generate a "Skill DNA" report.
    Profile:
    Name: ${profile.name}
    Title: ${profile.title}
    Bio: ${profile.bio}
    Skills: ${profile.skills?.join(', ')}
    
    Return a JSON object with exactly these fields:
    1. type: A catchy professional archetype (e.g., "Creative Strategist", "Technical Architect")
    2. strengths: An array of 3 key strengths
    3. hidden_talents: An array of 2 potential hidden talents based on their background
    4. learning_speed: A percentage (%) based on their skill variety
    5. dna_string: A short 6-8 character "DNA code" (e.g., "CR-X92-ST")
    6. income_booster: A dynamic growth multiplier like "↑ 2.1x" or "↑ 3.5x" based on their skill stack comparison to low-skill jobs.
    
    Return ONLY the JSON object. No markdown, no extra text.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    const resultText = response.text;
    let jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI failed to return valid JSON');
    
    const dnaData = JSON.parse(jsonMatch[0]);
    return NextResponse.json(dnaData);
  } catch (error) {
    console.error('Skill DNA AI error:', error);
    return NextResponse.json({ error: error.message || 'AI analysis failed' }, { status: 500 });
  }
}
