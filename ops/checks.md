# Contrôles

| Tâche | Critère | Verdict | Preuve |
|---|---|---|---|
| Suite de tests | 0 échec | validé | `npm test` : 117/117, 10/10/2026 |
| Build | `dist` généré | validé | `node scripts/build.mjs` |
| Site en ligne | HTTP 200 | validé | GET https://postibou.com/ |
| Route webhook | pas de redirection | validé | POST sans signature → 400 |
| Webhook Stripe | actif, bonne URL | validé | Stripe live, we_1UO1Pd… `enabled` |
| Prix Stripe | 790 et 990 actifs | validé | Stripe live, liste des prix |
| Planning abonné réel | 9,90 € à partir de 2027 | validé | sub_sched_1UOLlg… : phase 2 au 08/01/2027 |
| Relance d'activation | planning non raccourci | validé (branche) | tests/launch-schedule.test.mjs |
| Bascule heure de Paris | échéance 1er janv. 00h30 à 9,90 € | validé (branche) | tests/launch-schedule.test.mjs |
| Affichage crédits abonné | reflète le compteur | non résolu | correction appliquée, pas de test dédié |
| Défaut de paiement | pas de crédits sans paiement | validé (branche) | tests/payment-failed.test.mjs : échoue sans la correction, passe avec |
| Crédits bloqués | remboursés après coupure | échoué | revue contrôle (raisonnement) |
| Achat réel bout en bout | suivi complet | non résolu | jamais exercé |
