# Ouverture commerciale de Postibou — audit du 8 octobre 2026

Version de travail. Cet audit combine la lecture du code et des sources officielles ; il ne certifie pas la conformité du service. Éditeur confirmé par Thibaut : Localia, entreprise individuelle de Thibaut Marie. Public confirmé : artisans en priorité, associations et particuliers également admis. Localia publie une franchise en base de TVA ; les réglages Stripe restent à contrôler.

## Professionnels, particuliers et associations

Une V1 réservée aux professionnels réduit les obligations propres aux consommateurs, mais n'enlève ni les mentions légales, ni le RGPD, ni les obligations contractuelles et de facturation. La restriction doit correspondre à l'usage réel et être expliquée ; une case « professionnel » ne neutralise pas des droits légaux.

Ouvrir aux particuliers ajoute notamment rétractation, information précontractuelle, médiation et garanties des services numériques. L'abonnement à petit prix reste possible : le risque vient d'un parcours incomplet, pas du fait d'accueillir ces utilisateurs.

Une association est une personne morale. Selon son activité et l'objet du contrat, elle peut être professionnelle ou non-professionnelle. Un bénévole qui souscrit personnellement peut relever d'une autre qualification. Certaines protections, notamment relatives à la reconduction, s'étendent aux non-professionnels. Ne pas traiter toutes les associations comme des entreprises, ni comme des consommateurs personnes physiques.

Décision validée par Thibaut : conserver la cible marketing « artisans » et ouvrir également aux particuliers majeurs et aux associations, avec conditions adaptées. Garder une inscription commune simple, sans questionnaire de métier. Cette décision rend nécessaires les compléments consommateurs avant commercialisation.

Sources : [définitions](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049464063/2026-04-28), [non-professionnels et reconduction](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032226976), [commerce électronique](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/e-commerce-les-regles-entre-professionnels-et-consommateurs).

## Ce qui est prêt et ce qui manque

| Priorité | Sujet | Constat dans le projet | Travail restant |
|---|---|---|---|
| Avant ouverture | Mentions légales | Une page de préversion, sans identité complète | Confirmer immatriculation, adresse de domiciliation, contacts, direction de publication et coordonnées complètes de l'hébergeur ; publier une page dédiée |
| Avant vente | CGU/CGV | La case de paiement porte sur tarif et renouvellement, sans CGV finalisées | Définir le public, rendre les conditions consultables/téléchargeables et conserver leur version acceptée côté serveur, y compris pour les comptes Google |
| Avant vente | Information de commande | Tarifs et quotas visibles ; prix futur annoncé | Ajouter identité du vendeur, résumé contractuel, garanties applicables et confirmation de souscription sur support durable |
| Avant vente | Fiscalité/factures | Deux prix Stripe créés ; régime TVA non confirmé | Vérifier franchise en base et réglages Stripe Tax, identité/adresse facturée et mentions obligatoires. Ne pas considérer un reçu Stripe comme une facture française complète sans contrôle |
| Si consommateurs | Rétractation | Résiliation prévue ; aucune fonction spécifique de rétractation | Ajouter parcours distinct, accusé durable et gestion du remboursement. Ne pas supposer que l'essai gratuit remplace le droit de rétractation |
| Si consommateurs | Médiation | Aucun médiateur confirmé | Choisir un médiateur compétent, disposer du dispositif puis indiquer ses coordonnées. Ne pas inventer d'adhésion |
| Si consommateurs | Conformité numérique | Pas de clauses/encart définitifs | Préciser les exigences techniques et les garanties applicables ; vérifier l'encart réglementaire des CGV |
| Avant ouverture | Confidentialité | Compte, quotas, facturation et génération observés | Publier finalités, bases, destinataires, durées effectives, droits et garanties des transferts. Distinguer absence d'historique Postibou et traitement des fournisseurs |
| Avant ouverture | Contrats des fournisseurs | Neon, Netlify, Stripe et OpenRouter utilisés | Vérifier les contrats de sous-traitance, rôles respectifs, sous-traitants ultérieurs, lieux de traitement et garanties hors EEE |
| Avant ouverture | Textes contenant des données personnelles | Texte envoyé à OpenRouter, fournisseur choisi par routage | Vérifier politique du compte, rétention et entraînement ; déterminer les mesures contractuelles si des clients envoient des données de tiers |
| Avant ouverture | Cookies | Cookies de session Secure/HttpOnly/SameSite=Lax ; pas d'analytics ou stockage navigateur repéré dans le code local | Inventorier les cookies réels pendant e-mail, Google et Checkout, et leurs durées. Consentement préalable seulement si des traceurs non exemptés sont réellement utilisés |
| Avant ouverture | Droits et conservation | Pas de procédure complète repérée | Définir adresse de contact, vérification proportionnée de l'identité, suppression/export et délais ; ne pas supprimer les pièces soumises à conservation légale |
| Avant ouverture | Acceptation et preuves | Case de tarif gérée côté interface ; version des CGV non enregistrée | Ajouter contrôles serveur, horodatage et version des documents ; ne pas assimiler affichage et preuve d'acceptation |
| Avant ouverture | Réclamations/incidents | Pas de procédure documentée | Organiser support, incidents et traitement des violations de données selon les critères légaux |
| Après préparation | Vérification finale | Stripe sandbox encore en cours ; admin uniquement fictive | Tester parcours réel autorisé, documents, preuve d'achat, résiliation et rétractation si applicable. L'administration réelle est un chantier distinct |

## Détail sur la rétractation

La résiliation ordinaire arrête les renouvellements et conserve la période payée. La rétractation est une autre procédure, avec ses propres délais et effets. Pour les consommateurs, le code prévoit depuis le 19 juin 2026 une fonctionnalité en ligne permettant l'exercice de ce droit. Un simple lien e-mail ne remplace donc pas à lui seul cette fonctionnalité.

Recommandation produit à confirmer : conserver le droit de rétractation et définir une politique simple, plutôt que demander une renonciation générale dès la première génération. Une souscription SaaS mensuelle n'est pas automatiquement entièrement exécutée par la génération d'un texte.

Sources : [article L221-21 actuel](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053310520/2026-06-19), [rétractation](https://www.economie.gouv.fr/particuliers/mes-droits-conso/bien-consommer/vente-distance-tout-savoir-sur-votre-droit-de-retractation), [médiation](https://entreprendre.service-public.gouv.fr/vosdroits/F33338), [garanties numériques](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069565/LEGISCTA000044132867/).

## TVA : réponse de Thibaut et vérification

Thibaut indique ne pas récupérer la TVA et annoncer un prix total à payer. Les mentions légales et CGV de localiapro.fr indiquent aussi une franchise en base (art. 293 B). Cette déclaration publique fournit la mention à reprendre ; elle ne vérifie pas les réglages Stripe. La microentreprise et la franchise de TVA sont deux sujets distincts. Sous franchise applicable en France, pas de TVA collectée sur ces ventes et mention « TVA non applicable, art. 293 B du CGI » sur facture. Confirmer avec la situation fiscale réelle avant toute configuration. Les achats de services étrangers peuvent avoir des obligations spécifiques : ne pas déduire de la franchise une absence universelle de formalités.

Source : [franchise de TVA](https://www.economie.gouv.fr/entreprises/gerer-sa-fiscalite-et-ses-impots/autres-impots-et-taxes/entreprises-pouvez-vous-beneficier-de-la-franchise-de-tva).

## Informations à obtenir

- Compléter l’immatriculation applicable si nécessaire ; SIREN, identité, adresse et contacts retrouvés sur localiapro.fr (voir publisher-facts.md).
- Contrôler les paramètres fiscaux de Stripe avec le régime de franchise publié.
- Identifier le médiateur réellement conventionné : aucun nom n’a été trouvé dans les pages consultées.
- Durées de conservation choisies et applicables, configurations de confidentialité des fournisseurs et contrats correspondants.

## Sources transversales

- [Mentions EI](https://entreprendre.service-public.gouv.fr/vosdroits/F31228)
- [Information RGPD](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence)
- [Cookies](https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/comment-mettre-mon-site-web-en-conformite)
- [Factures EI](https://www.service-public.gouv.fr/entreprendre/vosdroits/F31808?profil=entrepreneur-individuel)
- [OpenRouter : collecte](https://openrouter.ai/docs/guides/privacy/data-collection)

Les corrections d'interface proposées avec cet audit précisent l'envoi à l'IA, distinguent résultats réels et démonstration, et décrivent la résiliation déjà disponible. Elles n'affirment pas que les documents définitifs sont publiés.
