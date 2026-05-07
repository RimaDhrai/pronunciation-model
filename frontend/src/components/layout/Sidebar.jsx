import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { getXpProgress } from '../../utils/gamification';
import {
  LayoutDashboard,
  Mic,
  BookOpen,
  TrendingUp,
  User,
  Settings,
  ChevronLeft,
  X,
  Trophy,
  Bot,
  Swords,
} from 'lucide-react';

const NAV_SECTIONS = {
  fr: [
    {
      label: 'NAVIGATION',
      items: [
        { title: 'Accueil',      path: '/dashboard',          icon: LayoutDashboard },
        { title: 'Apprendre',    path: '/exercises',           icon: BookOpen },
        { title: 'Pratiquer',    path: '/exercises/revision',  icon: Mic },
        { title: 'Coach IA',     path: '/chatbot',             icon: Bot },
        { title: 'Évaluation',   path: '/cefr-test',           icon: Trophy },
        { title: 'Défis',        path: '/battle',              icon: Swords },
        { title: 'Progression',  path: '/reports',             icon: TrendingUp },
      ],
    },
    {
      label: 'COMPTE',
      items: [
        { title: 'Profil',       path: '/profile',    icon: User },
        { title: 'Paramètres',   path: '/settings',   icon: Settings },
      ],
    },
  ],
  en: [
    {
      label: 'NAVIGATION',
      items: [
        { title: 'Home',         path: '/dashboard',          icon: LayoutDashboard },
        { title: 'Learn',        path: '/exercises',           icon: BookOpen },
        { title: 'Practice',     path: '/exercises/revision',  icon: Mic },
        { title: 'AI Coach',     path: '/chatbot',             icon: Bot },
        { title: 'Assessment',   path: '/cefr-test',           icon: Trophy },
        { title: 'Challenges',   path: '/battle',              icon: Swords },
        { title: 'Progress',     path: '/reports',             icon: TrendingUp },
      ],
    },
    {
      label: 'ACCOUNT',
      items: [
        { title: 'Profile',      path: '/profile',    icon: User },
        { title: 'Settings',     path: '/settings',   icon: Settings },
      ],
    },
  ],
};

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const location = useLocation();
  const { user } = useAuth();

  const { lang } = useLanguage();
  const navSections = NAV_SECTIONS[lang] || NAV_SECTIONS.fr;

  const firstName = user?.firstName || user?.prenom || (lang === 'en' ? 'User' : 'Utilisateur');
  const initials = firstName.charAt(0).toUpperCase();
  const totalXp = user?.totalXp || 0;
  const { pct: xpPct, current: xpCurrent, max: xpMax, lvl: xpLvl } = getXpProgress(totalXp);
  const streak = user?.currentStreak || 0;

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-foreground/20 z-40 lg:hidden" onClick={onMobileClose} />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full bg-card border-r border-border z-50 flex flex-col transition-all duration-300
          ${collapsed ? 'w-16' : 'w-[260px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:relative
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shrink-0">
            <Mic className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-heading font-bold text-lg text-foreground">SpeakCoach AI</span>
          )}
          <button onClick={onMobileClose} className="ml-auto lg:hidden text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User info */}
        {!collapsed && (
          <div className="px-4 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="font-heading font-semibold text-sm text-foreground truncate">{firstName}</p>
                <span className="sneat-badge-primary text-[10px]">{xpLvl.icon} {xpLvl.label[lang]}</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {navSections.map((section) => {
            return (
              <div key={section.label}>
                {!collapsed && (
                  <p className="text-[10px] font-semibold tracking-wider text-muted-foreground mb-2 px-3 uppercase opacity-50">
                    {section.label}
                  </p>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;
                    const cefrDone = user?.cefrCompleted || user?.cefr_completed;
                    const isRestricted = !cefrDone && item.path !== '/cefr-test' && item.path !== '/profile' && item.path !== '/dashboard' && item.path !== '/battle';

                    if (isRestricted) {
                      return (
                        <div
                          key={item.path}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-not-allowed"
                          style={{ color: '#bbb', filter: 'blur(0.5px)', opacity: 0.45 }}
                          title="Veuillez d'abord passer le test CEFR"
                        >
                          <Icon className="w-5 h-5 shrink-0" />
                          {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={onMobileClose}
                        className={`sneat-sidebar-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* XP bar */}
        {!collapsed && (
          <div className="px-4 py-4 border-t border-border">
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
              <span>{xpCurrent} / {xpMax} XP</span>
              <span>{xpLvl.icon} {xpLvl.label[lang]}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full gradient-primary rounded-full transition-all duration-700"
                style={{ width: `${xpPct}%` }}
              />
            </div>
            {streak > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1.5">🔥 {streak} {lang === 'en' ? 'day streak' : 'jours de suite'}</p>
            )}
          </div>
        )}

        {/* Collapse toggle (desktop) */}
        <div className="hidden lg:flex px-3 py-3 border-t border-border">
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-center h-9 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </aside>
    </>
  );
}
