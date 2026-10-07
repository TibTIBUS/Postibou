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
3. Base de données pour les utilisateurs, essais, abonnements et consommations. Neon et Neon Auth constituent une option ; aucun projet Neon n’a été créé pour ce dépôt.
4. Contrôle côté serveur : sept jours d’essai, dix adaptations pendant l’essai, puis trente adaptations par période mensuelle. Une adaptation réussie donne les deux versions ; un échec ne consomme aucun crédit.
5. Paiement, renouvellements, résiliation et accès jusqu’à la fin de la période payée.
6. Protection de l’administration et mentions légales définitives.

Les textes et résultats ne doivent pas être conservés dans un historique. Les secrets (base de données, IA, paiements et OAuth Google) doivent être configurés côté serveur, jamais dans ce fichier ou dans le dépôt public.

Le dépôt contient le code ; aucun hébergement public de Postibou n’a encore été configuré.
