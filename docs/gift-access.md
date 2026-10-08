# Accès offert sans abonnement

Les offres nominatives sont conservées exclusivement dans Neon (table `postibou_gifts`), pas dans les fichiers publics. Elles sont attribuées à une adresse normalisée et à un compte dont Neon a vérifié cette adresse. Le premier compte vérifié est lié à l’offre ; une recréation de compte ne réinitialise pas les crédits.

Pour l’offre de lancement : du 1er octobre 2026 à 00:00 Europe/Paris au 1er janvier 2027 à 00:00 Europe/Paris exclus. Chaque mois civil apporte 30 adaptations, sans report. La période est calculée côté serveur en Europe/Paris. Les réservations concurrentes ne dépassent pas 30 ; une erreur IA rembourse une seule fois et ne restitue pas un crédit dans un mois ultérieur.

L’accès ne crée ni client, ni abonnement, ni facture Stripe. Pendant une offre active, Checkout est bloqué pour éviter un abonnement involontaire. À expiration, les générations sont bloquées et l’utilisateur peut décider de souscrire. Aucun prélèvement automatique.

Un abonnement Stripe actif conserve la priorité et ses quotas de facturation. Les essais, offres gratuites et abonnements utilisent des compteurs séparés. Le parcours des codes promotionnels à saisir dans Checkout est une fonctionnalité distincte ; il n’est pas activé par cette migration.
