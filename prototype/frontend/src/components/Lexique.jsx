import { useState } from "react";
import { LEXIQUE_DATA, CATEGORIES, CRYPTO_DATA } from "../lib/constants";

const CATEGORY_DESCRIPTIONS = {
  "Réserve de valeur":   { description: "Cryptos conçues pour stocker de la valeur dans le temps, comme l'or. Peu de fonctionnalités, mais confiance maximale.", examples: "Bitcoin" },
  "Smart contracts":     { description: "Plateformes qui permettent d'exécuter des programmes décentralisés (DeFi, NFT, DAOs). C'est la couche sur laquelle se construisent la plupart des autres projets.", examples: "Ethereum, Solana, Cardano" },
  "Paiement & transfert":{ description: "Cryptos optimisées pour envoyer de l'argent rapidement et à faible coût, souvent en concurrence avec les systèmes bancaires.", examples: "XRP, Litecoin, Stellar" },
  "Exchange tokens":     { description: "Tokens émis par des plateformes d'échange. Donnent des réductions de frais et d'autres avantages sur la plateforme émettrice.", examples: "BNB (Binance), OKB (OKX)" },
  "DeFi":                { description: "Protocoles qui reproduisent des services financiers (prêts, échanges, épargne) sans banque ni intermédiaire.", examples: "Uniswap, Aave, Chainlink" },
  "Memecoins":           { description: "Cryptos nées d'un mème ou d'une blague, sans utilité technique réelle. Extrêmement volatiles, portées par la communauté et les réseaux sociaux.", examples: "Dogecoin, Shiba Inu" },
};

function IndicateursTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {LEXIQUE_DATA.map(({ term, fullName, definition, points, limite }) => (
        <div
          key={term}
          className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col gap-3"
        >
          <div>
            <span className="text-lg font-bold text-slate-100">{term}</span>
            <span className="text-slate-500 text-xs ml-2">{fullName}</span>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed m-0">{definition}</p>
          <ul className="space-y-1 m-0 pl-0 list-none">
            {points.map((pt, i) => (
              <li key={i} className="text-slate-400 text-xs leading-relaxed flex gap-2">
                <span className="text-slate-600 mt-0.5 shrink-0">›</span>
                <span>{pt}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-700 pt-3 mt-auto">
            <span className="text-slate-500 text-xs italic">⚠ {limite}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CryptoCard({ coin }) {
  const data = CRYPTO_DATA[coin.id];

  if (!data) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: coin.color }} />
          <span className="text-slate-100 font-bold">{coin.label}</span>
          <span className="text-slate-500 text-sm">{coin.symbol}</span>
        </div>
        <p className="text-slate-400 text-sm">
          Fiche détaillée non disponible pour cette crypto.{" "}
          <a
            href={`https://www.coingecko.com/en/coins/${coin.id}`}
            target="_blank"
            rel="noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            Consulte CoinGecko pour en savoir plus.
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: coin.color }} />
        <span className="text-slate-100 font-bold text-lg">{coin.label}</span>
        <span className="text-slate-500 text-sm">{coin.symbol}</span>
        <div className="ml-auto flex flex-wrap gap-1">
          {(coin.categories ?? []).map((name) => {
            const cat = CATEGORIES.find((c) => c.name === name);
            const color = cat?.color ?? "#94a3b8";
            return <span key={name} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: color + "22", color }}>{name}</span>;
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-900 rounded-lg p-2.5">
          <div className="text-slate-500 mb-0.5">Créé en</div>
          <div className="text-slate-200 font-semibold">{data.created}</div>
        </div>
        <div className="bg-slate-900 rounded-lg p-2.5">
          <div className="text-slate-500 mb-0.5">Corrélation BTC</div>
          <div className="text-slate-200 font-semibold">{data.btcCorrelation}</div>
        </div>
      </div>

      <div>
        <div className="text-slate-500 text-xs mb-1">Fondateur(s)</div>
        <div className="text-slate-300 text-sm">{data.founders}</div>
      </div>

      <div>
        <div className="text-slate-500 text-xs mb-1">Idée principale</div>
        <p className="text-slate-300 text-sm leading-relaxed">{data.idea}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-3">
          <div className="text-green-400 text-xs font-semibold mb-1">Point fort</div>
          <div className="text-slate-300 text-xs leading-relaxed">{data.strength}</div>
        </div>
        <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-3">
          <div className="text-red-400 text-xs font-semibold mb-1">Risque principal</div>
          <div className="text-slate-300 text-xs leading-relaxed">{data.risk}</div>
        </div>
      </div>
    </div>
  );
}

function CryptosTab({ coins }) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-slate-300 font-semibold text-sm mb-4">
          Les grandes familles de cryptomonnaies
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CATEGORIES.map((cat) => {
            const desc = CATEGORY_DESCRIPTIONS[cat.name];
            return (
              <div
                key={cat.name}
                className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: cat.color, color: "#0f172a" }}
                  >
                    {cat.name}
                  </span>
                  {cat.subtitle && (
                    <span className="text-slate-500 text-xs">{cat.subtitle}</span>
                  )}
                </div>
                {desc && <p className="text-slate-400 text-xs leading-relaxed">{desc.description}</p>}
                {desc && (
                  <div className="text-slate-500 text-xs">
                    <span className="text-slate-600">Exemples : </span>
                    {desc.examples}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-slate-300 font-semibold text-sm mb-4">Fiches par crypto</h3>
        <div className="space-y-4">
          {coins.map((coin) => (
            <CryptoCard key={coin.id} coin={coin} />
          ))}
          {coins.length === 0 && (
            <p className="text-slate-500 text-sm">Aucune crypto suivie pour l'instant.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Lexique({ coins = [] }) {
  const [activeTab, setActiveTab] = useState("indicateurs");

  const pills = [
    { id: "indicateurs", label: "Indicateurs" },
    { id: "cryptos",     label: "Cryptos & catégories" },
  ];

  return (
    <div className="space-y-5">
      {/* Pills de navigation interne */}
      <div className="flex gap-2">
        {pills.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border
              ${activeTab === id
                ? "bg-slate-700 text-slate-100 border-slate-500"
                : "text-slate-500 border-slate-700 hover:text-slate-300 hover:border-slate-600"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "indicateurs" && (
        <>
          <p className="text-slate-400 text-sm">
            Comprendre les indicateurs utilisés dans MarniarauCrypto.
          </p>
          <IndicateursTab />
        </>
      )}

      {activeTab === "cryptos" && <CryptosTab coins={coins} />}
    </div>
  );
}
