import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import AdminLayout from '../../components/layout/AdminLayout';
import { getAllUsers, createUser, updateUser, deleteUser } from '../../api/admin';
import { 
  Users, TrendingUp, Zap, Flame, Trophy, Search, 
  ArrowUpDown, LayoutList, CheckCircle2, AlertCircle, 
  X, Pencil, Trash2, Plus, BookOpen, Save, Loader2,
  ChevronLeft, ChevronRight
} from 'lucide-react';

/* ── Translations ────────────────────────────────────────────────── */
const T = {
  fr: {
    pageTitle:    'Gestion des utilisateurs',
    totalUsers:   'Utilisateurs total',
    cefrTests:    'Tests CEFR complétés',
    cefrSub:      (p) => `${p}% des inscrits`,
    avgXp:        'XP moyen / user',
    activeStreak: 'Série active ≥ 3j',
    leaderXp:     'Leader XP',
    search:       'Rechercher par nom ou email…',
    allLevels:    'Tous les niveaux',
    noLevel:      'Sans niveau',
    results:      (n) => `${n} résultat${n > 1 ? 's' : ''}`,
    newUser:      'Nouvel utilisateur',
    loading:      'Chargement…',
    noUsers:      'Aucun utilisateur trouvé.',
    noUsersSub:   'Aucun utilisateur. Vérifiez que Spring Boot est démarré.',
    colRank:      '#',
    colUser:      'Utilisateur',
    colCefr:      'Niveau CEFR',
    colXp:        'XP & Progression',
    colActivity:  'Activité',
    colBadge:     'Badge',
    colJoined:    'Inscrit le',
    colActions:   'Actions',
    table:        'Tableau',
    ranking:      'Classement',
    edit:         'Modifier',
    delete:       'Supprimer',
    saveSuccess:  'Utilisateur enregistré avec succès.',
    deleteSuccess:'Utilisateur supprimé.',
    streak:       (n) => `${n}j de série`,
    maxStreak:    (n) => `max ${n}j`,
    exercises:    (n) => `${n} exercice${n > 1 ? 's' : ''}`,
    disabled:     'Désactivé',
    page:         (p, t, n) => `Page ${p} / ${t} · ${n} utilisateurs`,
    confirmDel:   'Confirmer la suppression',
    confirmMsg:   'Vous allez supprimer :',
    cancel:       'Annuler',
    save:         'Enregistrer',
    create:       'Créer',
    editTitle:    'Modifier l\'utilisateur',
    newTitle:     'Nouvel utilisateur',
    fullName:     'Nom complet',
    email:        'Email',
    password:     'Mot de passe',
    newPassword:  'Nouveau mot de passe (laisser vide pour ne pas changer)',
    manualCefr:   'Niveau CEFR (correction manuelle)',
    auto:         '— Automatique —',
    emailLocked:  'L\'email ne peut pas être modifié.',
    saving:       'Enregistrement...',
    deleting:     'Suppression...',
    badges: {
      '🏆 Expert':        'Expert',
      '🥇 Avancé':        'Avancé',
      '🥈 Intermédiaire': 'Intermédiaire',
      '🥉 Débutant+':     'Débutant+',
      '🌱 Débutant':      'Débutant',
    }
  },
  en: {
    pageTitle:    'User Management',
    totalUsers:   'Total Users',
    cefrTests:    'CEFR Tests Completed',
    cefrSub:      (p) => `${p}% of registered users`,
    avgXp:        'Avg XP / user',
    activeStreak: 'Active Streak ≥ 3d',
    leaderXp:     'XP Leader',
    search:       'Search by name or email…',
    allLevels:    'All levels',
    noLevel:      'No level',
    results:      (n) => `${n} result${n > 1 ? 's' : ''}`,
    newUser:      'New User',
    loading:      'Loading…',
    noUsers:      'No users found.',
    noUsersSub:   'No users found. Check if Spring Boot is running.',
    colRank:      '#',
    colUser:      'User',
    colCefr:      'CEFR Level',
    colXp:        'XP & Progress',
    colActivity:  'Activity',
    colBadge:     'Badge',
    colJoined:    'Joined on',
    colActions:   'Actions',
    table:        'Table',
    ranking:      'Ranking',
    edit:         'Edit',
    delete:       'Delete',
    saveSuccess:  'User saved successfully.',
    deleteSuccess:'User deleted.',
    streak:       (n) => `${n}d streak`,
    maxStreak:    (n) => `max ${n}d`,
    exercises:    (n) => `${n} exercise${n > 1 ? 's' : ''}`,
    disabled:     'Disabled',
    page:         (p, t, n) => `Page ${p} / ${t} · ${n} users`,
    confirmDel:   'Confirm deletion',
    confirmMsg:   'You are about to delete:',
    cancel:       'Cancel',
    save:         'Save',
    create:       'Create',
    editTitle:    'Edit User',
    newTitle:     'New User',
    fullName:     'Full Name',
    email:        'Email',
    password:     'Password',
    newPassword:  'New password (leave empty to keep current)',
    manualCefr:   'CEFR Level (manual correction)',
    auto:         '— Automatic —',
    emailLocked:  'Email cannot be modified.',
    saving:       'Saving...',
    deleting:     'Deleting...',
    badges: {
      '🏆 Expert':        'Expert',
      '🥇 Avancé':        'Advanced',
      '🥈 Intermédiaire': 'Intermediate',
      '🥉 Débutant+':     'Beginner+',
      '🌱 Débutant':      'Beginner',
    }
  }
};

/* ── CEFR colors ─────────────────────────────────────────────────── */
const CEFR_COLORS = {
  A1: { bg: '#E8F9F9', text: '#2E9898', border: '#80DCDC' },
  A2: { bg: '#EBF4FB', text: '#3A7BAD', border: '#6BACD4' },
  B1: { bg: '#F0EDFF', text: '#6B52C8', border: '#9580D4' },
  B2: { bg: '#FEF3EC', text: '#C06A40', border: '#E8926A' },
  C1: { bg: '#FEF0EE', text: '#A84A42', border: '#D46A60' },
  C2: { bg: '#FFFBEA', text: '#A87C20', border: '#F0C85A' },
};

const BADGE_META = {
  '🏆 Expert':        { color: '#F0C85A', bg: '#FFFBEA', border: '#F0C85A' },
  '🥇 Avancé':        { color: '#E8926A', bg: '#FEF3EC', border: '#E8926A' },
  '🥈 Intermédiaire': { color: '#9580D4', bg: '#F0EDFF', border: '#9580D4' },
  '🥉 Débutant+':     { color: '#3A7BAD', bg: '#EBF4FB', border: '#6BACD4' },
  '🌱 Débutant':      { color: '#2E9898', bg: '#E8F9F9', border: '#80DCDC' },
};

const CEFR_ORDER = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

function CefrBadge({ level }) {
  if (!level) return <span style={{ fontSize: 11, color: '#9BB0C2', fontWeight: 700 }}>—</span>;
  const c = CEFR_COLORS[level] || CEFR_COLORS.B1;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800,
      background: c.bg, color: c.text, border: `1.5px solid ${c.border}`,
    }}>{level}</span>
  );
}

function XpBar({ xp }) {
  const tiers = [0, 200, 800, 2000, 5000, 10000];
  let idx = 0;
  for (let j = 0; j < tiers.length; j++) { if (xp >= tiers[j]) idx = j; }
  const next  = tiers[idx + 1] ?? tiers[tiers.length - 1];
  const prev  = tiers[idx] ?? 0;
  const pct   = next === prev ? 100 : Math.min(100, Math.round(((xp - prev) / (next - prev)) * 100));
  const colors = ['#9BB0C2', '#80DCDC', '#9580D4', '#E8926A', '#E8476A', '#F0C85A'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 90 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: colors[idx] }}>
        <Zap size={10} style={{ display: 'inline', marginRight: 2 }} />{xp.toLocaleString()} XP
      </div>
      <div style={{ height: 4, background: '#E8E4DF', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: colors[idx], borderRadius: 99, transition: 'width .4s' }} />
      </div>
      <div style={{ fontSize: 10, color: '#9BB0C2' }}>
        {pct}% → {next === tiers[tiers.length - 1] && xp >= next ? 'Max' : `${next.toLocaleString()} XP`}
      </div>
    </div>
  );
}

function BadgePill({ badge, lang }) {
  const m = BADGE_META[badge] || BADGE_META['🌱 Débutant'];
  const t = T[lang] || T.fr;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800,
      background: m.bg, color: m.color, border: `1.5px solid ${m.border}`,
    }}>{badge.split(' ')[0]} {t.badges[badge] || badge.split(' ')[1]}</span>
  );
}

function RankMedal({ rank }) {
  if (rank === 1) return <span style={{ fontSize: 20 }}>🥇</span>;
  if (rank === 2) return <span style={{ fontSize: 20 }}>🥈</span>;
  if (rank === 3) return <span style={{ fontSize: 20 }}>🥉</span>;
  return <span style={{ fontSize: 12, fontWeight: 800, color: '#9BB0C2', minWidth: 24, textAlign: 'center' }}>#{rank}</span>;
}

/* ── Toast ─────────────────────────────────────────────────────── */
function Toast({ msg, type, onClose }) {
  if (!msg) return null;
  return (
    <div className={`fixed top-6 right-6 z-[999] flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-xl border text-sm font-medium ${
      type === 'ok' ? 'bg-success/10 text-success border-success/20' : 'bg-destructive/10 text-destructive border-destructive/20'
    }`}>
      {type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      {msg}
      <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

/* ── User detail drawer ─────────────────────────────────────────── */
function UserDrawer({ user, onClose, onSaved, lang }) {
  const t = T[lang] || T.fr;
  const isNew = !user?.id;
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    email:    user?.email    || '',
    password: '',
    cefrLevel: user?.cefrLevel || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      if (isNew) {
        await createUser(form);
      } else {
        const payload = { fullName: form.fullName };
        if (form.cefrLevel) payload.cefrLevel = form.cefrLevel;
        if (form.password)  payload.password  = form.password;
        await updateUser(user.id, payload);
      }
      onSaved();
    } catch (e) {
      setErr(e?.response?.data?.message || (lang === 'fr' ? 'Erreur lors de l\'enregistrement.' : 'Error during saving.'));
    }
    setSaving(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="sneat-card w-full max-w-lg animate-fade-up">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading font-bold text-lg text-foreground">
              {isNew ? t.newTitle : t.editTitle}
            </h2>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* User stats panel (edit mode only) */}
          {!isNew && (
            <div style={{ background: '#F9FAFB', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9BB0C2', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                {lang === 'fr' ? 'Avancement de l\'utilisateur' : 'User Progress'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '1px solid #EEF0F3' }}>
                  <p style={{ fontSize: 10, color: '#9BB0C2', fontWeight: 600, marginBottom: 4 }}>{t.colCefr}</p>
                  <CefrBadge level={user.cefrLevel} />
                  {user.cefrCompleted && <span style={{ fontSize: 10, color: '#2E9898', fontWeight: 700, marginLeft: 6 }}>✓ {lang === 'fr' ? 'Complété' : 'Completed'}</span>}
                </div>
                <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '1px solid #EEF0F3' }}>
                  <p style={{ fontSize: 10, color: '#9BB0C2', fontWeight: 600, marginBottom: 4 }}>{t.colBadge}</p>
                  <BadgePill badge={user.badge || '🌱 Débutant'} lang={lang} />
                </div>
                <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '1px solid #EEF0F3' }}>
                  <p style={{ fontSize: 10, color: '#9BB0C2', fontWeight: 600, marginBottom: 4 }}>{lang === 'fr' ? 'XP total' : 'Total XP'}</p>
                  <XpBar xp={user.totalXp || 0} />
                </div>
                <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '1px solid #EEF0F3' }}>
                  <p style={{ fontSize: 10, color: '#9BB0C2', fontWeight: 600, marginBottom: 6 }}>{t.colActivity}</p>
                  <div style={{ fontSize: 12, fontWeight: 700, color: (user.currentStreak || 0) >= 3 ? '#E8926A' : '#5F7183', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Flame size={12} /> {t.streak(user.currentStreak || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: '#9BB0C2', marginTop: 4 }}>
                    {lang === 'fr' ? 'Record' : 'Best'} : {user.longestStreak || 0}j · {user.cefrTestCount || 0} tests · {user.exerciseCount || 0} ex.
                  </div>
                </div>
              </div>
            </div>
          )}

          {err && (
            <div className="flex items-center gap-2 bg-destructive/10 text-destructive p-3 rounded-lg text-sm mb-4 border border-destructive/20">
              <AlertCircle className="w-4 h-4 shrink-0" /> {err}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t.fullName}</label>
              <input className="sneat-input" value={form.fullName} onChange={set('fullName')} required placeholder="John Doe" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">{t.email}</label>
              <input className="sneat-input" type="email" value={form.email} onChange={set('email')} required disabled={!isNew} placeholder="john@example.com" />
              {!isNew && <p className="text-xs text-muted-foreground mt-1">{t.emailLocked}</p>}
            </div>
            {!isNew && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t.manualCefr}</label>
                <select className="sneat-input" value={form.cefrLevel} onChange={set('cefrLevel')}>
                  <option value="">{t.auto}</option>
                  {['A1','A2','B1','B2','C1','C2'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {isNew ? t.password : t.newPassword}
              </label>
              <input className="sneat-input" type="password" value={form.password} onChange={set('password')} required={isNew} placeholder="••••••••" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 border border-border text-foreground py-2.5 rounded-lg font-semibold hover:bg-muted transition-colors">
                {t.cancel}
              </button>
              <button type="submit" disabled={saving} className="flex-1 gradient-primary text-primary-foreground py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isNew ? t.create : t.save}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

/* ── Delete confirm ─────────────────────────────────────────────── */
function DeleteConfirm({ user, onClose, onDeleted, lang }) {
  const t = T[lang] || T.fr;
  const [deleting, setDeleting] = useState(false);
  const [err, setErr]           = useState('');

  const handleDelete = async () => {
    setDeleting(true); setErr('');
    try { await deleteUser(user.id); onDeleted(); }
    catch (e) { setErr(e?.response?.data?.message || (lang === 'fr' ? 'Erreur lors de la suppression.' : 'Error during deletion.')); setDeleting(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="sneat-card w-full max-w-sm animate-fade-up text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-6 h-6 text-destructive" />
          </div>
          <h3 className="font-heading font-bold text-lg text-foreground mb-2">{t.confirmDel}</h3>
          <p className="text-sm text-muted-foreground mb-1">{t.confirmMsg}</p>
          <p className="font-semibold text-foreground mb-5">{user.fullName || user.email}</p>
          {err && <p className="text-xs text-destructive mb-3">{err}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 border border-border text-foreground py-2.5 rounded-lg font-semibold hover:bg-muted transition-colors">{t.cancel}</button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 bg-destructive text-destructive-foreground py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-destructive/90 disabled:opacity-50">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {t.delete}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Summary cards ──────────────────────────────────────────────── */
function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="sneat-card flex items-center gap-4 py-4 px-5">
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {React.cloneElement(icon, { size: 20, color })}
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 900, color: '#1C2B3A', lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#5F7183', marginTop: 2 }}>{label}</p>
        {sub && <p style={{ fontSize: 10, color: '#9BB0C2', marginTop: 1 }}>{sub}</p>}
      </div>
    </div>
  );
}

/* ── Podium (top 3) ─────────────────────────────────────────────── */
function Podium({ users }) {
  const top3 = users.slice(0, 3);
  if (top3.length === 0) return null;

  // Visual order: 2nd | 1st | 3rd
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);
  const heights = top3.length > 1 ? ['60px', '90px', '45px'] : ['90px'];
  const orderHeights = top3.length > 1 ? [heights[1], heights[0], heights[2]] : heights;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
      {order.map((u, i) => {
        const realRank = top3.indexOf(u) + 1;
        const podiumColors = ['#F0C85A', '#B0BEC5', '#CD9A5A'];
        const podiumColor  = podiumColors[realRank - 1] || '#9BB0C2';
        return (
          <div key={u.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            {/* Avatar */}
            <div style={{ position: 'relative' }}>
              <div style={{
                width: realRank === 1 ? 60 : 48, height: realRank === 1 ? 60 : 48,
                borderRadius: '50%', background: `linear-gradient(135deg, ${podiumColor}CC, ${podiumColor})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 900, fontSize: realRank === 1 ? 22 : 17,
                border: `3px solid ${podiumColor}`,
                boxShadow: `0 4px 16px ${podiumColor}44`,
              }}>
                {(u.fullName || u.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div style={{ position: 'absolute', bottom: -6, right: -4, fontSize: 18 }}>
                {realRank === 1 ? '🥇' : realRank === 2 ? '🥈' : '🥉'}
              </div>
            </div>
            {/* Name */}
            <div style={{ textAlign: 'center', maxWidth: 90 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#1C2B3A', lineHeight: 1.2 }}>
                {(u.fullName || u.email || '—').split(' ')[0]}
              </p>
              <CefrBadge level={u.cefrLevel} />
            </div>
            {/* XP */}
            <div style={{ fontSize: 11, fontWeight: 800, color: podiumColor }}>
              {(u.totalXp || 0).toLocaleString()} XP
            </div>
            {/* Podium block */}
            <div style={{
              width: realRank === 1 ? 100 : 80,
              height: orderHeights[i],
              background: `linear-gradient(180deg, ${podiumColor}44, ${podiumColor}22)`,
              border: `2px solid ${podiumColor}66`,
              borderRadius: '10px 10px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 20, color: podiumColor,
            }}>
              {realRank}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Ranking row ────────────────────────────────────────────────── */
function RankingRow({ user, rank, onEdit, lang }) {
  const isTop3 = rank <= 3;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', borderRadius: 12,
      background: isTop3 ? '#FFFBF5' : '#FAFAFA',
      border: isTop3 ? '1.5px solid #F0C85A44' : '1.5px solid #EEF0F3',
      marginBottom: 8, transition: 'box-shadow .2s',
    }}>
      {/* Rank */}
      <div style={{ width: 32, textAlign: 'center', flexShrink: 0 }}>
        <RankMedal rank={rank} />
      </div>

      {/* Avatar */}
      <div style={{
        width: 38, height: 38, borderRadius: '50%',
        background: 'linear-gradient(135deg, #9580D4, #80DCDC)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 900, fontSize: 15, flexShrink: 0,
      }}>
        {(user.fullName || user.email || 'U').charAt(0).toUpperCase()}
      </div>

      {/* Name + email */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: '#1C2B3A', marginBottom: 2 }}>
          {user.fullName || '—'}
        </p>
        <p style={{ fontSize: 11, color: '#9BB0C2', marginBottom: 2 }}>{user.email}</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <CefrBadge level={user.cefrLevel} />
          <BadgePill badge={user.badge || '🌱 Débutant'} lang={lang} />
        </div>
      </div>

      {/* XP */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <XpBar xp={user.totalXp || 0} />
      </div>

      {/* Streak */}
      <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 56 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: (user.currentStreak || 0) >= 3 ? '#E8926A' : '#9BB0C2', display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center' }}>
          <Flame size={13} /> {user.currentStreak || 0}j
        </div>
        <div style={{ fontSize: 10, color: '#C8D4E0' }}>{user.exerciseCount || 0} ex.</div>
      </div>

      {/* Edit */}
      <button onClick={() => onEdit(user)}
        style={{ width: 32, height: 32, borderRadius: 8, background: '#F0EDFF', color: '#6B52C8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none', cursor: 'pointer' }}>
        <Pencil size={14} />
      </button>
    </div>
  );
}

/* ── Sort helpers ────────────────────────────────────────────────── */
const SORT_OPTIONS = (lang) => {
  const isFr = lang === 'fr';
  return [
    { value: 'xp',     label: isFr ? 'XP (haut → bas)' : 'XP (high → low)' },
    { value: 'streak', label: isFr ? 'Série (haut → bas)' : 'Streak (high → low)' },
    { value: 'tests',  label: isFr ? 'Tests CEFR' : 'CEFR Tests' },
    { value: 'cefr',   label: isFr ? 'Niveau CEFR' : 'CEFR Level' },
    { value: 'recent', label: isFr ? 'Inscription (récent)' : 'Registration (newest)' },
  ];
};

function sortUsers(users, sortBy) {
  const arr = [...users];
  if (sortBy === 'xp')     return arr.sort((a, b) => (b.totalXp || 0) - (a.totalXp || 0));
  if (sortBy === 'streak') return arr.sort((a, b) => (b.currentStreak || 0) - (a.currentStreak || 0));
  if (sortBy === 'tests')  return arr.sort((a, b) => (b.cefrTestCount || 0) - (a.cefrTestCount || 0));
  if (sortBy === 'cefr')   return arr.sort((a, b) => (CEFR_ORDER[b.cefrLevel] || 0) - (CEFR_ORDER[a.cefrLevel] || 0));
  if (sortBy === 'recent') return arr.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return arr;
}

/* ── Main page ──────────────────────────────────────────────────── */
const PAGE_SIZE = 12;

export default function AdminUsers() {
  const { lang } = useLanguage();
  const t = T[lang] || T.fr;
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);
  const [modal, setModal]       = useState(null);
  const [delTarget, setDelTarget] = useState(null);
  const [toast, setToast]       = useState({ msg: '', type: '' });
  const [cefrFilter, setCefrFilter] = useState('all');
  const [sortBy, setSortBy]     = useState('xp');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'ranking'

  const showToast = (msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: '' }), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await getAllUsers();
      setUsers(res.data || []);
    } catch { setUsers([]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Filter then sort
  const filtered = sortUsers(
    users.filter((u) => {
      const q = search.toLowerCase();
      const matchQ = !q || (u.fullName || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
      const matchC = cefrFilter === 'all' || u.cefrLevel === cefrFilter || (cefrFilter === 'none' && !u.cefrLevel);
      return matchQ && matchC;
    }),
    sortBy
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged      = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Summary stats
  const cefrDone    = users.filter(u => u.cefrCompleted).length;
  const avgXp       = users.length ? Math.round(users.reduce((s, u) => s + (u.totalXp || 0), 0) / users.length) : 0;
  const activeStreak = users.filter(u => (u.currentStreak || 0) >= 3).length;
  const topUser     = sortUsers(users, 'xp')[0];

  const handleSaved   = () => { setModal(null); showToast(t.saveSuccess, 'ok'); load(); };
  const handleDeleted = () => { setDelTarget(null); showToast(t.deleteSuccess, 'ok'); load(); };

  return (
    <AdminLayout title={t.pageTitle}>
      <Toast msg={toast.msg} type={toast.type} onClose={() => setToast({ msg: '', type: '' })} />
      {modal === 'create' && <UserDrawer user={null} onClose={() => setModal(null)} onSaved={handleSaved} lang={lang} />}
      {modal && modal !== 'create' && <UserDrawer user={modal} onClose={() => setModal(null)} onSaved={handleSaved} lang={lang} />}
      {delTarget && <DeleteConfirm user={delTarget} onClose={() => setDelTarget(null)} onDeleted={handleDeleted} lang={lang} />}

      {/* ── Summary cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 20 }}>
        <StatCard icon={<Users />} label={t.totalUsers} value={users.length} color="#80DCDC" />
        <StatCard icon={<TrendingUp />} label={t.cefrTests} value={cefrDone}
          sub={t.cefrSub(users.length ? Math.round((cefrDone / users.length) * 100) : 0)} color="#9580D4" />
        <StatCard icon={<Zap />} label={t.avgXp} value={avgXp.toLocaleString()} color="#F0C85A" />
        <StatCard icon={<Flame />} label={t.activeStreak} value={activeStreak} color="#E8926A" />
        {topUser && (
          <StatCard icon={<Trophy />} label={t.leaderXp} value={topUser.fullName?.split(' ')[0] || topUser.email?.split('@')[0] || '—'}
            sub={`${(topUser.totalXp || 0).toLocaleString()} XP · ${t.badges[topUser.badge] || topUser.badge || '—'}`} color="#F0C85A" />
        )}
      </div>

      <div className="sneat-card">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex-1 relative min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input className="sneat-input pl-9" placeholder={t.search}
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>

          {/* CEFR filter */}
          <select className="sneat-input !w-auto" value={cefrFilter} onChange={(e) => { setCefrFilter(e.target.value); setPage(1); }}>
            <option value="all">{t.allLevels}</option>
            <option value="none">{t.noLevel}</option>
            {['A1','A2','B1','B2','C1','C2'].map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          {/* Sort by */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
            <select className="sneat-input !w-auto text-xs" value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }}>
              {SORT_OPTIONS(lang).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* View mode toggle */}
          <div style={{ display: 'flex', background: '#F1F4F9', borderRadius: 8, padding: 3, gap: 2 }}>
            <button
              onClick={() => setViewMode('table')}
              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                background: viewMode === 'table' ? '#fff' : 'transparent',
                color: viewMode === 'table' ? '#6B52C8' : '#9BB0C2',
                boxShadow: viewMode === 'table' ? '0 1px 4px #0002' : 'none' }}>
              <LayoutList size={13} style={{ display: 'inline', marginRight: 4 }} />{t.table}
            </button>
            <button
              onClick={() => setViewMode('ranking')}
              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                background: viewMode === 'ranking' ? '#fff' : 'transparent',
                color: viewMode === 'ranking' ? '#F0C85A' : '#9BB0C2',
                boxShadow: viewMode === 'ranking' ? '0 1px 4px #0002' : 'none' }}>
              <Trophy size={13} style={{ display: 'inline', marginRight: 4 }} />{t.ranking}
            </button>
          </div>

          <span className="sneat-badge-primary whitespace-nowrap">{t.results(filtered.length)}</span>
          <button onClick={() => setModal('create')}
            className="gradient-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 hover:opacity-90 ml-auto">
            <Plus className="w-4 h-4" /> {t.newUser}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> {t.loading}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm">
              {search ? t.noUsers : t.noUsersSub}
            </p>
          </div>
        ) : viewMode === 'ranking' ? (
          /* ── RANKING VIEW ── */
          <div>
            {/* Badge distribution */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {Object.keys(BADGE_META).map(badge => {
                const count = users.filter(u => u.badge === badge).length;
                const m = BADGE_META[badge];
                return (
                  <div key={badge} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 10,
                    background: m.bg, border: `1.5px solid ${m.border}`,
                    fontSize: 12, fontWeight: 800, color: m.color,
                  }}>
                    {badge.split(' ')[0]} {t.badges[badge] || badge.split(' ')[1]}
                    <span style={{ background: m.color + '22', borderRadius: 99, padding: '1px 7px', fontSize: 11 }}>{count}</span>
                  </div>
                );
              })}
            </div>

            {/* Podium — always top 3 by XP */}
            <Podium users={sortUsers(users, 'xp')} />

            {/* Ranked list */}
            <div>
              {paged.map((u, i) => (
                <RankingRow
                  key={u.id}
                  user={u}
                  rank={(page - 1) * PAGE_SIZE + i + 1}
                  onEdit={setModal}
                  lang={lang}
                />
              ))}
            </div>
          </div>
        ) : (
          /* ── TABLE VIEW ── */
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-y border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-semibold">{t.colRank}</th>
                  <th className="text-left py-3 px-4 font-semibold">{t.colUser}</th>
                  <th className="text-left py-3 px-4 font-semibold">{t.colCefr}</th>
                  <th className="text-left py-3 px-4 font-semibold">{t.colXp}</th>
                  <th className="text-left py-3 px-4 font-semibold">{t.colActivity}</th>
                  <th className="text-left py-3 px-4 font-semibold">{t.colBadge}</th>
                  <th className="text-left py-3 px-4 font-semibold">{t.colJoined}</th>
                  <th className="text-right py-3 px-4 font-semibold">{t.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paged.map((u, i) => {
                  const globalRank = (page - 1) * PAGE_SIZE + i + 1;
                  return (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <RankMedal rank={globalRank} />
                      </td>

                      {/* Avatar + nom */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-xs shrink-0">
                            {(u.fullName || u.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate max-w-[130px]">{u.fullName || '—'}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[130px]">{u.email}</p>
                          </div>
                          {!u.enabled && (
                            <span style={{ fontSize: 10, fontWeight: 700, background: '#FEF0EE', color: '#A83228', padding: '1px 6px', borderRadius: 99, border: '1px solid #F5C6C2' }}>
                              {t.disabled}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* CEFR */}
                      <td className="py-3 px-4">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <CefrBadge level={u.cefrLevel} />
                          {u.cefrTestCount > 0 && (
                            <span style={{ fontSize: 10, color: '#9BB0C2', fontWeight: 600 }}>
                              {u.cefrTestCount} test{u.cefrTestCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* XP bar */}
                      <td className="py-3 px-4"><XpBar xp={u.totalXp || 0} /></td>

                      {/* Activité */}
                      <td className="py-3 px-4">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700,
                            color: (u.currentStreak || 0) >= 3 ? '#E8926A' : '#9BB0C2' }}>
                            <Flame size={11} />{t.streak(u.currentStreak || 0)}
                            {(u.longestStreak || 0) > 0 && (
                              <span style={{ fontWeight: 500, color: '#9BB0C2' }}>/ {t.maxStreak(u.longestStreak)}</span>
                            )}
                          </span>
                          <span style={{ fontSize: 10, color: '#9BB0C2', fontWeight: 600 }}>
                            <BookOpen size={9} style={{ display: 'inline', marginRight: 3 }} />
                            {t.exercises(u.exerciseCount || 0)}
                          </span>
                        </div>
                      </td>

                      {/* Badge */}
                      <td className="py-3 px-4"><BadgePill badge={u.badge || '🌱 Débutant'} lang={lang} /></td>

                      {/* Date */}
                      <td className="py-3 px-4 text-muted-foreground text-xs">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB') : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => setModal(u)}
                            className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors" title={t.edit}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDelTarget(u)}
                            className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/20 transition-colors" title={t.delete}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">{t.page(page, totalPages, filtered.length)}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => Math.abs(p - page) <= 2).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${
                    p === page ? 'gradient-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-muted'
                  }`}>{p}</button>
              ))}
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
