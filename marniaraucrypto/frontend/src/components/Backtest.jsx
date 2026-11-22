import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { formatEur } from "../lib/utils";

const API = "http://localhost:8000";

const STRATEGIES = [
  { id: "rsi",          label: "RSI (achat < 30 / vente > 70)" },
  { id: "golden_cross", label: "Golden Cross (EMA 20 / EMA 50)" },
];

function getDefaultDates() {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 180);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

function MetricCard({ label, value, positive, highlight }) {
  const color =
    positive === undefined ? "text-slate-100"
    : positive            ? "text-green-400"
    :                        "text-red-400";
  return (
    <div
      className={`rounded-xl p-4 border ${
        highlight ? "bg-slate-700 border-slate-500" : "bg-slate-800 border-slate-700"
      }`}
    >
      <div className="text-slate-500 text-xs mb-1">{label}</div>
      <div className={`font-bold text-lg tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs shadow-lg">
      <div className="text-slate-400 mb-1.5 font-medium">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex justify-between gap-4" style={{ color: p.color }}>
          <span>{p.name === "strategy_value" ? "Stratégie" : "Hold simple"}</span>
          <span className="tabular-nums font-semibold">{formatEur(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

const inputCls =
  "w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors";

export default function Backtest({ coins }) {
  const defaults = getDefaultDates();
  const [form, setForm] = useState({
    coin: "bitcoin",
    strategy: "rsi",
    start_date: defaults.start,
    end_date: defaults.end,
    initial_capital_eur: 1000,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API}/api/backtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          initial_capital_eur: parseFloat(form.initial_capital_eur),
        }),
      });
      const json = await res.json();
      if (json.status === "error") setError(json.message);
      else setResult(json);
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  const tickInterval = result
    ? Math.max(1, Math.floor(result.chart_data.length / 10))
    : 1;

  return (
    <div className="space-y-5">
      {/* Disclaimer */}
      <div className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 text-xs">
        MarniarauCrypto est un outil éducatif. Les signaux et simulations ne constituent pas des conseils financiers.
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4"
      >
        <h2 className="text-slate-200 font-semibold text-sm">Configuration du backtest</h2>

        <div className="grid grid-cols-2 gap-4">
          {/* Coin */}
          <div>
            <label className="text-slate-500 text-xs block mb-1">Cryptomonnaie</label>
            <select
              value={form.coin}
              onChange={(e) => set("coin", e.target.value)}
              className={inputCls}
            >
              {coins.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({c.symbol})
                </option>
              ))}
            </select>
          </div>

          {/* Strategy */}
          <div>
            <label className="text-slate-500 text-xs block mb-1">Stratégie</label>
            <select
              value={form.strategy}
              onChange={(e) => set("strategy", e.target.value)}
              className={inputCls}
            >
              {STRATEGIES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Start date */}
          <div>
            <label className="text-slate-500 text-xs block mb-1">Date de début</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => set("start_date", e.target.value)}
              className={inputCls}
            />
          </div>

          {/* End date */}
          <div>
            <label className="text-slate-500 text-xs block mb-1">
              Date de fin
              <span className="ml-2 text-slate-600 font-normal">
                Max 365 jours, date de fin dans les 365 derniers jours
              </span>
            </label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => set("end_date", e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Capital */}
          <div>
            <label className="text-slate-500 text-xs block mb-1">Capital initial (€)</label>
            <input
              type="number"
              min={10}
              step={10}
              value={form.initial_capital_eur}
              onChange={(e) => set("initial_capital_eur", e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-lg transition-colors text-sm cursor-pointer"
        >
          {loading ? "Calcul en cours…" : "Lancer le backtest"}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="p-4 bg-slate-800 border border-red-800 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {/* Metric cards */}
          <div className="grid grid-cols-4 gap-3">
            <MetricCard
              label="Rendement total"
              value={`${result.return_pct >= 0 ? "+" : ""}${result.return_pct.toFixed(2)} %`}
              positive={result.return_pct >= 0}
              highlight
            />
            <MetricCard
              label="Valeur finale"
              value={formatEur(result.final_value_eur)}
            />
            <MetricCard
              label="Win rate"
              value={result.win_rate_pct > 0 ? `${result.win_rate_pct.toFixed(1)} %` : "—"}
            />
            <MetricCard
              label="Drawdown max"
              value={`${result.max_drawdown_pct.toFixed(2)} %`}
              positive={result.max_drawdown_pct < 15}
            />
          </div>

          {/* No signals */}
          {result.trades.length === 0 && (
            <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 text-sm text-center">
              Aucun signal détecté sur cette période avec cette stratégie.
              <br />
              <span className="text-slate-500">
                Essaie une période plus longue ou une autre crypto.
              </span>
            </div>
          )}

          {/* Chart */}
          {result.chart_data.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="text-slate-300 text-sm font-semibold mb-4">
                Évolution du portefeuille
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={result.chart_data}
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="gStrategy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gHold" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    interval={tickInterval}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    tickFormatter={(v) => `${v.toLocaleString("fr-FR")} €`}
                    width={85}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: "#94a3b8", paddingTop: 8 }}
                    formatter={(key) =>
                      key === "strategy_value" ? "Stratégie" : "Hold simple"
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="strategy_value"
                    stroke="#3b82f6"
                    fill="url(#gStrategy)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="hold_value"
                    stroke="#94a3b8"
                    fill="url(#gHold)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Trades table */}
          {result.trades.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <h3 className="text-slate-300 text-sm font-semibold px-5 py-3 border-b border-slate-700">
                Trades exécutés ({result.trades.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-xs border-b border-slate-700">
                      <th className="text-left px-5 py-2 font-medium">Date</th>
                      <th className="text-left px-5 py-2 font-medium">Type</th>
                      <th className="text-right px-5 py-2 font-medium">Prix €</th>
                      <th className="text-right px-5 py-2 font-medium">Valeur portefeuille €</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((t, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                      >
                        <td className="px-5 py-2.5 text-slate-300 tabular-nums">{t.date}</td>
                        <td className="px-5 py-2.5">
                          <span
                            className={`font-semibold ${
                              t.type === "buy" ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {t.type === "buy" ? "▲ Achat" : "▼ Vente"}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-right text-slate-300 tabular-nums">
                          {formatEur(t.price_eur)}
                        </td>
                        <td className="px-5 py-2.5 text-right text-slate-300 tabular-nums">
                          {formatEur(t.portfolio_value_eur)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
