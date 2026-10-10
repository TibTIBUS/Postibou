# Suivi — cycle 1 fiabilité

## Terminé
- 114 tests automatisés passent (111 existants + 3 nouveaux), build OK.
- Site et route webhook en ligne vérifiés.
- Stripe live vérifié en lecture : 1 abonné réel (depuis le 8 oct.), planning correct (7,90 € jusqu'au 8 janv. 2027, puis 9,90 €).
- Corrections préparées sur la branche `fix/fiabilite-cycle1` :
  1. Le planning tarifaire ne peut plus être raccourci quand l'activation est relancée après un renouvellement (risque : facturer 9,90 € dès décembre).
  2. Bascule tarifaire calculée sur la date réelle (heure de Paris).
  3. `?billing=success` retiré de l'adresse après activation (évite les relances depuis un favori).
  4. Affichage des crédits restants d'un abonné corrigé (restait bloqué à 30).

- PR #19 fusionnée et en ligne le 10 oct. 2026 (vérifié sur postibou.com).
- Décision de Thibaut (10 oct.) : bloquer le nouveau quota tant qu'un renouvellement est impayé. Correction sur la branche `fix/defaut-paiement`.

- PR #20 (défaut de paiement) fusionnée et en ligne le 10 oct. 2026 (vérifié sur postibou.com).
- Crédits bloqués : remboursés automatiquement après 10 min, à l'ouverture du compte ou à la génération suivante (branche `fix/credits-bloques`). Pas de tâche planifiée, pour ne pas réveiller la base Neon gratuite.

## Décisions attendues de Thibaut
1. Fusionner la PR « Rendre les crédits des générations interrompues ».

## Restant (non corrigé)
- L'essai démarre à l'inscription, pas à la vérification de l'e-mail.
- Messages d'erreur techniques en anglais si le serveur renvoie une page d'erreur (502/504).
- Achat réel de bout en bout jamais suivi (navigateur → webhook → quota) : à observer sur le prochain abonné.

- À confirmer sans accès Neon : la colonne `created_at` de `postibou_adaptation_reservations` en production (utilisée par db/retention-review.sql). Si elle manque, le nettoyage ne fait rien mais ne bloque rien.

## Prochaine action
Après fusion : vérifier la mise en ligne. Cycle fiabilité alors bouclé ; proposer le cycle suivant (acquisition).
