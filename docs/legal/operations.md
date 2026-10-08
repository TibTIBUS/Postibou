# Données personnelles — procédure d’exploitation Postibou

Responsable : Thibaut MARIE / Localia. Version : 8 octobre 2026.
Contact public : gestion.localia@gmail.com. Ces procédures sont internes ; elles ne sont pas copiées dans le dossier public `legal/`.

## Demandes d’accès, de portabilité, de correction et de suppression

1. Inscrire la demande dans un registre privé : référence, date de réception, type, échéance d’un mois et état. Ne pas mettre ce registre, les exports ou les preuves contenant des données personnelles dans GitHub.
2. Vérifier le compte via l’adresse e-mail déjà connue. Si un doute réel subsiste, demander un élément proportionné ; pas de pièce d’identité systématique. Supprimer une éventuelle copie après vérification.
3. Pour un accès ou une portabilité, réunir les données du seul demandeur : profil Neon Auth, droits d’essai et quotas, métadonnées d’adaptations, références d’abonnement, tentatives de paiement, acceptations et demandes de rétractation. Il n’existe aucun historique des textes à exporter. Exclure mots de passe, empreintes de mot de passe, jetons de session, clés API et données d’autres comptes. Fournir un JSON/CSV lisible et, pour l’accès, expliquer finalités, destinataires et conservation.
4. Transmettre de façon sécurisée à la personne identifiée. Le lien éventuel doit expirer. Supprimer l’export temporaire après livraison, au plus tard sous sept jours. Une copie des conditions sans données personnelles peut être fournie directement.
5. Pour une clôture : vérifier l’abonnement Stripe et arrêter ses renouvellements en tenant compte de la demande. Ne jamais effacer uniquement le compte puis laisser Stripe facturer. Distinguer résiliation, rétractation avec remboursement et effacement ; expliquer les conséquences à l’utilisateur.
6. Identifier d’abord les pièces justifiant une conservation légale ou contentieuse. Les minimiser et les isoler dans une archive chiffrée accessible uniquement à l’éditeur, avec finalité et date de fin. Ne pas exporter toute la base au titre d’une preuve contractuelle.
7. **Avant toute suppression, examiner les clés étrangères.** `postibou_legal_acceptances.user_id` et `postibou_withdrawal_requests.user_id` référencent `neon_auth.user` sans cascade ; les supprimer ou les archiver de façon maîtrisée avant de fermer l’identité lorsque leur conservation active n’est plus justifiée. Les réservations et droits du service doivent également être examinés. Ne pas supprimer une preuve qui doit rester archivée ni désactiver globalement les contraintes. Faire approuver la liste précise des lignes et sauvegardes concernées avant exécution. Une erreur de contrainte n’est pas une clôture réussie.
8. Révoquer les sessions et fermer l’identité Neon Auth, puis vérifier que la connexion ne redonne pas accès. Faire les demandes pertinentes aux prestataires pour les données à supprimer chez eux. Ne pas annoncer la suppression immédiate de leurs sauvegardes ; consigner leur réponse et le délai communiqué.
9. Répondre au plus tard dans le mois : action effectuée, limites motivées, destinataires contactés et droit de réclamation CNIL. En cas de complexité, notifier dans le premier mois le motif et une prolongation limitée à deux mois supplémentaires. Conserver le dossier ordinaire de droits un an après clôture, sauf justification distincte.

Le canal e-mail permet ces droits sans ajouter de questionnaire à l’inscription. Cette procédure est manuelle ; aucun outil d’effacement automatique du compte n’est prétendu.

## Revue mensuelle de conservation

Exécuter `db/retention-review.sql` dans la branche de production : requêtes SELECT uniquement, résultats agrégés. Consigner date, résultats et décisions dans le registre privé. La revue fait partie des tâches d’exploitation de l’éditeur ; elle n’est pas déclenchée automatiquement par Netlify.

- Métadonnées terminées ou remboursées : examiner les candidates de plus de 90 jours, contrôler l’absence de litige. Une réservation bloquée doit d’abord être rapprochée du compteur pour éviter de perdre un crédit à tort. Conserver les compteurs actuels même si leurs anciennes métadonnées sont supprimées.
- Checkout expiré : vérifier Stripe avant de classer « abandonné ». Le SELECT ne prouve pas l’absence de paiement. Une tentative peut avoir abouti, et la table est remplacée lors d’une nouvelle tentative : ne jamais déduire l’absence d’un contrat de la seule absence de cette ligne.
- Preuves d’acceptation : classer en contrat payé / tentative abandonnée / dossier non résolu. Une tentative sans contrat suit 90 jours après expiration ; un contrat payé suit cinq ans après sa fin. Retrouver les références Checkout, factures et abonnement Stripe avant de classer. Aucun effacement automatique sur la seule date d’acceptation.
- Compte d’essai : après 12 mois suivant la fin de l’essai, contrôler connexions récentes, demandes en cours et situation Stripe. Adresser un préavis de 30 jours à l’adresse du compte avant une fermeture pour inactivité. Ne pas fermer un compte abonné sur son seul compteur de crédits. Les candidats du SQL ne tiennent pas lieu de preuve d’inactivité dans Neon Auth.
- Contrats terminés et litiges : inscrire explicitement la date de fin dans le registre d’archives. Retirer les données de la base opérationnelle lorsque le compte est fermé, conserver seulement la preuve nécessaire en archive privée. Une procédure contentieuse documentée peut prolonger la conservation jusqu’à son issue et au délai applicable.
- Factures : 10 ans après clôture de l’exercice. Le paramétrage et l’archivage des factures restent un chantier séparé avant ouverture payante.
- Assistance : 1 an après traitement ; extraire du dossier les seules pièces relevant d’une conservation contractuelle distincte.

Aucun DELETE n’est inclus dans ce fichier ou lancé pendant ce chantier. Les données récentes ne sont pas purgées préventivement. Les restaurations d’une sauvegarde doivent réappliquer les clôtures et suppressions précédemment traitées afin de ne pas remettre en service un compte supprimé. La fenêtre de récupération Neon observée est de six heures ; elle ne démontre pas le délai d’effacement de toutes les copies internes du prestataire.

## Sécurité et incidents

Ne jamais journaliser le texte, les résultats, les mots de passe ou les secrets. Restreindre l’accès aux tableaux de bord, vérifier l’authentification forte et les habilitations. Conserver les exports hors dépôt Git et dossier public. En cas d’incident : arrêter l’exposition, préserver les éléments nécessaires, évaluer personnes/données/risques, documenter la décision et contacter les prestataires. Notifier la CNIL dans les 72 heures après connaissance lorsque la violation présente un risque ; informer les personnes sans délai indu en cas de risque élevé, sous réserve des exceptions légales. Conserver un registre privé des incidents et des mesures correctrices.

## Rétractation

La fonction fournit une preuve téléchargeable et enregistre la demande ; elle ne rembourse pas elle-même. Examiner les demandes en attente à chaque jour ouvré. Identifier le premier contrat et la date de demande ; appliquer les CGV, arrêter les échéances futures et rembourser le premier paiement sous 14 jours si la rétractation intervient dans les 14 jours de la conclusion. Ne déduire aucun prorata de crédits utilisés dans cette offre. Confirmer au client les opérations réellement effectuées et conserver la preuve minimale. Le médiateur, les factures et la confirmation durable de commande restent des conditions préalables à l’ouverture payante.
