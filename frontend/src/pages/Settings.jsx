import { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Bell, Globe, Moon, Zap, CheckCircle2, Save, Palette, Volume2 } from 'lucide-react';
import confetti from 'canvas-confetti';

const STORAGE_KEY = 'sc_notif_prefs';
// Public URL for a nice success sound
const CONFIRM_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3';

const defaultPrefs = {
  dailyReminder:  true,
  streakAlert:    true,
  badgeAlert:     true,
  soundEnabled:   true,
  darkMode:       false,
  theme:          'classic',
};

const UI = {
  fr: {
    title: 'Paramètres',
    langSection: 'Langue de l\'interface',
    langDesc: 'La langue utilisée dans toute l\'application.',
    notifSection: 'Notifications',
    notifDesc: 'Choisissez ce que vous souhaitez recevoir.',
    dailyReminder: 'Rappel quotidien d\'entraînement',
    streakAlert: 'Alerte si ta série est en danger',
    badgeAlert: 'Notification quand tu débloques un badge',
    soundEnabled: 'Sons et retours audio activés',
    appSection: 'Application',
    darkMode: 'Mode sombre',
    darkModeDesc: 'Interface en thème nuit',
    themeSection: 'Thème visuel',
    themeDesc: 'Personnalisez les couleurs de l\'app',
    saved: 'Préférences sauvegardées !',
    save: 'Enregistrer',
    themes: {
      classic: 'Classique',
      royal: 'Royal',
      nature: 'Nature',
      candy: 'Bonbon',
    }
  },
  en: {
    title: 'Settings',
    langSection: 'Interface language',
    langDesc: 'The language used throughout the app.',
    notifSection: 'Notifications',
    notifDesc: 'Choose what you want to receive.',
    dailyReminder: 'Daily training reminder',
    streakAlert: 'Alert if your streak is at risk',
    badgeAlert: 'Notification when you unlock a badge',
    soundEnabled: 'Sounds and audio feedback enabled',
    appSection: 'App',
    darkMode: 'Dark mode',
    darkModeDesc: 'Night theme for the interface',
    themeSection: 'Visual Theme',
    themeDesc: 'Personalize the app colors',
    saved: 'Preferences saved!',
    save: 'Save',
    themes: {
      classic: 'Classic',
      royal: 'Royal',
      nature: 'Nature',
      candy: 'Candy',
    }
  },
};

const THEMES = {
  classic: { teal: '#80DCDC', tealDark: '#4DBFBF', tealSoft: '#E8F9F9', violet: '#9580D4', violetSoft: '#F3F0FE' },
  royal:   { teal: '#6366F1', tealDark: '#4338CA', tealSoft: '#EEF2FF', violet: '#F59E0B', violetSoft: '#FFFBEB' },
  nature:  { teal: '#10B981', tealDark: '#047857', tealSoft: '#ECFDF5', violet: '#F97316', violetSoft: '#FFF7ED' },
  candy:   { teal: '#EC4899', tealDark: '#BE185D', tealSoft: '#FDF2F8', violet: '#06B6D4', violetSoft: '#ECFEFF' },
};

function Toggle({ on, onChange, color }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer',
        background: on ? color : '#D1D5DB', position: 'relative', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18,
        borderRadius: '50%', background: 'white', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

function Section({ icon: Icon, title, desc, children, color, isDark }) {
  const borderCol = isDark ? '#2D3748' : '#EEE8E0';
  const bgCol = isDark ? '#1A202C' : '#FFFFFF';
  const textCol = isDark ? '#F7FAFC' : '#1C2B3A';
  const subTextCol = isDark ? '#A0AEC0' : '#5F7183';

  return (
    <div style={{ 
      background: bgCol, borderRadius: 24, border: `1.5px solid ${borderCol}`, borderBottom: `4px solid ${borderCol}`, 
      padding: '1.5rem', marginBottom: 20, transition: 'all 0.3s ease'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: desc ? 8 : 16 }}>
        <div style={{ 
          width: 40, height: 40, borderRadius: 14, background: color + '15', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
        }}>
          <Icon style={{ width: 20, height: 20, color }} />
        </div>
        <div>
          <p style={{ fontWeight: 900, fontSize: '1rem', color: textCol, margin: 0 }}>{title}</p>
          {desc && <p style={{ fontWeight: 600, fontSize: '0.78rem', color: subTextCol, margin: 0 }}>{desc}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function PrefRow({ label, checked, onChange, color, isDark }) {
  const textCol = isDark ? '#E2E8F0' : '#1C2B3A';
  const borderCol = isDark ? '#2D3748' : '#EEE8E0';

  return (
    <div style={{ 
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', 
      borderBottom: `1px solid ${borderCol}`, transition: 'all 0.2s ease' 
    }}>
      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: textCol }}>{label}</span>
      <Toggle on={checked} onChange={onChange} color={color} />
    </div>
  );
}

export default function Settings() {
  const { lang, setLang } = useLanguage();
  const { user } = useAuth();
  const ui = UI[lang] || UI.fr;

  const [prefs, setPrefs] = useState(() => {
    try { return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
    catch { return defaultPrefs; }
  });
  const [saved, setSaved] = useState(false);

  const C = THEMES[prefs.theme] || THEMES.classic;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', prefs.darkMode);
  }, [prefs.darkMode, prefs.theme]);

  const setPref = (key, val) => setPrefs(p => ({ ...p, [key]: val }));

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setSaved(true);

    if (prefs.soundEnabled) {
      try {
        const audio = new Audio(CONFIRM_SOUND_URL);
        audio.volume = 0.4;
        audio.play().catch(e => console.warn("Audio play blocked", e));
      } catch (err) {
        console.error("Audio error", err);
      }
    }

    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.75 },
      colors: [C.teal, C.violet, '#F0C85A'],
      gravity: 1.2
    });

    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <AppLayout title={ui.title}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 20px 80px 20px' }}>

        {/* Toast Notification */}
        <div style={{ 
          position: 'fixed', bottom: 30, right: 30, zIndex: 100, pointerEvents: saved ? 'auto' : 'none',
          transform: saved ? 'translateY(0)' : 'translateY(100px)', opacity: saved ? 1 : 0,
          transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', borderRadius: 16, 
            background: C.teal, color: 'white', boxShadow: `0 10px 25px ${C.teal}40`
          }}>
            <CheckCircle2 style={{ width: 20, height: 20 }} />
            <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{ui.saved}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
           <h2 style={{ fontWeight: 900, fontSize: '1.8rem', color: prefs.darkMode ? '#F7FAFC' : '#1C2B3A', margin: 0 }}>
             {ui.title}
           </h2>
        </div>

        {/* Langue */}
        <Section icon={Globe} title={ui.langSection} desc={ui.langDesc} color={C.teal} isDark={prefs.darkMode}>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            {[{ code: 'fr', flag: '🇫🇷', label: 'Français' }, { code: 'en', flag: '🇬🇧', label: 'English' }].map(l => (
              <button key={l.code} onClick={() => setLang(l.code)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 16, border: `2px solid ${lang === l.code ? C.teal : (prefs.darkMode ? '#2D3748' : '#EEE8E0')}`,
                  background: lang === l.code ? C.tealSoft : (prefs.darkMode ? '#2D3748' : '#FFFFFF'), cursor: 'pointer',
                  fontWeight: 800, fontSize: '0.9rem', color: lang === l.code ? C.tealDark : (prefs.darkMode ? '#A0AEC0' : '#5F7183'),
                  transition: 'all 0.2s ease', transform: lang === l.code ? 'scale(1.02)' : 'scale(1)'
                }}>
                {l.flag} {l.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Thème */}
        <Section icon={Palette} title={ui.themeSection} desc={ui.themeDesc} color={C.violet} isDark={prefs.darkMode}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
            {Object.keys(THEMES).map(tKey => {
              const t = THEMES[tKey];
              const isSelected = prefs.theme === tKey;
              return (
                <button key={tKey} onClick={() => setPref('theme', tKey)}
                  style={{
                    padding: '16px', borderRadius: 16, border: `2px solid ${isSelected ? t.teal : (prefs.darkMode ? '#2D3748' : '#EEE8E0')}`,
                    background: isSelected ? t.tealSoft : (prefs.darkMode ? '#2D3748' : '#FFFFFF'), cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s ease',
                    boxShadow: isSelected ? `0 4px 12px ${t.teal}20` : 'none'
                  }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <div style={{ width: 14, height: 14, borderRadius: 4, background: t.teal }} />
                    <div style={{ width: 14, height: 14, borderRadius: 4, background: t.violet }} />
                  </div>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: isSelected ? t.tealDark : (prefs.darkMode ? '#E2E8F0' : '#1C2B3A') }}>
                    {ui.themes[tKey]}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Notifications & Audio */}
        <Section icon={Bell} title={ui.notifSection} desc={ui.notifDesc} color={C.violet} isDark={prefs.darkMode}>
          <div style={{ marginTop: 4 }}>
            <PrefRow label={ui.dailyReminder} checked={prefs.dailyReminder} onChange={v => setPref('dailyReminder', v)} color={C.teal} isDark={prefs.darkMode} />
            <PrefRow label={ui.streakAlert}   checked={prefs.streakAlert}   onChange={v => setPref('streakAlert', v)} color={C.teal} isDark={prefs.darkMode} />
            <PrefRow label={ui.badgeAlert}    checked={prefs.badgeAlert}    onChange={v => setPref('badgeAlert', v)} color={C.teal} isDark={prefs.darkMode} />
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${prefs.darkMode ? '#2D3748' : '#EEE8E0'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Volume2 size={16} color={C.teal} />
                <span style={{ fontWeight: 700, fontSize: '0.8rem', color: C.tealDark, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Audio</span>
              </div>
              <PrefRow label={ui.soundEnabled} checked={prefs.soundEnabled} onChange={v => setPref('soundEnabled', v)} color={C.teal} isDark={prefs.darkMode} />
            </div>
          </div>
        </Section>

        {/* Apparence (Dark Mode) */}
        <Section icon={Moon} title={ui.darkMode} desc={ui.darkModeDesc} color="#9580D4" isDark={prefs.darkMode}>
          <div style={{ marginTop: 4 }}>
            <PrefRow label={ui.darkMode} checked={prefs.darkMode} onChange={v => setPref('darkMode', v)} color={C.teal} isDark={prefs.darkMode} />
          </div>
        </Section>

        {/* Bouton save */}
        <button onClick={handleSave}
          style={{ 
            display: 'flex', alignItems: 'center', gap: 10, padding: '16px 28px', borderRadius: 20, border: 'none', 
            background: C.teal, color: 'white', fontWeight: 900, fontSize: '1rem', cursor: 'pointer', 
            boxShadow: `0 8px 20px ${C.teal}40`, borderBottom: `4px solid ${C.tealDark}`,
            width: '100%', justifyContent: 'center', marginTop: 24, transition: 'all 0.2s ease'
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'translateY(2px)'}
          onMouseUp={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <Save style={{ width: 18, height: 18 }} /> {ui.save}
        </button>

      </div>
    </AppLayout>
  );
}
