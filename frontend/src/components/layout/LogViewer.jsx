import { useEffect, useState, useRef } from 'react';
import { RefreshCw, ClipboardCopy, Terminal } from 'lucide-react';

/**
 * LogViewer – placeholder component (FastAPI logs removed).
 * Currently displays a static message indicating no logs are available.
 */
export default function LogViewer({ pollInterval = 5000, lines = 50 }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const bottomRef = useRef(null);

  // Simulate fetching logs – now just clears logs after a short delay.
  const fetchLogs = async () => {
    try {
      // No backend call – placeholder.
      setLogs([]);
      setError(null);
    } catch (e) {
      setError('Erreur de chargement des logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, pollInterval);
    return () => clearInterval(interval);
  }, [pollInterval]);

  // Auto‑scroll to bottom when logs change.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(logs.join('\n')).catch(() => {});
  };

  const levelColor = (line) => {
    if (/ERROR|ECHEC|FAIL/i.test(line)) return 'text-rose-400';
    if (/WARN|WARNING/i.test(line)) return 'text-amber-400';
    if (/INFO/i.test(line)) return 'text-sky-300';
    return 'text-slate-300';
  };

  const filtered = filter
    ? logs.filter((l) => l.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  return (
    <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700 bg-slate-800">
        <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="text-xs font-bold text-slate-200 mr-auto">
          Logs (FastAPI désactivés)
          {!loading && <span className="ml-2 text-slate-400 font-normal">({filtered.length} lignes)</span>}
        </span>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrer…"
          className="text-xs bg-slate-700 text-slate-200 placeholder-slate-500 border border-slate-600 rounded px-2 py-0.5 w-28 focus:outline-none focus:border-indigo-400"
        />
        <button onClick={fetchLogs} title="Rafraîchir" className="text-slate-400 hover:text-white transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <button onClick={copyToClipboard} title="Copier" className="text-slate-400 hover:text-white transition-colors">
          <ClipboardCopy className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Log area */}
      <div className="overflow-y-auto max-h-80 p-3 font-mono text-xs space-y-0.5">
        {loading && <p className="text-slate-500 italic">Chargement…</p>}
        {error && <p className="text-rose-400 font-sans">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="text-slate-500 italic">Aucun log disponible.</p>
        )}
        {filtered.map((line, i) => (
          <div key={i} className={`whitespace-pre-wrap break-all leading-5 ${levelColor(line)}`}>{line}</div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
