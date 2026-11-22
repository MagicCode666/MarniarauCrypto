import React, { useState, useEffect, useCallback } from "react";
import { COINS } from "../lib/constants";
import { formatEur } from "../lib/utils";

const API = "http://localhost:8000";
const COIN_MAP = Object.fromEntries(COINS.map((c) => [c.id, c]));

function formatQty(qty) {
  if (qty === undefined || qty === null) return "—";
  if (qty >= 1000) return qty.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  if (qty >= 1) return qty.toLocaleString("fr-FR", { maximumFractionDigits: 4 });
  return qty.toLocaleString("fr-FR", { maximumFractionDigits: 8 });
}

function pnlClass(v) {
  if (v > 0.001) return "text-green-400";
  if (v < -0.001) return "text-red-400";
  return "text-slate-400";
}

function SummaryCard({ label, value, sub, color, highlight }) {
  return (
    <div className={`rounded-xl p-4 border ${highlight ? "bg-slate-700 border-slate-500" : "bg-slate-800 border-slate-700"}`}>
      <div className="text-slate-500 text-xs mb-1">{label}</div>
      <div className={`font-bold text-lg tabular-nums ${color ?? "text-slate-100"}`}>{value ?? "—"}</div>
      {sub && <div className={`text-xs mt-0.5 font-semibold ${color ?? "text-slate-400"}`}>{sub}</div>}
    </div>
  );
}

export default function Portfolio({ prices }) {
  const [portfolio, setPortfolio] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buyForm, setBuyForm] = useState({
    coin: "bitcoin", amount: "", note: "", loading: false, error: null, success: null,
  });
  const [sellTarget, setSellTarget] = useState(null);
  const [sellForm, setSellForm] = useState({ quantity: "", note: "", loading: false, error: null });

  const loadAll = useCallback(async () => {
    try {
      const [pRes, tRes] = await Promise.all([
        fetch(`${API}/api/portfolio`).then((r) => r.json()),
        fetch(`${API}/api/transactions`).then((r) => r.json()),
      ]);
      if (pRes.status === "ok") setPortfolio(pRes);
      if (tRes.status === "ok") setTransactions(tRes.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleBuy = async () => {
    const amount = parseFloat(buyForm.amount);
    if (!amount || amount <= 0) {
      setBuyForm((f) => ({ ...f, error: "Entrez un montant valide" }));
      return;
    }
    setBuyForm((f) => ({ ...f, loading: true, error: null, success: null }));
    const res = await fetch(`${API}/api/trade/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coin: buyForm.coin, eur_amount: amount, note: buyForm.note }),
    }).then((r) => r.json());
    if (res.status === "ok") {
      setBuyForm((f) => ({ ...f, amount: "", note: "", loading: false, success: res.message }));
      loadAll();
    } else {
      setBuyForm((f) => ({ ...f, loading: false, error: res.message }));
    }
  };

  const handleSell = async () => {
    const qty = parseFloat(sellForm.quantity);
    if (!qty || qty <= 0) {
      setSellForm((f) => ({ ...f, error: "Entrez une quantité valide" }));
      return;
    }
    setSellForm((f) => ({ ...f, loading: true, error: null }));
    const res = await fetch(`${API}/api/trade/sell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coin: sellTarget, quantity: qty, note: sellForm.note }),
    }).then((r) => r.json());
    if (res.status === "ok") {
      setSellTarget(null);
      setSellForm({ quantity: "", note: "", loading: false, error: null });
      loadAll();
    } else {
      setSellForm((f) => ({ ...f, loading: false, error: res.message }));
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Réinitialiser votre portefeuille ? Toutes les positions et l'historique seront effacés. Cette action est irréversible.")) return;
    await fetch(`${API}/api/portfolio/reset`, { method: "POST" });
    setSellTarget(null);
    setSellForm({ quantity: "", note: "", loading: false, error: null });
    loadAll();
  };

  const openSell = (coinId) => {
    setSellTarget(coinId);
    setSellForm({ quantity: "", note: "", loading: false, error: null });
  };

  const currentBuyPrice = prices?.[buyForm.coin]?.eur;
  const estQty =
    buyForm.amount && currentBuyPrice
      ? (parseFloat(buyForm.amount) * (1 - 0.001)) / currentBuyPrice
      : null;

  if (loading) {
    return <div className="py-20 text-center text-slate-500 text-sm">Chargement du portefeuille…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Cartes résumé */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Liquidités" value={formatEur(portfolio?.cash_eur)} />
        <SummaryCard label="Investi" value={formatEur(portfolio?.total_invested_eur)} />
        <SummaryCard label="Valeur totale" value={formatEur(portfolio?.total_value_eur)} highlight />
        <SummaryCard
          label="P&L total"
          value={
            portfolio
              ? `${portfolio.total_pnl_eur >= 0 ? "+" : ""}${formatEur(portfolio.total_pnl_eur)}`
              : "—"
          }
          sub={
            portfolio?.total_invested_eur > 0
              ? `${portfolio.total_pnl_pct >= 0 ? "+" : ""}${portfolio.total_pnl_pct.toFixed(2)} %`
              : null
          }
          color={portfolio ? pnlClass(portfolio.total_pnl_eur) : "text-slate-400"}
        />
      </div>

      {/* Positions ouvertes */}
      <section>
        <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wide mb-3">
          Positions ouvertes
        </h2>
        {portfolio?.holdings?.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-800/50">
                <tr>
                  {["Crypto", "Quantité", "Prix achat moy.", "Prix actuel", "Valeur", "P&L €", "P&L %", ""].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-xs uppercase tracking-wide text-slate-500 text-right first:text-left whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolio.holdings.map((h) => {
                  const coin = COIN_MAP[h.coin];
                  const isSelling = sellTarget === h.coin;
                  return (
                    <React.Fragment key={h.coin}>
                      <tr className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                        <td className="px-3 py-3 font-semibold text-slate-100 whitespace-nowrap">
                          <span className="inline-flex items-center gap-2">
                            {coin && (
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: coin.color }}
                              />
                            )}
                            {coin?.label ?? h.coin}
                            {coin && (
                              <span className="text-slate-500 font-normal text-xs">{coin.symbol}</span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-200">
                          {formatQty(h.quantity)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-400">
                          {formatEur(h.avg_buy_price_eur)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-200">
                          {formatEur(h.current_price_eur)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-200">
                          {formatEur(h.current_value_eur)}
                        </td>
                        <td className={`px-3 py-3 text-right font-mono tabular-nums ${pnlClass(h.pnl_eur)}`}>
                          {h.pnl_eur >= 0 ? "+" : ""}{formatEur(h.pnl_eur)}
                        </td>
                        <td className={`px-3 py-3 text-right font-mono tabular-nums ${pnlClass(h.pnl_pct)}`}>
                          {h.pnl_pct >= 0 ? "+" : ""}{h.pnl_pct.toFixed(2)} %
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            onClick={() => (isSelling ? setSellTarget(null) : openSell(h.coin))}
                            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                              isSelling
                                ? "bg-slate-700 text-slate-300 border-slate-600"
                                : "bg-transparent text-red-400 border-red-800 hover:bg-red-900/20"
                            }`}
                          >
                            {isSelling ? "Annuler" : "Vendre"}
                          </button>
                        </td>
                      </tr>

                      {isSelling && (
                        <tr className="border-t border-slate-800 bg-slate-900/60">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="flex flex-wrap items-end gap-3">
                              <div>
                                <label className="block text-xs text-slate-500 mb-1">
                                  Quantité à vendre
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="number"
                                    value={sellForm.quantity}
                                    onChange={(e) =>
                                      setSellForm((f) => ({ ...f, quantity: e.target.value, error: null }))
                                    }
                                    placeholder="0.00000000"
                                    step="any"
                                    min="0"
                                    className="bg-slate-800 border border-slate-600 text-slate-100 rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:border-slate-400"
                                  />
                                  <button
                                    onClick={() =>
                                      setSellForm((f) => ({ ...f, quantity: String(h.quantity) }))
                                    }
                                    className="text-xs px-2.5 py-1.5 bg-slate-700 text-slate-300 rounded-lg border border-slate-600 hover:bg-slate-600 cursor-pointer whitespace-nowrap"
                                  >
                                    Tout vendre
                                  </button>
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500 mb-1">
                                  Note (optionnel)
                                </label>
                                <input
                                  type="text"
                                  value={sellForm.note}
                                  onChange={(e) =>
                                    setSellForm((f) => ({ ...f, note: e.target.value }))
                                  }
                                  placeholder="Ex : prise de bénéfices"
                                  className="bg-slate-800 border border-slate-600 text-slate-100 rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:border-slate-400"
                                />
                              </div>
                              {sellForm.quantity && prices?.[h.coin]?.eur && (
                                <div className="text-xs text-slate-400 self-end pb-2">
                                  ≈{" "}
                                  <span className="text-slate-200 font-mono">
                                    {formatEur(
                                      parseFloat(sellForm.quantity) * prices[h.coin].eur * (1 - 0.001)
                                    )}
                                  </span>{" "}
                                  reçus
                                </div>
                              )}
                              <button
                                onClick={handleSell}
                                disabled={sellForm.loading}
                                className="self-end px-4 py-1.5 bg-red-800 hover:bg-red-700 text-white text-sm rounded-lg border border-red-700 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {sellForm.loading ? "…" : "Confirmer la vente"}
                              </button>
                              {sellForm.error && (
                                <span className="self-end pb-2 text-red-400 text-xs">
                                  {sellForm.error}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-500 text-sm">
            Aucune position ouverte. Utilisez le formulaire ci-dessous pour acheter votre première
            cryptomonnaie.
          </div>
        )}
      </section>

      {/* Formulaire d'achat */}
      <section className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wide mb-4">Acheter</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Cryptomonnaie</label>
            <select
              value={buyForm.coin}
              onChange={(e) =>
                setBuyForm((f) => ({ ...f, coin: e.target.value, success: null, error: null }))
              }
              className="bg-slate-900 border border-slate-600 text-slate-100 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-slate-400 cursor-pointer"
            >
              {COINS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({c.symbol})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Montant (€)</label>
            <input
              type="number"
              value={buyForm.amount}
              onChange={(e) =>
                setBuyForm((f) => ({ ...f, amount: e.target.value, success: null, error: null }))
              }
              placeholder="100"
              min="0"
              step="any"
              className="bg-slate-900 border border-slate-600 text-slate-100 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:border-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Note (optionnel)</label>
            <input
              type="text"
              value={buyForm.note}
              onChange={(e) => setBuyForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Ex : DCA mensuel"
              className="bg-slate-900 border border-slate-600 text-slate-100 rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:border-slate-400"
            />
          </div>
          <button
            onClick={handleBuy}
            disabled={buyForm.loading}
            className="px-5 py-1.5 bg-green-800 hover:bg-green-700 text-white text-sm rounded-lg border border-green-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            {buyForm.loading ? "…" : "Acheter"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
          {currentBuyPrice && (
            <span>
              Prix actuel :{" "}
              <span className="text-slate-300 font-mono">{formatEur(currentBuyPrice)}</span>
            </span>
          )}
          {estQty !== null && buyForm.amount && (
            <span>
              Quantité estimée :{" "}
              <span className="text-slate-300 font-mono">
                {formatQty(estQty)} {COIN_MAP[buyForm.coin]?.symbol}
              </span>
            </span>
          )}
          <span>Frais : 0,1 %</span>
          {portfolio && (
            <span>
              Solde disponible :{" "}
              <span
                className={`font-mono ${
                  portfolio.cash_eur < (parseFloat(buyForm.amount) || 0)
                    ? "text-red-400"
                    : "text-slate-300"
                }`}
              >
                {formatEur(portfolio.cash_eur)}
              </span>
            </span>
          )}
        </div>

        {buyForm.error && <p className="mt-2 text-red-400 text-sm">{buyForm.error}</p>}
        {buyForm.success && <p className="mt-2 text-green-400 text-sm">{buyForm.success}</p>}
      </section>

      {/* Journal des transactions */}
      <section>
        <h2 className="text-slate-300 font-semibold text-sm uppercase tracking-wide mb-3">
          Journal des transactions
        </h2>
        {transactions.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-800/50">
                <tr>
                  {["Date", "Type", "Crypto", "Quantité", "Prix", "Total", "Note"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-xs uppercase tracking-wide text-slate-500 text-right first:text-left whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const coin = COIN_MAP[tx.coin];
                  const isBuy = tx.type === "buy";
                  return (
                    <tr
                      key={tx.id}
                      className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                        {new Date(tx.timestamp * 1000).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-semibold whitespace-nowrap ${
                          isBuy ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {isBuy ? "Achat" : "Vente"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-200 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 justify-end">
                          {coin && (
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ background: coin.color }}
                            />
                          )}
                          {coin?.label ?? tx.coin}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-200">
                        {formatQty(tx.quantity)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-400">
                        {formatEur(tx.price_at_trade_eur)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono tabular-nums ${
                          isBuy ? "text-red-300" : "text-green-300"
                        }`}
                      >
                        {isBuy ? "-" : "+"}
                        {formatEur(tx.total_eur)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-500 italic text-xs">
                        {tx.note || ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center text-slate-500 text-sm">
            Aucune transaction enregistrée.
          </div>
        )}
      </section>

      {/* Disclaimer + réinitialisation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
        <p className="flex-1 px-4 py-3 bg-slate-800 border-l-4 border-slate-500 rounded text-slate-400 text-sm">
          MarniarauCrypto est un outil éducatif. Les transactions simulées ne constituent pas des
          conseils financiers et n'engagent aucun capital réel.
        </p>
        <button
          onClick={handleReset}
          className="shrink-0 px-4 py-2 text-sm text-red-400 border border-red-900 rounded-lg hover:bg-red-900/20 transition-colors cursor-pointer bg-transparent"
        >
          Réinitialiser le portefeuille
        </button>
      </div>
    </div>
  );
}
