// Génération de données 100 % fictives (déterministes grâce à une graine fixe).
(function () {
  let seed = 20261026;
  function rand() {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const between = (a, b) => a + rand() * (b - a);
  const int = (a, b) => Math.floor(between(a, b + 1));
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const round2 = v => Math.round(v * 100) / 100;
  const gauss = () => {
    let u = 0, v = 0;
    while (!u) u = rand();
    while (!v) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ---------- Patrimoine ----------
  const CLASSES = {
    liquidites: { label: 'Liquidités', color: '#5b8def' },
    bourse: { label: 'Bourse', color: '#e9c46a' },
    assurance: { label: 'Assurance vie', color: '#3ecf8e' },
    crypto: { label: 'Crypto', color: '#c084fc' },
    immobilier: { label: 'Immobilier', color: '#f97362' },
  };

  const ACCOUNTS = [
    { name: 'Compte courant', inst: 'FakeBank', cls: 'liquidites', balance: 3284.52 },
    { name: 'Livret A', inst: 'FakeBank', cls: 'liquidites', balance: 22950 },
    { name: 'LDDS', inst: 'FakeBank', cls: 'liquidites', balance: 8412.3 },
    { name: 'PEA', inst: 'Courtier Horizon', cls: 'bourse', balance: 27845.1 },
    { name: 'Compte-titres', inst: 'Courtier Horizon', cls: 'bourse', balance: 9120.75 },
    { name: 'Assurance vie', inst: 'Assur Avenir', cls: 'assurance', balance: 34610 },
    { name: 'Portefeuille crypto', inst: 'Cryptobox', cls: 'crypto', balance: 5240.88 },
    { name: 'Appartement T3', inst: 'Estimation', cls: 'immobilier', balance: 268000 },
  ];

  const LOAN = { name: 'Crédit immobilier', inst: 'FakeBank', balance: -171340 };

  // Marche aléatoire par classe d'actifs [dérive journalière, volatilité]
  const WALK = {
    liquidites: [0.0007, 0.0015],
    bourse: [0.00035, 0.009],
    assurance: [0.0002, 0.0025],
    crypto: [0.0006, 0.022],
    immobilier: [0.00005, 0.0006],
  };

  const N = 3 * 365 + 1;
  const dates = [];
  for (let i = 0; i < N; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - (N - 1 - i));
    dates.push(d);
  }

  const classTotals = {};
  for (const a of ACCOUNTS) classTotals[a.cls] = (classTotals[a.cls] || 0) + a.balance;

  const series = {};
  for (const [cls, [mu, sigma]] of Object.entries(WALK)) {
    const w = [1];
    for (let i = 1; i < N; i++) w.push(w[i - 1] * Math.exp(mu + sigma * gauss()));
    const end = w[N - 1];
    series[cls] = w.map(v => round2((v / end) * classTotals[cls]));
  }
  // Le capital restant dû diminue d'environ 600 € par mois
  series.dettes = dates.map((_, i) => round2(LOAN.balance - (N - 1 - i) * 19.6));

  const netWorth = dates.map((_, i) =>
    round2(Object.keys(series).reduce((s, k) => s + series[k][i], 0))
  );

  // ---------- Transactions ----------
  const CATEGORIES = {
    salaire: { label: 'Salaire', color: '#3ecf8e', kind: 'income' },
    autres: { label: 'Autres revenus', color: '#2dd4bf', kind: 'income' },
    logement: { label: 'Logement', color: '#7c8cff', kind: 'expense', budget: 1250 },
    courses: { label: 'Courses', color: '#3ecf8e', kind: 'expense', budget: 450 },
    restaurants: { label: 'Restaurants & sorties', color: '#f5a524', kind: 'expense', budget: 250 },
    transport: { label: 'Transport', color: '#38bdf8', kind: 'expense', budget: 150 },
    abonnements: { label: 'Abonnements', color: '#c084fc', kind: 'expense', budget: 110 },
    shopping: { label: 'Shopping', color: '#f472b6', kind: 'expense', budget: 200 },
    sante: { label: 'Santé', color: '#2dd4bf', kind: 'expense', budget: 60 },
    loisirs: { label: 'Loisirs & voyages', color: '#fb7185', kind: 'expense', budget: 200 },
    epargne: { label: 'Épargne', color: '#e9c46a', kind: 'transfer' },
  };

  const MERCHANTS = {
    courses: ['Supermarché Le Panier', 'Marché Saint-Antoine', 'Épicerie Bio Verte', 'Primeur du Quartier', 'Hypermarché Central'],
    restaurants: ['Bistrot des Halles', 'Sushi Kaze', 'Pizzeria Bella', 'Café Lumière', 'Burger Factory', 'Brasserie Le Comptoir', 'Livraison Repas Express'],
    transport: ['VTC Ride', 'Parking Centre-Ville', 'Station-service Relais', 'Location vélo'],
    shopping: ['Boutique Mode Urbaine', 'Librairie Page Blanche', 'Électro Discount', 'Maison & Déco', 'Sport Expert'],
    sante: ['Pharmacie Centrale', 'Cabinet médical', 'Opticien Vision+'],
    loisirs: ['Cinéma Le Rex', 'Billetterie Concerts', 'Escape Game Enigma', 'Galerie Expo 9', 'Bowling Strike'],
  };

  const tx = [];
  const add = (y, m, d, label, cat, amount) => {
    const date = new Date(y, m, d);
    if (date > today) return;
    tx.push({ date, label, cat, amount: round2(amount) });
  };

  for (let k = 11; k >= 0; k--) {
    const ref = new Date(today.getFullYear(), today.getMonth() - k, 1);
    const y = ref.getFullYear(), m = ref.getMonth();
    const dim = new Date(y, m + 1, 0).getDate();
    const winter = m <= 2 || m >= 10;

    add(y, m, 25, 'Salaire – Nova Conseil', 'salaire', 3150);
    if (m === 11) add(y, m, 20, 'Prime de fin d’année', 'salaire', 1450);
    if (rand() < 0.5) add(y, m, int(1, dim), 'Virement reçu – Remboursement', 'autres', between(15, 80));

    add(y, m, 1, 'Échéance prêt immobilier', 'logement', -980);
    add(y, m, 3, 'Charges de copropriété', 'logement', -118);
    add(y, m, 8, 'Énergie Volt+', 'logement', -between(48, 80) * (winter ? 1.5 : 1));
    add(y, m, 2, 'Abonnement transports', 'transport', -86.4);
    add(y, m, 5, 'Salle de sport FitClub', 'abonnements', -29.9);
    add(y, m, 10, 'Box Fibre & Mobile', 'abonnements', -44.98);
    add(y, m, 12, 'Streaming+', 'abonnements', -13.49);
    add(y, m, 15, 'Musique Premium', 'abonnements', -10.99);
    add(y, m, 26, 'Virement vers Livret A', 'epargne', -400);

    for (let d = int(1, 3); d <= dim; d += int(3, 5))
      add(y, m, d, pick(MERCHANTS.courses), 'courses', -between(18, 96));
    for (let i = 0, n = int(4, 8); i < n; i++)
      add(y, m, int(1, dim), pick(MERCHANTS.restaurants), 'restaurants', -between(11, 68));
    for (let i = 0, n = int(1, 4); i < n; i++)
      add(y, m, int(1, dim), pick(MERCHANTS.transport), 'transport', -between(7, 32));
    for (let i = 0, n = int(1, 4); i < n; i++)
      add(y, m, int(1, dim), pick(MERCHANTS.shopping), 'shopping', -between(19, 145));
    for (let i = 0, n = int(0, 2); i < n; i++) {
      const d = int(1, dim - 3);
      const cost = between(20, 65);
      add(y, m, d, pick(MERCHANTS.sante), 'sante', -cost);
      add(y, m, d + 3, 'Remboursement Assurance maladie', 'sante', cost * 0.6);
    }
    for (let i = 0, n = int(1, 3); i < n; i++)
      add(y, m, int(1, dim), pick(MERCHANTS.loisirs), 'loisirs', -between(12, 75));

    if (m === 6 || m === 7) add(y, m, int(5, 20), 'Voyage – Vols & hébergement', 'loisirs', -between(450, 900));
    if (m === 11) add(y, m, int(10, 22), 'Cadeaux de Noël', 'shopping', -between(180, 320));
  }
  tx.sort((a, b) => b.date - a.date);

  window.FB_DATA = { today, dates, series, netWorth, CLASSES, ACCOUNTS, LOAN, CATEGORIES, tx };
})();
