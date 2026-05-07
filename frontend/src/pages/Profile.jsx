import { useState } from 'react';
import Layout from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { updateProfile, updatePassword } from '../api/profile';
import { mergeBadges } from '../utils/gamification';
import { Save, Shield, Loader2, CheckCircle2, AlertCircle, User, Award, Lock } from 'lucide-react';

const UI_PROFILE = {
  fr: {
    title: 'Profil',
    tabs: { info: 'Informations', badges: 'Badges', security: 'Sécurité' },
    infoSection: 'Informations personnelles',
    firstName: 'Prénom', lastName: 'Nom', email: 'Email',
    save: 'Enregistrer',
    badgeEarned: '✓ Obtenu', badgeLocked: 'Verrouillé',
    secTitle: 'Changer le mot de passe',
    currentPw: 'Mot de passe actuel', newPw: 'Nouveau mot de passe', confirm: 'Confirmer',
    update: 'Mettre à jour',
    successProfile: 'Profil mis à jour !', successPw: 'Mot de passe mis à jour !',
    errPwMatch: 'Les mots de passe ne correspondent pas.',
  },
  en: {
    title: 'Profile',
    tabs: { info: 'Information', badges: 'Badges', security: 'Security' },
    infoSection: 'Personal information',
    firstName: 'First name', lastName: 'Last name', email: 'Email',
    save: 'Save',
    badgeEarned: '✓ Earned', badgeLocked: 'Locked',
    secTitle: 'Change password',
    currentPw: 'Current password', newPw: 'New password', confirm: 'Confirm',
    update: 'Update',
    successProfile: 'Profile updated!', successPw: 'Password updated!',
    errPwMatch: 'Passwords do not match.',
  }
};

const C = {
  bg: '#FEF8F3', white: '#FFFFFF', teal: '#80DCDC', tealDark: '#4DBFBF',
  tealSoft: '#E8F9F9', coral: '#E8926A', coralSoft: '#FEF3EC',
  violet: '#9580D4', violetSoft: '#F3F0FE', blue: '#6BACD4', blueSoft: '#EBF4FB',
  gold: '#F0C85A', dark: '#1C2B3A', mid: '#5F7183', muted: '#9BB0C2', border: '#EEE8E0',
};


function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontWeight: 700, fontSize: '0.78rem', color: C.mid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>{label}</label>
      {children}
    </div>
  );
}

function SpeakInput({ style, ...props }) {
  return (
    <input
      style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: `1.5px solid ${C.border}`, background: C.white, fontFamily: 'inherit', fontSize: '0.88rem', color: C.dark, fontWeight: 600, outline: 'none', boxSizing: 'border-box', ...style }}
      {...props}
    />
  );
}


function Toast({ msg, type }) {
  if (!msg) return null;
  const ok = type === 'ok';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 12, background: ok ? C.tealSoft : C.coralSoft, border: `1.5px solid ${ok ? C.teal : C.coral}20`, marginBottom: 20 }}>
      {ok ? <CheckCircle2 style={{ width: 15, height: 15, color: C.teal, flexShrink: 0 }} /> : <AlertCircle style={{ width: 15, height: 15, color: C.coral, flexShrink: 0 }} />}
      <span style={{ fontWeight: 600, fontSize: '0.84rem', color: ok ? C.tealDark : C.coral }}>{msg}</span>
    </div>
  );
}

export default function Profile() {
  const { user, setUser } = useAuth();
  const { lang } = useLanguage();
  const ui = UI_PROFILE[lang] || UI_PROFILE.fr;
  const [tab, setTab]       = useState('info');
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [toast, setToast]   = useState({ msg: '', type: '' });

  const badges = mergeBadges(user?.badges || [], lang);

  const fullName = user?.fullName || '';
  const [firstName, ...rest] = fullName.split(' ');

  const [form, setForm] = useState({
    firstName: firstName || '',
    lastName:  rest.join(' ') || '',
    email:     user?.email || '',
  });
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });

  const showToast = (msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: '' }), 3500);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fullName = `${form.firstName} ${form.lastName}`.trim();
      const res = await updateProfile({ fullName });
      setUser(prev => ({ ...prev, fullName: res.data?.fullName || fullName }));
      showToast(ui.successProfile, 'ok');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Erreur lors de la mise à jour.', 'err');
    }
    setSaving(false);
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPw !== pwForm.confirm) { showToast(ui.errPwMatch, 'err'); return; }
    setSavingPw(true);
    try {
      await updatePassword({ current: pwForm.current, newPw: pwForm.newPw });
      setPwForm({ current: '', newPw: '', confirm: '' });
      showToast(ui.successPw, 'ok');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Mot de passe actuel incorrect.', 'err');
    }
    setSavingPw(false);
  };

  const initials = (form.firstName || 'U').charAt(0).toUpperCase();
  const TABS = [
    { key: 'info',     label: ui.tabs.info,     icon: User   },
    { key: 'badges',   label: ui.tabs.badges,   icon: Award  },
    { key: 'security', label: ui.tabs.security, icon: Shield },
  ];

  return (
    <Layout title={ui.title}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '8px 0 60px' }}>

        {/* ── Avatar hero ── */}
        <div style={{ background: `linear-gradient(150deg,#FEF0E0,#FDF6EF 60%,${C.tealSoft})`, borderRadius: 24, border: `2px solid ${C.border}`, borderBottom: `5px solid ${C.border}`, padding: '2rem', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', border: `24px solid #E8476A`, opacity: 0.07, top: -50, right: -30, pointerEvents: 'none' }} />
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: `linear-gradient(135deg,${C.teal},${C.tealDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.8rem', color: 'white', boxShadow: `0 8px 24px ${C.teal}44`, flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <h2 style={{ fontWeight: 900, fontSize: '1.3rem', color: C.dark, margin: '0 0 4px', letterSpacing: '-0.03em' }}>{form.firstName} {form.lastName}</h2>
            <p style={{ fontWeight: 600, fontSize: '0.82rem', color: C.mid, margin: 0 }}>{form.email}</p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: C.white, borderRadius: 14, border: `1.5px solid ${C.border}`, padding: 5 }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 12px', borderRadius: 10, fontWeight: 700, fontSize: '0.82rem', border: 'none', cursor: 'pointer', transition: 'all .15s',
                background: tab === key ? C.teal : 'transparent',
                color: tab === key ? 'white' : C.mid,
                boxShadow: tab === key ? `0 4px 12px ${C.teal}40` : 'none',
              }}>
              <Icon style={{ width: 14, height: 14 }} />
              {label}
            </button>
          ))}
        </div>

        <Toast msg={toast.msg} type={toast.type} />

        {/* ── Informations ── */}
        {tab === 'info' && (
          <div style={{ background: C.white, borderRadius: 20, border: `1.5px solid ${C.border}`, borderBottom: `4px solid ${C.border}`, padding: '2rem', boxShadow: '0 4px 16px rgba(28,43,58,0.05)' }}>
            <h3 style={{ fontWeight: 900, fontSize: '0.7rem', color: C.teal, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 20px' }}>{ui.infoSection}</h3>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label={ui.firstName}>
                  <SpeakInput value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
                </Field>
                <Field label={ui.lastName}>
                  <SpeakInput value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
                </Field>
              </div>
              <Field label={ui.email}>
                <SpeakInput type="email" value={form.email} disabled style={{ background: '#FAFAFA', color: C.muted, cursor: 'not-allowed' }} />
              </Field>
              <button type="submit" disabled={saving}
                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 28px', borderRadius: 12, fontWeight: 800, fontSize: '0.88rem', background: C.teal, color: 'white', border: 'none', borderBottom: `3px solid ${C.tealDark}`, cursor: 'pointer', boxShadow: `0 4px 14px ${C.teal}40`, opacity: saving ? 0.65 : 1 }}>
                {saving ? <Loader2 style={{ width: 15, height: 15, animation: 'spin .8s linear infinite' }} /> : <Save style={{ width: 15, height: 15 }} />}
                {ui.save}
              </button>
            </form>
          </div>
        )}

        {/* ── Badges ── */}
        {tab === 'badges' && (
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.72rem', color: C.mid, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>
              {badges.filter(b => b.earned).length} badge{badges.filter(b => b.earned).length > 1 ? 's' : ''} obtenu{badges.filter(b => b.earned).length > 1 ? 's' : ''}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 14 }}>
              {badges.map(b => (
                <div key={b.key} style={{ background: C.white, borderRadius: 18, border: `1.5px solid ${b.earned ? b.color + '35' : C.border}`, borderBottom: `4px solid ${b.earned ? b.color + '60' : C.border}`, padding: '1.3rem', display: 'flex', alignItems: 'center', gap: 14, opacity: b.earned ? 1 : 0.45, transition: 'transform .15s' }}
                  onMouseEnter={e => { if (b.earned) e.currentTarget.style.transform = 'translateY(-3px)'; }}
                  onMouseLeave={e => e.currentTarget.style.transform = ''}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: b.earned ? (b.color + '18') : '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                    {b.earned ? b.icon : <Lock style={{ width: 18, height: 18, color: C.muted }} />}
                  </div>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: '0.85rem', color: b.earned ? C.dark : C.muted, margin: '0 0 2px' }}>{b.name}</p>
                    <p style={{ fontWeight: 600, fontSize: '0.68rem', color: b.earned ? b.color : C.muted, margin: 0 }}>{b.earned ? ui.badgeEarned : ui.badgeLocked}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Sécurité ── */}
        {tab === 'security' && (
          <div style={{ background: C.white, borderRadius: 20, border: `1.5px solid ${C.border}`, borderBottom: `4px solid ${C.border}`, padding: '2rem', maxWidth: 460, boxShadow: '0 4px 16px rgba(28,43,58,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: C.violetSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield style={{ width: 17, height: 17, color: C.violet }} />
              </div>
              <h3 style={{ fontWeight: 900, fontSize: '0.95rem', color: C.dark, margin: 0 }}>{ui.secTitle}</h3>
            </div>
            <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }} onSubmit={handlePassword}>
              {/* Hidden username field for password managers accessibility */}
              <input type="text" name="username" autoComplete="username" value={user?.email || ''} readOnly style={{ display: 'none' }} />
              <Field label={ui.currentPw}>
                <SpeakInput type="password" value={pwForm.current} required autoComplete="current-password" onChange={e => setPwForm({ ...pwForm, current: e.target.value })} />
              </Field>
              <Field label={ui.newPw}>
                <SpeakInput type="password" value={pwForm.newPw} required autoComplete="new-password" onChange={e => setPwForm({ ...pwForm, newPw: e.target.value })} />
              </Field>
              <Field label={ui.confirm}>
                <SpeakInput type="password" value={pwForm.confirm} required autoComplete="new-password" onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} />
              </Field>
              <button type="submit" disabled={savingPw}
                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 28px', borderRadius: 12, fontWeight: 800, fontSize: '0.88rem', background: C.violet, color: 'white', border: 'none', borderBottom: `3px solid #7D66C0`, cursor: 'pointer', boxShadow: `0 4px 14px ${C.violet}40`, opacity: savingPw ? 0.65 : 1 }}>
                {savingPw ? <Loader2 style={{ width: 15, height: 15, animation: 'spin .8s linear infinite' }} /> : <Shield style={{ width: 15, height: 15 }} />}
                {ui.update}
              </button>
            </form>
          </div>
        )}

        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </Layout>
  );
}
