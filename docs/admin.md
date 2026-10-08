# Administration Postibou

Depuis le compte propriétaire vérifié, ouvrir **Mon compte → Administration**. L’aperçu public et les comptes fictifs ont été supprimés.

L’espace affiche les comptes Neon Auth, adresses vérifiées, essais, abonnements et quotas stockés dans Postibou. Recherche par e-mail, filtres, pagination de 25 comptes et bouton Actualiser. Les compteurs généraux ne dépendent pas du filtre. Les adaptations utilisées sont celles des périodes actuellement enregistrées, pas un cumul historique. Un mois renouvelé utilise la même règle de remise à zéro que `/api/usage`.

Le dernier paiement affiché provient de la confirmation de souscription enregistrée ; il ne représente ni tous les renouvellements ni un montant de chiffre d’affaires. « Envoi accepté » indique l’acceptation par Resend, sans prouver la réception. Les demandes de rétractation reçues sont signalées pour traitement selon `docs/legal/operations.md`.

## Accès

`postibou_admins` contient l’UUID de l’identité propriétaire existante et vérifiée. La migration de création est à exécuter une fois ; elle ne fait pas partie de l’inscription. Aucun utilisateur ne peut s’attribuer ce rôle depuis une requête ou l’interface. Le rôle reste attaché à l’UUID, même si une autre identité a le même e-mail. Table avec RLS et accès public révoqué.

`GET /api/admin/access` indique seulement si la session courante est administratrice. `GET /api/admin/users` vérifie à chaque requête la session vérifiée Neon puis le rôle avant toute lecture de comptes. Les réponses sont privées et non mises en cache. Aucun jeton, identifiant de paiement, secret ou preuve contractuelle complète n’est retourné. Les écritures et requêtes intersites sont refusées. Les données affichées sont effacées de l’interface à la perte de session ou d’accès.

Cet espace assure le suivi. Les changements de facturation et remboursements restent dans Stripe ; les clôtures de comptes et demandes de droits suivent la procédure d’exploitation. Il ne modifie pas les quotas.

## Validation

101 tests passent : dont refus d’accès anonyme ou non administrateur, falsification d’identifiant, filtres et recherche littérale, pagination vide, absence de modification des quotas et cohérence des périodes. Build vérifié avant publication. La base de production contient un seul rôle administrateur, lié au compte propriétaire vérifié.
