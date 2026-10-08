# Postibou

Interface française pour transformer le texte d’un artisan en publications Facebook et Instagram.

Site : https://postibou.netlify.app/ — déploiement automatique de `main` sur Netlify.

## Comptes et essai gratuit

Inscription e-mail/mot de passe, vérification par code e-mail, connexion, déconnexion et récupération par code sont reliées à Neon Auth. Google utilise désormais le client OAuth Postibou, configuré via l’API Neon. Google Auth Platform reste en mode Test : seuls les utilisateurs test autorisés par Google peuvent se connecter.

Le serveur `netlify/functions/auth.mjs` limite les opérations autorisées, contrôle l’origine des requêtes et valide les sessions auprès de Neon. Il relaie uniquement les cookies Neon, avec `HttpOnly`, `Secure`, `SameSite=Lax`, sans domaine tiers. Les jetons ne sont pas exposés en JSON ni conservés dans localStorage. Les réponses ne sont jamais mises en cache. Le fournisseur assure le stockage des empreintes de mots de passe et les protections de son service d’authentification.

Le domaine autorisé est `https://postibou.netlify.app`. En cas de changement de domaine, mettre à jour `SITE_ORIGIN` et les domaines autorisés dans Neon. L’URL publique Neon figure dans le code ; elle n’est pas un secret. Aucun mot de passe de base de données ou clé administrative n’est nécessaire à cette étape.

Après une inscription, Neon conserve l’essai de sept jours et ses dix adaptations dans `public.postibou_entitlements`. Une ligne liée à l’identifiant Neon Auth contient seulement le début et la fin de l’essai ainsi que le compteur. Les réservations techniques ne contiennent aucun texte. Les publications ne sont pas conservées par Postibou.

La fonction `netlify/functions/adapt.mjs` vérifie la session Neon et l’adresse vérifiée avant de réserver un crédit. Elle envoie le texte et le ton à OpenRouter, valide la réponse structurée Facebook/Instagram, puis marque la réservation terminée. Si la génération échoue, elle rembourse le crédit. Le texte n’est pas écrit dans Neon. Le modèle par défaut est `openai/gpt-6-luna` ; le fournisseur et le modèle peuvent évoluer.

Avant la première génération, configurer les variables d’environnement Netlify avec le scope **Functions** : `OPENROUTER_API_KEY` et `DATABASE_URL` (URL de connexion Neon pour la branche `production`, SSL activé). Les secrets ne sont pas dans le dépôt ni `netlify.toml`. Modifier une variable nécessite un nouveau déploiement.

Les essais se créent lors de l’inscription quand la base est configurée ; le premier accès authentifié initialise aussi l’essai pour les comptes déjà créés. L’espace personnel utilise les données du compte. L’administration reste démonstrative. Les abonnements mensuels Stripe et les quotas abonnés sont reliés aux fonctions serveur.

## Architecture

- GitHub : code, dépôt `TibTIBUS/Postibou`.
- Netlify : interface et fonctions serveur, projet `postibou`, équipe Localia.
- Neon + Neon Auth : projet `Postibou` (`fragrant-sound-24707274`), offre gratuite, AWS Francfort, branche `production` (`br-shiny-fog-b1oz5ggz`).
- Stripe : Checkout, portail client et webhooks pour les abonnements.

## Vérification

Node 24 ; SDK serveur officiel `@neondatabase/auth` épinglé à `0.5.0-beta`. Installer avec `npm ci`.

```sh
node --test tests/*.test.mjs
node --check auth.js
node scripts/build.mjs
```

`dist` contient seulement `index.html` et `auth.js`. Netlify détecte les fonctions dans `netlify/functions`. Un serveur statique seul permet d’examiner le rendu, mais ne fournit pas l’authentification.

Tests serveur : origine, méthodes, validation, filtrage des cookies et champs, absence de jetons dans les réponses, sessions vérifiées, récupération, suppression des cookies et erreurs. La réception d’un vrai e-mail et le parcours complet doivent être confirmés avec le compte du propriétaire dans son navigateur.

## Étapes suivantes

1. Valider le parcours paiement → abonnement → résiliation dans un environnement Stripe de test.
2. Stripe : 7,90 € pour les échéances jusqu’au 31 décembre 2026, puis 9,90 € au premier renouvellement en 2027 (Europe/Paris), résiliation à tout moment et accès jusqu’à la fin de la période payée.
3. Ajouter l’administration sécurisée et les informations légales réelles avant l’ouverture commerciale.
4. Compléter Google Auth Platform et son passage au public avant d’ouvrir l’inscription à tous.

Les secrets futurs doivent rester côté serveur, jamais dans le dépôt public. Identité : violet électrique `#6135e8`, citron vert `#d6ff44`, encre `#231749`.

## Retour OAuth Google

`POST /api/auth/google` fixe le fournisseur Google et les URL de retour côté serveur. Le navigateur suit l’URL d’initialisation fournie par Neon. `GET /auth/google/retour` utilise `processAuthMiddleware` du SDK officiel pour échanger le vérificateur Neon et le cookie de challenge contre le cookie de session. Le retour est toujours une URL fixe du site ; les paramètres OAuth sont retirés. Échec ou annulation : retour à la connexion avec un message.

Aucun secret Google n’est dans Netlify ou GitHub : les identifiants ont été transmis directement à Neon. L’application n’utilise pas le cache de sessions signé du SDK : son cookie `local.session_data` est écarté, et chaque session est validée auprès de Neon. La clé temporaire utilisée par le SDK pour ce cache écarté ne sert jamais à autoriser un utilisateur.

Le client Google Postibou se trouve dans le projet Google existant Localia Partners. L’écran de consentement est commun aux clients de ce projet ; sa séparation dans un projet dédié pourra être effectuée ultérieurement.

## Gestion de l’abonnement

Les fonctions Checkout, webhook et portail Stripe sont déployées. Les variables `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` restent dans Netlify, portée Functions. Le quota abonné est de trente adaptations par période payée.

L’espace personnel affiche « Factures et moyen de paiement » dès qu’un compte Stripe existe. La résiliation utilise `POST /api/billing/cancel`, avec session Neon vérifiée et contrôle de propriété côté serveur. Après confirmation, un abonnement ordinaire est résilié en fin de période ; un calendrier tarifaire est réduit à sa phase actuelle, terminée à la fin de la période payée, avec `end_behavior: cancel`. Aucun crédit utilisé n’est réinitialisé. Les mises à jour Stripe relisent l’abonnement courant pour éviter qu’un événement ancien annule la résiliation enregistrée.

Vérifications automatisées : abonnements ordinaires et programmés, conservation des réglages de facturation, confirmation répétée, origine, identité du client, erreurs Stripe/base et événements retardés. Un test complet dans un environnement Stripe de test reste nécessaire avant de considérer les parcours de paiement et résiliation validés de bout en bout. Aucun paiement réel n’est effectué pour ces tests.

## Protection contre les doubles abonnements

Appliquer `db/migrations/2026-10-08-checkout-attempts.sql` avant de déployer cette version. Cette migration ajoute une table technique, avec une tentative de paiement unique par compte et RLS activée sans politique publique. Elle ne modifie ni les quotas ni les abonnements existants.

Le serveur conserve les paramètres de la tentative (prix, client ou e-mail, expiration et identifiant aléatoire) dans Neon. Les demandes simultanées utilisent la même clé d’idempotence Stripe et les mêmes paramètres. Une page ouverte est réutilisée ; un paiement terminé ou encore en confirmation bloque la création d’une nouvelle page. Chaque page expire après une heure. Une tentative expirée sans identifiant de session est rapprochée de la liste Stripe avant d’être remplacée, y compris après l’expiration du cache d’idempotence Stripe. Une réconciliation indisponible bloque le nouveau paiement.

Le webhook ne remplace un abonnement précédent que si Stripe confirme qu’il est terminé. La mise à jour utilise une comparaison atomique de l’identifiant précédent ; un conflit retourne une erreur afin d’être visible dans les livraisons webhook Stripe, sans écraser l’abonnement enregistré.

`npm test` vérifie notamment les requêtes concurrentes et les SQL réels avec PostgreSQL embarqué (PGlite, dépendance de développement uniquement), les réponses Stripe et Neon perdues, les paiements asynchrones, les sessions expirées, les événements simultanés et le passage tarifaire à 2027. Stripe reste simulé dans ces tests.

Avant l’ouverture commerciale, confirmer le régime de TVA et le traitement TTC des tarifs ; `automatic_tax` n’est pas activé par cette correction.

## Parrainage

Le compte propose un lien personnel, les compteurs et des badges. Un premier paiement du filleul vérifié après quatorze jours donne un mois offert au parrain, cumulable et utilisable sur une prochaine facture mensuelle avec les trente adaptations habituelles. Appliquer `db/migrations/2026-10-08-referrals.sql` avant déploiement. Configuration du coupon, événements webhook, droits de la clé Stripe, tests et procédures : [programme de parrainage](docs/referral-program.md). La souscription publique reste fermée.
