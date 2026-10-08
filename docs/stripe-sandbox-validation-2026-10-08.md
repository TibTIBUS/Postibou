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

- Le blocage initial de création d’horloge (403) a été résolu après rattachement du sandbox et autorisation CLI. Les renouvellements, crédits et fin d’accès sont maintenant vérifiés ci-dessous.
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

## Reprise avec horloge — préparation initiale

Le sandbox est désormais réclamé. L’autorisation CLI reçue est limitée au compte `acct_1UOADR9BDDs3b0Qj`, mode test. La lecture API confirme le client `cus_VP00dp0JNmXu2x`, `livemode=false`, rattaché à l’horloge `clock_1UOC0B9BDDs3b0QjJNJOyXWH`, état ready. L’API indique un temps gelé de 1791442804 (8 octobre 2026 à 07:00:04 UTC).

La fonction Checkout réelle, avec prix de test et PostgreSQL en mémoire, a créé `cs_test_a1w0FIq6UGS9bKQkVreQRc7itYRksieztoDr4bKz4JE6Sm1iFrKzLKqflE`. Le formulaire affiche Sandbox et 7,90 €/mois, avec carte fictive 4242. La soumission par l’agent a été refusée par le contrôle automatique du navigateur, qui exige la validation finale par l’utilisateur même en sandbox. Aucun paiement n’est déclaré réussi et l’horloge n’a pas été avancée par cette reprise.

Deux scripts manuels sont préparés : `validate-stripe-clock.mjs` crée le Checkout et refuse les doublons ; `validate-stripe-renewals.mjs` attend le paiement terminé, puis prévoit les renouvellements novembre/décembre à 790 centimes, janvier/février à 990 centimes, les trente crédits renouvelés et la fin d’accès après résiliation. Ces scripts étaient initialement préparés sans exécution complète ; les résultats de leur exécution sont consignés dans la section suivante. Il utilise des événements Stripe authentiques rejoués avec une signature locale, pas une livraison réseau en production.

Variables privées : POSTIBOU_CLOCK_CREDENTIALS (fichier d’autorisation CLI, projet postibou-test), POSTIBOU_CLOCK_FIXTURES (créé par le premier script, URL comprise), POSTIBOU_CLOCK_REPORT (rapport final du second). Aucun de ces fichiers ne doit être publié. Exécution Node avec proxy de l’environnement si requis. Ne pas relancer la création pour la session déjà préparée.

## Renouvellements et fin d’accès — vérifiés le 8 octobre 2026

Abonnement de test : `sub_1UOCz99BDDs3b0QjP6BgVGjy`. Calendrier créé par le webhook Postibou : `sub_sched_1UOD0d9BDDs3b0QjiBBkvego`. Le client et les prix sont ceux du sandbox décrit ci-dessus ; aucun paiement réel et aucun changement de Neon ou Netlify production.

| Échéance simulée | Facture Stripe réellement payée en test | Montant | Crédits après traitement |
|---|---|---|---|
| 8 octobre 2026 — souscription | in_1UOCz79BDDs3b0QjC7syUKUo | 7,90 € | Activation vérifiée par le scénario précédent ; ici paiement confirmé |
| 8 novembre 2026 | in_1UOD1S9BDDs3b0QjOFnTRuBb | 7,90 € | 30 |
| 8 décembre 2026 | in_1UOD2e9BDDs3b0QjoXNXtrwg | 7,90 € | 30 |
| 8 janvier 2027 | in_1UOD419BDDs3b0QjLBGrV3Mw | 9,90 € | 30 |
| 8 février 2027 | in_1UOD5Q9BDDs3b0QjoXhNxeGs | 9,90 € | 30 |

Avant chacun des quatre renouvellements, le scénario met les trente crédits précédents à zéro restant dans la base isolée. Le rejeu signé local de l’événement authentique `invoice.paid` active la nouvelle période et rétablit trente crédits. Le rejeu répété est reconnu comme doublon. Le tarif à 9,90 € est ainsi contrôlé au premier renouvellement de 2027 et à celui du mois suivant.

La fonction de résiliation Postibou retourne 200 avec fin le 8 mars 2027 à 07:00:04 UTC. Le contrôle avant échéance confirme l’accès actif et la résiliation programmée. Un timeout réseau de 20 secondes interrompt le script lors du dernier avancement : une reprise en lecture constate que Stripe a bien avancé l’horloge, évitant de refaire cette mutation.

`scripts/finish-stripe-clock.mjs` termine ce contrôle sans créer d’abonnement ni de paiement : abonnement `canceled`, horloge ready au 8 mars 2027 à 09:00:04 UTC, cinq factures seulement, toutes payées (trois à 790 centimes et deux à 990). Aucune nouvelle facture en mars. L’événement authentique `evt_1UOD7M9BDDs3b0QjberdV7uo` de suppression d’abonnement est rejoué localement dans une base isolée remappée au même client : le webhook retourne 200, puis l’API usage indique accès inactif et zéro crédit restant. La base du premier processus étant en mémoire, cette reprise vérifie la transition de fin séparément ; elle ne prétend pas restaurer une base persistante.

Les scripts sauvegardés disposent désormais d’un timeout plus tolérant, de checkpoints et d’une garde empêchant de rejouer tout le scénario sur une horloge déjà avancée. Leur syntaxe est contrôlée. Ces améliorations du harness sont postérieures au premier parcours réussi des renouvellements ; elles ne changent aucun export de production.

### Limites restantes

Ces résultats vérifient Stripe en sandbox et les fonctions serveur avec PostgreSQL isolé, identité synthétique et rejeu local signé. Ils ne prouvent pas la livraison réseau Stripe → Netlify → Neon en production, ni le parcours complet Neon Auth. Un renouvellement refusé en cours d’abonnement n’est pas couvert par ce scénario ; le refus de paiement initial a été testé précédemment. La fiscalité et les mentions de facture en production restent à contrôler pour correspondre à la franchise en base déclarée par Localia.
