import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getAllUsers, getAdminStats } from '../../api/admin';
import {
  LayoutDashboard, Users, Settings,
  LogOut, Bell, ChevronDown, ChevronLeft,
  Shield, PlayCircle, AlertTriangle, TrendingUp,
  UserPlus, Activity, BookOpen, CheckCircle2
} from 'lucide-react';

/* ─── Bilingual sidebar labels ─── */
const NAV = {
  fr: [
    { title: 'Tableau de bord', path: '/admin',         icon: LayoutDashboard },
    { title: 'Utilisateurs',    path: '/admin/users',    icon: Users },
    { title: 'Gestion Cours',   path: '/admin/courses',  icon: PlayCircle },
    { title: 'Monitoring',      path: '/admin/settings', icon: Settings },
  ],
  en: [
    { title: 'Dashboard',       path: '/admin',         icon: LayoutDashboard },
    { title: 'Users',           path: '/admin/users',    icon: Users },
    { title: 'Courses',         path: '/admin/courses',  icon: PlayCircle },
    { title: 'Monitoring',      path: '/admin/settings', icon: Settings },
  ],
};

/* ─── Admin-specific smart notifications (live from API) ─── */
function useAdminNotifications(lang) {
  const [notifs, setNotifs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const fr = lang === 'fr';
    const items = [];

    try {
      const [usersRes, statsRes] = await Promise.all([
        getAllUsers().catch(() => ({ data: [] })),
        getAdminStats().catch(() => ({ data: null })),
      ]);
      const users = usersRes?.data || [];

      // 1. New users today
      const today = new Date().toISOString().slice(0, 10);
      const newToday = users.filter(u => u.createdAt?.startsWith(today) && u.role !== 'ADMIN');
      if (newToday.length > 0) {
        items.push({
          id: 'new-users', icon: UserPlus, color: '#10B981', bg: '#ECFDF5',
          title: fr ? `👤 ${newToday.length} nouvelle${newToday.length > 1 ? 's' : ''} inscription${newToday.length > 1 ? 's' : ''}` : `👤 ${newToday.length} new registration${newToday.length > 1 ? 's' : ''}`,
          body: newToday.map(u => u.fullName || u.email?.split('@')[0]).slice(0, 3).join(', ') + (newToday.length > 3 ? '…' : ''),
          link: '/admin/users',
          time: fr ? "Aujourd'hui" : 'Today',
        });
      }

      // 2. Users without CEFR test
      const noCefr = users.filter(u => !u.cefrCompleted && u.role !== 'ADMIN');
      if (noCefr.length > 3) {
        items.push({
          id: 'no-cefr', icon: AlertTriangle, color: '#F59E0B', bg: '#FFFBEB',
          title: fr ? `⚠️ ${noCefr.length} sans test CEFR` : `⚠️ ${noCefr.length} without CEFR test`,
          body: fr ? "Ces utilisateurs n'ont pas encore passé leur évaluation." : "These users haven't taken their assessment yet.",
          link: '/admin/users',
          time: '',
        });
      }

      // 3. User growth trend
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const newYesterday = users.filter(u => u.createdAt?.startsWith(yesterday) && u.role !== 'ADMIN');
      if (newToday.length > newYesterday.length && newToday.length > 0) {
        items.push({
          id: 'growth', icon: TrendingUp, color: '#6366F1', bg: '#EEF2FF',
          title: fr ? '📈 Croissance en hausse' : '📈 Growth trending up',
          body: fr ? `+${newToday.length - newYesterday.length} inscriptions de plus qu'hier.` : `+${newToday.length - newYesterday.length} more registrations than yesterday.`,
          link: '/admin',
          time: '',
        });
      }

      // 4. Active learners (streak ≥3)
      const activeStreaks = users.filter(u => (u.currentStreak || 0) >= 3 && u.role !== 'ADMIN');
      if (activeStreaks.length > 0) {
        items.push({
          id: 'active', icon: Activity, color: '#EC4899', bg: '#FDF2F8',
          title: fr ? `🔥 ${activeStreaks.length} apprenant${activeStreaks.length > 1 ? 's' : ''} actif${activeStreaks.length > 1 ? 's' : ''}` : `🔥 ${activeStreaks.length} active learner${activeStreaks.length > 1 ? 's' : ''}`,
          body: fr ? `Série d'au moins 3 jours consécutifs.` : 'Streak of 3+ consecutive days.',
          link: '/admin/users',
          time: '',
        });
      }

      // 5. Total users milestone approaching
      const regularCount = users.filter(u => u.role !== 'ADMIN').length;
      const milestones = [10, 25, 50, 100, 250, 500, 1000];
      const nearMilestone = milestones.find(m => regularCount >= m - 2 && regularCount < m);
      if (nearMilestone) {
        items.push({
          id: 'milestone', icon: CheckCircle2, color: '#10B981', bg: '#ECFDF5',
          title: fr ? `🎯 Bientôt ${nearMilestone} utilisateurs !` : `🎯 Almost ${nearMilestone} users!`,
          body: fr ? `Plus que ${nearMilestone - regularCount} pour atteindre le palier.` : `Only ${nearMilestone - regularCount} more to reach the milestone.`,
          link: '/admin',
          time: '',
        });
      }

      // 6. Platform health (always visible)
      const adminCount = users.filter(u => u.role === 'ADMIN').length;
      const regularUsers = users.filter(u => u.role !== 'ADMIN').length;
      items.push({
        id: 'health', icon: Shield, color: '#6366F1', bg: '#EEF2FF',
        title: fr ? '✅ Système opérationnel' : '✅ System operational',
        body: fr ? `${regularUsers} utilisateurs, ${adminCount} admin${adminCount > 1 ? 's' : ''}.` : `${regularUsers} users, ${adminCount} admin${adminCount > 1 ? 's' : ''}.`,
        link: '/admin/settings',
        time: fr ? 'En direct' : 'Live',
      });

    } catch (err) {
      items.push({
        id: 'error', icon: AlertTriangle, color: '#EF4444', bg: '#FEF2F2',
        title: fr ? '❌ Erreur de chargement' : '❌ Loading error',
        body: fr ? 'Impossible de récupérer les données. Vérifiez le serveur.' : 'Unable to fetch data. Check the server.',
        link: '/admin/settings',
        time: '',
      });
    }

    setNotifs(items);
    setLoaded(true);
  }, [lang]);

  useEffect(() => { load(); }, [load]);

  return { notifs, loaded, refresh: load };
}

/* ═══════════════════════════════════════════════════════════════
   AdminLayout — main shell for all admin pages
   ═══════════════════════════════════════════════════════════════ */
export default function AdminLayout({ children, title = 'Admin' }) {
  const { user } = useAuth();
  const { lang, setLang } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [dropOpen, setDropOpen]   = useState(false);
  const [bellOpen, setBellOpen]   = useState(false);
  const dropRef = useRef(null);
  const bellRef = useRef(null);

  // ── Notifications via hook ──
  const { notifs: fetchedNotifs, loaded: notifsLoaded } = useAdminNotifications(lang);
  
  // Track read notification IDs in localStorage to persist across renders/reloads
  const [readAdminIds, setReadAdminIds] = useState(() => {
    try {
      const stored = localStorage.getItem('sc_admin_read_notifs');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const adminNotifs = fetchedNotifs.map(n => ({ ...n, read: readAdminIds.includes(n.id) }));
  const unreadCount = adminNotifs.filter(n => !n.read).length;

  const markAllRead = () => {
    const allIds = fetchedNotifs.map(n => n.id);
    setReadAdminIds(allIds);
    try { localStorage.setItem('sc_admin_read_notifs', JSON.stringify(allIds)); } catch {}
  };

  // ── Derived values ──
  const fr = lang === 'fr';
  const isDbAdmin = user?.role === 'ADMIN';
  const fullName  = isDbAdmin ? user.fullName : (fr ? 'Administrateur' : 'Administrator');
  const initials  = fullName.charAt(0).toUpperCase();
  const adminNav = (NAV[lang] || NAV.fr);

  const handleLogout = () => {
    sessionStorage.removeItem('sc_admin_auth');
    navigate('/admin/login');
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const fn = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <div className="flex h-screen bg-[#F0F2F5] overflow-hidden" style={{ fontFamily: 'var(--font-body)' }}>

      {/* ─── ADMIN SIDEBAR ────────────────────────────────────────── */}
      <aside className={`${collapsed ? 'w-16' : 'w-64'} shrink-0 bg-[#1a1c2e] flex flex-col transition-all duration-300 relative`}>

        {/* Brand */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-lg">
            <Shield className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div>
              <p className="font-heading font-extrabold text-white text-sm leading-none">SpeakCoach</p>
              <p className="text-[9px] font-bold text-indigo-400 tracking-widest uppercase">Administration</p>
            </div>
          )}
        </div>

        {/* User info */}
        {!collapsed && (
          <div className="px-4 py-4 border-b border-white/5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{fullName.split(' ')[0]}</p>
                <span className="text-[10px] text-indigo-400 font-semibold">{fr ? 'Administrateur' : 'Administrator'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {!collapsed && <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-2">NAVIGATION</p>}
          {adminNav.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                } ${collapsed ? 'justify-center px-0' : ''}`}>
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{item.title}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-3 border-t border-white/5">
          <button onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all ${collapsed ? 'justify-center px-0' : ''}`}>
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && (fr ? 'Déconnexion' : 'Sign out')}
          </button>
        </div>

        {/* Collapse toggle */}
        <button onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white border border-border flex items-center justify-center shadow-md text-muted-foreground hover:text-foreground z-10">
          <ChevronLeft className={`w-3 h-3 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </aside>

      {/* ─── MAIN AREA ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="h-16 bg-white border-b border-border flex items-center justify-between px-6 shrink-0">
          <div>
            <h1 className="font-heading font-bold text-lg text-foreground">{title}</h1>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Admin</span>
              {title !== 'Dashboard Admin' && <><span>/</span><span className="text-foreground">{title}</span></>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Lang toggle */}
            <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border/50">
              <button
                onClick={() => setLang('fr')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                  lang === 'fr'
                    ? 'bg-white text-primary shadow-sm'
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
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <img src="https://flagcdn.com/16x12/gb.png" width="16" height="12" alt="EN" style={{borderRadius:2,flexShrink:0}} />
                <span>EN</span>
              </button>
            </div>

            {/* ── Bell notifications ── */}
            <div className="relative" ref={bellRef}>
              <button onClick={() => setBellOpen(v => !v)}
                className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground relative transition-colors">
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
                    <div className="flex items-center gap-2">
                      <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1e293b' }}>
                        🔔 {fr ? 'Alertes Admin' : 'Admin Alerts'}
                      </span>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead}
                          className="ml-auto text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded hover:bg-primary/20 transition-colors">
                          {fr ? 'Tout marquer lu' : 'Mark all read'}
                        </button>
                      )}
                    </div>
                  </div>

                  {!notifsLoaded ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: '0.82rem', fontWeight: 600 }}>
                      <div className="animate-spin inline-block w-5 h-5 border-2 border-indigo-300 border-t-transparent rounded-full mb-2" />
                      <p>{fr ? 'Chargement…' : 'Loading…'}</p>
                    </div>
                  ) : adminNotifs.length === 0 ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#6B7280' }}>
                        {fr ? 'Aucune alerte' : 'No alerts'}
                      </p>
                    </div>
                  ) : (
                    <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                      {adminNotifs.map((n, idx) => {
                        const Icon = n.icon;
                        return (
                          <Link key={n.id} to={n.link} onClick={() => setBellOpen(false)}
                            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderBottom: idx < adminNotifs.length - 1 ? '1px solid #F1F5F9' : 'none', textDecoration: 'none', transition: 'background .15s' }}
                            onMouseOver={e => e.currentTarget.style.background = '#F8FAFC'}
                            onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
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
                </div>
              )}
            </div>

            {/* Go to user view */}
            <Link to="/dashboard" className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">
              ← {fr ? 'Vue utilisateur' : 'User view'}
            </Link>

            {/* User dropdown */}
            <div className="relative" ref={dropRef}>
              <button onClick={() => setDropOpen(!dropOpen)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-muted transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs">
                  {initials}
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-foreground leading-none">{fullName.split(' ')[0]}</p>
                  <p className="text-[10px] text-muted-foreground">{fr ? 'Administrateur' : 'Administrator'}</p>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${dropOpen ? 'rotate-180' : ''}`} />
              </button>
              {dropOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-border py-1.5 z-50">
                  <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/5">
                    <LogOut className="w-4 h-4" /> {fr ? 'Déconnexion' : 'Sign out'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
