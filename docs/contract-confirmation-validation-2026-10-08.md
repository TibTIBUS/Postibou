# Validation de la confirmation contractuelle

## Réalisé

- Copie immuable des CGV exactes, empreintes et récapitulatif de la facture initiale, protégée par une contrainte de base.
- Téléchargement réservé au compte propriétaire, sans cache ; l’API ne diffuse pas les e-mails ou références Stripe dans la liste.
- Adaptateur Resend réel : message texte, deux pièces jointes TXT, réponse vers l’éditeur et absence de texte d’artisan.
- Charge utile figée, idempotence, verrou concurrent et arrêt des reprises incertaines avant expiration de la clé du prestataire.
- Quota payé activé seulement après acceptation de l’envoi ; événements de cycle de vie anticipés incapables de contourner cette étape.
- Configuration d’envoi exigée avant création d’une nouvelle session de paiement, même si l’ouverture payante est activée plus tard.
- Politique de confidentialité et procédures internes mises à jour pour ce futur flux.

## Tests automatisés

La suite utilise PostgreSQL local PGlite et des réponses Stripe/Resend simulées. Elle couvre le rapprochement compte/contrat/facture, les pièces jointes exactes, l’immuabilité, les accès privés, les pannes réseau et base, les envois concurrents, les réponses perdues, la limite de reprise et l’ordre des événements. Les anciennes suites de facturation restent indépendantes du transport e-mail. Le build vérifie aussi que les CGV publiques sont identiques à la version contractuelle enregistrée.

## Non attesté à ce stade

Aucun compte Resend créé, secret d’envoi renseigné, expéditeur vérifié ou message réel envoyé. La permission Stripe de lecture des factures reste à vérifier. L’acceptation de l’API n’atteste pas la livraison en boîte ni la lecture. Le téléchargement d’un contrat payé n’a pas été exercé avec un paiement réel. Suivre `docs/confirmation-email-setup.md` avant activation.

L’abonnement public reste fermé. Le médiateur, la validation des factures et du parcours réel restent des conditions séparées ; ce chantier ne revendique aucune certification générale de conformité.
