# Portefeuille simulé

Outil éducatif : aucune transaction n'est réelle et rien ne constitue un conseil financier. Chaque
compte reçoit à l'inscription un portefeuille personnel de **10 000 €** (créé automatiquement ; les
comptes existants le reçoivent à la migration).

## Règles (reprises du prototype)

- **Achat** : on indique un montant en euros. Les frais en sont déduits, la quantité reçue est
  `(montant − frais) / prix`.
- **Vente** : on indique une quantité. On reçoit `quantité × prix − frais`.
- **Frais simulés : 0,5 %**, arrondis au centime, par achat et par vente. C'est un taux indicatif et
  arbitraire : il est mémorisé sur le portefeuille (`fee_rate`) et chaque transaction mémorise les frais
  réellement appliqués, donc changer le taux plus tard ne modifie pas l'historique. Il ne modélise
  ni l'écart entre prix d'achat et de vente, ni le glissement, ni la fiscalité.
- **Prix d'achat moyen** pondéré ; une vente ne le change pas ; une position soldée repart de zéro.
- Les montants d'achat ont au plus 2 décimales, les quantités vendues au plus 12.

## Ce qui change par rapport au prototype

- **Performance depuis le départ** = valeur totale − capital initial, **frais compris**. Le P&L des
  positions du prototype est conservé, mais il ignore les frais.
- **Prix trop ancien** : un achat ou une vente est refusé si le dernier prix a plus de 30 minutes
  (collecteur interrompu), au lieu de s'exécuter sur un prix périmé.
- **Remise à zéro = archivage** : l'ancien portefeuille est conservé en base (non modifiable) et un
  neuf repart à 10 000 € avec les mêmes membres. L'historique des portefeuilles archivés n'est pas
  encore affiché.
- Les données de test de l'ancien prototype ne sont pas reprises.

## Sécurité (dans la base, pas dans l'application)

- Aucune écriture directe : achats, ventes et remise à zéro passent par `buy_coin`, `sell_coin` et
  `reset_portfolio`.
- **Le prix est lu dans la table `prices`** par la fonction ; le client ne le transmet jamais.
- Le portefeuille est verrouillé pendant l'opération (`for update`) : deux achats simultanés ne
  peuvent pas dépasser le cash.
- Le cash et les positions sont **calculés depuis les transactions** (`portfolio_cash`,
  `portfolio_positions`) : il n'y a pas de solde stocké qui puisse se désynchroniser. Une transaction
  n'est jamais modifiée ni supprimée.
- Montants en `numeric` (décimal exact), pas en flottant.
- Lecture réservée aux membres du portefeuille. Rôles `owner`, `editor` (peut trader) et `viewer`
  (lecture seule) ; seul le propriétaire peut remettre à zéro. Le partage et les invitations sont le
  jalon 4 : seul le portefeuille personnel est exposé dans l'interface.

## Points d'attention

- Ne pas désactiver une crypto du catalogue tant que des portefeuilles la détiennent : le collecteur
  cesse de la mettre à jour, son prix devient trop ancien et la vente est alors refusée.
- La suppression d'un compte laisse ses transactions dans les portefeuilles partagés (l'auteur
  devient « inconnu ») pour garder le cash exact.

## Vérification

Les tests rejouent les migrations sur PGlite et couvrent les frais, le prix moyen (dont la moyenne
mobile, comparée à une implémentation de référence sur 80 transactions aléatoires), tous les refus,
les rôles, l'archivage et les comptes existants. Un test compare aussi les estimations affichées dans
l'interface aux calculs réels de la base sur 600 cas aléatoires.
