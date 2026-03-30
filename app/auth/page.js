'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from './auth.module.css';

export default function AuthPage() {
  const [tab,       setTab]      = useState('login');
  const [showPass,  setShowPass] = useState(false);
  const [loading,   setLoading]  = useState(false);
  const [form,      setForm]     = useState({ name: '', email: '', password: '' });
  const { login, signup, loginWithGoogle } = useAuth();
  const router = useRouter();

  const update = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(form.email, form.password);
        toast.success('Welcome back!');
        router.push('/chat');
      } else {
        if (!form.name.trim()) { toast.error('Name is required'); setLoading(false); return; }
        await signup(form.email, form.password, form.name);
        toast.success('Account created! Welcome 🎉');
        router.push('/onboarding');
      }
    } catch (err) {
      const msgs = {
        'Invalid login credentials':   'Invalid email or password.',
        'Email not confirmed':         'Please verify your email first.',
        'User already registered':     'Email already in use.',
        'Password should be at least': 'Password must be at least 6 characters.',
      };
      const msg = Object.entries(msgs).find(([k]) => err.message?.includes(k))?.[1] || err.message || 'Something went wrong';
      toast.error(msg);
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await loginWithGoogle(tab === 'signup' ? 'signup' : 'login');
    } catch (err) {
      toast.error(err.message || 'Google sign-in failed');
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.banner}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <h1 className={styles.appName}>Connectify AI</h1>
            <p className={styles.tagline}>Elevate your hustle via skills.</p>
          </div>
        </div>
      </div>

      <motion.div className={styles.card}
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className={styles.cardTop}>
          <div className={styles.cardEyebrow}>{tab === 'login' ? 'Welcome Back' : 'Get Started'}</div>
          <h2 className={styles.cardTitle}>{tab === 'login' ? 'Sign in to your account' : 'Create your Connectify account'}</h2>
        </div>

        <div className={styles.tabs}>
          {['login', 'signup'].map(t => (
            <button key={t} className={`${styles.tab}${tab === t ? ` ${styles.tabActive}` : ''}`}
              onClick={() => setTab(t)}>
              {t === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <button className={styles.googleBtn} onClick={handleGoogle} disabled={loading}>
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="divider">or</div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <AnimatePresence mode="wait">
            {tab === 'signup' && (
              <motion.div key="name" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}>
                <div className="input-group">
                  <label className="input-label">Full Name</label>
                  <div className={styles.inputWrap}>
                    <User size={16} className={styles.icon} />
                    <input name="name" placeholder="Your full name" value={form.name}
                      onChange={update} className={`input ${styles.inputPad}`} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="input-group">
            <label className="input-label">Email</label>
            <div className={styles.inputWrap}>
              <Mail size={16} className={styles.icon} />
              <input name="email" type="email" placeholder="you@example.com" value={form.email}
                onChange={update} className={`input ${styles.inputPad}`} required />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <div className={styles.inputWrap}>
              <Lock size={16} className={styles.icon} />
              <input name="password" type={showPass ? 'text' : 'password'} placeholder="••••••••"
                value={form.password} onChange={update}
                className={`input ${styles.inputPad} ${styles.inputPadRight}`} required />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(p => !p)}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <motion.button type="submit" className={`btn btn-primary ${styles.submitBtn}`}
            disabled={loading} whileTap={{ scale: 0.97 }}>
            {loading
              ? <span className="spinner" style={{ width: 18, height: 18 }} />
              : (tab === 'login' ? 'Sign In' : 'Create Account')}
          </motion.button>
        </form>

        <p className={styles.switchText}>
          {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button className={styles.switchBtn}
            onClick={() => setTab(tab === 'login' ? 'signup' : 'login')}>
            {tab === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
      <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
      <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
    </svg>
  );
}
