# Padel Auth Service

Ce projet fournit un service d'authentification minimal en Node.js sans dépendances externes.

## Endpoints
- `POST /auth/signup` – inscription avec `email`, `password`, `role`, `license_id`.
- `POST /auth/login` – connexion, renvoie un JWT basique.
- `GET /profile` – retourne le profil de l'utilisateur connecté.
- `GET /players` – liste des joueurs enregistrés.
- `POST /players` – ajoute un joueur (`firstName`, `lastName`, `license`, `bio?`, `photo?`, `preferences?`, `ranking?`).
- `GET /players/:id` – retourne le profil complet d'un joueur.
- `GET /players?name=&minRanking=&maxRanking=` – recherche de joueurs.
- `GET /pairs` – liste des paires.
- `POST /pairs` – crée une paire (`p1`, `p2`, `seed`).
- `GET /tournaments` – liste des tournois.
- `POST /tournaments` – crée un tournoi (`name`, `startDate`, `endDate`, `category`, `superTB`).
- `POST /tournaments/:id/register` – inscrit une paire à un tournoi.
- `GET /tournaments/:id/registrations` – liste les paires inscrites.

## Scripts
- `npm start` lance le serveur sur le port 3000.
- `npm test` exécute des tests simples.
