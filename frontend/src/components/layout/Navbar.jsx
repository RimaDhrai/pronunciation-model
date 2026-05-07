import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Bell, LogOut, Menu } from 'lucide-react';

export default function Navbar({ title, onMenuClick }) {
  const { user, logout } = useAuth();
  const { lang, setLang } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = (user?.firstName || user?.prenom || 'U').charAt(0).toUpperCase();

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden text-muted-foreground">
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="font-heading font-semibold text-lg text-foreground">{title}</h1>
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
            <span className="text-sm leading-none">🇫🇷</span>
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
            <span className="text-sm leading-none">🇬🇧</span>
            <span>EN</span>
          </button>
        </div>
        <button className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors relative">
          <Bell className="w-4 h-4" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent" />
        </button>
        <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
          {initials}
        </div>
        <button
          onClick={handleLogout}
          className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
