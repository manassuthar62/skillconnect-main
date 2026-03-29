'use client';
import { Zap, Copy, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import styles from './SetupScreen.module.css';

const STEPS = [
  { num: 1, title: 'Supabase Project banao', desc: 'supabase.com pe jao → New Project', link: 'https://supabase.com' },
  { num: 2, title: 'API Keys copy karo', desc: 'Project Settings → API → Project URL aur Anon Key uthao' },
  { num: 3, title: 'Database setup karo', desc: 'SQL Editor mein jaakar tables create karo (agar nahi hain)' },
  { num: 4, title: '.env.local file banao', desc: '.env.local.example ko copy karo .env.local mein aur Supabase config bharo' },
  { num: 5, title: 'Server restart karo', desc: 'npm run dev terminal mein dobara chalao' },
];

const ENV_EXAMPLE = `NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key`;

export default function SetupScreen() {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(ENV_EXAMPLE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.page}>
      <div className={styles.blob1} />
      <div className={styles.blob2} />

      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}><Zap size={28} fill="#25D366" color="#25D366" /></div>
          <div>
            <h1 className={styles.title}>SkillConnect</h1>
            <p className={styles.sub}>Supabase setup required</p>
          </div>
        </div>

        <div className={styles.alert}>
          ⚠️ Supabase credentials missing. Neeche steps follow karo.
        </div>

        <div className={styles.steps}>
          {STEPS.map(s => (
            <div key={s.num} className={styles.step}>
              <div className={styles.stepNum}>{s.num}</div>
              <div>
                <div className={styles.stepTitle}>
                  {s.link ? <a href={s.link} target="_blank" rel="noreferrer">{s.title} ↗</a> : s.title}
                </div>
                <div className={styles.stepDesc}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.envBox}>
          <div className={styles.envHeader}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>.env.local</span>
            <button className={styles.copyBtn} onClick={copy}>
              {copied ? <><CheckCheck size={13} /> Copied!</> : <><Copy size={13} /> Copy template</>}
            </button>
          </div>
          <pre className={styles.envCode}>{ENV_EXAMPLE}</pre>
        </div>
      </div>
    </div>
  );
}
