# G2 Hub — Journal des décisions

Chaque décision porte un statut :
- ✅ **Validé** : acté ensemble, on construit dessus.
- 💡 **Proposé** : ma proposition, à discuter ou valider.
- ❓ **Ouvert** : question à trancher.

Une décision qui change = on ne réécrit pas l'ancienne : on la marque ~~remplacée~~ et on ajoute la
nouvelle avec sa date et sa raison.

---

## 1. Vision

✅ **2026-10-13 — Nom du projet : `g2-hub`** (dossier `C:\Users\guigo\Projet Web\g2-hub`).
Le « hub » central où se branchent toutes les applications clientes ; parlant pour un client
(« votre site est connecté au Hub »), extensible au-delà de l'auth et du stockage.

✅ **2026-10-13 — Objectif** : un service réutilisable qui gère **les accès (utilisateurs)** et **le
stockage de fichiers** de n'importe quelle application cliente, branchée par API. But : ne plus
dupliquer un système de connexion + un système de stockage à chaque client, et livrer vite un site
client relié au hub.

✅ **2026-10-13 — Modèle commercial** : un back-office (« console ») auquel les clients ont accès pour
agir sur leur site sans en avoir un à eux, contre un petit forfait mensuel couvrant stockage et
serveur.

✅ **2026-10-13 — Deux modes de distribution, un seul code** :
- **Instance partagée (par défaut)** : un seul G2 Hub hébergé par G2 WebDev, multi-clients, proposé
  contre un petit forfait mensuel.
- **Édition livrée** : un client qui veut son propre back-office reçoit un **clone** de G2 Hub,
  installé sur son serveur, qu'il gère et modifie lui-même (« livré d'usine »).

Conséquence 💡 : le même code doit tourner aussi bien avec des dizaines d'organisations qu'avec une
seule (l'édition livrée = une instance avec une organisation). Rien de propre à G2 WebDev n'est
codé en dur : nom de l'instance, domaine, S3, e-mail viennent de la configuration (`.env`), et un
script d'installation crée le premier superadmin.

✅ **2026-10-13 — Marque** : la console s'appelle **G2 Hub** (outil interne à l'entreprise, pas de
marque blanche). Les sites / portails / portfolios des clients portent leur propre logo — le hub ne
fait que servir leurs fichiers. Un client qui reçoit l'édition livrée la personnalise lui-même dans
le code.

## 2. Périmètre fonctionnel

✅ **2026-10-13 — Uniquement des fichiers, pas de contenu** : pas de CMS (textes, horaires…). Le hub
stocke des **fichiers dans des dossiers que le client crée lui-même** — « comme Supabase Storage, en
vraiment simple ».

✅ **2026-10-13 — Types de fichiers : images, vidéos, PDF.** Traitement inspiré de ShareMoment
(`Projects_G2_Webdev/0005_ShareMoment/share-moment`) — voir §5.

✅ **2026-10-13 — Plusieurs utilisateurs par client, avec des rôles prédéfinis** que l'admin du client
distribue.

✅ **2026-10-13 — Facturation hors du hub** : les factures mensuelles sont gérées par le futur portail
de G2 WebDev (pas encore créé). Le hub n'émet aucune facture.

Conséquence 💡 : le hub **mesure et applique** (stockage consommé par organisation, quota du forfait)
et **expose cette consommation** au portail G2 WebDev par une API interne ; le portail facture.

✅ **2026-10-13 — Premiers utilisateurs** : le futur portail + landing de G2 WebDev
(`Projects_G2_Webdev/0003_Suite_G2-Webdev`), une fois Créacioun terminé. Migrer Créacioun sur le hub
est possible plus tard, mais **pas une priorité**.

## 3. Modèle

💡 **Hiérarchie multi-tenant** :

```
Organisation (le client, facturé au mois, porte le quota du forfait)
 ├─ Membres (comptes console, avec un rôle — voir ci-dessous)
 └─ Application (son site vitrine, son portail…)
     ├─ Clés API (publique : lecture depuis le navigateur ; secrète : serveur à serveur)
     ├─ Origines autorisées (domaines du site → CORS)
     └─ Dossiers → Fichiers
```

💡 **Rôles prédéfinis** :
| Rôle | Portée | Droits |
|---|---|---|
| `superadmin` | toute l'instance | toi : toutes les organisations, forfaits, quotas |
| `owner` | son organisation | tout, dont membres, rôles, applications et clés API |
| `editor` | son organisation | créer / renommer / supprimer dossiers et fichiers |
| `viewer` | son organisation | consulter et télécharger |

💡 **Trois modes d'intégration** d'une application :
1. **Site 100 % front** (landing + galerie) : lit seulement, avec la clé publique ; le client gère
   ses fichiers dans la console.
2. **Site avec son propre admin** : écrit via l'API avec la clé secrète, côté serveur.
3. **Portail avec utilisateurs** : « Se connecter avec G2 Hub » (SSO OAuth2 / OpenID Connect).

## 4. Lecture par les sites clients

✅ **2026-10-13 — Les sites lisent les fichiers à l'exécution** (appel de l'API à chaque visite, pas
de régénération du site).

Conséquence 💡 : comme une panne du hub toucherait tous les sites, on limite la dépendance :
- les **fichiers publics sont servis directement par l'Object Storage** (URL stable, cache long
  `immutable` : un nom de fichier ne change jamais de contenu) — le hub n'est pas sur le chemin
  d'affichage d'une image ;
- seule la **liste** d'un dossier passe par l'API, avec un cache HTTP court (ex. 60 s) ;
- le SDK garde la dernière liste reçue et la ressert si l'API ne répond pas.

## 5. Stack technique

💡 Monorepo pnpm (modèle Créacioun) :
- `apps/console` — SvelteKit 2 + Svelte 5 : back-office **et** API `/api/v1/…`.
- `packages/db` — Prisma.
- `packages/sdk` — client TypeScript `@g2/hub-client` pour brancher un site en quelques lignes.

💡 Better Auth (comptes console ; plugin OIDC provider pour le SSO), PostgreSQL, S3 (MinIO en dev,
Infomaniak Object Storage en prod — config déjà maîtrisée sur Créacioun), `@guillaumeg/ui`,
Docker + `adapter-node` sur VPS Infomaniak.

💡 **Traitement des médias, repris de ShareMoment** :
- **Images** : `sharp` → WebP, rotation EXIF appliquée, métadonnées (GPS) retirées, plusieurs
  largeurs (vignette / moyenne / grande) pour des sites rapides.
- **Vidéos** : `ffmpeg` → H.264 / MP4 plafonné en 1080p (les vidéos iPhone en HEVC ne se lisent pas
  dans la plupart des navigateurs), image d'aperçu (poster) en WebP.
- **PDF** : stocké tel quel ; aperçu de la 1re page en option plus tard.

✅ **2026-10-13 — On ne garde que les versions traitées** : l'original d'une image ou d'une vidéo est
supprimé une fois le traitement réussi (WebP grande taille ~2 500 px + largeurs réduites ; vidéo
H.264 1080p + poster). Il ne compte donc pas dans le quota. Le PDF, lui, est l'original.

✅ **2026-10-13 — Taille maximale d'un fichier envoyé** : **20 Mo** pour une image, **200 Mo** pour
une vidéo. 💡 PDF : 20 Mo comme une image.
- **File d'attente en base** (pas de Redis) : `FOR UPDATE SKIP LOCKED`, un worker unique dans le
  process, `nice -n 19` sur le VPS, reprise des tâches interrompues au redémarrage, 3 essais max.

💡 **Envoi des fichiers** : directement du navigateur vers S3 par **URL présignée** (le fichier ne
transite pas par le serveur, contrairement à ShareMoment qui le relaie). Le hub vérifie avant
(type, taille, quota) puis confirme après (taille réelle lue sur S3) et lance le traitement.

## 6. Feuille de route

💡 Un commit par étape :

| Étape | Contenu |
|---|---|
| 0 ✅ | Scaffold du monorepo, Docker (Postgres + MinIO), Better Auth, layout de la console, script d'installation (1er superadmin) |
| 1 ✅ | Organisations, membres et rôles, applications |
| 2 | Dossiers (publics / privés) et fichiers : upload présigné, traitement images / vidéos / PDF, CRUD dans la console, **blocage au quota (1 Go)** |
| 3 | API publique + clés + CORS + SDK, avec une landing de démo et sa galerie branchée |
| 4 | Paliers au-delà de 1 Go (5 Go, 20 Go), suivi de la consommation, API interne pour le portail G2 WebDev |
| 5 | SSO pour les portails (OIDC) + espaces privés des utilisateurs d'application — utile au portail G2 WebDev |

Les étapes 0 à 3 suffisent pour vendre le cas « landing + galerie ».

## 7. Dossiers et visibilité

✅ **2026-10-13 — Dossiers imbriqués** (`galerie/2026/mariage`).

✅ **2026-10-13 — Deux visibilités** :
- **Public** : images, vidéos, PDF téléchargeables par n'importe quel visiteur du site.
- **Privé** : fichiers personnels — ceux d'un utilisateur de l'application, ou ceux de l'`owner`.

💡 Mise en œuvre :
- la visibilité se choisit **par dossier** et **s'hérite** dans ses sous-dossiers ;
- **deux buckets S3 séparés** : un public (lisible par URL directe, cache long) et un privé (jamais
  lisible directement ; accès par **lien signé de courte durée**, ex. 5 min, délivré par le hub
  après vérification des droits). Séparer les buckets évite qu'une erreur de règle expose un
  fichier privé ;
- changer la visibilité d'un dossier **déplace** ses fichiers d'un bucket à l'autre (tâche de fond,
  avec confirmation dans la console).

## 8. Utilisateurs des applications (portails)

✅ **2026-10-13 — Les utilisateurs d'un portail pourront envoyer des fichiers** (ex. un adhérent
dépose un document). On prévoit le cas, en restant simple pour commencer.

💡 Version simple : chaque utilisateur d'application a **son espace privé** dans l'application
(lecture / écriture de ses propres fichiers uniquement) ; l'`owner` et les `editor` de
l'organisation voient tout. Le modèle de données porte dès l'étape 2 le **propriétaire** de chaque
fichier (membre de la console ou utilisateur d'application), pour que l'étape 5 n'impose pas de
migration douloureuse.

## 9. Sécurité

✅ **2026-10-13 — Double authentification (TOTP) obligatoire** pour le `superadmin` et les `owner`.

💡 Facultative pour `editor` et `viewer` (activable dans leur profil).

💡 Clés API secrètes stockées **hachées** (affichées une seule fois à la création), révocables ;
clés publiques limitées en lecture et à leurs origines autorisées.

## 10. Quotas

~~✅ **2026-10-13 — 500 Mo par organisation**~~ — remplacé le jour même par le palier de 1 Go
ci-dessous (500 Mo jugé trop juste).

✅ **2026-10-13 — Quota de départ : 1 Go par organisation**, pour tout le monde, **toutes
applications confondues**. Paliers supérieurs : **1 Go → 5 Go → 20 Go** (champ « forfait » préparé
dans le hub ; la facturation reste dans le portail G2 WebDev).

✅ **2026-10-13 — Blocage strict** : un envoi qui ferait dépasser le quota est refusé ; le client doit
passer à un forfait supérieur. Pour réduire son stockage, il doit **supprimer** ses fichiers
lui-même (pas de rétrogradation automatique).

💡 Règles de calcul :
- on compte **tout ce qui est stocké** : uniquement les versions traitées (voir §5), poster
  compris ;
- la vérification se fait **avant** l'envoi (taille déclarée + déjà consommé ≤ quota), puis la
  consommation est **recalculée** après traitement (une vidéo transcodée est souvent plus légère que
  l'original) ;
- la suppression d'un fichier libère immédiatement son espace (pas de corbeille en v1) ;
- le forfait (quota) d'une organisation est modifiable par le `superadmin` dans la console, en
  attendant le portail G2 WebDev.

## 11. Licence de l'édition livrée

✅ **2026-10-13 — Droit de modifier, interdiction absolue de revendre** :
- le client peut modifier le code pour son propre usage (en pratique, G2 WebDev propose la
  personnalisation comme prestation) ;
- **aucun droit de revendre, redistribuer, ni céder une licence** du produit, **même modifié**.

💡 Un fichier `LICENSE` **propriétaire** (pas open source) dans le dépôt + une clause dans le contrat
de livraison. Le texte final est à faire relire par un juriste.

## 12. Offres et emplacement du stockage

✅ **2026-10-13 — Le stockage devient une option** : deux offres distinctes,
**« Accès »** (gestion des utilisateurs seule) et **« Accès + Stockage »**. Le stockage s'active par
organisation.

✅ **2026-10-13 — Un client peut vouloir ses fichiers sur le disque de son propre VPS**, comme sa
base de données.

~~💡 **Drivers de stockage** (`s3` + `local`)~~ — remplacé le 2026-10-13 par la décision ci-dessous :
le stockage se configure par instance, le driver `local` n'est plus nécessaire en v1.

✅ **2026-10-13 — Le stockage se configure par instance (`.env`), pas par client** :
- **instance partagée** : le S3 Infomaniak de G2 WebDev (tes clés) ;
- **client qui veut son propre stockage** (ex. son propre S3 Infomaniak) : on lui livre un **clone**
  du hub avec **ses** clés S3 dans le `.env` — aucun code spécifique.
Le scénario « instance partagée qui écrit dans le stockage d'un client » est abandonné.

💡 v1 : uniquement S3. Le stockage reste derrière une interface (envoyer, lire, supprimer, lister,
lien signé) pour qu'un driver `local` (disque du VPS) puisse s'ajouter plus tard si un client le
demande, sans toucher aux sites. Et la règle ci-dessous reste valable :

<details><summary>Ancienne proposition (pour mémoire)</summary>

💡 **Drivers de stockage** : le hub range les fichiers via une interface unique (envoyer, lire,
supprimer, lister, lien signé) avec deux implémentations :
- `s3` — Object Storage (Infomaniak en prod, MinIO en dev) ;
- `local` — un dossier du disque du VPS (ex. `/var/g2-hub/storage/{public,private}`).

**Règle** : les sites et applications clientes ne lisent ni n'écrivent **jamais** les fichiers
directement sur le disque ou le bucket ; ils passent toujours par l'API / le SDK du hub. Leur code
est donc identique quel que soit le driver (même principe que Prisma pour la base).

💡 Différences gérées par le driver `local` :
- envoi : le fichier transite par le hub (flux, sans tout charger en mémoire — comme ShareMoment),
  puisqu'il n'y a pas d'URL présignée S3 ;
- fichiers publics servis directement par **nginx** depuis le dossier public (rapide, cache long) ;
- fichiers privés servis par le hub via un **lien signé** (HMAC + expiration) ;
- quota : celui du forfait s'applique quand c'est G2 WebDev qui héberge ; sur le disque du client,
  la limite est son disque (quota facultatif).

</details>

## 13. Cloisonnement des clients

✅ **2026-10-13 — Cloisonnement strict entre organisations** : un `owner` (et ses membres) ne voit
**que** son organisation — ses applications, fichiers, membres et accès. **Seul le `superadmin`
voit tout**, pour gérer les organisations et leurs `owner`.

✅ **2026-10-13 — Raison d'être de l'instance partagée** : un client qui ne veut pas de back-office à
lui (il se connecte quelques fois par an) utilise le tien ; le hub gère ses connexions par client
et par application.

💡 Mise en œuvre :
- l'organisation courante vient **toujours de la session** (ou de la clé API), jamais d'un
  paramètre envoyé par le navigateur ;
- chaque requête d'un repository sur des données client prend l'`organizationId` en paramètre
  obligatoire ; le contournement `superadmin` est explicite (fonctions dédiées), jamais implicite ;
- un id reçu (dossier, fichier, application) est toujours vérifié comme appartenant à
  l'organisation courante — sinon **404** (et non 403, pour ne pas révéler qu'il existe ailleurs) ;
- plus tard, en défense supplémentaire : Row-Level Security PostgreSQL.

## 14. Choix d'implémentation de l'étape 1

💡 **Organisation active stockée dans la session** (`session.activeOrganizationId`), écrite
uniquement côté serveur après vérification de l'appartenance, et revérifiée à chaque requête par le
hook (membre retiré, organisation supprimée…). Un membre d'une seule organisation l'a
automatiquement ; le superadmin choisit « Travailler dans cette organisation » dans la liste.

💡 **Comptes créés sans e-mail** (pas encore de SMTP) : créer une organisation (son propriétaire) ou
ajouter un membre crée le compte s'il n'existe pas, avec un **mot de passe temporaire affiché une
seule fois** (14 caractères, sans caractères ambigus). La personne le change dans « Sécurité ».
Si le compte existe déjà (membre d'une autre organisation), il est simplement ajouté.

💡 **Qui fait quoi** :
- créer / modifier (nom, offre, forfait) / supprimer une organisation : **superadmin uniquement** ;
- page Membres (ajouter, changer de rôle, retirer) : **owner** (et superadmin) ;
- Applications : **visibles par tous les membres**, créées / modifiées / supprimées par l'owner ;
- une organisation garde **toujours au moins un owner** (il ne peut ni se rétrograder ni être
  retiré s'il est le dernier).

💡 **Retrait d'un membre** : si son compte n'appartient plus à **aucune** organisation, il est
**supprimé** (sinon il pourrait encore se connecter sans rien voir). Supprimer une organisation,
en revanche, **conserve** les comptes de ses membres.

💡 **Origines autorisées** d'une application : schéma + domaine (+ port), sans chemin
(`https://monsite.fr`, `http://localhost:5173`), barre finale retirée, doublons fusionnés,
20 maximum.

## 15. Questions ouvertes

Aucune pour l'instant.
