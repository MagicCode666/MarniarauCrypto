import { SIGNAL_CONFIG, HELP_TEXTS } from "../lib/constants";

export function formatEurInline(value) {
  if (value === undefined || value === null) return "—";
  const d = value < 1 ? 4 : 2;
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: d }).format(value);
}

export function SignalBadge({ signal, showInfo, onOpenHelp }) {
  if (!signal) return null;
  const cfg = SIGNAL_CONFIG[signal] ?? SIGNAL_CONFIG.neutral;
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full border"
        style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
      >
        {cfg.label}
      </span>
      {showInfo && onOpenHelp && (
        <InfoIcon topic="signal" onOpen={onOpenHelp} />
      )}
    </span>
  );
}

export function RSIBar({ rsi, showInfo, onOpenHelp }) {
  if (rsi === undefined || rsi === null) return null;
  const pct = Math.min(Math.max(rsi, 0), 100);
  const color = rsi < 30 ? "#4ade80" : rsi > 70 ? "#ef4444" : "#fb923c";
  return (
    <div className="mt-1">
      <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
        <span className="flex items-center gap-0.5">
          RSI
          {showInfo && onOpenHelp && <InfoIcon topic="rsi" onOpen={onOpenHelp} />}
        </span>
        <span style={{ color }} className="font-mono">{rsi.toFixed(1)}</span>
      </div>
      <div className="bg-slate-900 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-700 mt-0.5">
        <span>Survendu</span><span>Suracheté</span>
      </div>
    </div>
  );
}

export function InfoIcon({ topic, onOpen }) {
  return (
    <button
      onClick={() => onOpen(topic)}
      className="text-slate-600 hover:text-slate-300 transition-colors text-xs leading-none cursor-pointer bg-transparent border-0 p-0 ml-0.5"
      title="En savoir plus"
    >
      ⓘ
    </button>
  );
}

export function HelpModal({ topic, onClose }) {
  const info = HELP_TEXTS[topic];
  if (!info) return null;
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 border border-slate-600 rounded-xl p-6 max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-slate-100 font-bold text-base m-0">{info.title}</h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors bg-transparent border-0 cursor-pointer text-lg leading-none pl-4"
          >✕</button>
        </div>
        <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-line m-0">{info.body}</p>
      </div>
    </div>
  );
}
