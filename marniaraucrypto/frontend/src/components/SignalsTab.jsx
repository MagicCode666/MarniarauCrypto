import { useState } from "react";
import { SIGNAL_CONFIG, SIGNAL_SORT_ORDER } from "../lib/constants";
import { formatEur } from "../lib/utils";
import { SignalBadge, InfoIcon } from "./shared";

export default function SignalsTab({ coins, prices, analyses, onOpenHelp }) {
  const [sort, setSort] = useState({ key: "signal", dir: "desc" });

  const handleSort = (key) => {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc",
    }));
  };

  const getValue = (id, key) => {
    const p = prices?.[id];
    const a = analyses?.[id];
    switch (key) {
      case "price":    return p?.eur ?? -Infinity;
      case "change":   return p?.eur_24h_change ?? -Infinity;
      case "rsi":      return a?.rsi ?? -Infinity;
      case "macd":     return a?.macd ?? -Infinity;
      case "signal":   return SIGNAL_SORT_ORDER[a?.signal] ?? -1;
      default:         return 0;
    }
  };

  const sorted = [...coins].sort((a, b) => {
    const va = getValue(a.id, sort.key);
    const vb = getValue(b.id, sort.key);
    return sort.dir === "desc" ? vb - va : va - vb;
  });

  const SortHeader = ({ colKey, label, help, align = "right" }) => {
    const active = sort.key === colKey;
    return (
      <th
        className={`px-4 py-2.5 text-xs uppercase tracking-wide cursor-pointer select-none whitespace-nowrap text-${align} hover:text-slate-300 transition-colors ${active ? "text-slate-200" : "text-slate-500"}`}
        onClick={() => handleSort(colKey)}
      >
        {label}
        <span className="ml-1 text-slate-600">
          {active ? (sort.dir === "desc" ? "▼" : "▲") : "⇅"}
        </span>
        {help && <InfoIcon topic={help} onOpen={onOpenHelp} />}
      </th>
    );
  };

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full border-collapse">
          <thead className="bg-slate-800/50">
            <tr>
              <th className="px-4 py-2.5 text-xs uppercase tracking-wide text-slate-500 text-left">Crypto</th>
              <SortHeader colKey="price"  label="Prix €"       />
              <SortHeader colKey="change" label="Variation 24h"/>
              <SortHeader colKey="rsi"    label="RSI"    help="rsi"    />
              <SortHeader colKey="macd"   label="MACD"   help="macd"   />
              <SortHeader colKey="signal" label="Signal" help="signal" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ id, label, symbol, color }) => {
              const p = prices?.[id];
              const a = analyses?.[id];
              const change = p?.eur_24h_change;
              const positive = (change ?? 0) >= 0;
              const rsiColor = a?.rsi < 30 ? "#4ade80" : a?.rsi > 70 ? "#ef4444" : "#fb923c";
              return (
                <tr key={id} className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-100">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                      {label}
                      <span className="text-slate-500 font-normal text-xs">{symbol}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-slate-200 tabular-nums">
                    {formatEur(p?.eur)}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold text-sm tabular-nums ${positive ? "text-green-400" : "text-red-400"}`}>
                    {change !== undefined ? `${positive ? "+" : ""}${change.toFixed(2)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm tabular-nums" style={{ color: rsiColor }}>
                    {a?.rsi?.toFixed(1) ?? "—"}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono text-sm tabular-nums ${(a?.macd ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {a?.macd?.toFixed(2) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {a?.signal ? <SignalBadge signal={a.signal} /> : <span className="text-slate-600">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 px-4 py-3 bg-slate-800 border-l-4 border-slate-500 rounded text-slate-400 text-sm">
        MarniarauCrypto est un outil éducatif. Les signaux et simulations ne constituent pas des conseils financiers.
      </div>
    </div>
  );
}
