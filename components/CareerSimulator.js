import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, TrendingUp, Calendar, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CareerSimulator({ isOpen, onClose, profile }) {
  const [targetSkill, setTargetSkill] = useState('');
  const [loading, setLoading]     = useState(false);
  const [roadmap, setLoadingRoadmap] = useState(null);

  const handleSimulate = async () => {
    if (!targetSkill.trim()) return;
    setLoading(true);
    setLoadingRoadmap(null);
    try {
      const res = await fetch('/api/ai/career-simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, targetSkill })
      });
      const data = await res.json();
      if (data.roadmap) {
        setLoadingRoadmap(data.roadmap);
      } else {
        toast.error(data.error || 'Failed to simulate');
      }
    } catch (err) {
      toast.error('AI Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="simulator-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div 
            className="simulator-modal"
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
          >
            <div className="sim-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="sim-icon-box"><TrendingUp size={20} /></div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18 }}>AI Career Simulator</h3>
                  <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>Predict your growth 6 months ahead</p>
                </div>
              </div>
              <button className="wa-icon-btn" onClick={onClose}><X size={20} /></button>
            </div>

            <div className="sim-body">
              {!roadmap ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <p style={{ fontSize: 14, color: 'var(--t2)' }}>
                    Enter a skill you want to learn, and our AI will calculate your career path and earning growth over the next 6 months.
                  </p>
                  <div className="sim-input-row">
                    <input 
                      className="input" 
                      placeholder="e.g. Next.js, UI/UX, Sales, Python..." 
                      value={targetSkill}
                      onChange={e => setTargetSkill(e.target.value)}
                    />
                    <button className="btn btn-primary" onClick={handleSimulate} disabled={loading || !targetSkill}>
                      {loading ? <span className="spinner" /> : 'Simulate'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="roadmap-container">
                  <div className="roadmap-hero">
                    <div className="hero-stat">
                      <span className="stat-label">Income Potential</span>
                      <span className="stat-value">{roadmap.income_growth} Growth</span>
                    </div>
                    <div className="hero-stat">
                      <span className="stat-label">New Archetype</span>
                      <span className="stat-value">{roadmap.new_archetype}</span>
                    </div>
                  </div>

                  <div className="timeline">
                    {roadmap.steps?.map((step, i) => (
                      <div key={i} className="timeline-item">
                        <div className="time-marker">
                          <Calendar size={14} />
                          <span>{step.month}</span>
                        </div>
                        <div className="time-content">
                          <h4>{step.title}</h4>
                          <p>{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button className="btn btn-outline" style={{ width: '100%', marginTop: 12 }} onClick={() => setLoadingRoadmap(null)}>
                    Try Another Skill
                  </button>
                </div>
              )}
            </div>

            <style jsx>{`
              .simulator-overlay {
                position: fixed; inset: 0; z-index: 1000;
                background: rgba(10, 20, 40, 0.85); backdrop-filter: blur(8px);
                display: flex; align-items: center; justify-content: center; padding: 20px;
              }
              .simulator-modal {
                background: #16213e; color: #fff; width: 100%; max-width: 500px;
                border-radius: 24px; border: 1px solid rgba(255,255,255,0.1);
                box-shadow: 0 20px 50px rgba(0,0,0,0.5); overflow: hidden;
              }
              .sim-header {
                padding: 20px; display: flex; justify-content: space-between; align-items: center;
                border-bottom: 1px solid rgba(255,255,255,0.05);
              }
              .sim-icon-box {
                width: 42px; height: 42px; border-radius: 12px; background: var(--accent);
                display: flex; align-items: center; justify-content: center;
              }
              .sim-body { padding: 24px; }
              .sim-input-row { display: flex; gap: 10px; }
              .sim-input-row input { flex: 1; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; }
              
              .roadmap-hero {
                display: flex; gap: 12px; margin-bottom: 24px;
              }
              .hero-stat {
                flex: 1; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 16px;
                display: flex; flexDirection: column; gap: 4px; border: 1px solid rgba(255,255,255,0.05);
              }
              .stat-label { font-size: 11px; color: var(--t3); text-transform: uppercase; letter-spacing: 0.5px; }
              .stat-value { font-size: 14px; font-weight: 700; color: #4ade80; }
              
              .timeline {
                display: flex; flexDirection: column; gap: 20px; position: relative; padding-left: 10px;
              }
              .timeline::before {
                content: ''; position: absolute; left: 16px; top: 0; bottom: 0; width: 2px; background: rgba(255,255,255,0.05);
              }
              .timeline-item {
                display: flex; gap: 20px; position: relative;
              }
              .time-marker {
                width: 80px; font-size: 11px; font-weight: 600; color: var(--accent);
                display: flex; flexDirection: column; align-items: center; gap: 4px; zIndex: 2;
              }
              .time-content {
                flex: 1; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 12px;
              }
              .time-content h4 { margin: 0 0 4px 0; font-size: 14px; }
              .time-content p { margin: 0; font-size: 12px; opacity: 0.7; line-height: 1.4; }
            `}</style>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
