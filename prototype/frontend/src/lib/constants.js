export const COINS = [
  { id: "bitcoin",     label: "Bitcoin",  symbol: "BTC", color: "#f7931a" },
  { id: "ethereum",    label: "Ethereum", symbol: "ETH", color: "#627eea" },
  { id: "solana",      label: "Solana",   symbol: "SOL", color: "#9945ff" },
  { id: "binancecoin", label: "BNB",      symbol: "BNB", color: "#f0b90b" },
  { id: "ripple",      label: "XRP",      symbol: "XRP", color: "#00aae4" },
  { id: "cardano",     label: "Cardano",  symbol: "ADA", color: "#3cc8c8" },
];

export const SIGNAL_CONFIG = {
  strong_buy:  { label: "▲▲ Fort signal haussier", color: "#22c55e", bg: "#14532d", border: "#166534" },
  buy:         { label: "▲ Signal haussier",        color: "#4ade80", bg: "#166534", border: "#15803d" },
  neutral:     { label: "─ Neutre",                 color: "#94a3b8", bg: "#1e293b", border: "#334155" },
  sell:        { label: "▼ Signal baissier",        color: "#f87171", bg: "#7f1d1d", border: "#991b1b" },
  strong_sell: { label: "▼▼ Fort signal baissier",  color: "#ef4444", bg: "#450a0a", border: "#7f1d1d" },
};

export const SIGNAL_DESCRIPTIONS = {
  strong_buy:  "Les indicateurs convergent vers une forte pression acheteuse à court terme.",
  buy:         "Les indicateurs suggèrent une légère tendance haussière.",
  neutral:     "Les indicateurs ne dégagent pas de tendance claire.",
  sell:        "Les indicateurs suggèrent une légère pression vendeuse.",
  strong_sell: "Les indicateurs convergent vers une forte pression vendeuse à court terme.",
};

export const SIGNAL_SORT_ORDER = { strong_buy: 4, buy: 3, neutral: 2, sell: 1, strong_sell: 0 };

export const HELP_TEXTS = {
  rsi: {
    title: "RSI — Indice de force relative",
    body: "Mesure la vitesse et l'amplitude des variations de prix sur 14 jours. Va de 0 à 100.\n\n• En dessous de 30 : survendu (potentiellement sous-évalué — achat possible).\n• Au-dessus de 70 : suracheté (potentiellement surévalué — vente possible).\n• Entre 30 et 70 : zone neutre.",
  },
  macd: {
    title: "MACD — Convergence/Divergence des moyennes mobiles",
    body: "Compare deux moyennes mobiles exponentielles (12j et 26j) pour détecter les changements de tendance.\n\n• MACD positif : tendance haussière à court terme.\n• MACD négatif : tendance baissière.\n• Le croisement avec la ligne de signal (9j) est un indicateur classique.",
  },
  signal: {
    title: "Signal composite",
    body: "Score calculé en combinant RSI, MACD et variation 24h :\n\n• RSI < 30 : +2 pts   • RSI < 45 : +1 pt\n• RSI > 70 : −2 pts   • RSI > 55 : −1 pt\n• MACD > 0 : +1 pt    • MACD < 0 : −1 pt\n• Hausse > 5% : +1 pt • Baisse > 5% : −1 pt\n\nScore ≥ 3 → Fort haussier   Score ≥ 1 → Haussier\nScore ≤ −3 → Fort baissier  Score ≤ −1 → Baissier\n\nCes signaux sont éducatifs, pas des conseils financiers.",
  },
};

export const CATEGORIES = [
  { name: "Réserve de valeur",  subtitle: "or numérique",          color: "#F7931A" },
  { name: "Smart contracts",    subtitle: "infrastructure",         color: "#627EEA" },
  { name: "Paiement & transfert", subtitle: "",                    color: "#00AAE4" },
  { name: "Exchange tokens",    subtitle: "jetons de plateforme",   color: "#F3BA2F" },
  { name: "DeFi",               subtitle: "finance décentralisée",  color: "#00CC66" },
  { name: "Memecoins",          subtitle: "spéculatif",             color: "#FF6B6B" },
];

export const CRYPTO_DATA = {
  bitcoin:     { categories: ["Réserve de valeur"],                  created: 2009, founders: "Satoshi Nakamoto (anonyme)",                 idea: "Première cryptomonnaie. Un système de paiement électronique pair-à-pair sans banque centrale. Quantité limitée à 21 millions.", strength: "La plus reconnue, la plus sécurisée, la plus liquide.", risk: "Très énergivore, lente pour les transactions, très suivie par les régulateurs.", btcCorrelation: "— (c'est la référence)" },
  ethereum:    { categories: ["Smart contracts", "DeFi"],            created: 2015, founders: "Vitalik Buterin",                            idea: "Plateforme programmable qui permet de créer des applications décentralisées. La majorité des projets DeFi et NFT tournent dessus.", strength: "Écosystème le plus développé, passage réussi au Proof of Stake.", risk: "Frais de transaction élevés en période de congestion, forte concurrence des autres Layer 1.", btcCorrelation: "Forte" },
  solana:      { categories: ["Smart contracts", "DeFi"],            created: 2020, founders: "Anatoly Yakovenko",                          idea: "Blockchain très rapide (~65 000 transactions/seconde) et peu chère, conçue pour rivaliser avec Ethereum sur la vitesse.", strength: "Rapidité et frais très bas, écosystème en forte croissance.", risk: "A subi plusieurs pannes réseau, plus centralisée qu'Ethereum, projet plus jeune donc moins éprouvé.", btcCorrelation: "Forte" },
  binancecoin: { categories: ["Exchange tokens", "Smart contracts"], created: 2017, founders: "Changpeng Zhao (CZ) / Binance",              idea: "Token natif de Binance, la plus grande plateforme d'échange au monde. Donne des réductions de frais et alimente la BNB Chain.", strength: "Très liquide, soutenu par l'écosystème Binance.", risk: "Très dépendant de la santé de Binance et de son fondateur, risque réglementaire élevé.", btcCorrelation: "Forte" },
  ripple:      { categories: ["Paiement & transfert"],               created: 2012, founders: "Ripple Labs (Brad Garlinghouse)",             idea: "Conçu pour les transferts interbancaires internationaux, ultra-rapide et quasi-gratuit. Utilisé par des banques dans certains pays.", strength: "Transactions en 3-5 secondes, partenariats institutionnels.", risk: "Long conflit juridique avec la SEC américaine, projet relativement centralisé autour de Ripple Labs.", btcCorrelation: "Modérée" },
  cardano:     { categories: ["Smart contracts"],                    created: 2017, founders: "Charles Hoskinson (co-fondateur d'Ethereum)", idea: "Blockchain construite sur une base académique et peer-reviewed. Priorité à la sécurité et la rigueur scientifique sur la vitesse de déploiement.", strength: "Approche rigoureuse, consommation énergétique très faible.", risk: "Développement lent, écosystème encore limité comparé à Ethereum ou Solana.", btcCorrelation: "Forte" },
};

export function getCoinCategories(coinId) {
  const data = CRYPTO_DATA[coinId];
  if (!data) return [];
  return data.categories.map((name) => CATEGORIES.find((c) => c.name === name)).filter(Boolean);
}

export const LEXIQUE_DATA = [
  {
    term: "RSI",
    fullName: "Relative Strength Index",
    definition: "Indicateur de momentum qui mesure la vitesse et l'amplitude des variations de prix sur 14 jours. Il oscille entre 0 et 100.",
    points: [
      "RSI < 30 → zone de survente : l'actif a baissé rapidement, un rebond est possible.",
      "RSI > 70 → zone de surachat : l'actif a monté rapidement, une correction est possible.",
      "Entre 30 et 70 → zone neutre, pas de signal clair.",
    ],
    limite: "Le RSI peut rester longtemps en zone extrême lors de tendances fortes. Ce n'est pas un oracle.",
  },
  {
    term: "MACD",
    fullName: "Moving Average Convergence Divergence",
    definition: "Indicateur de tendance calculant la différence entre deux moyennes mobiles exponentielles : courte (12j) et longue (26j).",
    points: [
      "MACD positif → la moyenne courte dépasse la longue : tendance haussière à court terme.",
      "MACD négatif → tendance baissière à court terme.",
      "Croisement MACD / ligne de signal (EMA 9j) : signal d'entrée ou sortie classique.",
    ],
    limite: "Le MACD est un indicateur retardé — il confirme les tendances plutôt qu'il ne les anticipe.",
  },
  {
    term: "EMA",
    fullName: "Exponential Moving Average — Moyenne mobile exponentielle",
    definition: "Moyenne des prix sur une période donnée qui accorde plus de poids aux données récentes. Plus réactive qu'une moyenne simple.",
    points: [
      "EMA 12j : réagit vite aux variations de prix.",
      "EMA 26j : plus lisse, représente la tendance de fond.",
      "Utilisée dans le calcul du MACD (différence EMA 12j − EMA 26j).",
    ],
    limite: "Plus réactive = plus sensible aux faux signaux sur les marchés très volatils.",
  },
  {
    term: "Market Cap",
    fullName: "Capitalisation boursière",
    definition: "Valeur totale d'une crypto en circulation. Calculée en multipliant le prix par le nombre de tokens en circulation.",
    points: [
      "Grande market cap (BTC, ETH) → actif plus stable et plus liquide.",
      "Petite market cap → potentiel de croissance plus élevé, mais risque plus fort.",
      "Permet de comparer la taille relative des cryptos entre elles.",
    ],
    limite: "La market cap ne reflète pas la valeur intrinsèque — elle peut être gonflée par la spéculation.",
  },
  {
    term: "Volume",
    fullName: "Volume de transactions sur 24h",
    definition: "Montant total échangé sur une crypto en 24 heures, exprimé en euros dans cette application.",
    points: [
      "Volume élevé lors d'une hausse → mouvement potentiellement fiable.",
      "Volume faible lors d'une hausse → mouvement peu convainquant, peut être éphémère.",
      "Forte baisse avec gros volume → pression vendeuse significative.",
    ],
    limite: "Un volume élevé seul ne suffit pas à valider un signal. À croiser avec d'autres indicateurs.",
  },
  {
    term: "Signal",
    fullName: "Signal composite éducatif",
    definition: "Score calculé en combinant RSI, MACD et variation 24h pour donner une orientation globale. C'est un outil pédagogique, pas une recommandation d'investissement.",
    points: [
      "RSI < 30 : +2 pts  |  RSI < 45 : +1 pt  |  RSI > 55 : −1 pt  |  RSI > 70 : −2 pts",
      "MACD > 0 : +1 pt  |  MACD < 0 : −1 pt",
      "Variation 24h > +5% : +1 pt  |  < −5% : −1 pt",
      "Score ≥ 3 → Fort haussier  |  ≥ 1 → Haussier  |  ≤ −1 → Baissier  |  ≤ −3 → Fort baissier",
    ],
    limite: "Ce signal simplifie une réalité complexe. Les marchés crypto sont imprévisibles. Ne jamais investir sur la seule base de ces indicateurs.",
  },
];
