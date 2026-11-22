import { useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { SIGNAL_DESCRIPTIONS, CATEGORIES } from "../lib/constants";
import { formatEur, formatLargeEur, formatDate } from "../lib/utils";
import { SignalBadge, RSIBar } from "./shared";

function CategoryBadges({ categories }) {
  if (!categories?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {categories.map((name) => {
        const cat = CATEGORIES.find((c) => c.name === name);
        const color = cat?.color ?? "#94a3b8";
        return (
          <span key={name} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: color + "22", color }}>
            {name}
          </span>
        );
      })}
    </div>
  );
}

function CoinCard({ coin, priceData, history, analysis, selected, onClick, onOpenHelp }) {
  const price = priceData?.eur;
  const change = priceData?.eur_24h_change;
  const positive = (change ?? 0) >= 0;

  return (
    <div
      onClick={onClick}
      className={`bg-slate-800 rounded-xl p-4 flex flex-col gap-2 border cursor-pointer transition-all duration-150
        ${selected ? "border-slate-400 ring-1 ring-slate-400" : "border-slate-700 hover:border-slate-500"}`}
    >
      <div className="flex justify-between items-center">
        <span className="flex items-center gap-2 font-bold text-slate-100">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: coin.color }} />
          {coin.label}
        </span>
        <span className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">{coin.symbol}</span>
      </div>
      <CategoryBadges categories={coin.categories} />

      <div className="text-2xl font-bold text-slate-50 tabular-nums">{formatEur(price)}</div>

      <div className={`text-sm font-semibold ${positive ? "text-green-400" : "text-red-400"}`}>
        {change !== undefined ? `${positive ? "+" : ""}${change.toFixed(2)}%` : "—"}
        <span className="text-slate-500 font-normal text-xs ml-1">sur 24h</span>
      </div>

      {analysis?.signal && <SignalBadge signal={analysis.signal} showInfo onOpenHelp={onOpenHelp} />}

      <RSIBar rsi={analysis?.rsi} showInfo onOpenHelp={onOpenHelp} />

      <div className="h-14 mt-1">
        {history?.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <Line type="monotone" dataKey="price" stroke={positive ? "#4ade80" : "#f87171"} strokeWidth={1.5} dot={false} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "6px", fontSize: "0.7rem" }}
                labelFormatter={() => ""}
                formatter={(v) => [formatEur(v), ""]}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center text-slate-600 text-xs">Graphique en cours de chargement…</div>
        )}
      </div>
    </div>
  );
}

function DetailModal({ coin, priceData, history, analysis, onClose }) {
  const price = priceData?.eur ?? analysis?.price;
  const change = priceData?.eur_24h_change ?? analysis?.change_24h;
  const positive = (change ?? 0) >= 0;
  const signalDesc = SIGNAL_DESCRIPTIONS[analysis?.signal];

  const metrics = [
    { label: "Prix actuel",    value: formatEur(price) },
    { label: "Variation 24h", value: change !== undefined ? `${positive ? "+" : ""}${change.toFixed(2)}%` : "—", color: positive ? "#4ade80" : "#f87171" },
    { label: "Market Cap",    value: formatLargeEur(priceData?.eur_market_cap) },
    { label: "Volume 24h",    value: formatLargeEur(priceData?.eur_24h_vol) },
    { label: "RSI",           value: analysis?.rsi?.toFixed(1) ?? "—", color: analysis?.rsi < 30 ? "#4ade80" : analysis?.rsi > 70 ? "#ef4444" : "#fb923c" },
    { label: "MACD",          value: analysis?.macd?.toFixed(4) ?? "—", color: (analysis?.macd ?? 0) >= 0 ? "#4ade80" : "#f87171" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        className="bg-slate-800 border border-slate-600 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-[fadeIn_0.15s_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <span className="flex items-center gap-2 font-bold text-slate-100 text-lg">
            <span className="w-3 h-3 rounded-full" style={{ background: coin.color }} />
            {coin.label}
            <span className="text-slate-500 font-normal text-sm">{coin.symbol}</span>
          </span>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors bg-transparent border-0 cursor-pointer text-xl leading-none"
          >✕</button>
        </div>

        <CategoryBadges categories={coin.categories} />

        <div className="h-64 mt-4 mb-5">
          {history?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timestamp" tickFormatter={formatDate} tick={{ fill: "#475569", fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#475569", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => formatEur(v)} width={80} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", fontSize: "0.75rem" }}
                  labelFormatter={(ts) => formatDate(ts)}
                  formatter={(v) => [formatEur(v), "Prix"]}
                />
                <Line type="monotone" dataKey="price" stroke={positive ? "#4ade80" : "#f87171"} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-600 text-sm">Données en cours de chargement…</div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {metrics.map(({ label, value, color }) => (
            <div key={label} className="bg-slate-900 rounded-lg p-3">
              <div className="text-slate-500 text-xs mb-1">{label}</div>
              <div className="font-semibold text-sm tabular-nums" style={{ color: color ?? "#f1f5f9" }}>{value}</div>
            </div>
          ))}
        </div>

        {analysis?.signal && (
          <div className="flex items-start gap-3 bg-slate-900 rounded-lg p-3">
            <SignalBadge signal={analysis.signal} />
            <span className="text-slate-400 text-sm">{signalDesc}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({ coins, prices, histories, analyses, onOpenHelp, onRefresh, lastUpdated, histLoaded }) {
  const [selected, setSelected] = useState(null);

  const handleCardClick = (id) => setSelected((prev) => (prev === id ? null : id));
  const selectedCoin = coins.find((c) => c.id === selected);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="text-slate-500 text-xs">
          {lastUpdated
            ? `Dernière mise à jour : ${lastUpdated.toLocaleTimeString("fr-FR")}`
            : "Chargement en cours…"}
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm px-3 py-1.5 rounded-lg border border-slate-600 transition-colors cursor-pointer"
        >
          ↺ Actualiser
        </button>
      </div>

      {histLoaded > 0 && histLoaded < coins.length && (
        <p className="text-slate-600 text-xs mb-4">Graphiques : {histLoaded}/{coins.length} chargés…</p>
      )}

      {/* Grille */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {coins.map((coin) => (
          <CoinCard
            key={coin.id}
            coin={coin}
            priceData={prices?.[coin.id]}
            history={histories[coin.id]}
            analysis={analyses[coin.id]}
            selected={selected === coin.id}
            onClick={() => handleCardClick(coin.id)}
            onOpenHelp={onOpenHelp}
          />
        ))}
      </div>

      {/* Modale détail */}
      {selected && selectedCoin && (
        <DetailModal
          coin={selectedCoin}
          priceData={prices?.[selected]}
          history={histories[selected]}
          analysis={analyses[selected]}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
