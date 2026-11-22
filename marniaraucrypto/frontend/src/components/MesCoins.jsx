import { useState, useEffect, useRef } from "react";
import { CATEGORIES } from "../lib/constants";

const API = "http://localhost:8000";

const COLOR_PALETTE = [
  "#F7931A", "#627EEA", "#9945FF", "#F3BA2F", "#00AAE4",
  "#0033AD", "#00CC66", "#FF6B6B", "#E84142", "#8247E5",
];

export default function MesCoins({ watchedCoins, onCoinsChange }) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null);
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/coins/search?query=${encodeURIComponent(query.trim())}`);
        const json = await res.json();
        setSearchResults(json.data || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const watchedIds = watchedCoins.map((c) => c.coin_id);

  const handleSelectResult = (coin) => {
    setSelectedResult(coin);
    setSelectedColor(COLOR_PALETTE[0]);
    setQuery("");
    setSearchResults([]);
  };

  const handleAdd = async () => {
    if (!selectedResult) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/watched-coins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coin_id: selectedResult.coin_id,
          symbol: selectedResult.symbol,
          name: selectedResult.name,
          color: selectedColor,
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: `${selectedResult.name} ajouté à ta liste.` });
        setSelectedResult(null);
        onCoinsChange();
      } else {
        const json = await res.json();
        setMessage({ type: "error", text: json.detail || "Erreur lors de l'ajout." });
      }
    } catch {
      setMessage({ type: "error", text: "Impossible de joindre le serveur." });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (coin) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/watched-coins/${coin.coin_id}`, { method: "DELETE" });
      if (res.ok) {
        setMessage({ type: "success", text: `${coin.name} retiré de ta liste.` });
        setConfirmRemove(null);
        onCoinsChange();
      } else {
        const json = await res.json();
        setMessage({ type: "error", text: json.detail || "Erreur lors de la suppression." });
        setConfirmRemove(null);
      }
    } catch {
      setMessage({ type: "error", text: "Impossible de joindre le serveur." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Message flash */}
      {message && (
        <div className={`p-3 rounded-xl text-sm border ${
          message.type === "success"
            ? "bg-green-900/30 border-green-700 text-green-300"
            : "bg-red-900/30 border-red-700 text-red-300"
        }`}>
          {message.text}
        </div>
      )}

      {/* Modale confirmation suppression */}
      {confirmRemove && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <p className="text-slate-200 font-semibold">
              Retirer {confirmRemove.name} de ta liste ?
            </p>
            <p className="text-slate-400 text-sm">
              Les données de prix et d'analyse pour {confirmRemove.symbol} ne seront plus affichées.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmRemove(null)}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={() => handleRemove(confirmRemove)}
                disabled={loading}
                className="flex-1 py-2 bg-red-700 hover:bg-red-600 disabled:bg-slate-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer"
              >
                {loading ? "Suppression…" : "Retirer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale confirmation ajout */}
      {selectedResult && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <p className="text-slate-200 font-semibold">
              Ajouter {selectedResult.name} ({selectedResult.symbol}) à ta liste ?
            </p>
            <div>
              <p className="text-slate-400 text-xs mb-2">Choisis une couleur pour l'identifier :</p>
              <div className="flex flex-wrap gap-2">
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                      selectedColor === color ? "border-white scale-110" : "border-transparent hover:scale-105"
                    }`}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-3">
              <span className="w-4 h-4 rounded-full shrink-0" style={{ background: selectedColor }} />
              <span className="text-slate-200 text-sm font-semibold">{selectedResult.name}</span>
              <span className="text-slate-500 text-xs">{selectedResult.symbol}</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedResult(null)}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleAdd}
                disabled={loading}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer"
              >
                {loading ? "Ajout…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liste des cryptos suivies */}
      <div>
        <h2 className="text-slate-300 font-semibold text-sm mb-3">
          Cryptos suivies ({watchedCoins.length}/20)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {watchedCoins.map((coin) => (
            <div
              key={coin.coin_id}
              className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: coin.color }} />
                <div className="min-w-0">
                  <div className="text-slate-200 text-sm font-semibold truncate">{coin.name}</div>
                  <div className="text-slate-500 text-xs">{coin.symbol}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(coin.categories ?? []).map((name) => {
                      const cat = CATEGORIES.find((c) => c.name === name);
                      const color = cat?.color ?? "#94a3b8";
                      return <span key={name} className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: color + "22", color }}>{name}</span>;
                    })}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  if (watchedCoins.length <= 1) {
                    setMessage({ type: "error", text: "Tu dois garder au moins une crypto dans ta liste." });
                    return;
                  }
                  setConfirmRemove(coin);
                }}
                className="text-slate-600 hover:text-red-400 transition-colors bg-transparent border-0 cursor-pointer text-lg leading-none shrink-0"
                title={`Retirer ${coin.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recherche */}
      <div>
        <h2 className="text-slate-300 font-semibold text-sm mb-3">Ajouter une crypto</h2>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une crypto..."
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
          {isSearching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
              Recherche…
            </span>
          )}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden">
              {searchResults.map((coin) => {
                const alreadyIn = watchedIds.includes(coin.coin_id);
                const maxReached = watchedCoins.length >= 20;
                const disabled = alreadyIn || maxReached;
                return (
                  <button
                    key={coin.coin_id}
                    onClick={() => {
                      if (alreadyIn) {
                        setMessage({ type: "error", text: "Déjà dans ta liste." });
                        setSearchResults([]);
                        setQuery("");
                        return;
                      }
                      if (maxReached) {
                        setMessage({ type: "error", text: "Tu suis déjà 20 cryptos, retire-en une d'abord." });
                        setSearchResults([]);
                        setQuery("");
                        return;
                      }
                      handleSelectResult(coin);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-700/50 last:border-0 transition-colors cursor-pointer
                      ${disabled ? "opacity-50" : "hover:bg-slate-700/50"}`}
                  >
                    {coin.thumb ? (
                      <img src={coin.thumb} alt={coin.name} className="w-6 h-6 rounded-full shrink-0" />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-slate-700 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-slate-200 text-sm font-semibold truncate">{coin.name}</div>
                      <div className="text-slate-500 text-xs">{coin.symbol}</div>
                    </div>
                    {alreadyIn && (
                      <span className="text-slate-500 text-xs shrink-0">Déjà dans ta liste</span>
                    )}
                    {!alreadyIn && maxReached && (
                      <span className="text-slate-500 text-xs shrink-0">Maximum atteint</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Note */}
      <p className="text-slate-500 text-xs border-t border-slate-800 pt-4">
        Les cryptos que tu ajoutes ici apparaissent dans le Dashboard, les Signaux, le Simulateur et le Backtest.
      </p>
    </div>
  );
}
