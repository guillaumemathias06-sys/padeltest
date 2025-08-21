# Padel Auth Service

Ce projet fournit un service d'authentification minimal en Node.js sans dépendances externes.

## Endpoints
- `POST /auth/signup` – inscription avec `email`, `password`, `role`, `license_id`.
- `POST /auth/login` – connexion, renvoie un JWT basique.
- `GET /profile` – retourne le profil de l'utilisateur connecté.

## Scripts
- `npm start` lance le serveur sur le port 3000.
- `npm test` exécute des tests simples.
