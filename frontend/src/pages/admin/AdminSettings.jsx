import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { getPracticeHealthAdmin } from '../../api/practice';
import { getJvmMetrics, getAdminConfig } from '../../api/admin';
import { useLanguage } from '../../context/LanguageContext';
import { Link } from 'react-router-dom';
import {
  Mail, Server, Shield, RefreshCw, CheckCircle2, XCircle,
  Settings, ExternalLink, Cpu, Activity,
  Layers, AlertTriangle, PlayCircle,
} from 'lucide-react';

const T = {
  fr: {
    pageTitle:   'Monitoring Système',
    subtitle:    'Surveillance en temps réel des services et de la JVM',
    allOk:       'Tous les services opérationnels',
    alert:       'Service(s) hors ligne',
    refresh:     'Actualiser',
    services:    'État des services',
    operational: '● OPÉRATIONNEL',
    alertBadge:  '● ALERTE',
    spring:      'Spring Boot API',
    whisper:     'Whisper STT (vocal)',
    ollama:      'Ollama — ',
    globalStatus:'Statut global',
    online:      'En ligne',
    offline:     'Hors ligne',
    startCmds:   'Commandes de démarrage :',
    jvmTitle:    'JVM Spring Boot — Mémoire Heap',
    heapUsed:    'Heap utilisé',
    heapFree:    'Heap libre',
    heapTotal:   'Heap total',
    heapMax:     'Heap max',
    heapUsage:   'Utilisation heap',
    threadsLive: 'Threads actifs',
    threadsPeak: 'Threads pic',
    gcRuns:      'GC exécutions',
    gcTime:      'Temps GC',
    uptime:      'Uptime',
    cpus:        'CPUs dispo.',
    javaVer:     'Java version',
    os:          'OS',
    modelLoaded: 'Modèle Whisper',
    loaded:      'Chargé',
    notLoaded:   'Non chargé',
    platform:    'Configuration plateforme',
    modelCourse: 'Modèle IA (cours)',
    modelChat:   'Modèle IA (chat)',
    stt:         'Moteur STT',
    auth:        'Authentification',
    db:          'Base de données',
    quickConf:   'Configuration rapide',
    emailConf:   'Configuration email',
    emailSub:    'SMTP, notifications, mot de passe oublié',
    rolesConf:   'Accès & Rôles',
    rolesSub:    'Gérer les privilèges et la base d\'utilisateurs',
    coursesConf: 'Catalogue de Cours',
    coursesSub:  'Gérer le contenu pédagogique (vidéos, audio)',
  },
  en: {
    pageTitle:   'System Monitoring',
    subtitle:    'Real-time monitoring of services and JVM',
    allOk:       'All services operational',
    alert:       'Service(s) offline',
    refresh:     'Refresh',
    services:    'Service Status',
    operational: '● OPERATIONAL',
    alertBadge:  '● ALERT',
    spring:      'Spring Boot API',
    whisper:     'Whisper STT (voice)',
    ollama:      'Ollama — ',
    globalStatus:'Global status',
    online:      'Online',
    offline:     'Offline',
    startCmds:   'Start commands:',
    jvmTitle:    'JVM Spring Boot — Heap Memory',
    heapUsed:    'Heap used',
    heapFree:    'Heap free',
    heapTotal:   'Heap total',
    heapMax:     'Heap max',
    heapUsage:   'Heap usage',
    threadsLive: 'Active threads',
    threadsPeak: 'Peak threads',
    gcRuns:      'GC runs',
    gcTime:      'GC time',
    uptime:      'Uptime',
    cpus:        'Available CPUs',
    javaVer:     'Java version',
    os:          'OS',
    modelLoaded: 'Whisper model',
    loaded:      'Loaded',
    notLoaded:   'Not loaded',
    platform:    'Platform Configuration',
    modelCourse: 'AI model (courses)',
    modelChat:   'AI model (chat)',
    stt:         'STT engine',
    auth:        'Authentication',
    db:          'Database',
    quickConf:   'Quick Configuration',
    emailConf:   'Email configuration',
    emailSub:    'SMTP, notifications, password reset',
    rolesConf:   'Role management',
    rolesSub:    'Admins, users, Keycloak sync',
    coursesConf: 'Course management',
    coursesSub:  'Add, edit, delete video courses',
  },
};

function Section({ icon: Icon, title, badge, children, accent = '#6366F1' }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <span style={{ background: accent + '18', borderRadius: 8, width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon style={{ width: 16, height: 16, color: accent }} />
          </span>
          {title}
        </h3>
        {badge}
      </div>
      {children}
    </div>
  );
}

function StatusRow({ label, status, loading, ping, onlineLabel, offlineLabel }) {
  const ok = status === 'UP' || status === 'OK' || status === 'loaded';
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <div className="flex items-center gap-2">
        {ping != null && !loading && (
          <span className="text-[10px] text-slate-400 font-mono">{ping}ms</span>
        )}
        {loading
          ? <div className="h-6 w-20 bg-slate-100 rounded animate-pulse" />
          : <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {ok ? onlineLabel : offlineLabel}
            </span>
        }
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500 font-medium">{label}</span>
      <span className={`text-sm font-bold text-slate-800 max-w-[55%] text-right ${mono ? 'font-mono text-xs' : ''}`}>{value ?? '—'}</span>
    </div>
  );
}

function MiniBar({ value, max, colorClass = 'bg-indigo-500', warnAt = 80 }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  const color = pct >= warnAt ? 'bg-rose-500' : colorClass;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold w-9 text-right ${pct >= warnAt ? 'text-rose-600' : 'text-slate-600'}`}>{pct}%</span>
    </div>
  );
}

function JvmStat({ label, value, unit }) {
  return (
    <div className="bg-slate-50 rounded-xl px-4 py-3 text-center">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="font-black text-lg text-slate-800 leading-tight">
        {value}<span className="text-[11px] font-semibold text-slate-400 ml-0.5">{unit}</span>
      </p>
    </div>
  );
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function AdminSettings() {
  const { lang, toggleLang } = useLanguage();
  const t = T[lang] || T.fr;

  const [health,     setHealth]     = useState(null);
  const [jvm,        setJvm]        = useState(null);
  const [config,     setConfig]     = useState(null);
  const [pings,      setPings]      = useState({});
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const t0Spring = Date.now();
      const [healthRes, jvmRes, cfgRes] = await Promise.all([
        getPracticeHealthAdmin().catch(() => ({ data: null })),
        getJvmMetrics().catch(() => ({ data: null })),
        getAdminConfig().catch(() => ({ data: null })),
      ]);

      setPings(p => ({ ...p, spring: Date.now() - t0Spring }));
      setHealth(healthRes?.data || null);
      setJvm(jvmRes?.data || null);
      setConfig(cfgRes?.data || null);
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const whisperOk = health?.whisper_python === 'UP';
  const ollamaOk  = health?.ollama === 'UP';
  const allOk     = whisperOk && ollamaOk;

  const ollamaModelName = config?.ollama_model || 'qwen2.5:3b';
  const chatModelName   = config?.ollama_model_chatbot || 'qwen2.5:3b';

  return (
    <AdminLayout title={t.pageTitle}>
      <div className="space-y-6 max-w-4xl">

        {/* Header Actions */}
        <div className="flex items-center justify-between bg-white/50 p-4 rounded-2xl border border-white shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {!loading && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                allOk ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {allOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {allOk ? t.allOk : t.alert}
              </div>
            )}
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <p className="text-xs text-slate-500 font-medium">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleLang}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
              <img src={`https://flagcdn.com/16x12/${lang === 'fr' ? 'fr' : 'gb'}.png`} width="16" height="12" alt={lang.toUpperCase()} style={{ borderRadius: 2 }} />
              {lang.toUpperCase()}
            </button>
            <button 
              onClick={() => {
                console.log("Refreshing...");
                load(true);
              }} 
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-600/20">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {t.refresh}
            </button>
          </div>
        </div>


        {/* Services */}
        <Section icon={Server} title={t.services} accent="#6366F1"
          badge={!loading && (
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${allOk ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {allOk ? t.operational : t.alertBadge}
            </span>
          )}>
          <StatusRow label={t.spring}      status="UP"                               ping={pings.spring}  loading={loading} onlineLabel={t.online} offlineLabel={t.offline} />
          <StatusRow label={t.whisper}     status={health?.whisper_python ?? 'DOWN'} loading={loading}    onlineLabel={t.online} offlineLabel={t.offline} />
          <StatusRow label={`${t.ollama}${ollamaModelName}`} status={health?.ollama ?? 'DOWN'} loading={loading} onlineLabel={t.online} offlineLabel={t.offline} />
          <StatusRow label={t.globalStatus} status={health?.overall ?? (allOk ? 'UP' : 'DOWN')} loading={loading} onlineLabel={t.online} offlineLabel={t.offline} />

          {!loading && !allOk && (
            <div className="mt-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-[10px] font-bold text-amber-700 mb-1">{t.startCmds}</p>
              <code className="text-[10px] text-amber-800 font-mono block leading-5 whitespace-pre">
                {!whisperOk  && '> cd mon_projettalan_fastapi && python main.py\n'}
                {!ollamaOk && `> ollama run ${ollamaModelName}`}
              </code>
            </div>
          )}
        </Section>

        {/* JVM */}
        <Section icon={Layers} title={t.jvmTitle} accent="#10B981">
          {loading || !jvm ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <JvmStat label={t.heapUsed}  value={jvm.heap_used_mb}  unit="Mo" />
                <JvmStat label={t.heapFree}  value={jvm.heap_free_mb}  unit="Mo" />
                <JvmStat label={t.heapTotal} value={jvm.heap_total_mb} unit="Mo" />
                <JvmStat label={t.heapMax}   value={jvm.heap_max_mb}   unit="Mo" />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span className="text-slate-600">{t.heapUsage}</span>
                  <span className={jvm.heap_percent >= 80 ? 'text-rose-600' : 'text-emerald-600'}>
                    {jvm.heap_used_mb} Mo / {jvm.heap_max_mb} Mo
                  </span>
                </div>
                <MiniBar value={jvm.heap_used_mb} max={jvm.heap_max_mb} colorClass="bg-emerald-500" warnAt={80} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
                <JvmStat label={t.threadsLive} value={jvm.threads_live}   unit="" />
                <JvmStat label={t.threadsPeak} value={jvm.threads_peak}   unit="" />
                <JvmStat label={t.gcRuns}      value={jvm.gc_collections} unit="" />
                <JvmStat label={t.gcTime}      value={jvm.gc_time_ms}     unit="ms" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label={t.uptime}  value={formatUptime(jvm.uptime_seconds)} />
                <InfoRow label={t.cpus}    value={jvm.available_cpus} />
                <InfoRow label={t.javaVer} value={jvm.java_version} mono />
                <InfoRow label={t.os}      value={`${jvm.os_name} (${jvm.os_arch})`} mono />
              </div>
            </>
          )}
        </Section>

        {/* Platform config — dynamic from /api/admin/config */}
        <Section icon={Cpu} title={t.platform} accent="#8B5CF6">
          {loading ? (
            <div className="space-y-2">{[...Array(5)].map((_,i) => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}</div>
          ) : (
            <>
              <InfoRow label={t.modelCourse} value={config?.ollama_model || ollamaModelName} />
              <InfoRow label={t.modelChat}   value={config?.ollama_model_chatbot || chatModelName} />
              <InfoRow label={t.stt}         value="faster-whisper (CUDA)" />
              <InfoRow label={t.auth}        value={`Keycloak OAuth2${config?.keycloak_realm ? ` — ${config.keycloak_realm}` : ''}`} />
              <InfoRow label={t.db}          value={config?.database || 'PostgreSQL'} />
              <InfoRow label={t.javaVer}     value={config?.java_version} mono />
            </>
          )}
        </Section>

        {/* Quick config */}
        <Section icon={Settings} title={t.quickConf} accent="#F59E0B">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link to="/admin/mail-settings"
              className="flex flex-col p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 hover:shadow-md hover:-translate-y-0.5 transition-all group">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Mail className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-sm font-bold text-amber-900 mb-1">{t.emailConf}</p>
              <p className="text-[10px] text-amber-700/80 leading-snug">{t.emailSub}</p>
            </Link>

            <Link to="/admin/users"
              className="flex flex-col p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 hover:shadow-md hover:-translate-y-0.5 transition-all group">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Shield className="w-4 h-4 text-indigo-600" />
              </div>
              <p className="text-sm font-bold text-indigo-900 mb-1">{t.rolesConf}</p>
              <p className="text-[10px] text-indigo-700/80 leading-snug">{t.rolesSub}</p>
            </Link>

            <Link to="/admin/courses"
              className="flex flex-col p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 hover:shadow-md hover:-translate-y-0.5 transition-all group">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <PlayCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-sm font-bold text-emerald-900 mb-1">{t.coursesConf}</p>
              <p className="text-[10px] text-emerald-700/80 leading-snug">{t.coursesSub}</p>
            </Link>
          </div>
        </Section>

      </div>
    </AdminLayout>
  );
}
