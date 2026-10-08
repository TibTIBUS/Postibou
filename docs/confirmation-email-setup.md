# Confirmation durable de souscription — activation

État au 8 octobre 2026 : code intégré, envoi réel non validé. La souscription demeure fermée (`PAID_LAUNCH_READY=false`). Aucun compte Resend, domaine vérifié ou secret d’envoi n’a été créé par ce chantier.

## Ce que fait le code

Après un Checkout payé et signé par Stripe, le serveur rapproche le compte, la preuve de CGV et la facture initiale. Il enregistre une confirmation immuable, puis confie l’e-mail à Resend **avant** d’activer le quota payé. Le message contient deux pièces jointes TXT : récapitulatif complet et copie exacte des CGV acceptées, incluant le formulaire de rétractation. La confirmation se télécharge aussi dans « Mon compte ». L’e-mail est adressé au compte vérifié, pas à une adresse modifiée dans la facturation Stripe. Aucun texte d’artisan ni résultat de génération n’est transmis à Resend.

Un abonnement produit une confirmation initiale ; les factures de renouvellement restent un flux Stripe distinct. La confirmation ne remplace pas une facture comptable. Les événements de renouvellement ne peuvent pas activer une nouvelle souscription avant son Checkout confirmé.

## Configuration, pas à pas

1. Ouvrir [Resend](https://resend.com). Créer ou choisir le compte de l’éditeur. Lors d’une création, l’éditeur doit lire et accepter les conditions applicables ; conserver le DPA applicable dans son dossier privé. Ne pas présenter cette acceptation comme déjà effectuée.
2. Dans **Domains**, ajouter un sous-domaine que l’éditeur contrôle, par exemple `notifications.localiapro.fr`. Cette proposition ne prouve pas l’accès au DNS. Recopier uniquement les enregistrements de vérification, SPF et DKIM fournis par Resend dans le gestionnaire DNS. Ne pas remplacer les MX ou les enregistrements de la messagerie principale. Si un enregistrement demandé utilise un nom dédié de retour des messages, vérifier ce nom avant de le créer. Attendre le statut **Verified**.
3. Dans les réglages du domaine, désactiver le suivi des ouvertures et des liens. Le code n’ajoute aucun outil de suivi, mais les options du fournisseur doivent aussi être contrôlées.
4. Choisir une adresse sur ce domaine vérifié, par exemple `postibou@notifications.localiapro.fr`. Les réponses sont dirigées par le code vers `gestion.localia@gmail.com`. Ne pas employer l’adresse Gmail comme expéditeur Resend.
5. Dans **API Keys**, créer une clé limitée à l’envoi et à ce domaine si les options du compte le permettent. La copier directement dans Netlify, jamais dans une conversation, le dépôt ou un compte rendu.
6. Netlify → projet **postibou** → **Environment variables** : ajouter `RESEND_API_KEY`, valeur secrète, contexte Production, portée Functions. Ajouter `POSTIBOU_EMAIL_FROM`, contenant uniquement l’adresse d’expéditeur vérifiée, sans nom ni chevrons. Ces noms sont lus côté serveur ; aucun secret n’est fourni au navigateur.
7. Dans Stripe, vérifier que la clé restreinte utilisée par Postibou autorise aussi **Invoices / Factures : lecture**, en plus des droits déjà nécessaires à Checkout, Customers, Subscriptions, Subscription Schedules, Customer portal et Prices. L’intégration lit la facture initiale pour figer le montant réellement payé et ses dates. Ne pas afficher ni transmettre la clé dans le compte rendu.
8. Relancer un déploiement Netlify après configuration. Vérifier uniquement les noms des variables, leurs contextes et portées dans le compte rendu.
9. Effectuer un essai d’envoi à une adresse expressément autorisée par l’éditeur, avec des données fictives. Vérifier la réception, les deux pièces jointes lisibles, le Reply-To et l’absence de suivi. Aucun message de test n’a été envoyé par ce chantier. La validation automatisée utilise un transport simulé.
10. Valider séparément le parcours complet en environnement Stripe de test, avec les prix et clés de cet environnement. Les prix du code actuel sont ceux du compte réel ; ne pas réutiliser leurs identifiants en test. Les anciens scripts de renouvellement sont des tests de facturation uniquement, ils ne valident pas l’e-mail. Aucun paiement réel n’est nécessaire à ces vérifications.

Le médiateur et les factures restent à régler avant l’ouverture payante. Configurer l’e-mail ne doit pas activer à lui seul `PAID_LAUNCH_READY`.

## Reprises et surveillance

Le webhook échoue si l’envoi ne peut pas être confirmé ; Stripe peut alors le rejouer. Le document et le corps d’e-mail sont figés avant l’envoi. Une clé d’idempotence stable et un verrou de deux minutes empêchent les envois concurrents et les doublons pendant la fenêtre du prestataire. L’état `sent` signifie **accepté par l’API Resend**, pas « lu » ou nécessairement livré dans la boîte de réception. Vérifier les échecs et rebonds dans Resend et traiter l’adresse avec le client.

Examiner à chaque jour ouvré les événements Stripe en erreur et les confirmations `needs_review`. Après 23 heures depuis la première tentative incertaine, le code cesse les renvois automatiques pour ne pas dépasser la fenêtre d’idempotence annoncée de 24 heures. Il n’existe pas de tâche planifiée Resend ni de promesse de reprise infinie.

Pour un état incertain : rapprocher la référence de confirmation, les journaux Resend et la clé d’idempotence. Si une acceptation est démontrée, conserver son identifiant et remettre le suivi dans l’état confirmé avec une procédure contrôlée, puis rejouer l’événement Stripe. Si aucun envoi n’a été accepté, préparer une reprise contrôlée avec la même pièce contractuelle, après vérification de l’absence de doublon. **Ne pas remettre aveuglément à zéro la date de première tentative ni modifier le document ou le corps figé.** Un rebond nécessite une prise de contact et, le cas échéant, une nouvelle remise documentée ; l’acceptation initiale ne doit pas être falsifiée.

Les copies et journaux du fournisseur suivent sa politique de conservation. La preuve contractuelle Postibou suit cinq ans après la fin du contrat, avec archivage limité et privé selon `docs/legal/operations.md`. Ne pas copier les confirmations contenant des données personnelles dans GitHub.

## Sources vérifiées

- [Resend : envoi et pièces jointes](https://resend.com/docs/api-reference/emails/send-email), [idempotence](https://resend.com/docs/dashboard/emails/idempotency-keys), [vérification du domaine](https://resend.com/docs/dashboard/domains/introduction).
- [Offre gratuite](https://resend.com/pricing) consultée le 8 octobre 2026 : 3 000 e-mails par mois, limite de 100 par jour. Vérifier les conditions avant activation ; une confirmation utilise un e-mail, pas une adaptation IA.
- [Sécurité et stockage aux États-Unis](https://resend.com/security), [DPA](https://resend.com/legal/dpa).
- Code de la consommation L. 221-13 : remise de la confirmation sur support durable avant exécution du service.
