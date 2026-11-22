# Portefeuilles partagés

Un portefeuille partagé est une simulation commune de 10 000 € : plusieurs comptes achètent et
vendent avec **le même cash**, ou consultent seulement. Outil éducatif : rien n'est réel.

## Rôles

|              | Voir | Acheter / vendre | Inviter, retirer, changer les rôles | Remise à zéro, archiver |
| ------------ | ---- | ---------------- | ----------------------------------- | ----------------------- |
| Propriétaire | oui  | oui              | oui                                 | oui                     |
| Éditeur      | oui  | oui              | non                                 | non                     |
| Lecteur      | oui  | non              | non                                 | non                     |

Il y a un seul propriétaire (celui qui crée le portefeuille), sans transfert de propriété pour
l'instant. Un membre non propriétaire peut **quitter** le portefeuille ; le propriétaire peut
l'**archiver** (fermeture définitive : il disparaît des listes, rien n'est supprimé en base).
Le portefeuille personnel n'est pas partageable.

Limites : 10 membres par portefeuille, 5 portefeuilles partagés actifs par propriétaire,
20 invitations en attente par portefeuille.

## Invitation par code

1. Le propriétaire ouvre « Inviter », choisit le rôle (éditeur ou lecteur) et la durée (1 à 30 jours,
   7 par défaut).
2. L'application affiche **une seule fois** un code de 64 caractères et un lien
   (`…/#/rejoindre?code=…`). Le propriétaire le transmet lui-même (message, SMS, de vive voix).
3. La personne se connecte avec son propre compte, ouvre le lien ou colle le code, et rejoint. Rejoindre
   est toujours un clic volontaire : un lien ouvert ne fait jamais rejoindre automatiquement.

Propriétés de sécurité (dans la base) :

- Le code est aléatoire (deux UUID v4) ; **seule son empreinte SHA-256 est stockée**. Même avec un
  accès à la base, on ne peut pas retrouver un code.
- Un code est à **usage unique**, expire, et peut être **révoqué**. La remise à zéro et l'archivage
  révoquent les invitations en cours.
- Tous les échecs (inconnu, expiré, révoqué, déjà utilisé, portefeuille archivé) renvoient le **même
  message** « Code invalide ou expiré » : rien n'est révélé à qui devine.
- Le code est après le `#` du lien, partie qui n'est jamais envoyée aux serveurs.
- Un code refusé parce que la personne est déjà membre, ou parce que le portefeuille est complet, n'est
  **pas consommé**.
- Le propriétaire voit ses invitations (rôle, expiration, état) mais jamais l'empreinte.

## Confidentialité des pseudos

Les membres d'un même portefeuille voient le **pseudo** les uns des autres, et seulement lui
(`profiles` n'expose que `id` et `pseudo`). Les nouveaux comptes reçoivent un pseudo neutre
(« Membre-4821 ») et non le début de leur adresse email. Le pseudo se modifie depuis l'en-tête, et un
rappel s'affiche avant de créer, d'inviter ou de rejoindre.

Un membre retiré ou parti ne voit plus les pseudos des autres, sauf s'il partage un autre portefeuille
avec eux. Ses anciennes transactions restent (le cash doit rester exact) et apparaissent sous
« Ancien membre » pour les autres.

## À l'écran

- Sélecteur de portefeuille, « Nouveau portefeuille partagé », « Rejoindre avec un code ».
- Pour un portefeuille partagé : rôle, liste des membres (rôles modifiables, retrait avec
  confirmation), invitations en attente (révocables), colonne « Par » dans les transactions.
- Un portefeuille partagé est relu toutes les 60 secondes pour voir les opérations des autres.
- Les lecteurs n'ont ni bouton d'achat, ni de vente, ni de remise à zéro.

## Points d'attention

- Un compte supprimé garde ses transactions dans les portefeuilles partagés (auteur devenu inconnu).
  Si c'est le propriétaire qui supprime son compte, le portefeuille partagé n'a plus de propriétaire :
  le traitement de la suppression de compte est prévu plus tard.
- Il n'y a pas de limitation du nombre d'essais de code : le code est assez long pour que deviner soit
  impraticable.

## Vérification

Les tests SQL rejouent les migrations sur PGlite et couvrent chaque règle (code valide, expiré,
révoqué, réutilisé, déjà membre, portefeuille plein ou archivé, rôles, retrait, départ, archivage,
remise à zéro, visibilité des pseudos, écritures directes refusées). Chaque règle de sécurité a été
cassée volontairement, un test a échoué à chaque fois.
