import { useEffect, useRef, useState } from "react";
import Dashboard from "./components/Dashboard";
import SignalsTab from "./components/SignalsTab";
import Portfolio from "./components/Portfolio";
import Backtest from "./components/Backtest";
import Lexique from "./components/Lexique";
import MesCoins from "./components/MesCoins";
import { HelpModal } from "./components/shared";

const API = "http://localhost:8000";
const POLL_INTERVAL = 8000;

const TABS = [
  { id: "dashboard",  label: "Tableau de bord" },
  { id: "signals",    label: "Signaux" },
  { id: "mes-coins",  label: "Mes cryptos" },
  { id: "portfolio",  label: "Portefeuille" },
  { id: "backtest",   label: "Backtest" },
  { id: "lexique",    label: "Lexique" },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [watchedCoins, setWatchedCoins] = useState([]);
  const [prices, setPrices] = useState(null);
  const [histories, setHistories] = useState({});
  const [analyses, setAnalyses] = useState({});
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [helpTopic, setHelpTopic] = useState(null);
  const histPollRef = useRef(null);
  const analysisPollRef = useRef(null);
  const pricesPollRef = useRef(null);

  // Formate les coins DB en format utilisé par les composants enfants
  const coins = watchedCoins.map((c) => ({
    id: c.coin_id,
    label: c.name,
    symbol: c.symbol,
    color: c.color,
    categories: c.categories ?? [],
  }));

  const fetchWatchedCoins = () =>
    fetch(`${API}/api/watched-coins`)
      .then((r) => r.json())
      .then((json) => {
        if (json.status === "ok") setWatchedCoins(json.data);
      })
      .catch(() => {});

  const fetchPrices = () =>
    fetch(`${API}/api/prices`)
      .then((r) => r.json())
      .then((json) => {
        if (json.status === "error") {
          setError(json.message);
        } else {
          setPrices(json.data);
          setLastUpdated(new Date());
          setError(null);
          clearInterval(pricesPollRef.current);
        }
      })
      .catch(() => setError("Impossible de joindre le serveur. Assurez-vous que le backend est lancé."));

  const fetchHistories = () =>
    fetch(`${API}/api/history/all`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data && Object.keys(json.data).length > 0) setHistories(json.data);
        if (json.status === "ok") clearInterval(histPollRef.current);
      })
      .catch(() => {});

  const fetchAnalyses = () =>
    fetch(`${API}/api/analysis/all`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data && Object.keys(json.data).length > 0) setAnalyses(json.data);
        if (json.status === "ok") clearInterval(analysisPollRef.current);
      })
      .catch(() => {});

  useEffect(() => {
    fetchWatchedCoins();
    fetchPrices();
    fetchHistories();
    fetchAnalyses();
    pricesPollRef.current = setInterval(fetchPrices, 30000);
    histPollRef.current = setInterval(fetchHistories, POLL_INTERVAL);
    analysisPollRef.current = setInterval(fetchAnalyses, POLL_INTERVAL);
    return () => {
      clearInterval(pricesPollRef.current);
      clearInterval(histPollRef.current);
      clearInterval(analysisPollRef.current);
    };
  }, []);

  // Appelé par MesCoins après ajout/suppression d'une crypto
  const handleCoinsChange = () => {
    fetchWatchedCoins();
    fetchPrices();
  };

  const histLoaded = Object.keys(histories).length;

  return (
    <div className="min-h-screen px-4 py-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-50 mb-1">MarniarauCrypto</h1>
        <p className="text-slate-500 text-sm">Suivi des prix en temps réel — EUR</p>
      </div>

      {/* Navigation */}
      <nav className="flex flex-wrap gap-1 mb-6 border-b border-slate-800 pb-3">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors border cursor-pointer
              ${tab === id
                ? "bg-slate-700 text-slate-100 border-slate-600"
                : "text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Erreur globale */}
      {error && (
        <div className="mb-4 p-4 bg-slate-800 border border-red-800 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Contenu par onglet */}
      {tab === "dashboard" && (
        <Dashboard
          coins={coins}
          prices={prices}
          histories={histories}
          analyses={analyses}
          onOpenHelp={setHelpTopic}
          onRefresh={fetchPrices}
          lastUpdated={lastUpdated}
          histLoaded={histLoaded}
        />
      )}
      {tab === "signals"   && <SignalsTab coins={coins} prices={prices} analyses={analyses} onOpenHelp={setHelpTopic} />}
      {tab === "mes-coins" && <MesCoins watchedCoins={watchedCoins} onCoinsChange={handleCoinsChange} />}
      {tab === "portfolio" && <Portfolio prices={prices} />}
      {tab === "backtest"  && <Backtest coins={coins} />}
      {tab === "lexique"   && <Lexique coins={coins} />}

      {/* Modale d'aide */}
      {helpTopic && <HelpModal topic={helpTopic} onClose={() => setHelpTopic(null)} />}
    </div>
  );
}
