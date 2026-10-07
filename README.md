# Postibou

Interface française pour adapter un texte d’artisan en deux publications : Facebook et Instagram.

## Ouvrir la préversion

Télécharger `index.html` et l’ouvrir dans un navigateur, ou le servir avec un serveur statique. Aucun outil de compilation ni aucune dépendance externe ne sont nécessaires.

Identité choisie : violet électrique `#6135e8`, citron vert `#d6ff44` et encre `#231749`.

## Ce qui fonctionne

- Navigation entre accueil, outil, connexion, compte, abonnement, administration et informations.
- Démonstration sur le texte d’exemple avec deux tons : professionnel et chaleureux, ou plus commercial.
- Deux résultats à copier ; dix crédits de démonstration en mémoire, réinitialisés au rechargement.
- Présentation des tarifs : 7,90 € par échéance jusqu’au 31 décembre 2026, puis 9,90 € au premier renouvellement en 2027, selon le fuseau Europe/Paris.

## Ce qui reste à connecter

L’interface est une démonstration. Aucun compte réel, appel IA ou paiement n’est effectué. L’administration contient uniquement des profils fictifs et n’est pas encore un espace sécurisé.

1. Hébergement et API côté serveur pour l’IA, les quotas et les paiements.
2. Authentification e-mail / mot de passe et Google, avec vérification e-mail et récupération du mot de passe.
3. Base de données pour les utilisateurs, essais, abonnements et consommations. Neon et Neon Auth sont retenus ; le projet dédié Postibou est créé, mais l’interface n’est pas encore reliée à l’authentification.
4. Contrôle côté serveur : sept jours d’essai, dix adaptations pendant l’essai, puis trente adaptations par période mensuelle. Une adaptation réussie donne les deux versions ; un échec ne consomme aucun crédit.
5. Paiement, renouvellements, résiliation et accès jusqu’à la fin de la période payée.
6. Protection de l’administration et mentions légales définitives.

Les textes et résultats ne doivent pas être conservés dans un historique. Les secrets (base de données, IA, paiements et OAuth Google) doivent être configurés côté serveur, jamais dans ce fichier ou dans le dépôt public.

Le site est déployé sur https://postibou.netlify.app/ depuis la branche `main`, via l’équipe Netlify Localia existante.

## Architecture retenue

- GitHub : code source.
- Netlify : interface et fonctions serveur.
- Neon + Neon Auth : comptes, essais, quotas et données d’abonnement.
- Stripe : souscriptions, factures et résiliation.

## Déployer sur Netlify

Le dépôt `TibTIBUS/Postibou` est importé dans le projet Netlify dédié `postibou`. La configuration `netlify.toml` définit la commande `node scripts/build.mjs` et le dossier publié `dist`. Les autres fichiers du dépôt ne sont pas publiés comme ressources statiques. Les modifications de `main` déclenchent désormais un déploiement Netlify.

Test local de la construction : `node scripts/build.mjs`. Cette étape ne connecte pas encore l’authentification, l’IA ou le paiement. Aucun abonnement fournisseur ni paiement client n’a été activé.

## Infrastructure créée le 7 octobre 2026

- Netlify : `postibou`, https://postibou.netlify.app/, relié au dépôt et déploiement initial vérifié.
- Neon : projet `Postibou` (`fragrant-sound-24707274`), offre gratuite, AWS Francfort.
- Branche Neon : `production` (`br-shiny-fog-b1oz5ggz`), prête.
- Neon Auth : Managed Better Auth activé ; e-mail/mot de passe disponible et fournisseur Google partagé de développement présent.
- À terminer : adresses de retour et domaines autorisés, vérification e-mail, configuration Google de production, raccordement des formulaires et du serveur, quotas réels, IA et Stripe. Les connexions et les crédits affichés par le site demeurent une démonstration.

Aucun secret n’est inclus dans ces informations. Aucun paiement client n’a été activé.
