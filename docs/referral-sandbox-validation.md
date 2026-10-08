# Parrainage : validation Stripe sandbox du 8 octobre 2026

Compte isolé : `acct_1UOADR9BDDs3b0Qj`, livemode=false. Aucune clé stockée dans le dépôt, aucun paiement réel, aucune donnée fictive dans Neon. Les identifiants des trois clients, abonnements et factures de test sont conservés dans `scripts/referral-sandbox-fixtures.json`.

## Vérifié

- Coupon de test `postibou_referral_month_v1`, 100 %, once, limité au produit de test `prod_VOzNa1qUp6NCc1`.
- Nouvelle horloge `clock_1UOIUK9BDDs3b0Qjj8ykRgpn`, départ 8 octobre 2026 à 07:00 UTC.
- Trois clients fictifs distincts, carte de test tok_visa, trois abonnements actifs ; premières factures payées à 790 centimes dans Stripe test.
- Le script `validate-referral-payments-rpc.mjs` exécute réellement `qualifyReferrals` sur une base PGlite locale. Chaque lecture de facture, paiement de facture, PaymentIntent et Charge est résolue par le connecteur Stripe en mode test. Aucune clé API nécessaire au script.
- Temps local injecté pour l'assertion du délai : à J+13 aucun candidat traité ; à J+14 deux paiements vérifiés, deux parrainages validés et deux mois disponibles. Ce contrôle ne prétend pas que l'horloge Stripe a avancé.

## À vérifier

Les deux renouvellements à zéro et le troisième renouvellement payé à 9,90 € sont désormais vérifiés dans ce scénario. Le comportement du calendrier automatique 2027, l'annulation, les remboursements et le parcours complet site/webhooks/base restent à vérifier avec de vrais objets Stripe sandbox. Les tests automatisés avec Stripe simulé couvrent ces cas complémentaires. Les abonnements fictifs de ce scénario ont été créés directement à 7,90 € sans calendrier 2027, puis celui du parrain a été préparé manuellement au prix de 9,90 € ; ils ne permettent donc pas de confirmer seuls le changement de prix automatique du parcours Checkout.

Le connecteur disponible expose la création d'horloges, sans opération d'avance trouvée dans son catalogue. Le navigateur Codex demande une connexion Stripe. L'agent Chrome connecté peut effectuer uniquement l'avance suivante.

## Prompt pour l'agent Chrome : première échéance seulement

Ouvre Stripe, environnement de test `acct_1UOADR9BDDs3b0Qj`. Vérifie le bandeau de test. Ouvre la simulation **Postibou — Parrainage : deux mois offerts**, horloge `clock_1UOIUK9BDDs3b0Qjj8ykRgpn`. Ne touche pas à l'ancienne simulation Renouvellements 2026-2027.

Vérifie les trois clients fictifs de cette simulation, notamment le parrain `cus_VP6hpwA8cEnC4p` et son abonnement `sub_1UOIUW9BDDs3b0QjyHdMWBDE`.

Avance uniquement à **8 novembre 2026, 07:00 UTC**, soit **08:00 à Paris**. Si le formulaire affiche UTC, saisis 07:00. N'avance pas une heure de plus : Codex doit appliquer les mois gratuits pendant que la facture du parrain est encore en brouillon. Si la précision horaire n'est pas disponible, arrête et rapporte les options proposées.

Attends la fin de la simulation. Rapporte le statut de l'horloge, l'heure exacte, l'identifiant et le statut de la nouvelle facture du parrain, son montant et la période facturée. N'avance pas à décembre ni à janvier. Ne finalise, ne paie, ne rembourse aucune facture. Ne modifie pas l'abonnement et ne lui attache pas manuellement le coupon. Aucun compte réel, aucune clé, aucun webhook, aucun réglage Netlify à modifier.

Cette avance n'applique pas seule le parrainage : les récompenses restent uniquement dans la base locale de test. Codex appliquera ensuite la remise avec le code de Postibou.

## Premier mois offert confirmé

L'agent Chrome a avancé l'horloge au 8 novembre 2026 à 07:00 UTC, puis laissé la facture `in_1UOIcf9BDDs3b0QjLwi9bKmm` en brouillon à 790 centimes, période du 8 novembre au 8 décembre.

Le script RPC appelle réellement `applyReferralMonth`, avec les identifiants du produit et des prix sandbox injectés côté serveur. Les valeurs de production par défaut restent inchangées ; aucune requête utilisateur ne peut fournir ces options.

Lectures effectuées dans Stripe test : factures initiales des deux filleuls, leurs InvoicePayments, PaymentIntents et Charges ; coupon avec expansion `applies_to` ; facture du parrain avec expansion `discounts`. L'appel de mise à jour Stripe est produit par le code du parrainage. La remise ramène le total et le montant dû à zéro. Une nouvelle tentative n'ajoute aucune remise et ne consomme pas le second mois. La facture est ensuite finalisée en test : statut `paid`, montant payé zéro. Le code de règlement marque un seul mois utilisé. Compteurs locaux : un utilisé, un disponible, zéro réservé.

L'identifiant d'idempotence demandé par le code est vérifié dans le pont RPC ; ce pont ne transmet pas cet en-tête à l'outil MCP. Les pannes réseau et garanties d'idempotence de transport restent couvertes par les tests automatisés, pas attestées par ce scénario MCP sans panne.

Le journal de consommation fictif est conservé dans `scripts/referral-sandbox-ledger.json` pour reprendre le scénario sans offrir à nouveau un mois déjà utilisé. Aucun utilisateur ou paiement réel n'y figure. Ne pas réinitialiser ce fichier pour les prochains renouvellements de cette simulation.

## Prompt suivant : deuxième échéance seulement

Dans Stripe, environnement de test `acct_1UOADR9BDDs3b0Qj`, ouvre uniquement la simulation **Postibou — Parrainage : deux mois offerts**, `clock_1UOIUK9BDDs3b0Qjj8ykRgpn`.

Avance exactement au **8 décembre 2026 à 07:00 UTC**, soit **08:00 à Paris**, puis attends le statut Prêt. N'avance pas une heure de plus et n'avance pas à janvier : Codex doit appliquer le second mois pendant que la nouvelle facture est encore en brouillon.

Rapporte l'identifiant, le statut, le montant et la période de la nouvelle facture du parrain `cus_VP6hpwA8cEnC4p`, abonnement `sub_1UOIUW9BDDs3b0QjyHdMWBDE`. Ne finalise, ne paie et ne rembourse aucune facture ; n'applique aucun coupon et ne modifie aucun abonnement, clé, webhook ou compte réel.

## Deuxième mois offert confirmé

L'horloge a été avancée par l'agent Chrome au 8 décembre 2026 à 07:00 UTC. La facture `in_1UOIyF9BDDs3b0QjhqJTp6jb`, initialement en brouillon à 790 centimes, est passée à zéro par `applyReferralMonth`, puis a été finalisée payée à zéro en Stripe test. Une nouvelle tentative n'ajoute pas de remise et ne consomme aucun autre mois. Le règlement est enregistré par `settleReferralInvoice` dans le journal local : deux mois utilisés, aucun disponible, aucun réservé.

Après règlement de cette facture, le seul abonnement fictif du parrain est passé au prix sandbox `price_1UOBPT9BDDs3b0QjuQEiELdj` (990 centimes), avec `proration_behavior=none`, sans déplacement des dates du cycle. Cela prépare le contrôle de la reprise de facturation après les mois gratuits. **Ce changement est manuel, en sandbox : il ne prouve pas le calendrier automatique de prix 2027 du parcours Checkout.**

## Prompt suivant : reprise de la facturation

Dans Stripe, uniquement l'environnement de test `acct_1UOADR9BDDs3b0Qj`, ouvre la simulation **Postibou — Parrainage : deux mois offerts**, `clock_1UOIUK9BDDs3b0Qjj8ykRgpn`.

L'horloge doit être au 8 décembre 2026 à 07:00 UTC. Avance au **8 janvier 2027 à 08:00 UTC**, soit **09:00 à Paris**, et attends Prêt. Cette heure laisse le renouvellement de 07:00 se finaliser automatiquement avec la carte fictive. Il n'y a plus de mois offert à appliquer.

Rapporte pour le parrain `cus_VP6hpwA8cEnC4p`, abonnement `sub_1UOIUW9BDDs3b0QjyHdMWBDE`, l'identifiant de la facture de janvier, son statut, le total, le montant payé, le montant restant et les remises affichées. Montant attendu : 9,90 €, sans coupon de parrainage. Si elle n'est pas encore payée, n'avance pas davantage et rapporte son état exact. Ne paie et ne finalise rien manuellement. Aucun autre abonnement ou réglage à modifier.

Codex exécutera ensuite le script avec les arguments fixture, facture de janvier et `exhausted`. Ce mode interdit une nouvelle remise et vérifie le paiement de 990 centimes, les deux mois consommés et l'absence de remise sur la nouvelle facture.

## Reprise de facturation confirmée

L'agent Chrome a avancé l'horloge au 8 janvier 2027 à 08:00 UTC. La facture `in_1UOJAm9BDDs3b0Qj88R7TEqW`, période du 8 janvier au 8 février, est payée à 990 centimes sans remise et sans métadonnée de consommation de parrainage. Le solde restant (`amount_remaining`) est zéro ; `amount_due` conserve le montant initial de 990 centimes même après paiement et ne désigne pas le solde.

Le contrôle `exhausted` a été exécuté sur cette facture avec le journal des deux mois utilisés : zéro écriture Stripe, zéro remise supplémentaire, deux mois utilisés, zéro disponible et zéro réservé. Le scénario de cumul puis épuisement des deux mois offerts est validé avec de vrais objets Stripe sandbox et une base d'application locale isolée.

Limites : ce scénario ne valide pas la livraison des webhooks au site Netlify, les écritures dans Neon production, les quotas et e-mails réels après souscription, ni le calendrier automatique de prix 2027 (prix sandbox préparé manuellement). La souscription payante reste fermée jusqu'aux vérifications du parcours complet.
