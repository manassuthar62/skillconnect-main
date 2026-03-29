'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getSupabase } from '@/lib/supabase';

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

export function isProfileComplete(profile) {
  if (!profile) return false;

  return Boolean(
    profile.name?.trim() &&
    profile.username?.trim() &&
    profile.title?.trim() &&
    profile.location?.trim() &&
    profile.bio?.trim() &&
    profile.preferred_exchange?.trim() &&
    Array.isArray(profile.skills) &&
    profile.skills.length > 0
  );
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile,  setUserProfile]  = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  // Check if Supabase is configured
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    setIsConfigured(Boolean(url && key));
  }, []);

  // Fetch profile from users table
  const fetchProfile = useCallback(async (user) => {
    if (!user) { setUserProfile(null); return; }
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb.from('users').select('*').eq('id', user.id).single();
    setUserProfile(data || null);
  }, []);

  // Auto-generate username from name
  const genUsername = (name) =>
    (name || 'user').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '').slice(0, 12) +
    Math.floor(1000 + Math.random() * 9000);

  // Create profile row if first login
  const ensureProfile = useCallback(async (user) => {
    if (!user) return;
    const sb = getSupabase();
    if (!sb) return;
    const { data: existing } = await sb.from('users').select('id').eq('id', user.id).single();
    if (!existing) {
      const meta = user.user_metadata || {};
      const name = meta.full_name || meta.name || user.email?.split('@')[0] || 'User';
      await sb.from('users').insert({
        id:        user.id,
        email:     user.email,
        name,
        username:  genUsername(name),
        photo_url: meta.avatar_url || meta.picture || null,
        skills:    [],
        connections: [],
      });
    }
    await fetchProfile(user);
  }, [fetchProfile]);


  // Subscribe to auth state
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }

    // Get initial session
    sb.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      if (user) ensureProfile(user).finally(() => setLoading(false));
      else setLoading(false);
    });

    // Listen to changes
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      if (user) ensureProfile(user);
      else { setUserProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, [ensureProfile]);

  // ─── Auth actions ───────────────────────────────────────────
  const login = async (email, password) => {
    const sb = getSupabase();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signup = async (email, password, name) => {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { data: { full_name: name } },
    });
    if (error) throw error;
    if (data.user) {
      await sb.from('users').upsert({
        id: data.user.id, email, name,
        username: genUsername(name),
        skills: [], connections: [],
      });
      await fetchProfile(data.user);
    }
  };


  const loginWithGoogle = async (mode = 'login') => {
    const sb = getSupabase();
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?mode=${mode}` },
    });
    if (error) throw error;
  };

  const logout = async () => {
    const sb = getSupabase();
    await sb.auth.signOut();
    setCurrentUser(null);
    setUserProfile(null);
  };

  const refreshProfile = useCallback(async () => {
    if (currentUser) await fetchProfile(currentUser);
  }, [currentUser, fetchProfile]);

  const updateProfile = async (updates) => {
    const sb = getSupabase();
    const { error } = await sb.from('users').update(updates).eq('id', currentUser.id);
    if (error) throw error;
    await fetchProfile(currentUser);
  };

  return (
    <AuthContext.Provider value={{
      currentUser, userProfile, loading, isConfigured,
      login, signup, loginWithGoogle, logout,
      refreshProfile, updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
