import { useEffect, useState, useCallback, useMemo } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { getAllUsers } from '../../api/admin';
import { useLanguage } from '../../context/LanguageContext';
import {
  Users, Shield, RefreshCw, Zap, Plus,
  TrendingUp, ArrowRight, Settings, PlayCircle, Trophy, Activity, Clock,
  BookOpen, BarChart2, Target, CheckCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

// ─── i18n ────────────────────────────────────────────────────────────────────
const T = {
  fr: {
    title:        "Vue d'ensemble",
    subtitle:     "Statistiques et indicateurs de la plateforme en temps réel",
    refresh:      "Actualiser",
    addUser:      "Nouvel utilisateur",
    totalUsers:   "Utilisateurs",
    newToday:     "Nouveaux (24h)",
    admins:       "Staff Admin",
    systemHealth: "Santé Système",
    recentTitle:  "Dernières Inscriptions",
    viewAll:      "Tout voir",
    colUser:      "Utilisateur",
    colEmail:     "Email",
    colRole:      "Rôle",
    colDate:      "Date",
    noUsers:      "Aucun utilisateur",
    activeCount:  (n) => `${n} apprenant${n > 1 ? 's' : ''} actif${n > 1 ? 's' : ''}`,
    adminSub:     "Accès privilégiés",
    online:       "● Opérationnel",
    adminBadge:   "🛡 Admin",
    userBadge:    "👤 Utilisateur",
    actions:      "Raccourcis de gestion",
    addUserLink:  "Créer un utilisateur",
    courses:      "Catalogue de cours",
    mailConf:     "Serveur Email",
    monitoring:   "Monitoring Système",
    activityTitle:"Inscriptions (7 jours)",
    inscriptions: "Inscriptions",
  },
  en: {
    title:        "Overview",
    subtitle:     "Real-time platform statistics and key indicators",
    refresh:      "Refresh",
    addUser:      "New user",
    totalUsers:   "Users",
    newToday:     "New (24h)",
    admins:       "Admin Staff",
    systemHealth: "System Health",
    recentTitle:  "Recent Signups",
    viewAll:      "View all",
    colUser:      "User",
    colEmail:     "Email",
    colRole:      "Role",
    colDate:      "Joined",
    noUsers:      "No users found",
    activeCount:  (n) => `${n} active learner${n > 1 ? 's' : ''}`,
    adminSub:     "Privileged access",
    online:       "● Operational",
    adminBadge:   "🛡 Admin",
    userBadge:    "👤 User",
    actions:      "Quick links",
    addUserLink:  "Create a user",
    courses:      "Courses",
    mailConf:     "Email Server",
    monitoring:   "System Monitoring",
    activityTitle:"Registrations (7 days)",
    inscriptions: "Registrations",
  },
};

// ─── Sub-components ────────────────────────────────────────────────────────────
function MetricCard({ icon, label, value, sub, gradient, loading }) {
  return (
    <div className="rounded-2xl border border-white/20 p-5 flex items-center gap-4 relative overflow-hidden shadow-lg" style={{ background: gradient }}>
      <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
      <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 relative z-10 shadow-inner">
        <span className="text-white">{icon}</span>
      </div>
      <div className="min-w-0 flex-1 relative z-10">
        <p className="text-[11px] font-bold text-white/70 uppercase tracking-widest mb-0.5">{label}</p>
        {loading ? <div className="h-8 w-16 bg-white/20 rounded-lg animate-pulse" /> : <p className="font-black text-3xl text-white leading-none">{value}</p>}
        {sub && !loading && <p className="text-[11px] font-semibold text-white/80 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-lg text-xs">
        <p className="font-bold text-slate-600 mb-1">{label}</p>
        <p className="font-black text-indigo-600">{payload[0].value} inscriptions</p>
      </div>
    );
  }
  return null;
};

export default function AdminDashboard() {
  const { lang, toggleLang } = useLanguage();
  const t = T[lang] || T.fr;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const usersRes = await getAllUsers().catch(() => ({ data: [] }));
    setUsers(usersRes?.data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const adminCount   = users.filter(u => u.role === 'ADMIN').length;
  const regularUsers = users.filter(u => u.role !== 'ADMIN');
  const today        = new Date().toISOString().slice(0, 10);
  const newToday     = regularUsers.filter(u => u.createdAt?.startsWith(today)).length;
  const recentUsers  = [...regularUsers]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  const chartData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toISOString().slice(0, 10);
      const count   = regularUsers.filter(u => u.createdAt?.startsWith(dateStr)).length;
      return {
        name: d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'short' }),
        val:  count,
      };
    });
  }, [regularUsers, lang]);

  return (
    <AdminLayout title={t.title}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-800">{t.title}</h2>
            <p className="text-sm text-slate-400 mt-0.5">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleLang} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
              <img src={`https://flagcdn.com/16x12/${lang === 'fr' ? 'fr' : 'gb'}.png`} width="16" height="12" alt={lang.toUpperCase()} style={{ borderRadius: 2 }} />
              {lang.toUpperCase()}
            </button>
            <button onClick={() => load(true)} disabled={refreshing} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {t.refresh}
            </button>
            <Link to="/admin/users" className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/25">
              <Plus className="w-3.5 h-3.5" /> {t.addUser}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={<Users className="w-5 h-5" />} label={t.totalUsers} value={regularUsers.length} sub={t.activeCount(regularUsers.length)} gradient="linear-gradient(135deg, #6366f1, #8b5cf6)" loading={loading} />
          <MetricCard icon={<TrendingUp className="w-5 h-5" />} label={t.newToday} value={`+${newToday}`} sub={lang === 'fr' ? "Inscriptions aujourd'hui" : 'Joined today'} gradient="linear-gradient(135deg, #10b981, #059669)" loading={loading} />
          <MetricCard icon={<Shield className="w-5 h-5" />} label={t.admins} value={adminCount} sub={t.adminSub} gradient="linear-gradient(135deg, #f43f5e, #e11d48)" loading={loading} />
          <MetricCard icon={<Zap className="w-5 h-5" />} label={t.systemHealth} value="100%" sub={t.online} gradient="linear-gradient(135deg, #f59e0b, #d97706)" loading={loading} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-6 text-sm">
                <Activity className="w-4 h-4 text-indigo-500" /> {t.activityTitle}
              </h3>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="val" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-indigo-500" /> {t.recentTitle}
                </h3>
                <Link to="/admin/users" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                  {t.viewAll} <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {loading ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 animate-pulse shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-slate-100 rounded w-28 animate-pulse" />
                        <div className="h-2.5 bg-slate-100 rounded w-44 animate-pulse" />
                      </div>
                      <div className="h-5 w-14 bg-slate-100 rounded-full animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : recentUsers.length === 0 ? (
                <div className="py-16 text-center">
                  <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">{t.noUsers}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] text-slate-400 border-b border-slate-100 font-bold uppercase tracking-widest">
                        <th className="text-left px-6 pb-3 pt-3">{t.colUser}</th>
                        <th className="text-left pb-3 pt-3">{t.colEmail}</th>
                        <th className="text-left pb-3 pt-3">CEFR</th>
                        <th className="text-left pb-3 pt-3">{t.colDate}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentUsers.map(u => (
                        <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                {(u.fullName || u.email || 'U').charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold text-slate-800 truncate max-w-[110px]">{u.fullName || '—'}</span>
                            </div>
                          </td>
                          <td className="py-3 text-slate-500 text-xs truncate max-w-[150px]">{u.email}</td>
                          <td className="py-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{u.cefrLevel || '—'}</span>
                          </td>
                          <td className="py-3 text-slate-400 text-xs">{u.createdAt ? new Date(u.createdAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm">{t.actions}</h3>
              <div className="space-y-2">
                {[
                  { icon: <Plus className="w-4 h-4" />,       label: t.addUserLink, to: '/admin/users',         bg: '#eef2ff', color: '#6366f1' },
                  { icon: <PlayCircle className="w-4 h-4" />, label: t.courses,     to: '/admin/courses',       bg: '#ecfdf5', color: '#10b981' },
                  { icon: <Zap className="w-4 h-4" />,        label: t.mailConf,    to: '/admin/mail-settings', bg: '#fffbeb', color: '#f59e0b' },
                  { icon: <Settings className="w-4 h-4" />,   label: t.monitoring,  to: '/admin/settings',      bg: '#f5f3ff', color: '#8b5cf6' },
                ].map(a => (
                  <Link key={a.to} to={a.to} className="flex items-center gap-3 p-3 rounded-xl font-semibold text-sm transition-all hover:-translate-y-0.5 hover:shadow-md" style={{ background: a.bg, color: a.color }}>
                    {a.icon} {a.label}
                    <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-40" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
