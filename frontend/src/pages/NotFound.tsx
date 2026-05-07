import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Mic, ArrowLeft, Home } from 'lucide-react';

const C = {
  bg: '#FEF8F3', white: '#FFFFFF', teal: '#80DCDC', tealDark: '#4DBFBF',
  tealSoft: '#E8F9F9', coral: '#E8926A', coralSoft: '#FEF3EC',
  violet: '#9580D4', violetSoft: '#F3F0FE', gold: '#F0C85A',
  pink: '#E8476A', dark: '#1C2B3A', mid: '#5F7183', muted: '#9BB0C2', border: '#EEE8E0',
};

const NotFound = () => {
  const location = useLocation();
  useEffect(() => {
    console.error('404 — route introuvable :', location.pathname);
  }, [location.pathname]);

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans','Nunito',system-ui,sans-serif", background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <nav style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: '0 32px', height: 64, display: 'flex', alignItems: 'center' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mic style={{ width: 15, height: 15, color: 'white' }} />
          </div>
          <span style={{ fontWeight: 900, fontSize: '0.95rem', color: C.dark }}>Speak<span style={{ color: C.teal }}>Coach</span></span>
        </Link>
      </nav>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', position: 'relative', overflow: 'hidden' }}>

        {/* Anneaux déco */}
        <div style={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', border: `4px solid ${C.pink}`, opacity: 0.7, top: '8%', left: '-36px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 65, height: 65, borderRadius: '50%', border: `3px solid ${C.pink}`, opacity: 0.45, top: '55%', left: '-14px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', border: `4px solid ${C.pink}`, opacity: 0.65, bottom: '5%', right: '-48px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 18, height: 18, border: `3px solid ${C.gold}`, transform: 'rotate(45deg)', opacity: 0.55, top: '20%', right: '22%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 11, height: 11, border: `2px solid ${C.gold}`, transform: 'rotate(45deg)', opacity: 0.35, top: '28%', right: '30%', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center', position: 'relative', zIndex: 1 }}>

          {/* Big 404 */}
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 32 }}>
            <p style={{ fontWeight: 900, fontSize: 'clamp(6rem,15vw,9rem)', color: C.teal, margin: 0, lineHeight: 1, letterSpacing: '-0.06em', opacity: 0.15, userSelect: 'none' }}>404</p>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: `linear-gradient(135deg,${C.teal},${C.tealDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 12px 32px ${C.teal}44`, animation: 'nf-float 3s ease-in-out infinite' }}>
                <Mic style={{ width: 34, height: 34, color: 'white' }} />
              </div>
            </div>
          </div>

          {/* Text */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: C.tealSoft, border: `1px solid ${C.teal}30`, borderRadius: 999, padding: '5px 16px', marginBottom: 20 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.coral, display: 'inline-block' }} />
            <span style={{ fontWeight: 800, fontSize: '0.65rem', color: C.tealDark, textTransform: 'uppercase', letterSpacing: '0.14em' }}>Page introuvable</span>
          </div>

          <h1 style={{ fontWeight: 900, fontSize: 'clamp(1.6rem,4vw,2.4rem)', color: C.dark, margin: '0 0 12px', letterSpacing: '-0.04em', lineHeight: 1.2 }}>
            On a perdu cette page !
          </h1>
          <p style={{ fontWeight: 500, fontSize: '0.92rem', color: C.mid, margin: '0 0 36px', lineHeight: 1.7 }}>
            La page <code style={{ background: C.border, padding: '2px 8px', borderRadius: 6, fontSize: '0.85rem', color: C.coral }}>{location.pathname}</code> n'existe pas.
          </p>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 999, fontWeight: 800, fontSize: '0.88rem', background: C.teal, color: 'white', textDecoration: 'none', boxShadow: `0 6px 20px ${C.teal}44`, borderBottom: `3px solid ${C.tealDark}` }}>
              <Home style={{ width: 15, height: 15 }} /> Accueil
            </Link>
            <button onClick={() => window.history.back()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 999, fontWeight: 700, fontSize: '0.88rem', background: C.white, color: C.mid, border: `1.5px solid ${C.border}`, cursor: 'pointer' }}>
              <ArrowLeft style={{ width: 15, height: 15 }} /> Retour
            </button>
          </div>

          {/* Phoneme déco */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 48, flexWrap: 'wrap' }}>
            {[['[a]', C.teal], ['[ɛ]', C.coral], ['[ʒ]', C.violet], ['[y]', C.gold]].map(([label, color]) => (
              <div key={label} style={{ background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '6px 13px', fontWeight: 900, fontSize: '0.8rem', color, boxShadow: '0 3px 10px rgba(28,43,58,0.07)' }}>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes nf-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`}</style>
    </div>
  );
};

export default NotFound;
