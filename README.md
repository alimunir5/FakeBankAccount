# FakeBank – faux compte bancaire (démo)

Pour montrer un tableau de bord complet de patrimoine et de budget sans exposer de vraies données bancaires, cette page web en JavaScript et Chart.js génère automatiquement des comptes et des transactions **100 % fictifs**, sans saisie ni installation.

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
