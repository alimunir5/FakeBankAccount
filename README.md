# FakeBank – faux compte bancaire (démo)

Tableau de bord de patrimoine et de budget, avec des données **100 % fictives** générées automatiquement (aucune saisie nécessaire).

## Fonctionnalités

- **Patrimoine** : patrimoine net, courbe d'évolution (1M / 6M / 1A / 3A), répartition des actifs, liste des comptes avec variation sur 1 an.
- **Budget** : revenus, dépenses, reste à vivre, taux d'épargne, budget par catégorie avec repère d'avancement du mois, historique sur 12 mois.
- **Dépenses** : répartition par catégorie, dépenses cumulées comparées au mois précédent, liste des transactions avec recherche et filtre, top commerçants.

## Lancer

Ouvrir `index.html` dans un navigateur. Aucune installation requise (Chart.js est chargé depuis un CDN).

## Fichiers

- `data.js` : génération des données fictives (graine fixe, donc résultats reproductibles)
- `app.js` : rendu des vues et des graphiques
- `style.css` : styles (thème sombre, responsive)
