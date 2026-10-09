// Exemples de publications par métier, utilisés pour générer les pages /exemples/*.
// Chaque exemple montre un texte de départ simple et le type de résultat que Postibou produit.
// Aucun prix, avis ou résultat chiffré n'est inventé : tout ce qui apparaît dans un résultat figure dans le texte de départ.

export const METIERS = [
  {
    slug: 'plombier',
    nom: 'Plombier',
    pour: 'un plombier',
    resume: 'Salle de bain, conseils de saison, congés et urgences.',
    intro: 'Un chantier terminé, un conseil avant l’hiver, une période de congés : ce sont les publications qui rassurent vos clients et vous gardent en tête quand une fuite arrive. Voici trois exemples de textes de départ, et ce que Postibou en fait pour Facebook et Instagram.',
    conseils: [
      'Mentionnez votre secteur d’intervention (commune, canton) : c’est ce qui fait réagir les gens autour de chez vous.',
      'Ajoutez une photo de l’avant et de l’après : un chantier de salle de bain ou de chauffage se comprend en un coup d’œil.',
      'Indiquez comment vous joindre pour une urgence, surtout avant une période de congés.'
    ],
    exemples: [
      {
        situation: 'Chantier terminé',
        source: 'On a refait une salle de bain complète chez des clients. Douche à l’italienne et meuble vasque. Ils sont contents.',
        facebook: 'Une salle de bain refaite de A à Z, et des clients contents. 🚿\n\nNous venons de terminer cette rénovation : douche à l’italienne, meuble vasque et finitions soignées. Merci à nos clients pour leur confiance.\n\nUne salle de bain, c’est la pièce où l’on commence et finit la journée : elle mérite d’être pensée dans les détails.\n\nVous avez un projet de rénovation ? Parlons-en, nous répondons avec plaisir.',
        instagram: 'Salle de bain refaite, projet terminé. 🚿\n\nDouche à l’italienne, meuble vasque, finitions soignées. Merci à nos clients pour leur confiance.\n\nUn projet de salle de bain ? Écrivez-nous en message.\n\n#Plombier #SalleDeBain #DoucheItalienne #Rénovation'
      },
      {
        situation: 'Conseil de saison',
        source: 'Avec le froid qui arrive, pensez à purger vos robinets extérieurs et à protéger le compteur d’eau contre le gel.',
        facebook: 'Le froid arrive : pensez à protéger vos installations. ❄️\n\nQuelques gestes simples évitent bien des mauvaises surprises : purger les robinets extérieurs et protéger le compteur d’eau contre le gel.\n\nUn doute sur votre installation ? Contactez-nous, nous vous conseillons volontiers.\n\nEt vous, avez-vous déjà fait le tour de votre maison avant l’hiver ?',
        instagram: 'Le froid arrive ❄️\n\nDeux gestes simples : purger les robinets extérieurs, protéger le compteur d’eau contre le gel.\n\nUn doute ? Écrivez-nous.\n\n#Plombier #Hiver #Gel #AstucePlomberie'
      },
      {
        situation: 'Congés et urgences',
        source: 'On est en congés du 20 au 27 octobre. Pour une urgence, appelez comme d’habitude, on répond.',
        facebook: 'Petite pause du 20 au 27 octobre. 🌴\n\nNotre activité ralentit quelques jours, mais pour une urgence, vous pouvez continuer à nous appeler au numéro habituel : nous répondons.\n\nPour les autres demandes, nous revenons vers vous dès notre retour.\n\nMerci pour votre compréhension, et à très vite !',
        instagram: 'Petite pause du 20 au 27 octobre 🌴\n\nUne urgence ? Appelez-nous comme d’habitude, nous répondons.\n\nPour le reste, nous revenons vers vous dès notre retour.\n\n#Plombier #Congés #Dépannage'
      }
    ]
  },
  {
    slug: 'electricien',
    nom: 'Électricien',
    pour: 'un électricien',
    resume: 'Mise aux normes, réflexes de sécurité et nouveaux chantiers.',
    intro: 'En électricité, vos clients cherchent d’abord quelqu’un de fiable. Montrer un tableau refait, donner un réflexe de sécurité ou annoncer vos disponibilités vous aide à devenir cette personne-là. Trois exemples pour Facebook et Instagram.',
    conseils: [
      'Racontez ce que vous avez fait en une phrase claire : « mise aux normes », « tableau remplacé », « borne installée ».',
      'Une photo d’un tableau bien rangé rassure plus qu’un long texte.',
      'Donnez un conseil de sécurité simple de temps en temps : c’est utile, et ça se partage.'
    ],
    exemples: [
      {
        situation: 'Chantier terminé',
        source: 'Mise aux normes du tableau électrique dans une maison des années 70. Tout est repris, nouveau tableau, différentiels, repérage des circuits.',
        facebook: 'Un tableau électrique remis à neuf, une maison plus sûre. ⚡\n\nNous venons de mettre aux normes l’installation d’une maison des années 70 : nouveau tableau, protections différentielles et repérage clair de chaque circuit.\n\nUn tableau bien organisé, c’est plus de sécurité et moins de recherches le jour où un disjoncteur saute.\n\nVotre installation date un peu ? Nous pouvons faire le point avec vous.',
        instagram: 'Tableau électrique refait à neuf ⚡\n\nMaison des années 70, mise aux normes complète : nouveau tableau, différentiels, circuits repérés.\n\nVotre installation date ? Parlons-en.\n\n#Électricien #MiseAuxNormes #TableauÉlectrique #Rénovation'
      },
      {
        situation: 'Conseil de sécurité',
        source: 'Pensez à tester régulièrement le bouton test de vos disjoncteurs différentiels. Ça prend quelques secondes.',
        facebook: 'Un réflexe de sécurité qui prend quelques secondes. 🔌\n\nVotre tableau électrique comporte des disjoncteurs différentiels équipés d’un bouton « test ». L’actionner régulièrement permet de vérifier qu’ils fonctionnent.\n\nVous ne savez pas où il se trouve ? Posez-nous la question en commentaire, nous vous répondons.',
        instagram: 'Un réflexe de sécurité de quelques secondes 🔌\n\nTestez régulièrement le bouton « test » de vos disjoncteurs différentiels.\n\nUne question ? Écrivez-nous.\n\n#Électricien #Sécurité #Astuce #Maison'
      },
      {
        situation: 'Nouveaux chantiers',
        source: 'On prend de nouveaux chantiers à partir de novembre : dépannage, installation, borne de recharge. Devis gratuit.',
        facebook: 'Nous prenons de nouveaux chantiers à partir de novembre. 🗓️\n\nDépannage, installation, borne de recharge… quel que soit votre projet, parlons-en : le devis est gratuit.\n\nEnvoyez-nous un message ou appelez-nous, avec quelques mots sur ce que vous souhaitez faire.',
        instagram: 'Nouveaux chantiers à partir de novembre 🗓️\n\nDépannage, installation, borne de recharge. Devis gratuit : écrivez-nous.\n\n#Électricien #BorneDeRecharge #Devis'
      }
    ]
  },
  {
    slug: 'macon',
    nom: 'Maçon',
    pour: 'un maçon',
    resume: 'Extensions, rénovation de pierre et congés d’hiver.',
    intro: 'Un chantier de maçonnerie dure des semaines : c’est une chance de raconter l’avancement, de montrer le résultat et d’annoncer vos périodes de fermeture. Trois exemples de publications à partir d’un texte simple.',
    conseils: [
      'Racontez les étapes d’un chantier long : un post au gros œuvre, un autre à la fin, c’est de la matière pour plusieurs semaines.',
      'Les avant / après (façade, mur en pierre) sont ce qui fonctionne le mieux.',
      'Annoncez vos dates de fermeture : vos clients savent quand vous reprenez et quand vous répondre.'
    ],
    exemples: [
      {
        situation: 'Avancement de chantier',
        source: 'On a monté une extension de 25 m² en parpaings avec isolation. Gros œuvre terminé, place aux finitions.',
        facebook: 'Le gros œuvre de cette extension est terminé. 🧱\n\n25 m² de plus à vivre, montés avec soin : les murs sont levés, l’isolation est en place et les finitions vont pouvoir commencer.\n\nUn grand merci à nos clients pour leur confiance.\n\nVous pensez agrandir votre maison ? Dites-nous ce dont vous rêvez, nous regardons ensemble ce qui est possible.',
        instagram: 'Extension de 25 m² : gros œuvre terminé 🧱\n\nMurs montés, isolation en place, place aux finitions.\n\nUn projet d’agrandissement ? Écrivez-nous.\n\n#Maçon #Extension #GrosŒuvre #Construction'
      },
      {
        situation: 'Avant / après',
        source: 'Rénovation d’un mur en pierre : rejointoiement à la chaux. Avant / après en photos.',
        facebook: 'Avant / après : un mur en pierre retrouve toute sa beauté. 🪨\n\nRejointoiement à la chaux, pierre par pierre : la façade retrouve son caractère d’origine. C’est un travail de patience, mais le résultat parle de lui-même.\n\nVous avez un mur ou une façade en pierre à rénover ? Envoyez-nous une photo, nous vous dirons ce que nous ferions.',
        instagram: 'Avant / après 🪨\n\nMur en pierre rejointoyé à la chaux. Le caractère d’origine est de retour.\n\nUne façade à rénover ? Envoyez-nous une photo.\n\n#Maçon #Pierre #Chaux #AvantAprès'
      },
      {
        situation: 'Congés d’hiver',
        source: 'On ferme pour les congés d’hiver du 24 décembre au 5 janvier. Reprise des chantiers le 6.',
        facebook: 'Nous faisons une pause du 24 décembre au 5 janvier. 🎄\n\nLes chantiers reprennent le 6 janvier. Pour un devis ou une question, laissez-nous un message : nous vous répondrons dès notre retour.\n\nMerci à tous nos clients pour cette année, et de très belles fêtes à vous !',
        instagram: 'Fermeture du 24 décembre au 5 janvier 🎄\n\nReprise des chantiers le 6. Un devis à demander ? Laissez-nous un message.\n\nBelles fêtes !\n\n#Maçon #Fêtes #Congés'
      }
    ]
  },
  {
    slug: 'peintre-en-batiment',
    nom: 'Peintre en bâtiment',
    pour: 'un peintre en bâtiment',
    resume: 'Chantiers de peinture, préparation des supports et créneaux libres.',
    intro: 'La peinture se juge à l’œil : une belle photo accompagnée de quelques mots suffit pour donner envie. Voici trois exemples de textes pour montrer vos chantiers, expliquer votre méthode et annoncer un créneau libre.',
    conseils: [
      'Nommez les couleurs et les finitions (vert sauge, laqué, mat) : les gens les retiennent et les recherchent.',
      'Expliquez la préparation des murs : c’est ce qui distingue un vrai professionnel.',
      'Annoncez un créneau libre quand vous en avez un : c’est la publication qui déclenche le plus de messages.'
    ],
    exemples: [
      {
        situation: 'Chantier terminé',
        source: 'Salon repeint en vert sauge, plafond blanc, boiseries laquées. Les clients sont ravis du résultat.',
        facebook: 'Un salon qui change de visage. 🎨\n\nMurs en vert sauge, plafond blanc, boiseries laquées : la pièce respire autrement. Les clients sont ravis du résultat, et nous aussi.\n\nMerci à eux pour leur confiance, et pour leur joli choix de couleur !\n\nUn projet de peinture, même petit ? Racontez-nous ce que vous imaginez.',
        instagram: 'Salon repeint 🎨\n\nVert sauge, plafond blanc, boiseries laquées. Les clients sont ravis !\n\nUne pièce à rafraîchir ? Écrivez-nous.\n\n#PeintreEnBâtiment #VertSauge #Décoration #Peinture'
      },
      {
        situation: 'Savoir-faire',
        source: 'Avant de repeindre : on lessive, on rebouche, on ponce. Une bonne préparation fait toute la différence.',
        facebook: 'Le secret d’une belle peinture ? La préparation. 🖌️\n\nAvant le premier coup de rouleau : lessiver, reboucher, poncer. Ces étapes ne se voient pas une fois le chantier fini, mais elles font toute la différence sur la durée.\n\nEt vous, quelle pièce aimeriez-vous rafraîchir en premier ?',
        instagram: 'Le secret d’une belle peinture : la préparation 🖌️\n\nLessiver, reboucher, poncer. On ne le voit pas, mais ça change tout.\n\n#PeintreEnBâtiment #Peinture #Astuce #Rénovation'
      },
      {
        situation: 'Créneau disponible',
        source: 'Un créneau se libère pour un chantier de peinture fin novembre. Premier arrivé, premier servi.',
        facebook: 'Un créneau se libère fin novembre. 📅\n\nNous pouvons prendre un chantier de peinture à cette période : chambre, salon, cage d’escalier… Premier arrivé, premier servi.\n\nSi vous hésitiez à vous lancer, c’est le moment d’en parler : envoyez-nous un message avec quelques mots sur votre projet.',
        instagram: 'Un créneau se libère fin novembre 📅\n\nChambre, salon, escalier : parlons de votre projet de peinture. Premier arrivé, premier servi.\n\n#PeintreEnBâtiment #Peinture #Devis'
      }
    ]
  },
  {
    slug: 'paysagiste',
    nom: 'Paysagiste',
    pour: 'un paysagiste',
    resume: 'Création de jardin, conseils de saison et contrats d’entretien.',
    intro: 'Un jardin, ça se montre, ça se saisonne et ça s’entretient toute l’année. Autant de sujets de publications qui parlent à vos clients. Trois exemples à partir de quelques phrases.',
    conseils: [
      'Suivez les saisons : plantation à l’automne, taille au printemps, entretien l’été. Vos clients y pensent à ce moment-là.',
      'Citez les plantes et les matériaux (vivaces, charmille, terrasse bois) : ce sont des mots que les gens recherchent.',
      'Annoncez l’ouverture de votre planning d’entretien : c’est une demande qui revient chaque année.'
    ],
    exemples: [
      {
        situation: 'Création terminée',
        source: 'Création d’un jardin avec terrasse en bois, massifs de vivaces et une haie de charmille. Fin de chantier.',
        facebook: 'Un jardin tout juste terminé. 🌿\n\nTerrasse en bois, massifs de vivaces et haie de charmille : l’espace est prêt à être vécu.\n\nUn grand merci à nos clients pour leur confiance.\n\nEt vous, de quoi rêvez-vous pour votre extérieur ? Dites-le-nous en commentaire.',
        instagram: 'Jardin terminé 🌿\n\nTerrasse en bois, vivaces et haie de charmille. Merci à nos clients pour leur confiance !\n\nUn projet d’extérieur ? Écrivez-nous.\n\n#Paysagiste #Jardin #Terrasse #Vivaces'
      },
      {
        situation: 'Conseil de saison',
        source: 'C’est le moment de planter les arbres et arbustes avant l’hiver, et de ramasser les feuilles sur la pelouse.',
        facebook: 'L’automne, c’est le bon moment pour planter. 🍂\n\nArbres et arbustes s’installent avant l’hiver et démarrent plus sereinement au printemps. Pensez aussi à ramasser les feuilles sur la pelouse pour la laisser respirer.\n\nUn projet de plantation ? Parlez-nous de votre jardin, nous vous conseillons.',
        instagram: 'L’automne, c’est le moment de planter 🍂\n\nArbres, arbustes, et un coup de râteau sur la pelouse.\n\nBesoin d’un conseil ? Écrivez-nous.\n\n#Paysagiste #Automne #Plantation #Jardin'
      },
      {
        situation: 'Entretien de jardin',
        source: 'Entretien de jardin : on prend de nouveaux clients pour 2027. Tonte, taille, désherbage. Devis gratuit.',
        facebook: 'Nous ouvrons notre planning d’entretien pour 2027. ✂️\n\nTonte, taille, désherbage : nous nous occupons de votre jardin pour que vous puissiez en profiter. Le devis est gratuit.\n\nContactez-nous dès maintenant pour réserver votre place.',
        instagram: 'Entretien de jardin 2027 : nous prenons de nouveaux clients ✂️\n\nTonte, taille, désherbage. Devis gratuit. Écrivez-nous.\n\n#Paysagiste #EntretienJardin #Jardin'
      }
    ]
  },
  {
    slug: 'boulangerie',
    nom: 'Boulangerie',
    pour: 'une boulangerie',
    resume: 'Nouveautés, commandes de fêtes et fermeture annuelle.',
    intro: 'Une boulangerie vit au rythme de ses nouveautés, de ses fêtes et de ses fermetures. Ce sont aussi les publications que vos clients attendent. Trois exemples à partir de textes très courts.',
    conseils: [
      'Annoncez les dates limites de commande (Noël, Pâques, galette) : c’est ce qui évite les oublis et déclenche les commandes.',
      'Photographiez le produit du jour, tel qu’il est, sorti du four : c’est ce qui donne faim.',
      'Dites clairement les dates de fermeture et de réouverture pour éviter les portes closes.'
    ],
    exemples: [
      {
        situation: 'Nouveauté',
        source: 'Nouveau cette semaine : le pain aux noix et aux figues, fait au levain. Disponible tous les matins.',
        facebook: 'Du nouveau au fournil : le pain aux noix et aux figues ! 🥖\n\nFait au levain, il est disponible tous les matins à partir de cette semaine.\n\nVenez le goûter à la boulangerie, et dites-nous ce que vous en pensez !',
        instagram: 'Nouveau : pain aux noix et aux figues 🥖\n\nFait au levain, disponible tous les matins. Venez le goûter !\n\n#Boulangerie #PainAuLevain #Artisan #Nouveauté'
      },
      {
        situation: 'Commandes de fêtes',
        source: 'Pour Noël, on prend les commandes de bûches et de pains surprise jusqu’au 20 décembre. À commander au magasin.',
        facebook: 'Les commandes de Noël sont ouvertes ! 🎄\n\nBûches, pains surprise… vous pouvez commander au magasin jusqu’au 20 décembre.\n\nPour être sûrs de régaler toute votre tablée, passez nous voir un peu à l’avance. Nous serons ravis de préparer vos fêtes avec vous.',
        instagram: 'Commandes de Noël ouvertes 🎄\n\nBûches et pains surprise, à commander au magasin jusqu’au 20 décembre.\n\n#Boulangerie #Noël #Bûche #PainSurprise'
      },
      {
        situation: 'Fermeture annuelle',
        source: 'On ferme pour congés du 3 au 17 août. Réouverture le 18. Merci à nos clients, à bientôt.',
        facebook: 'Fermeture annuelle du 3 au 17 août. 🌞\n\nLa boulangerie fait une pause et rouvre le 18 août.\n\nMerci à tous nos clients, on se retrouve très vite. Bel été à vous !',
        instagram: 'Fermeture du 3 au 17 août 🌞\n\nRéouverture le 18. Merci à nos clients, bel été à tous !\n\n#Boulangerie #Congés #Été'
      }
    ]
  },
  {
    slug: 'fleuriste',
    nom: 'Fleuriste',
    pour: 'un fleuriste',
    resume: 'Fêtes, arrivages de saison et conseils d’entretien des bouquets.',
    intro: 'Le calendrier d’un fleuriste est fait de dates clés : fête des mères, Toussaint, Saint-Valentin, Noël. Chacune est une occasion de publier. Trois exemples de textes pour Facebook et Instagram.',
    conseils: [
      'Publiez quelques jours avant chaque fête, en indiquant jusqu’à quand on peut commander.',
      'Montrez les arrivages : une photo de saison, et la date où ils sont en magasin.',
      'Un conseil d’entretien (couper les tiges, changer l’eau) se partage beaucoup et vous rend utile.'
    ],
    exemples: [
      {
        situation: 'Fête à venir',
        source: 'Fête des mères dimanche. On prépare des bouquets et des compositions. Commandes jusqu’à samedi midi.',
        facebook: 'Dimanche, c’est la fête des mères. 💐\n\nNous préparons des bouquets et des compositions pour dire merci. Vous pouvez commander jusqu’à samedi midi.\n\nPour une attention qui touche juste, dites-nous à qui elle est destinée : nous vous aidons à choisir.',
        instagram: 'Dimanche, fête des mères 💐\n\nBouquets et compositions, commandes jusqu’à samedi midi.\n\n#Fleuriste #FêteDesMères #Bouquet'
      },
      {
        situation: 'Arrivage',
        source: 'Arrivage de chrysanthèmes et de bruyères pour la Toussaint. Plein de couleurs, au magasin dès demain.',
        facebook: 'Arrivage pour la Toussaint ! 🌼\n\nChrysanthèmes et bruyères, en pleines couleurs, sont au magasin dès demain.\n\nPassez les voir, nous vous aidons à choisir.',
        instagram: 'Arrivage de Toussaint 🌼\n\nChrysanthèmes et bruyères, plein de couleurs, au magasin dès demain.\n\n#Fleuriste #Toussaint #Chrysanthèmes #Bruyère'
      },
      {
        situation: 'Conseil',
        source: 'Astuce : pour garder un bouquet plus longtemps, on recoupe les tiges en biais et on change l’eau tous les deux jours.',
        facebook: 'Pour garder votre bouquet plus longtemps : deux gestes simples. 🌷\n\nRecoupez les tiges en biais, et changez l’eau tous les deux jours.\n\nVotre bouquet vous en remerciera ! Et vous, quelles fleurs préférez-vous en ce moment ?',
        instagram: 'Un bouquet qui dure plus longtemps 🌷\n\nTiges recoupées en biais, eau changée tous les deux jours.\n\n#Fleuriste #Bouquet #AstuceFleurs'
      }
    ]
  },
  {
    slug: 'salon-de-coiffure',
    nom: 'Salon de coiffure',
    pour: 'un salon de coiffure',
    resume: 'Transformations, conseils de soin et nouveaux horaires.',
    intro: 'Dans un salon, tout passe par l’image et par la confiance. Une transformation, un conseil de soin ou de nouveaux horaires : voici trois exemples de publications à partir d’un texte de départ très simple.',
    conseils: [
      'Demandez l’accord de la cliente avant de publier une photo d’elle, et remerciez-la dans le texte.',
      'Nommez la technique (balayage, carré plongeant) : c’est ce que les gens recherchent avant de prendre rendez-vous.',
      'Rappelez comment réserver (téléphone, message) dans chaque publication d’horaires.'
    ],
    exemples: [
      {
        situation: 'Transformation',
        source: 'Cheveux longs abîmés, coupe au carré plongeant et balayage miel. La cliente est ravie.',
        facebook: 'Un joli changement de coupe. ✂️\n\nDe longueurs abîmées à un carré plongeant avec balayage miel. La cliente est ravie, et nous aussi.\n\nMerci à elle pour sa confiance !\n\nEnvie de changer de tête vous aussi ? Prenez rendez-vous, nous en parlerons ensemble.',
        instagram: 'Avant / après ✂️\n\nCarré plongeant et balayage miel. La cliente est ravie !\n\nEnvie d’un changement ? Prenez rendez-vous.\n\n#Coiffeur #CarréPlongeant #BalayageMiel #AvantAprès'
      },
      {
        situation: 'Conseil de saison',
        source: 'Avec le froid et le chauffage, les cheveux se dessèchent. Un soin hydratant par semaine. On vous conseille lequel au salon.',
        facebook: 'Le froid et le chauffage dessèchent les cheveux. ❄️\n\nPensez à un soin hydratant par semaine. Au salon, nous vous conseillons celui qui convient à votre type de cheveux : demandez-nous lors de votre prochain rendez-vous.\n\nEt vous, quel est votre rituel d’hiver ?',
        instagram: 'Cheveux secs en hiver ? ❄️\n\nUn soin hydratant par semaine, et on vous conseille le bon au salon.\n\n#Coiffeur #SoinCheveux #Hiver #Cheveux'
      },
      {
        situation: 'Nouveaux horaires',
        source: 'Nouveaux horaires à partir de lundi : ouvert du mardi au samedi, de 9h à 18h, sur rendez-vous.',
        facebook: 'Nouveaux horaires dès lundi ! 🕘\n\nLe salon vous accueille du mardi au samedi, de 9h à 18h, sur rendez-vous.\n\nPour réserver votre créneau, appelez-nous ou envoyez-nous un message. À très bientôt !',
        instagram: 'Nouveaux horaires dès lundi 🕘\n\nDu mardi au samedi, 9h-18h, sur rendez-vous. Écrivez-nous pour réserver.\n\n#Coiffeur #Horaires #RendezVous'
      }
    ]
  },
  {
    slug: 'restaurant',
    nom: 'Restaurant',
    pour: 'un restaurant',
    resume: 'Carte de saison, soirées spéciales et fermetures exceptionnelles.',
    intro: 'Un restaurant a besoin de dire ce qu’il y a dans l’assiette et quand il est ouvert. Carte de saison, soirée spéciale, fermeture exceptionnelle : trois exemples de publications à partir de quelques mots.',
    conseils: [
      'Citez les plats par leur nom : c’est ce qui donne envie et ce que les gens recherchent.',
      'Pour une soirée spéciale, dites toujours : la date, le nombre de places et comment réserver.',
      'Annoncez les fermetures dès que vous les connaissez : un client qui trouve porte close ne revient pas toujours.'
    ],
    exemples: [
      {
        situation: 'Nouvelle carte',
        source: 'Nouvelle carte d’automne : velouté de potimarron, souris d’agneau confite, tarte aux poires. Produits de saison.',
        facebook: 'Notre carte d’automne est arrivée. 🍂\n\nAu menu : velouté de potimarron, souris d’agneau confite et tarte aux poires, avec des produits de saison.\n\nVenez vous réchauffer à notre table ! Réservez votre place.',
        instagram: 'La carte d’automne est là 🍂\n\nVelouté de potimarron, souris d’agneau confite, tarte aux poires. Produits de saison.\n\nRéservez votre table !\n\n#Restaurant #CarteDAutomne #ProduitsDeSaison #Cuisine'
      },
      {
        situation: 'Soirée spéciale',
        source: 'Soirée jeudi : menu dégustation en 4 plats avec accord mets et vins. Places limitées, sur réservation.',
        facebook: 'Jeudi soir, une soirée dégustation. 🍷\n\nAu programme : un menu en 4 plats avec accord mets et vins. Les places sont limitées et uniquement sur réservation.\n\nRéservez vite pour ne pas manquer la table.',
        instagram: 'Jeudi : soirée dégustation 🍷\n\nMenu 4 plats, accord mets et vins. Places limitées, sur réservation.\n\n#Restaurant #Dégustation #AccordMetsEtVins'
      },
      {
        situation: 'Fermeture exceptionnelle',
        source: 'Fermeture exceptionnelle lundi et mardi pour travaux de cuisine. On rouvre mercredi midi.',
        facebook: 'Fermeture exceptionnelle lundi et mardi. 🔧\n\nNous faisons des travaux en cuisine. Le restaurant rouvre mercredi midi.\n\nMerci de votre compréhension, et à mercredi !',
        instagram: 'Fermeture exceptionnelle lundi et mardi 🔧\n\nTravaux de cuisine. Réouverture mercredi midi. À très vite !\n\n#Restaurant #Fermeture #Travaux'
      }
    ]
  },
  {
    slug: 'institut-de-beaute',
    nom: 'Institut de beauté',
    pour: 'un institut de beauté',
    resume: 'Nouveaux soins, cartes cadeaux et réservations de fin d’année.',
    intro: 'Dans un institut, vos clientes réservent à l’avance et aiment les nouveautés. Un nouveau soin, une idée cadeau, un rappel de réservation avant les fêtes : trois exemples de publications à partir de quelques phrases.',
    conseils: [
      'Présentez un nouveau soin avec sa durée et la façon de réserver : ce sont les deux questions qu’on vous posera.',
      'Parlez des cartes cadeaux un mois avant les fêtes, pas la veille.',
      'Rappelez que les créneaux se remplissent avant les périodes chargées : cela encourage à réserver tôt.'
    ],
    exemples: [
      {
        situation: 'Nouveau soin',
        source: 'Nouveau soin visage à l’institut : soin éclat à la vitamine C, 1 heure. Sur rendez-vous.',
        facebook: 'Nouveau soin visage à l’institut : le soin éclat à la vitamine C. ✨\n\nUne heure pour prendre soin de votre peau, sur rendez-vous.\n\nVous avez envie de vous accorder une pause ? Réservez votre créneau, nous vous accueillons avec plaisir.',
        instagram: 'Nouveau : soin éclat à la vitamine C ✨\n\n1 h dédiée à votre visage, sur rendez-vous. Réservez votre pause.\n\n#InstitutDeBeauté #SoinVisage #VitamineC #Beauté'
      },
      {
        situation: 'Idée cadeau',
        source: 'Pensez aux cartes cadeaux pour les fêtes, valables un an.',
        facebook: 'Une idée cadeau pour les fêtes : la carte cadeau. 🎁\n\nValable un an, elle permet d’offrir un moment de détente.\n\nPassez à l’institut, nous vous aidons à choisir celle qui convient.',
        instagram: 'Pour les fêtes : la carte cadeau 🎁\n\nValable un an. Offrez un moment de détente !\n\n#InstitutDeBeauté #CarteCadeau #IdéeCadeau #Noël'
      },
      {
        situation: 'Réservation avant les fêtes',
        source: 'Pensez à réserver votre épilation et vos soins avant les fêtes. Les créneaux partent vite en décembre.',
        facebook: 'Les fêtes approchent, pensez à réserver. 📅\n\nÉpilation, soins : les créneaux partent vite en décembre. Prenez rendez-vous dès maintenant pour être au calme le moment venu.\n\nContactez-nous pour choisir votre date.',
        instagram: 'Les fêtes approchent 📅\n\nLes créneaux de décembre partent vite : pensez à réserver épilation et soins.\n\n#InstitutDeBeauté #Fêtes #RendezVous #Beauté'
      }
    ]
  }
];
