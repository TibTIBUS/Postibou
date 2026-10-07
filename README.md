# Postibou

Interface française pour transformer le texte d’un artisan en publications Facebook et Instagram.

Site : https://postibou.netlify.app/ — déploiement automatique de `main` sur Netlify.

## Étape actuelle : comptes par e-mail

Inscription e-mail/mot de passe, vérification par code e-mail, connexion, déconnexion et récupération par code sont reliées à Neon Auth. Google est désactivé dans l’interface en attendant les identifiants OAuth de production.

Le serveur `netlify/functions/auth.mjs` limite les opérations autorisées, contrôle l’origine des requêtes et valide les sessions auprès de Neon. Il relaie uniquement les cookies Neon, avec `HttpOnly`, `Secure`, `SameSite=Lax`, sans domaine tiers. Les jetons ne sont pas exposés en JSON ni conservés dans localStorage. Les réponses ne sont jamais mises en cache. Le fournisseur assure le stockage des empreintes de mots de passe et les protections de son service d’authentification.

Le domaine autorisé est `https://postibou.netlify.app`. En cas de changement de domaine, mettre à jour `SITE_ORIGIN` et les domaines autorisés dans Neon. L’URL publique Neon figure dans le code ; elle n’est pas un secret. Aucun mot de passe de base de données ou clé administrative n’est nécessaire à cette étape.

L’espace personnel expose uniquement l’adresse vérifiée. Les quotas réels et l’essai ne commencent pas encore : l’IA est en préparation. L’outil et l’administration restent des démonstrations (profils fictifs), sans historique de textes. Stripe et les paiements ne sont pas actifs.

## Architecture

- GitHub : code, dépôt `TibTIBUS/Postibou`.
- Netlify : interface et fonctions serveur, projet `postibou`, équipe Localia.
- Neon + Neon Auth : projet `Postibou` (`fragrant-sound-24707274`), offre gratuite, AWS Francfort, branche `production` (`br-shiny-fog-b1oz5ggz`).
- Stripe : abonnements à connecter ultérieurement.

## Vérification

Node 24, aucune dépendance de production.

```sh
node --test tests/auth.test.mjs
node --check auth.js
node scripts/build.mjs
```

`dist` contient seulement `index.html` et `auth.js`. Netlify détecte les fonctions dans `netlify/functions`. Un serveur statique seul permet d’examiner le rendu, mais ne fournit pas l’authentification.

Tests serveur : origine, méthodes, validation, filtrage des cookies et champs, absence de jetons dans les réponses, sessions vérifiées, récupération, suppression des cookies et erreurs. La réception d’un vrai e-mail et le parcours complet doivent être confirmés avec le compte du propriétaire dans son navigateur.

## Étapes suivantes

1. Tester le compte réel du propriétaire, puis configurer Google avec une application OAuth de production.
2. Activer les essais : sept jours et dix adaptations ; abonnements : trente adaptations par période mensuelle. Contrôle serveur, aucun crédit consommé en cas d’échec.
3. Relier l’IA aux textes personnalisés, sans historique.
4. Stripe : 7,90 € pour les échéances jusqu’au 31 décembre 2026, puis 9,90 € au premier renouvellement en 2027 (Europe/Paris), résiliation à tout moment et accès jusqu’à la fin de la période payée.
5. Administration sécurisée et informations légales réelles avant l’ouverture commerciale.

Les secrets futurs doivent rester côté serveur, jamais dans le dépôt public. Identité : violet électrique `#6135e8`, citron vert `#d6ff44`, encre `#231749`.
