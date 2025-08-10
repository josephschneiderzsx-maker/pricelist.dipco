# Projet Dashboard Admin - Dipco

Ce projet est une application web complète avec un frontend pour l'administration et un backend pour la gestion des données.

## Aperçu

L'application permet aux administrateurs de se connecter à un tableau de bord sécurisé pour gérer des articles (produits).

- **Frontend**: Construit avec HTML, CSS, et JavaScript vanilla. Il inclut une page de connexion et un tableau de bord pour le CRUD (Créer, Lire, Mettre à jour, Supprimer) des articles.
- **Backend**: Une API RESTful construite avec Node.js et Express.js. Elle gère l'authentification avec JWT et interagit avec une base de données MySQL.

## Technologies utilisées

- **Frontend**:
  - HTML5
  - CSS3 (avec une approche de style moderne)
  - JavaScript (ES6+)
  - [Tailwind CSS](https://tailwindcss.com/) (utilisé via CDN pour la page de connexion)
  - [Font Awesome](https://fontawesome.com/) (pour les icônes)

- **Backend**:
  - [Node.js](https://nodejs.org/)
  - [Express.js](https://expressjs.com/)
  - [MySQL2](https://github.com/sidorares/node-mysql2) (pour la connexion à la base de données MySQL)
  - [JSON Web Tokens (JWT)](https://jwt.io/) (pour l'authentification)
  - [bcrypt](https://github.com/kelektiv/node.bcrypt.js) (pour le hachage des mots de passe)
  - [dotenv](https://github.com/motdotla/dotenv) (pour la gestion des variables d'environnement)

## Installation et Lancement

### Prérequis

- Node.js et npm installés
- Une base de données MySQL fonctionnelle

### 1. Configuration du Backend

1.  **Clonez le dépôt** (ou téléchargez les fichiers) et naviguez dans le dossier `backend`:
    ```sh
    cd backend
    ```

2.  **Installez les dépendances** npm:
    ```sh
    npm install
    ```

3.  **Configurez les variables d'environnement**:
    Créez un fichier `.env` à la racine du dossier `backend` en vous basant sur le fichier `.env.example` (s'il existe) ou en utilisant les variables ci-dessous.

    ```env
    # Configuration du serveur
    PORT=3000

    # Configuration de la base de données
    DB_HOST=localhost
    DB_USER=votre_utilisateur_mysql
    DB_PASSWORD=votre_mot_de_passe_mysql
    DB_DATABASE=votre_base_de_donnees

    # Configuration JWT
    JWT_SECRET=un_secret_tres_long_et_securise
    JWT_EXPIRES_IN=1h
    ```

4.  **Démarrez le serveur backend**:
    ```sh
    node app.js
    ```
    Le serveur devrait maintenant tourner sur `http://localhost:3000`.

### 2. Lancement du Frontend

Le frontend est composé de fichiers statiques (HTML, CSS, JS). Il doit être servi par un serveur web. Pour un développement local simple, vous pouvez utiliser une extension comme "Live Server" dans VS Code.

1.  Ouvrez le fichier `admin/login.html` dans votre navigateur.
2.  L'application communiquera avec le backend qui tourne sur le port 3000. Assurez-vous que le backend est en cours d'exécution.

*Note: Les appels API dans le frontend sont relatifs (ex: `/api/auth/login`), ce qui signifie que le frontend doit être servi depuis la même origine que le backend ou utiliser un proxy pour éviter les problèmes de CORS. La configuration actuelle de CORS dans `app.js` est stricte et n'autorise que `https://dipco.itxpress.net`.* Pour le développement local, vous devrez peut-être ajuster les paramètres CORS dans `backend/app.js`.
