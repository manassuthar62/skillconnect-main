import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getSupabase } from '@/lib/supabase';

export async function POST(req) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY missing' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const { profile } = await req.json();

    if (!profile) {
      return NextResponse.json({ error: 'Profile required' }, { status: 400 });
    }

    // --- FETCH TOP RATED USERS FROM COMMUNITY ---
    const sb = getSupabase();
    // Exclude current user and find top 20 high-rated people
    const { data: topUsers } = await sb.from('users')
      .select('id, name, username, title, skills, bio, trust_score')
      .neq('id', profile.id)
      .order('trust_score', { ascending: false })
      .limit(20);

    const communityContext = topUsers?.map(u => ({
      uid: u.id,
      uname: u.name,
      user_handle: u.username,
      u_title: u.title,
      u_skills: u.skills?.join(', '),
      u_score: u.trust_score
    })) || [];

    const prompt = `Act as an AI Community Matchmaker for Connectify AI (a professional Skill-Swap & Peer-to-Peer network).
    
    Current User Profile:
    Name: ${profile.name}
    Title: ${profile.title}
    Skills: ${profile.skills?.join(', ')}
    Bio: ${profile.bio}

    Top-Rated Community Members Available for Match:
    ${JSON.stringify(communityContext)}

    TASK: Select the 3 BEST matches for the current user from the "Top-Rated Community Members" list above.
    Focus on finding users who have complementary skills (e.g. if I know Design and they know Code, we can Swap).

    Return a JSON object with a field "opportunities" which is an array of 3 objects.
    Each object must have:
    - title: Catchy collaboration title (e.g. "Startup Collab", "Skill Swap: Learn Python")
    - platform: Use "Community Swap", "Direct Hire", or "Co-Launch"
    - budget: e.g. "Barter/Swap", "₹5,000", or "Profit Share"
    - match_score: A percentage (e.g. 98)
    - why: One sentence on why this specific user match is perfect.
    - target_uid: The 'uid' of the matched user from the provided list.
    - target_handle: The 'user_handle' of the matched user.
    - target_name: The 'uname' of the matched user.

    Return ONLY the JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    let text = response.text.trim();
    
    // Clean markdown if present
    text = text.replace(/```json\n?|\n?```/g, '').replace(/```\n?|\n?```/g, '').trim();

    let jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI failed to return valid JSON');
    
    const data = JSON.parse(jsonMatch[0]);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Opportunity Hunter Error:', error);
    return NextResponse.json({ error: 'Failed to find opportunities' }, { status: 500 });
  }
}
