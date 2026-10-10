# Postibou — cadre de pilotage

## Références vérifiées (10 oct. 2026)
- Site : https://postibou.com (200). Routes serveur aussi servies sur postibou.netlify.app.
- Dépôt : TibTIBUS/Postibou, `main` déployé automatiquement sur Netlify.
- Stripe (compte localiapro.fr, live) : prix 7,90 € (`postibou_launch_monthly_2026`) et 9,90 € (`postibou_monthly_2027`) actifs. Webhook actif sur https://postibou.netlify.app/api/stripe/webhook, 9 événements.
- Passage à 9,90 € : planning Stripe à deux phases créé au premier paiement ; première échéance à 9,90 € = première échéance tombant le 1er janv. 2027 (Paris) ou après. Les abonnés existants suivent leur propre date d'échéance.
- Essai : 7 jours, 10 adaptations, géré dans Postibou (pas dans Stripe). Abonné : 30 adaptations par période payée.
- Accès non disponibles : Neon (statistiques), Facebook/Instagram.

## Cycle 1 — fiabilité du parcours inscription → génération → abonnement
- Objectif : trouver et corriger les défauts qui touchent un client payant.
- Budget supplémentaire : 0 €.
- Agents : coordinateur (Claude), contrôle (revue de code indépendante).
- Autorisations : lecture GitHub/Netlify/Stripe, branche + pull request. Fusion sur `main` = mise en production → décision de Thibaut.
