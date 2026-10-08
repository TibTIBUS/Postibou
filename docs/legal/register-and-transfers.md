# Registre simplifié et revue des prestataires

Responsable : Thibaut MARIE, EI / Localia. 8 octobre 2026. Personnes : utilisateurs majeurs, représentants d’artisans et d’associations, clients particuliers ; éventuellement tiers mentionnés dans un texte. Aucun traitement volontaire de données sensibles. Ne pas ajouter de copies de données personnelles dans ce document public au dépôt.

| Traitement | Base | Catégories | Prestataires et localisation constatée | Conservation |
|---|---|---|---|---|
| Compte et connexion | Contrat | Adresse, nom, identifiant, vérification, données de connexion | Neon Auth ; endpoint Francfort ; Google facultatif | Vie du compte ; clôture selon politique ; revue des essais après 12 mois |
| Réécriture | Contrat | Texte, ton, mode et résultats transitoires | Serveur Netlify Ohio → OpenRouter → fournisseur du modèle | Aucun texte en base Postibou ; politiques des prestataires pour leurs traitements |
| Quotas | Contrat | Essai, compteur, métadonnées sans texte | Neon production AWS eu-central-1 | Compte ; métadonnées 90 jours sous réserve de rapprochement |
| Paiement et contrats, après ouverture | Contrat / obligation / défense des droits | Références Stripe, facturation, versions et dates d’acceptation | Stripe + Neon + Netlify | Preuves 5 ans après contrat ; comptabilité 10 ans après exercice ; abandon 90 jours |
| Confirmation durable, après activation | Contrat / obligation / défense des droits | E-mail vérifié, récapitulatif, références de paiement, CGV exactes, état d’envoi ; aucun texte généré | Neon + Netlify + Resend (Plus Five Five, Inc.), stockage États-Unis | Preuve 5 ans après contrat ; copies et journaux Resend annoncés à 30 jours dans l’offre gratuite actuelle |
| Assistance et droits | Contrat / obligation / intérêt légitime | Messages et éléments strictement utiles | Messagerie de gestion et prestataires concernés | 1 an après traitement, exceptions motivées |
| Sécurité | Intérêt légitime | Sessions, IP et éléments techniques | Netlify, Neon et prestataires | Durées des services ; limiter les traces sous contrôle de l’éditeur |

## Transferts et garanties

Constats techniques vérifiés : base et Auth Neon en Allemagne, fonctions Netlify en Ohio. Aucun engagement d’hébergement exclusivement européen n’est pris. Les générations ne transmettent pas l’e-mail ou l’identifiant du client dans le corps envoyé à OpenRouter. Le texte libre peut néanmoins contenir une information personnelle saisie par l’utilisateur.

- Netlify : [DPA actuel lié depuis sa page RGPD](https://www.netlify.com/pdf/netlify-dpa.pdf), édition du 9 juin 2026. Le prestataire indique qu’il est incorporé à ses conditions ; clauses de transfert à conserver dans le dossier contractuel privé.
- Neon : [Platform Terms](https://neon.com/platform-terms), édition du 5 août 2026, articulation avec les documents Databricks. [DPA Databricks](https://www.databricks.com/legal/dpa). Ne pas présenter l’ancien PDF DPA Neon comme le contrat actuel sans vérifier la version applicable au compte.
- OpenRouter : [conditions](https://openrouter.ai/terms), 31 août 2026, article 10.2 incorporant le [DPA](https://openrouter.ai/data-processing-agreement), dont l’article 13 prévoit les clauses contractuelles types. [Collecte](https://openrouter.ai/docs/guides/privacy/data-collection). Le code actuel n’exige pas `provider.zdr` ni `data_collection: deny` ; les réglages exacts du compte et la rétention du fournisseur ne sont pas attestés. La politique publique le dit et ne promet ni zéro rétention ni absence absolue d’entraînement. Une promesse plus forte nécessite contrôle des options, restrictions de routage, essai réel du modèle et examen des exceptions du prestataire.
- Stripe : [DPA](https://stripe.com/fr/legal/dpa) et [accord de transfert](https://stripe.com/legal/dta). Distinguer sous-traitance pour le service et traitements autonomes de fraude/conformité. Aucun numéro de carte ne passe dans la base Postibou.
- Resend (prévu, non encore activé) : [DPA](https://resend.com/legal/dpa), 31 décembre 2025, et [sécurité](https://resend.com/security). Stockage aux États-Unis même avec une région d’envoi européenne ; clauses contractuelles types prévues dans le DPA. Conserver le contrat effectivement accepté et examiner les [sous-traitants](https://resend.com/legal/subprocessors) avant activation. Vérifier et désactiver le suivi d’ouverture et de clic sur le domaine ; aucune vérification de ce réglage de compte n’est revendiquée à ce stade. Le message du code est en texte simple avec deux pièces jointes TXT, sans texte d’artisan ni résultat IA.
- Google : [politique](https://policies.google.com/privacy). Authentification volontaire ; aucun accès Gmail, Drive ou Agenda prévu. La messagerie de gestion constitue un flux distinct des générations : minimiser les pièces et maîtriser l’accès à ce compte.

## Suivi effectif

Conserver dans un dossier privé la version contractuelle applicable au compte et sa date, les sous-traitants ultérieurs, les pays et mécanismes de transfert, les garanties d’accès/suppression, ainsi que les mesures de minimisation et de sécurité. Revoir après chaque notification importante d’un prestataire et au moins annuellement. La publication d’un DPA ou une certification annoncée n’est pas une preuve suffisante que tous les traitements sont conformes ; ne pas cocher une vérification d’un réglage de compte qui n’a pas été effectuée.

Risques : textes libres pouvant identifier des tiers, prestataires et autorités étrangers, options de journalisation, archives et sauvegardes. Réponses actuelles : saisie limitée, mise en garde avant utilisation, absence d’historique en base, transmission de la seule source et paramètres nécessaires, clés côté serveur, contrôle d’accès, droits par contact, revues de conservation. Le registre est à maintenir ; aucun label global de conformité n’est revendiqué.

## Références juridiques

[Information CNIL](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence) ; [Conservation CNIL](https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees) ; RGPD articles 5, 6, 12 à 22, 28, 30, 32 à 34 et 44 suivants ; code de la consommation L. 221-18 et suivants, L. 224-25-1 et suivants, annexe D. 211-4 ; code civil 2224 ; code de commerce L. 123-22. Les droits impératifs s’appliquent selon la qualité réelle du client. La médiation n’est pas réglée dans ce chantier et la souscription reste fermée.
