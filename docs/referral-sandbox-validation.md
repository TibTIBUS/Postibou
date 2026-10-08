# Parrainage : validation Stripe sandbox du 8 octobre 2026

Compte isolé : `acct_1UOADR9BDDs3b0Qj`, livemode=false. Aucune clé stockée dans le dépôt, aucun paiement réel, aucune donnée fictive dans Neon. Les identifiants des trois clients, abonnements et factures de test sont conservés dans `scripts/referral-sandbox-fixtures.json`.

## Vérifié

- Coupon de test `postibou_referral_month_v1`, 100 %, once, limité au produit de test `prod_VOzNa1qUp6NCc1`.
- Nouvelle horloge `clock_1UOIUK9BDDs3b0Qjj8ykRgpn`, départ 8 octobre 2026 à 07:00 UTC.
- Trois clients fictifs distincts, carte de test tok_visa, trois abonnements actifs ; premières factures payées à 790 centimes dans Stripe test.
- Le script `validate-referral-payments-rpc.mjs` exécute réellement `qualifyReferrals` sur une base PGlite locale. Chaque lecture de facture, paiement de facture, PaymentIntent et Charge est résolue par le connecteur Stripe en mode test. Aucune clé API nécessaire au script.
- Temps local injecté pour l'assertion du délai : à J+13 aucun candidat traité ; à J+14 deux paiements vérifiés, deux parrainages validés et deux mois disponibles. Ce contrôle ne prétend pas que l'horloge Stripe a avancé.

## À vérifier

Deux vrais renouvellements à zéro, consommation unique des mois, troisième renouvellement au tarif normal, comportement du calendrier 2027, annulation et remboursements. Les tests automatisés avec Stripe simulé couvrent déjà ces cas, mais la validation avec de vrais objets Stripe sandbox n'est pas complète.

Le connecteur disponible expose la création d'horloges, sans opération d'avance trouvée dans son catalogue. Le navigateur Codex demande une connexion Stripe. L'agent Chrome connecté peut effectuer uniquement l'avance suivante.

## Prompt pour l'agent Chrome : première échéance seulement

Ouvre Stripe, environnement de test `acct_1UOADR9BDDs3b0Qj`. Vérifie le bandeau de test. Ouvre la simulation **Postibou — Parrainage : deux mois offerts**, horloge `clock_1UOIUK9BDDs3b0Qjj8ykRgpn`. Ne touche pas à l'ancienne simulation Renouvellements 2026-2027.

Vérifie les trois clients fictifs de cette simulation, notamment le parrain `cus_VP6hpwA8cEnC4p` et son abonnement `sub_1UOIUW9BDDs3b0QjyHdMWBDE`.

Avance uniquement à **8 novembre 2026, 07:00 UTC**, soit **08:00 à Paris**. Si le formulaire affiche UTC, saisis 07:00. N'avance pas une heure de plus : Codex doit appliquer les mois gratuits pendant que la facture du parrain est encore en brouillon. Si la précision horaire n'est pas disponible, arrête et rapporte les options proposées.

Attends la fin de la simulation. Rapporte le statut de l'horloge, l'heure exacte, l'identifiant et le statut de la nouvelle facture du parrain, son montant et la période facturée. N'avance pas à décembre ni à janvier. Ne finalise, ne paie, ne rembourse aucune facture. Ne modifie pas l'abonnement et ne lui attache pas manuellement le coupon. Aucun compte réel, aucune clé, aucun webhook, aucun réglage Netlify à modifier.

Cette avance n'applique pas seule le parrainage : les récompenses restent uniquement dans la base locale de test. Codex appliquera ensuite la remise avec le code de Postibou.
