# Parrainage Postibou — 8 octobre 2026

## Offre et parcours

Un nouveau client volontairement rattaché à un parrain avant toute tentative Checkout rapporte un mois gratuit à ce parrain après son premier paiement effectif et au moins quatorze jours, sans rétractation, remboursement, avoir ou contestation détectés. L’inscription seule et un premier mois totalement gratuit ne rapportent rien. Un seul parrain est attaché à chaque compte nouvellement créé (moins de sept jours). L’activation volontaire et la version des règles sont conservées. L’auto-parrainage par même compte ou même e-mail vérifié est refusé ; ces protections ne constituent pas une preuve d’identité civile et ne suffisent pas à détecter tous les comptes artificiels.

Le compte affiche uniquement des totaux, jamais l’identité ou les coordonnées des filleuls. Lien opaque, bouton copier/partager, badges symboliques à 1, 3 et 5, progression vers le prochain badge. L’utilisateur partage lui-même son lien. La conservation en sessionStorage pendant au plus sept jours pour le retour Google est facultative et activée par une case explicite ; aucun accès aux contacts, tracking publicitaire ni e-mail d’invitation automatique.

Les mois se cumulent sans plafond annoncé, sans conversion monétaire. Un mois couvre une prochaine facture mensuelle de renouvellement Postibou et fournit le quota habituel de 30 adaptations. La remise de 100 % vaut aux tarifs 7,90 € et 9,90 €. Les compteurs et calendriers tarifaires restent inchangés. Une période déjà gratuite ne consomme pas un nouveau mois. Une résiliation ne déclenche ni achat ni remboursement des récompenses ; les mois non utilisés restent disponibles sur le compte pour un renouvellement après reprise d’un abonnement. La première facture d’une souscription n’est pas offerte au titre du parrainage.

## Paiement et preuves

- Le Checkout confirmé enregistre la première facture à partir de la confirmation contractuelle déjà préparée et de l’e-mail accepté. Le premier contrat seulement est éligible.
- La tâche `referral-qualification` effectue une revue quotidienne à 05:15 UTC (07:15 Paris l’été, 06:15 l’hiver), au maximum dix candidats. Elle fonctionne uniquement sur les déploiements publiés. À l’échéance, `invoice.created` vérifie aussi les candidats du parrain afin de ne pas dépendre exclusivement de cette revue.
- Les paiements d’une facture sont relus par `invoicePayments.list`, puis par PaymentIntents/Charges. Une permission manquante ou un type de paiement non vérifiable bloque la validation. Aucune récompense n’est déduite du seul statut `invoice.paid`.
- Un coupon interne `postibou_referral_month_v1`, 100 %, `once`, limité au produit `prod_VOog5UMGZt2LCL`, est ajouté à une facture de renouvellement **draft**. Aucun Promotion Code public n’est associé à ce coupon.
- L’API garde les remises déjà présentes et une charge utile figée ; une clé d’idempotence par facture et des index uniques empêchent l’utilisation répétée d’un même mois et les doubles récompenses sur une même période. La facture est relue avec ses remises et sa métadonnée en cas de réponse perdue.
- `invoice.paid` marque utilisé le mois dont la facture a bien été réglée à zéro. `invoice.voided` libère un mois réservé non utilisé, sans effacer son historique. Une facture déjà finalisée sans remise est mise en revue ; aucun remboursement ni débit de rattrapage automatique n’est lancé.

Une facture mixte, une quantité différente de un, du prorata, un solde client non nul ou une période non mensuelle nécessitent une revue au lieu d’une remise aveugle. Les droits habituels d’accès et le quota se renouvellent via le flux Stripe existant, même pour une facture couverte par le parrainage.

## Configuration Stripe à vérifier avant ouverture

Le webhook Postibou doit écouter les sept événements existants **et** `invoice.created`, `invoice.voided`. Ne pas modifier les endpoints des autres applications.

La clé restreinte Netlify doit autoriser : **Invoices : lecture/écriture**, **Coupons : lecture**, **Invoice Payments : lecture**, **PaymentIntents : lecture**, **Charges : lecture**, en plus des droits existants. Vérifier les libellés exacts des permissions disponibles dans le tableau de bord. La création du coupon est une opération de configuration ponctuelle effectuée dans Stripe ; aucune permission générale d’écriture sur Coupons n’est nécessaire au runtime.

Un échec de traitement de `invoice.created` peut retarder la finalisation Stripe. Examiner les événements en erreur et les réservations `review` chaque jour ouvré. Ne pas répondre artificiellement avec succès ni consommer un autre mois pour cacher un échec. Rapprocher facture, métadonnée, état du paiement et récompense avant toute réparation manuelle. Ne jamais facturer deux fois un client pour récupérer un mois offert.

## Migration et validation

Appliquer `db/migrations/2026-10-08-referrals.sql` avant déploiement. Trois tables privées avec RLS, clés étrangères et index de consommation unique. Pas de données fictives ajoutées en production. Les règles ont une page publique et sont intégrées à la nouvelle version `2026-10-08-v3` des CGV ; les archives v2 et précédentes restent intactes.

Tests automatisés avec PGlite et Stripe simulé : attribution volontaire et unique, accès, ancien compte, Checkout déjà commencé, délai, retraits et litiges, permissions, remises aux deux tarifs, cumul, duplications et concurrence, pannes réseau/base, factures étrangères ou inadaptées, retour d’un mois réservé et dispatch du webhook.

Une simulation Stripe de bout en bout, incluant deux renouvellements consécutifs, la facture à zéro, la reprise du tarif normal, le passage 2027, les remboursements et la résiliation, reste à valider avant lancement payant. Aucun paiement réel n’est nécessaire pour cette validation. La souscription reste fermée.

## Conservation et droits

Inclure les codes, attributions, version des règles et récompenses dans l’export du seul demandeur. Le filleul ne reçoit pas les informations d’autres filleuls ; le parrain ne reçoit pas les données personnelles de ses filleuls via cet espace. Les liens sont pseudonymes, pas anonymes pour l’éditeur.

Code : vie du compte. Attribution sans achat : revue à douze mois. Preuves contractuelles : cinq ans après fin du contrat ou dernière utilisation selon le dossier ; comptabilité : dix ans après exercice. Ne pas purger automatiquement des mois encore disponibles. Les tables ont des clés étrangères sans cascade vers Neon Auth : examiner et archiver les preuves nécessaires avant clôture. Ne jamais contourner les contraintes ni publier un export en GitHub.

## Sources techniques

Documentation Stripe : [Coupons et remises](https://docs.stripe.com/billing/subscriptions/coupons), [modification d’une facture brouillon](https://docs.stripe.com/api/invoices/update), [paiements de facture](https://docs.stripe.com/api/invoice-payment/list), [cycle des webhooks](https://docs.stripe.com/billing/subscriptions/webhooks). SDK Node 22.6.0, appels serveur API 2026-08-26.dahlia ; les événements existants de l’endpoint sont normalisés même si leur version diffère.
