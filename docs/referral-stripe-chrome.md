# Configuration Stripe du parrainage — prompt pour l’agent Chrome

Configure uniquement les éléments Stripe manquants pour le parrainage Postibou. Le code est déployé, mais les remises automatiques ne sont pas encore activées. La souscription payante doit rester fermée. Ne crée aucun client, paiement ou abonnement et ne modifie ni les tarifs ni les calendriers d’abonnement.

Compte réel attendu : **localiapro.fr**, `acct_1OdCU5Enc0W23lgn`. Vérifie ce compte avant toute modification. Ne touche pas aux autres applications.

## 1. Remise interne

Vérifie d’abord si le coupon `postibou_referral_month_v1` existe. S’il existe, contrôle ses paramètres sans créer de doublon. Sinon, crée ce coupon :

- Identifiant exact : `postibou_referral_month_v1`.
- Nom : `Postibou — Mois offert parrainage`.
- Réduction : **100 %**.
- Durée : **une fois**, pas indéfiniment ni un nombre de mois.
- Produit autorisé uniquement : `prod_VOog5UMGZt2LCL`, « Postibou — Abonnement mensuel ».
- Aucun code promotionnel public, aucun lien de paiement.

Si l’interface ne permet pas de définir cet identifiant exact ou la restriction au produit, arrête cette partie et rapporte le blocage. Ne crée pas un coupon approximatif : le serveur recherche cet identifiant précis.

## 2. Webhook

Ouvre **postibou-webhook**, identifiant `we_1UO1PdEnc0W23lgncGxXaulq`. Vérifie l’URL `https://postibou.netlify.app/api/stripe/webhook`.

Conserve ses sept événements actuels et ajoute uniquement **`invoice.created`** et **`invoice.voided`** s’ils manquent. Vérifie l’enregistrement des neuf événements. Ne montre pas son secret de signature et ne change pas sa version d’API.

## 3. Clé restreinte

La clé candidate est **postibou-netlify**, suffixe `eJ9U`. Confirme avec l’utilisateur qu’elle correspond bien à la clé enregistrée dans Netlify avant d’en élargir les permissions. Ne révèle, ne copie et ne remplace aucune clé.

Conserve tous les droits actuels. Vérifie les droits nécessaires : **Factures : lecture/écriture**, **Coupons : lecture**, **Paiements de facture : lecture**, **PaymentIntents : lecture**, **Charges : lecture**. Si un libellé n’existe pas, rapporte exactement les options disponibles, sans inventer un droit ni donner des permissions générales.

Avant d’appliquer une extension de permissions, présente les changements précis à l’utilisateur pour confirmation. Aucun droit d’écriture sur Coupons n’est nécessaire à la clé du site : la création du coupon est une opération de configuration distincte.

## Compte rendu

Pour chaque point, indique **Réalisé / Bloqué / À vérifier**, les paramètres effectivement constatés et les modifications enregistrées. Aucune valeur secrète. N’annonce pas le parrainage entièrement validé : Codex doit encore tester les renouvellements gratuits, leur cumul et le retour au tarif normal dans un environnement Stripe de test. Aucun paiement réel n’est nécessaire.
