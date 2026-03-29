import { createClient } from '@supabase/supabase-js';

let supabase = null;

export function getSupabase() {
  if (!supabase) {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    supabase = createClient(url, key);
  }
  return supabase;
}

export default getSupabase;
