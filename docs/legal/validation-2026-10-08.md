# Validation du chantier CGV et confidentialité

8 octobre 2026. Périmètre : textes du point 2 ; médiateur explicitement reporté.

- Nouvelle version `2026-10-08-v2`, ancienne version du 8 octobre conservée intacte.
- Texte téléchargeable égal au document de preuve côté serveur ; vérification bloquante au build.
- CGV : publics professionnel / association / particulier, service classique et Sublimer à un crédit, essai 7 jours / 10 adaptations sans conversion automatique, 30 crédits mensuels, prix 2026/2027, résiliation, droit de rétractation et garanties du service numérique.
- Politique : finalités et bases, nécessité des données, destinataires, Francfort / Ohio et transferts, durées, droits et contact, cookies nécessaires, limites concernant la rétention des fournisseurs d’IA.
- Procédures d’exploitation : droits, exports minimisés, arrêt des renouvellements lors d’une clôture, archives, contraintes FK, revue mensuelle, incidents et demandes de rétractation.
- `npm run build` réussi ; 60 tests réussis après mise à jour des fixtures pour importer la version courante des CGV.
- Revue SQL de production exécutée en lecture seule : zéro candidate dans les six catégories (métadonnées échues, réservations bloquées, Checkout expirés, essais anciens, preuves à classer, rétractations en attente). Aucun compte ni aucune donnée supprimés.
- `PAID_LAUNCH_READY` reste `false` ; aucun abonnement ou paiement créé par ce chantier.

L’offre préparée prévoit un remboursement intégral du premier paiement pour une rétractation dans les 14 jours, même si des crédits ont été utilisés ; aucun renoncement ni prorata n’est demandé. Ce choix doit être respecté dans le traitement des demandes après ouverture.

La médiation, la confirmation durable de commande, les factures et la validation complète du paiement réel restent des chantiers distincts. Cette validation ne certifie pas la conformité globale, ne constate pas une signature individuelle de tous les documents fournisseurs et ne prétend pas que la revue mensuelle est automatisée.
