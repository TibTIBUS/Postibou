# Mise en place juridique et facturation — 8 octobre 2026

## Livré

- Pages publiques séparées : mentions légales, conditions de l’essai et présentation de l’offre, confidentialité, rétractation ; liens depuis l’inscription, le paiement et le pied de page.
- Identité issue de Localia, sans médiateur fictif ni promesse de conformité intégrale.
- Version contractuelle téléchargeable ; le build vérifie que son contenu est identique à celui enregistré par le serveur.
- Avant une nouvelle session Stripe : acceptation explicite du document courant, sauvegarde Neon du document complet, empreinte SHA-256, version, identifiant du compte et de la tentative, tarif et horodatage. Les reprises ne remplacent pas la preuve initiale. Aucun enregistrement de l’IP.
- Rétractation : deux étapes explicites, identité du contrat obtenue côté serveur, enregistrement idempotent dans Neon et accusé daté téléchargeable. L’éditeur traite les suites et remboursements ; aucun remboursement automatique n’est annoncé. Repli par e-mail et formulaire postal.
- Adresse de facturation demandée dans Checkout. Les versions préparées ne s’appliquent pas à une ancienne session : aucune session ni abonnement n’était enregistré dans Neon lors du contrôle.

## Contrôle Stripe réel (lecture seule)

Compte acct_1OdCU5Enc0W23lgn : LOCALIA, entrepreneur individuel, France, adresse de Créances et téléphone cohérents ; paiement et versements activés. Le libellé bancaire est LOCALIA ; le contact de support Stripe diffère du contact public Postibou. Les paramètres globaux n’ont pas été modifiés car le compte sert également Localia.

Les prix réels du produit prod_VOog5UMGZt2LCL sont bien mensuels, actifs, EUR, sans essai :
- price_1UO13LEnc0W23lgnnIpKJi4k : 790 centimes, clé postibou_launch_monthly_2026.
- price_1UO13LEnc0W23lgnTxtNXNW6 : 990 centimes, clé postibou_monthly_2027.

**Correction du compte rendu précédent :** l’API indique tax_behavior = unspecified pour les deux prix, et non TTC/inclusive ni un taux de 20 %. Le code ne demande pas automatic_tax. Aucun justificatif réel Postibou n’existe encore : on ne peut donc pas déclarer la facture conforme à partir de ces seuls réglages. Le régime public déclaré est la franchise de TVA, article 293 B du CGI.

## Prérequis d’ouverture payante

PAID_LAUNCH_READY reste faux dans netlify/functions/legal-policy.mjs. Cette fermeture est appliquée à la fois côté serveur et dans l’interface ; les essais gratuits et la gestion d’un abonnement existant restent opérationnels. L’injection true dans les fabriques est uniquement destinée aux tests.

1. Thibaut a confirmé qu’aucun médiateur n’est conventionné : choisir et signer une convention, puis intégrer nom, adresse et site du médiateur. Aucune convention ne peut être annoncée ni souscrite sans lui.
2. Finaliser les CGV de vente, l’encart réglementaire des garanties numériques, les mentions d’immatriculation/hébergeur manquantes et les procédures/durées de conservation et garanties de transfert.
3. Vérifier une facture représentative : identité EI, numérotation, date, description/période, nom et adresse du client, total 7,90/9,90, absence de TVA facturée et mention exacte « TVA non applicable, art. 293 B du CGI ». Configurer un modèle de facture propre à Postibou ou contrôler l’effet sur les autres services Localia avant de modifier le compte global.
4. Vérifier la confirmation contractuelle sur support durable. La preuve Neon avant paiement ne remplace pas la confirmation de contrat après achat. La rétractation propose un fichier durable mais le parcours de réception/envoi et le traitement effectif des remboursements doivent être validés avant ouverture. Aucun canal d’e-mail transactionnel n’a été configuré.
5. Activer le paiement seulement après ces vérifications et valider une transaction de bout en bout Stripe → webhook Netlify → Neon. Aucun paiement réel n’a été réalisé. Les renouvellements 2026–2027 et l’expiration des crédits sont validés dans le sandbox, avec événements Stripe authentiques rejoués localement ; cela ne valide pas le transport du webhook réel.

Lors d’une nouvelle version, conserver les fichiers historiques et les preuves, créer un nouveau document et un nouvel identifiant de version ; ne jamais réécrire une version acceptée.

Références : Service-Public F33338 (médiation), Code de la consommation L221-21 (rétractation en ligne à compter du 19 juin 2026), D211-4 et son annexe (garanties numériques), CNIL information des personnes ; voir aussi launch-audit-2026-10-08.md.
