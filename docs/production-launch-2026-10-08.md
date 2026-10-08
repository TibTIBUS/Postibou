# Ouverture de Postibou — 8 octobre 2026

Ouverture des souscriptions autorisée explicitement par l’éditeur pour les artisans, associations et particuliers. Les CGV v4 retirent les annonces de fermeture ; les archives v1 à v3 ne sont pas modifiées.

## Vérifications réalisées

- Session vérifiée réelle sur le site publié : compte et compteurs privés accessibles.
- Génération OpenRouter réelle en mode classique puis magique commercial : deux résultats par génération, une adaptation consommée pour chacun ; copie Facebook confirmée.
- Configuration serveur Netlify contrôlée par une fonction privée temporaire : connexion Stripe réelle, deux prix actifs mensuels EUR 790/990 sur le produit Postibou, coupon de parrainage valide 100 % une fois et limité au bon produit. Configuration Resend et présence du secret webhook confirmées sans afficher aucune clé.
- Création d’une session Checkout réelle par le serveur, sans client ni paiement, puis expiration immédiate confirmée : droit d’écriture Checkout vérifié. Cette opération ne valide pas un achat.
- Webhook réel actif : bonne URL, neuf événements incluant invoice.created et invoice.voided.
- Tests automatisés du checkout, quotas, confirmations durables, rétractation et parrainage ; build vérifiant l’identité du texte public et de la preuve contractuelle.
- Les validations sandbox documentées précédemment prouvent deux mensualités offertes, la reprise à 9,90 €, ainsi que les autres scénarios décrits dans leurs comptes rendus. Elles ne constituent pas un achat complet sur le site publié.

## Limites et exploitation

Le médiateur conventionné n’est pas encore désigné. L’éditeur a déclaré « Pas encore » puis demandé l’ouverture à « tous dès maintenant » après information sur cette obligation. Les documents ne prétendent ni adhésion ni conformité acquise : la désignation et la publication des coordonnées restent à régulariser.

Aucun paiement réel n’a été déclenché pour tester. Le parcours complet achat depuis le navigateur → webhook reçu par Netlify → quota payé → confirmation contractuelle reçue n’a pas été validé par une transaction de bout en bout dans cette session. La présence d’un secret webhook ne prouve pas sa correspondance avec l’endpoint ; la création et l’expiration Checkout sont vérifiées, mais les autres droits d’écriture ne sont pas tous exercés par ce contrôle. Un premier paiement réel doit être suivi dans Stripe, Neon et Resend, ou ce scénario doit être réalisé avec une installation de test isolée. Ne pas annoncer que ces contrôles prouvent tout le parcours.

Les demandes de rétractation et les remboursements demeurent des opérations à traiter par l’éditeur selon la procédure d’exploitation. Les factures doivent être archivées selon la conservation applicable. Le panneau administrateur de l’interface reste un aperçu de démonstration.

L’outil temporaire de vérification et sa page sont retirés de la version ouverte au public après leurs contrôles. Aucun secret n’a été affiché.
