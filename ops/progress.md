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

## Décisions attendues de Thibaut
1. Fusionner la pull request (mise en production).
2. Défaut de paiement (`past_due`) : aujourd'hui l'abonné reçoit ses 30 nouveaux crédits sans avoir payé, jusqu'à la fin des relances Stripe. Bloquer jusqu'au paiement, ou laisser comme ça ?

## Restant (non corrigé)
- Crédits perdus si la fonction de génération est coupée net (pas de nettoyage automatique des réservations bloquées).
- L'essai démarre à l'inscription, pas à la vérification de l'e-mail.
- Messages d'erreur techniques en anglais si le serveur renvoie une page d'erreur (502/504).
- Achat réel de bout en bout jamais suivi (navigateur → webhook → quota) : à observer sur le prochain abonné.

## Prochaine action
Après fusion : vérifier le déploiement Netlify, puis traiter les crédits bloqués (tâche planifiée de remboursement).
