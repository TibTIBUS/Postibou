# Postibou — inventaire des traitements et mesures à finaliser

Responsable : Thibaut Marie, Localia EI. Contact : gestion.localia@gmail.com. Adresse : 92 rue des quatre rues, 50710 Créances, France. Inventaire issu du code au 8 octobre 2026 ; registre de travail, à compléter avec les configurations et contrats réels.

| Traitement | Données repérées | Finalité | Base envisagée à valider | Durée / action nécessaire |
|---|---|---|---|---|
| Authentification | Identifiant, e-mail, données nécessaires à l'authentification chez Neon/Google, cookies | Création du compte, connexion et sécurité | Exécution du service demandé ; intérêt légitime pour certaines mesures de sécurité à documenter | Durées Neon Auth, sessions et comptes inactifs à fixer/vérifier ; procédure de suppression |
| Droits et crédits | Identifiant, dates d'essai, quota utilisé, périodes et statut d'abonnement | Fournir l'essai et l'abonnement, empêcher les dépassements | Exécution contractuelle | Conserver pendant l'accès ; distinguer données actives, preuve et archive nécessaires |
| Réservations de génération | UUID réservation/utilisateur, état, dates | Réserver/restituer les crédits, limiter les doubles traitements | Exécution contractuelle | Nettoyage des métadonnées à définir ; pas de texte stocké par ce mécanisme |
| Paiement | Identifiants client/abonnement/session Stripe, statut, période, identifiant d'événement webhook | Facturation, activation et résiliation | Exécution contractuelle ; obligation légale pour les pièces comptables applicables | Définir conservation des métadonnées ; contrôler factures et obligations légales séparément |
| Génération IA | Texte et intention, sortie produite | Reformulation Facebook/Instagram | Exécution du service pour l'utilisateur ; qualification supplémentaire si son texte contient des données de tiers | Traitement transitoire dans la fonction ; rétention fournisseur/logs à vérifier. Prévoir contrat art. 28 si le cas d'usage le nécessite |
| Support et exercice des droits | E-mail, demande, vérification d'identité proportionnée | Répondre aux demandes et droits | Exécution contractuelle / obligation légale selon demande | Canal retenu : gestion.localia@gmail.com ; procédure et délais à documenter |
| Journaux techniques | Potentiellement IP, identifiants de requête et erreurs chez hébergeur/fournisseurs | Sécurité et diagnostic | Intérêt légitime à évaluer | Inventaire des logs/accès et durée réelle à vérifier ; éviter tout contenu utilisateur ou secret dans les logs |

## Contrôles fournisseurs

Pour Netlify, Neon/Neon Auth, Stripe et OpenRouter : confirmer entité contractante, rôle dans chaque traitement, accord de traitement applicable, sous-traitants ultérieurs, pays d'hébergement et accès, mécanisme des transferts et durée des logs/sauvegardes. Les rôles de Stripe et Google ne doivent pas être présumés identiques à ceux d'un hébergeur.

Pour OpenRouter : vérifier les réglages de journalisation et d'utilisation pour entraînement, les politiques du fournisseur qui sert le modèle et les éventuelles destinations d'observabilité. Évaluer ensuite les contrôles de routage `data_collection` et `zdr` avec un test réel de disponibilité du modèle avant modification en production. Une option de routage ne remplace pas l'analyse contractuelle des transferts.

## Procédures à mettre en place

1. Définir un contact public unique pour support et droits, et vérifier que la boîte reçoit les messages.
2. Décrire le parcours de demande d'accès/suppression/export sans exiger systématiquement une pièce d'identité.
3. Lors d'une suppression, vérifier abonnement, échéance, obligations de conservation et sauvegardes ; supprimer ce qui n'est plus nécessaire sans effacer les preuves légalement requises.
4. Fixer les durées puis mettre en œuvre et vérifier les purges. Ne pas publier les durées comme appliquées avant leur mise en place.
5. Documenter la gestion des violations ; évaluer, selon risque, notification CNIL dans le délai applicable et information des personnes concernées.
6. Restreindre les accès réels à Neon, Netlify et Stripe ; l'écran administrateur fictif ne constitue pas une console autorisée.

Sources : [information CNIL](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence), [droits](https://cnil.fr/fr/respecter-les-droits-des-personnes), [OpenRouter collecte](https://openrouter.ai/docs/guides/privacy/data-collection), [politiques des fournisseurs IA](https://github.com/OpenRouterTeam/docs/blob/main/guides/privacy/provider-logging.mdx).
