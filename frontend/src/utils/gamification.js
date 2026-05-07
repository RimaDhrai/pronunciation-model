/**
 * gamification.js — Système de niveaux XP + configuration des badges
 */

// ── Niveaux XP ──────────────────────────────────────────────────────────────
export const XP_LEVELS = [
  { level: 1, label: { fr: 'Débutant',       en: 'Beginner'      }, minXp: 0,    maxXp: 199,  color: '#94a3b8', icon: '🌱' },
  { level: 2, label: { fr: 'Apprenti',        en: 'Apprentice'    }, minXp: 200,  maxXp: 499,  color: '#60a5fa', icon: '📚' },
  { level: 3, label: { fr: 'Intermédiaire',   en: 'Intermediate'  }, minXp: 500,  maxXp: 999,  color: '#34d399', icon: '🎯' },
  { level: 4, label: { fr: 'Avancé',          en: 'Advanced'      }, minXp: 1000, maxXp: 1999, color: '#a78bfa', icon: '⚡' },
  { level: 5, label: { fr: 'Expert',          en: 'Expert'        }, minXp: 2000, maxXp: 3999, color: '#fb923c', icon: '🏆' },
  { level: 6, label: { fr: 'Maître',          en: 'Master'        }, minXp: 4000, maxXp: 9999, color: '#f43f5e', icon: '👑' },
];

export function getXpLevel(totalXp) {
  const xp = totalXp || 0;
  for (let i = XP_LEVELS.length - 1; i >= 0; i--) {
    if (xp >= XP_LEVELS[i].minXp) return XP_LEVELS[i];
  }
  return XP_LEVELS[0];
}

export function getXpProgress(totalXp) {
  const xp    = totalXp || 0;
  const lvl   = getXpLevel(xp);
  const range = lvl.maxXp - lvl.minXp;
  const done  = xp - lvl.minXp;
  return { pct: Math.min(100, Math.round((done / range) * 100)), current: done, max: range, lvl };
}

// ── Configuration des badges ─────────────────────────────────────────────────
export const BADGE_CONFIG = {
  FIRST_STEP:    { icon: '🎯', color: '#14b8a6', name: { fr: 'Premier Pas',       en: 'First Step'      }, desc: { fr: 'Première session complétée',     en: 'First session completed'     } },
  STREAK_3:      { icon: '🔥', color: '#f97316', name: { fr: '3 Jours de Suite',  en: '3-Day Streak'    }, desc: { fr: 'Pratique 3 jours consécutifs',   en: 'Practice 3 days in a row'    } },
  STREAK_7:      { icon: '⚡', color: '#eab308', name: { fr: 'Semaine Parfaite',  en: 'Perfect Week'    }, desc: { fr: '7 jours consécutifs de pratique', en: '7 days in a row'             } },
  STREAK_30:     { icon: '💎', color: '#6366f1', name: { fr: 'Mois de Maître',    en: 'Master Month'    }, desc: { fr: '30 jours consécutifs',            en: '30 consecutive days'          } },
  PERFECT_SCORE: { icon: '💯', color: '#ec4899', name: { fr: 'Score Parfait',     en: 'Perfect Score'   }, desc: { fr: 'Score de 100/100',                en: 'Score of 100/100'            } },
  EXCELLENCE:    { icon: '⭐', color: '#f59e0b', name: { fr: 'Excellence',        en: 'Excellence'      }, desc: { fr: 'Score ≥ 90/100',                  en: 'Score ≥ 90/100'              } },
  XP_100:        { icon: '🌟', color: '#10b981', name: { fr: '100 XP',            en: '100 XP'          }, desc: { fr: '100 points XP gagnés',            en: '100 XP earned'               } },
  XP_500:        { icon: '🚀', color: '#8b5cf6', name: { fr: '500 XP',            en: '500 XP'          }, desc: { fr: '500 points XP gagnés',            en: '500 XP earned'               } },
  XP_1000:       { icon: '🏆', color: '#f43f5e', name: { fr: '1000 XP',           en: '1000 XP'         }, desc: { fr: '1000 points XP gagnés',           en: '1000 XP earned'              } },
};

/** Fusionne les badges gagnés (du backend) avec la config complète */
export function mergeBadges(earnedBadges = [], lang = 'fr') {
  const earnedKeys = new Set((earnedBadges || []).map(b => b.badgeKey || b.badge_key || b.key));
  return Object.entries(BADGE_CONFIG).map(([key, cfg]) => ({
    key,
    icon:    cfg.icon,
    color:   cfg.color,
    name:    cfg.name[lang] || cfg.name.fr,
    desc:    cfg.desc[lang] || cfg.desc.fr,
    earned:  earnedKeys.has(key),
    earnedAt: (earnedBadges || []).find(b => (b.badgeKey || b.badge_key || b.key) === key)?.earnedAt || null,
  }));
}
