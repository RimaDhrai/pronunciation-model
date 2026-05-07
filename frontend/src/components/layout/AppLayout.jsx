import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  Mic, GraduationCap, BookOpen,
  FileBarChart, User, LogOut, Bell, ChevronDown,
  Menu, X, Trophy, Lock, Bot, Zap, Flame, Award, Swords, BrainCircuit, Settings
} from 'lucide-react';

const NAV_ITEMS = {
  fr: [
    { title: 'Accueil',      path: '/master',    icon: BrainCircuit },
    { title: 'Apprendre',    path: '/courses',   icon: GraduationCap },
    { title: 'Exercices',    path: '/exercises', icon: BookOpen },
    { title: 'Coach IA',     path: '/chatbot',   icon: Bot },
    { title: 'Évaluation',   path: '/cefr-test', icon: Trophy },
    { title: 'Défis',        path: '/battle',    icon: Swords },
    { title: 'Progression',  path: '/reports',   icon: FileBarChart },
    { title: 'Profil',       path: '/profile',   icon: User },
  ],
  en: [
    { title: 'Home',         path: '/master',    icon: BrainCircuit },
    { title: 'Learn',        path: '/courses',   icon: GraduationCap },
    { title: 'Exercises',    path: '/exercises', icon: BookOpen },
    { title: 'AI Coach',     path: '/chatbot',   icon: Bot },
    { title: 'Assessment',   path: '/cefr-test', icon: Trophy },
    { title: 'Challenges',   path: '/battle',    icon: Swords },
    { title: 'Progress',     path: '/reports',   icon: FileBarChart },
    { title: 'Profile',      path: '/profile',   icon: User },
  ],
};

const UI = {
  fr: { home: 'Accueil', profile: 'Mon profil', settings: 'Paramètres', logout: 'Déconnexion', cefrTooltip: 'Passez le test CEFR d\'abord' },
  en: { home: 'Home', profile: 'My profile', settings: 'Settings', logout: 'Sign out', cefrTooltip: 'Complete the CEFR test first' },
};

// Génère des notifications intelligentes à partir des données user (zéro API call)
function useSmartNotifications(user, lang) {
  return useMemo(() => {
    if (!user) return [];
    const notifs = [];
    const fr = lang === 'fr';

    // Read user notification preferences
    let prefs = {};
    try { prefs = JSON.parse(localStorage.getItem('sc_notif_prefs') || '{}'); } catch {}
    const dailyOn  = prefs.dailyReminder !== false;
    const streakOn = prefs.streakAlert   !== false;
    const badgeOn  = prefs.badgeAlert    !== false;

    // ── 1. CEFR test not completed (always shown) ──
    if (!user.cefrCompleted && !user.cefr_completed) {
      notifs.push({ id: 'cefr', icon: Trophy, color: '#9580D4', bg: '#F3F0FE',
        title: fr ? '🎯 Test CEFR non passé' : '🎯 CEFR test pending',
        body:  fr ? 'Passe le test pour débloquer tous les exercices !' : 'Take the test to unlock all exercises!',
        link: '/cefr-test', time: '' });
    }

    // ── 2. Streak notifications (if enabled) ──
    const streak = user.currentStreak || 0;
    if (streakOn) {
      if (streak >= 7) {
        notifs.push({ id: 'streak7', icon: Flame, color: '#F0C85A', bg: '#FFFBEA',
          title: fr ? `🏅 ${streak} jours de suite !` : `🏅 ${streak}-day streak!`,
          body:  fr ? 'Incroyable ! Tu bats ton record, continue !' : "Incredible! You're breaking your record, keep going!",
          link: '/reports', time: fr ? "Aujourd'hui" : 'Today' });
      } else if (streak >= 3) {
        notifs.push({ id: 'streak', icon: Flame, color: '#E8926A', bg: '#FEF3EC',
          title: fr ? `🔥 ${streak} jours d'affilée !` : `🔥 ${streak}-day streak!`,
          body:  fr ? 'Continue comme ça, tu es en feu !' : "You're on fire, keep it up!",
          link: '/exercises', time: fr ? "Aujourd'hui" : 'Today' });
      } else if (streak === 0 && (user.totalXp || 0) > 0) {
        notifs.push({ id: 'streak0', icon: Flame, color: '#E8476A', bg: '#FDE8EE',
          title: fr ? '⚠️ Série interrompue' : '⚠️ Streak lost',
          body:  fr ? "Entraîne-toi aujourd'hui pour relancer ta série !" : 'Practice today to restart your streak!',
          link: '/exercises', time: fr ? 'Maintenant' : 'Now' });
      }
    }

    // ── 3. Daily training reminder (if enabled) ──
    if (dailyOn && streak < 1 && (user.totalXp || 0) > 0) {
      const hour = new Date().getHours();
      if (hour >= 8 && hour <= 22) {
        notifs.push({ id: 'daily', icon: BookOpen, color: '#6BACD4', bg: '#EBF4FB',
          title: fr ? "📚 Rappel d'entraînement" : '📚 Training reminder',
          body:  fr ? "Tu n'as pas encore pratiqué aujourd'hui. 5 minutes suffisent !" : "You haven't practiced today. Just 5 minutes is enough!",
          link: '/exercises', time: fr ? 'Maintenant' : 'Now' });
      }
    }

    // ── 4. Welcome message for new users ──
    if ((user.totalXp || 0) === 0 && (user.exerciseCount || 0) === 0) {
      notifs.push({ id: 'welcome', icon: Zap, color: '#80DCDC', bg: '#E8F9F9',
        title: fr ? '👋 Bienvenue sur SpeakCoach !' : '👋 Welcome to SpeakCoach!',
        body:  fr ? 'Commence par un exercice pour gagner tes premiers XP.' : 'Start with an exercise to earn your first XP.',
        link: '/exercises', time: fr ? 'Nouveau' : 'New' });
    }

    // ── 5. XP milestones ──
    const xp = user.totalXp || 0;
    const milestones = [50, 100, 250, 500, 1000, 2500, 5000];
    const reached = milestones.filter(m => xp >= m);
    const next = milestones.find(m => xp < m);
    if (next && xp > 0 && (next - xp) <= 30) {
      notifs.push({ id: 'xp-near', icon: Zap, color: '#F0C85A', bg: '#FEFCF0',
        title: fr ? `⚡ Plus que ${next - xp} XP !` : `⚡ Only ${next - xp} XP to go!`,
        body:  fr ? `Tu es à ${next - xp} XP du palier ${next} XP. Fonce !` : `You're ${next - xp} XP from the ${next} XP milestone. Go for it!`,
        link: '/exercises', time: '' });
    }

    // ── 6. Level progress suggestion ──
    const level = user.cefrLevel;
    if (level && level !== 'C2' && (user.exerciseCount || 0) >= 5) {
      const nextLevel = { A1: 'A2', A2: 'B1', B1: 'B2', B2: 'C1', C1: 'C2' }[level];
      if (nextLevel) {
        notifs.push({ id: 'level-up', icon: GraduationCap, color: '#9580D4', bg: '#F3F0FE',
          title: fr ? `📈 Objectif : ${nextLevel}` : `📈 Goal: ${nextLevel}`,
          body:  fr ? `Continue tes exercices ${level} pour débloquer le niveau ${nextLevel}.` : `Keep practicing ${level} exercises to unlock level ${nextLevel}.`,
          link: '/reports', time: '' });
      }
    }

    // ── 7. Badge unlock (if enabled) ──
    if (badgeOn) {
      const badges = user.badges || [];
      const recentBadge = badges.find(b => b.earnedAt && (Date.now() - new Date(b.earnedAt).getTime()) < 86400000 * 3);
      if (recentBadge) {
        notifs.push({ id: 'badge', icon: Award, color: '#80DCDC', bg: '#E8F9F9',
          title: fr ? '🏆 Badge débloqué !' : '🏆 Badge unlocked!',
          body:  recentBadge.name || (fr ? 'Nouveau badge obtenu !' : 'New badge earned!'),
          link: '/profile', time: fr ? 'Récent' : 'Recent' });
      }
    }

    // ── 8. Course recommendation ──
    if ((user.cefrCompleted || user.cefr_completed) && (user.exerciseCount || 0) < 3) {
      notifs.push({ id: 'courses', icon: GraduationCap, color: '#E8926A', bg: '#FEF3EC',
        title: fr ? '🎬 Explore les cours' : '🎬 Explore courses',
        body:  fr ? 'Découvre les cours vidéo pour améliorer ta prononciation.' : 'Check out video courses to improve your pronunciation.',
        link: '/courses', time: '' });
    }

    return notifs;
  }, [user, lang]);
}

export default function AppLayout({ children, title = '' }) {
  const { user, logout } = useAuth();
  const { lang, setLang } = useLanguage();
  const location = useLocation();
  const navigate  = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const dropRef = useRef(null);
  const bellRef = useRef(null);

  const rawNotifications = useSmartNotifications(user, lang);
  
  // Track read notification IDs in localStorage to persist across renders/reloads
  const [readIds, setReadIds] = useState(() => {
    try {
      const stored = localStorage.getItem('sc_read_notifs');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const userNotifs = rawNotifications.map(n => ({ ...n, read: readIds.includes(n.id) }));
  const unreadCount = userNotifs.filter(n => !n.read).length;

  const markAllRead = () => {
    const allIds = rawNotifications.map(n => n.id);
    setReadIds(allIds);
    try { localStorage.setItem('sc_read_notifs', JSON.stringify(allIds)); } catch {}
  };

  const navItems = NAV_ITEMS[lang] || NAV_ITEMS.fr;
  const ui = UI[lang] || UI.fr;
  const fr = lang === 'fr';

  const fullName = user?.fullName || user?.email?.split('@')[0] || 'Utilisateur';
  const firstName = fullName.split(' ')[0];
  const initials = fullName.charAt(0).toUpperCase();

  const handleLogout = () => { logout(); navigate('/login'); };

  // Theme logic
  useEffect(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem('sc_notif_prefs') || '{}');
      const theme = prefs.theme || 'classic';
      const isDark = prefs.darkMode || false;
      
      const themeColors = {
        classic: { 
          primary: '180 57% 68%', primaryDark: '180 57% 58%', primarySoft: '180 57% 95%',
          secondary: '270 55% 58%', secondaryDark: '270 55% 46%', secondarySoft: '270 55% 95%',
          shadow: 'rgba(128,220,220,0.12)' 
        },
        royal: { 
          primary: '239 84% 67%', primaryDark: '239 84% 57%', primarySoft: '239 84% 95%',
          secondary: '38 92% 50%', secondaryDark: '38 92% 40%', secondarySoft: '38 92% 95%',
          shadow: 'rgba(99,102,241,0.12)' 
        },
        nature: { 
          primary: '161 94% 39%', primaryDark: '161 94% 30%', primarySoft: '161 94% 95%',
          secondary: '25 95% 53%', secondaryDark: '25 95% 43%', secondarySoft: '25 95% 95%',
          shadow: 'rgba(16,185,129,0.12)' 
        },
        candy: { 
          primary: '330 81% 60%', primaryDark: '330 81% 50%', primarySoft: '330 81% 95%',
          secondary: '188 86% 43%', secondaryDark: '188 86% 33%', secondarySoft: '188 86% 95%',
          shadow: 'rgba(236,72,153,0.12)' 
        },
      };
      
      const colors = themeColors[theme] || themeColors.classic;
      const root = document.documentElement;
      
      root.style.setProperty('--primary', colors.primary);
      root.style.setProperty('--secondary', colors.secondary);
      root.style.setProperty('--accent', colors.primary);
      
      // Update Sneat/Duo variables from index.css
      root.style.setProperty('--p-blue', colors.primary);
      root.style.setProperty('--p-blue-dark', colors.primaryDark);
      root.style.setProperty('--p-blue-soft', colors.primarySoft);
      
      root.style.setProperty('--p-green', colors.secondary);
      root.style.setProperty('--p-green-dark', colors.secondaryDark);
      root.style.setProperty('--p-green-soft', colors.secondarySoft);

      root.style.setProperty('--p-orange', colors.primary);
      root.style.setProperty('--p-orange-dark', colors.primaryDark);
      root.style.setProperty('--p-orange-soft', colors.primarySoft);
      
      root.style.setProperty('--p-shadow-premium', colors.shadow);
      
      // Theme-specific Background Pattern
      const patterns = {
        classic: 'radial-gradient(#80DCDC 0.5px, transparent 0.5px), radial-gradient(#80DCDC 0.5px, transparent 0.5px)',
        royal:   'linear-gradient(30deg, #4338CA 12%, transparent 12.5%, transparent 87%, #4338CA 87.5%, #4338CA), linear-gradient(150deg, #4338CA 12%, transparent 12.5%, transparent 87%, #4338CA 87.5%, #4338CA), linear-gradient(30deg, #4338CA 12%, transparent 12.5%, transparent 87%, #4338CA 87.5%, #4338CA), linear-gradient(150deg, #4338CA 12%, transparent 12.5%, transparent 87%, #4338CA 87.5%, #4338CA), linear-gradient(60deg, #4338CA 25%, transparent 25.5%, transparent 75%, #4338CA 75%, #4338CA), linear-gradient(60deg, #4338CA 25%, transparent 25.5%, transparent 75%, #4338CA 75%, #4338CA)',
        nature:  'radial-gradient(circle at 2px 2px, #10B981 1px, transparent 0)',
        candy:   'radial-gradient(#EC4899 2px, transparent 2px), radial-gradient(#EC4899 2px, #FDF2F8 2px)'
      };
      root.style.setProperty('--bg-pattern', patterns[theme] || patterns.classic);
      root.style.setProperty('--bg-pattern-size', theme === 'royal' ? '80px 140px' : (theme === 'candy' ? '40px 40px' : '20px 20px'));
      root.style.setProperty('--bg-pattern-opacity', isDark ? '0.03' : '0.05');
      
      root.classList.toggle('dark', isDark);
    } catch (e) {
      console.warn("Theme loading failed", e);
    }
  }, [location.pathname]); // Re-check on nav or we could use a custom hook/context

  // close dropdowns on outside click
  useEffect(() => {
    const fn = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300 flex flex-col w-full overflow-hidden relative" style={{ fontFamily: 'var(--font-body)' }}>
      
      {/* Dynamic Background Pattern */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: 'var(--bg-pattern)', backgroundSize: 'var(--bg-pattern-size)', opacity: 'var(--bg-pattern-opacity)',
        transition: 'all 0.5s ease'
      }} />

      {/* ─── TOP NAVBAR (Sneat style) ─────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-card border-b border-border shadow-sm transition-colors duration-300">
        <div className="w-full mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">

          {/* Brand */}
          <Link to="/master" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-md shadow-primary/20">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <div className="hidden md:block">
              <p className="font-heading font-extrabold text-foreground text-[14px] leading-none">SpeakCoach</p>
              <p className="text-[10px] font-semibold text-primary tracking-widest uppercase">AI Platform</p>
            </div>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden lg:flex items-center gap-1 xl:gap-2 flex-1 justify-center min-w-0 overflow-hidden">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              const cefrDone = user?.cefrCompleted || user?.cefr_completed;
              const isLocked = !cefrDone && item.path !== '/cefr-test' && item.path !== '/profile' && item.path !== '/master' && item.path !== '/battle';

              if (isLocked) {
                return (
                  <div key={item.path}
                    title={ui.cefrTooltip}
                    className="relative group flex items-center gap-1.5 px-2 xl:px-3 py-2 rounded-xl text-[10px] xl:text-[11px] font-black tracking-widest uppercase cursor-not-allowed select-none pointer-events-none whitespace-nowrap"
                    style={{ color: '#c0c0c0', background: 'repeating-linear-gradient(45deg,#f5f5f5,#f5f5f5 4px,#ebebeb 4px,#ebebeb 8px)', border: '1.5px dashed #d0d0d0', filter: 'blur(0.8px) grayscale(1)', opacity: 0.45 }}>
                    <Lock className="w-3 h-3" />
                    <span>{item.title}</span>
                  </div>
                );
              }

              return (
                <Link key={item.path} to={item.path}
                  className={`flex items-center gap-1.5 px-2 xl:px-3 py-2 rounded-xl text-[10px] xl:text-[11px] font-black tracking-widest uppercase transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-p-blue text-white shadow-md shadow-p-blue/20 translate-y-[-1px]'
                      : 'text-muted-foreground hover:bg-muted hover:text-p-blue'
                  }`}>
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'group-hover:text-p-blue'}`} />
                  {item.title}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Lang toggle */}
            <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border/50">
              <button
                onClick={() => setLang('fr')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                  lang === 'fr'
                    ? 'bg-white text-primary shadow-sm ring-1 ring-border/20'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <img src="https://flagcdn.com/16x12/fr.png" width="16" height="12" alt="FR" style={{borderRadius:2,flexShrink:0}} />
                <span>FR</span>
              </button>
              <button
                onClick={() => setLang('en')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                  lang === 'en'
                    ? 'bg-white text-primary shadow-sm ring-1 ring-border/20'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <img src="https://flagcdn.com/16x12/gb.png" width="16" height="12" alt="EN" style={{borderRadius:2,flexShrink:0}} />
                <span>EN</span>
              </button>
            </div>
            {/* Bell notifications */}
            <div className="relative" ref={bellRef}>
              <button onClick={() => setBellOpen(v => !v)}
                className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors relative">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center leading-none animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="bg-white border border-border" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 360, borderRadius: 16, boxShadow: '0 12px 40px rgba(0,0,0,0.15)', zIndex: 60, overflow: 'hidden' }}>
                  <div className="flex items-center justify-between border-b border-border" style={{ padding: '14px 16px' }}>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1e293b' }}>
                        🔔 {fr ? 'Alertes' : 'Notifications'}
                      </span>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead}
                          className="ml-auto text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded hover:bg-primary/20 transition-colors">
                          {fr ? 'Tout marquer lu' : 'Mark all read'}
                        </button>
                      )}
                    </div>
                  </div>
                  {userNotifs.length === 0 ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#6B7280' }}>
                        {fr ? 'Aucune alerte' : 'No alerts'}
                      </p>
                    </div>
                  ) : (
                    <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                      {userNotifs.map((n, idx) => {
                        const Icon = n.icon;
                        return (
                          <Link key={n.id} to={n.link} onClick={() => setBellOpen(false)}
                            className="hover:bg-muted"
                            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderBottom: idx < userNotifs.length - 1 ? '1px solid #F1F5F9' : 'none', textDecoration: 'none', transition: 'background .15s' }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: n.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1.5px solid ${n.color}30` }}>
                              <Icon style={{ width: 16, height: 16, color: n.color }} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                <p style={{ fontWeight: 800, fontSize: '0.78rem', margin: 0, color: '#1e293b', lineHeight: 1.3 }}>{n.title}</p>
                                {n.time && (
                                  <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#9CA3AF', whiteSpace: 'nowrap', flexShrink: 0 }}>{n.time}</span>
                                )}
                              </div>
                              <p style={{ fontWeight: 600, fontSize: '0.72rem', margin: '3px 0 0', color: '#6B7280', lineHeight: 1.4 }}>{n.body}</p>
                            </div>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: n.color, flexShrink: 0, marginTop: 6, opacity: 0.8 }} />
                          </Link>
                        );
                      })}
                    </div>
                  )}
                  <Link to="/settings" onClick={() => setBellOpen(false)}
                    className="text-muted-foreground hover:text-foreground"
                    style={{ display: 'block', textAlign: 'center', padding: '10px 16px', fontSize: '0.72rem', fontWeight: 700, borderTop: '1px solid var(--border)', textDecoration: 'none', transition: 'color 0.15s' }}>
                    ⚙️ {lang === 'fr' ? 'Gérer les notifications' : 'Manage notifications'}
                  </Link>
                </div>
              )}
            </div>

            {/* User dropdown */}
            <div className="relative" ref={dropRef}>
              <button onClick={() => setDropOpen(!dropOpen)}
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl hover:bg-muted transition-colors max-w-[200px]">
                <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-xs shrink-0">
                  {initials}
                </div>
                <div className="hidden md:flex flex-col text-left min-w-0">
                  <p className="text-xs font-bold text-foreground leading-tight truncate">{firstName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                </div>
                <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform shrink-0 ${dropOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-card rounded-2xl shadow-xl border border-border py-1.5 z-50 animate-fade-up">
                  <div className="px-4 py-2.5 border-b border-border mb-1">
                    <p className="text-sm font-bold text-foreground">{fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                  <Link to="/profile" onClick={() => setDropOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">
                    <User className="w-4 h-4 text-muted-foreground" /> {ui.profile}
                  </Link>
                  <Link to="/settings" onClick={() => setDropOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors">
                    <Settings className="w-4 h-4 text-muted-foreground" /> {ui.settings}
                  </Link>
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors">
                    <LogOut className="w-4 h-4" /> {ui.logout}
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
              {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <div className="lg:hidden border-t border-border bg-card px-4 py-3 space-y-1 animate-fade-up">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              const cefrDone = user?.cefrCompleted || user?.cefr_completed;
              const isLocked = !cefrDone && item.path !== '/cefr-test' && item.path !== '/profile' && item.path !== '/master' && item.path !== '/battle';
              if (isLocked) {
                return (
                  <div key={item.path}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-not-allowed pointer-events-none select-none"
                    style={{ color: '#c0c0c0', background: 'repeating-linear-gradient(45deg,#f5f5f5,#f5f5f5 4px,#ebebeb 4px,#ebebeb 8px)', border: '1.5px dashed #d0d0d0', filter: 'blur(0.7px) grayscale(1)', opacity: 0.4 }}>
                    <Lock className="w-4 h-4" /> {item.title}
                  </div>
                );
              }
              return (
                <Link key={item.path} to={item.path} onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
                  }`}>
                  <Icon className="w-4 h-4" /> {item.title}
                </Link>
              );
            })}
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-destructive hover:bg-destructive/5">
              <LogOut className="w-4 h-4" /> {ui.logout}
            </button>
          </div>
        )}
      </header>

      {/* ─── PAGE CONTENT ─────────────────────────────────────────── */}
      <main className="flex-1 w-full mx-auto px-4 lg:px-8 py-6">
        {title && (
          <div className="mb-6">
            <h1 className="font-heading font-bold text-2xl text-foreground">{title}</h1>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <Link to="/master" className="hover:text-primary transition-colors">{ui.home}</Link>
              {title && <><span>/</span><span className="text-foreground">{title}</span></>}
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
