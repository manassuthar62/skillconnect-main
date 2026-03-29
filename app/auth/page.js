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
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#2563eb">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.374 0 0 5.373 0 12c0 2.117.549 4.099 1.51 5.827L0 24l6.374-1.493A11.947 11.947 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.877 0-3.624-.506-5.127-1.387l-.367-.218-3.787.888.904-3.695-.24-.38A9.822 9.822 0 012.182 12C2.182 6.58 6.58 2.182 12 2.182S21.818 6.58 21.818 12 17.42 21.818 12 21.818z"/>
            </svg>
          </div>
          <div>
            <h1 className={styles.appName}>SkillConnect</h1>
            <p className={styles.tagline}>Connect through your skills</p>
          </div>
        </div>
      </div>

      <motion.div className={styles.card}
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className={styles.cardTop}>
          <div className={styles.cardEyebrow}>{tab === 'login' ? 'Welcome Back' : 'Get Started'}</div>
          <h2 className={styles.cardTitle}>{tab === 'login' ? 'Sign in to your account' : 'Create your SkillConnect account'}</h2>
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
