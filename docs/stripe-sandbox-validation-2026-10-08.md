# Validation Stripe du 8 octobre 2026

## Périmètre

Sandbox Stripe anonyme isolé `acct_1UOADR9BDDs3b0Qj`, sans paiements réels, sans modification des clés de production ni de Neon production. Les fonctions serveur du projet sont appelées avec des prix de test injectés par leur factory et une base PostgreSQL PGlite en mémoire. Les exports de production conservent leurs prix réels.

## Résultats observés

- Deux demandes successives à la fonction Checkout retournent la même session Stripe et la même URL.
- Le Checkout hébergé affiche 7,90 €/mois et la mention sandbox sans paiement réel.
- La carte fictive de refus est rejetée. Le compte de test conserve son essai de 7 jours et ses 10 crédits.
- La carte fictive de réussite produit une session `complete`, `payment_status=paid`, `livemode=false` et un abonnement Stripe actif.
- L'événement réel `checkout.session.completed` est récupéré depuis l'API Stripe et rejoué avec une signature locale dans la fonction webhook. Le traitement retourne 200 et ouvre 30 crédits dans la base isolée. Ce rejeu ne constitue pas une livraison réseau du webhook de production.
- Stripe accepte le calendrier : 7,90 € du 8 octobre 2026 au 8 janvier 2027 ; prix de 9,90 € à partir du renouvellement du 8 janvier. Le calendrier a `end_behavior=release`.
- Le rejeu du même événement retourne `duplicate=true`.
- La fonction de résiliation retourne 200 deux fois. Stripe confirme un calendrier à une seule phase, `end_behavior=cancel`, fin le 8 novembre 2026 à 07:17:41 UTC. La future phase à 9,90 € est retirée.
- Après demande de résiliation, le compte de test reste actif avec ses 30 crédits jusqu'à cette échéance.
- 47 tests automatisés passent ; la compilation de l'interface passe.

## Points non validés

- La création d'une horloge de test est refusée (403) avec la clé du sandbox non réclamé. Le renouvellement effectivement facturé à 9,90 €, le renouvellement des crédits et la fin réelle de l'accès après résiliation restent à simuler après rattachement du sandbox.
- Le listener CLI reçoit les événements Stripe, mais ne parvient pas à joindre le serveur localhost dans cette exécution. La signature et la logique du webhook ont été vérifiées par rejeu local ; la livraison Stripe → Netlify → Neon en production n'a pas été testée par ce scénario.
- Ce scénario utilise une identité vérifiée synthétique ; il ne constitue pas un test complet de connexion Neon Auth dans le navigateur.

## Reproduire la vérification des fonctions

`scripts/validate-stripe-sandbox.mjs` attend trois chemins privés dans l'environnement :

- `POSTIBOU_STRIPE_SANDBOX_FILE` : JSON contenant `secret_key`, obligatoirement une clé Stripe test.
- `POSTIBOU_STRIPE_SANDBOX_FIXTURES` : JSON `{ "customer": "cus_…", "prices": { "launch": "price_…", "standard": "price_…" } }`, contenant uniquement un client synthétique et les deux prix mensuels EUR 790/990 du sandbox.
- `POSTIBOU_STRIPE_SANDBOX_EVENT` : événement réel `checkout.session.completed` du paiement test, téléchargé via l'API Stripe. Le `client_reference_id` doit correspondre à l'utilisateur fictif du helper de test.

Exécuter `node scripts/validate-stripe-sandbox.mjs` avec ces variables configurées. Le script appelle Stripe, rejoue l'événement localement, vérifie le calendrier puis résilie l'abonnement de la fixture en fin de période. Utiliser un abonnement test neuf, actif et non résilié. Le script n'utilise pas `DATABASE_URL` et refuse les clés/prix/clients en mode réel. Les secrets et les fichiers privés ne doivent jamais être ajoutés au dépôt.

## Suite prévue

Terminer les tests avec horloge Stripe dans un sandbox rattaché. Ensuite examiner les mentions légales, les conditions d'abonnement et la confidentialité à partir des sources officielles françaises et des renseignements réels de l'éditeur. La page actuelle « Informations et confidentialité » est une page de préversion ; elle ne remplace pas les documents définitifs.
