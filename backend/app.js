require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['https://dipco.itxpress.net', 'https://www.dipco.itxpress.net'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Rate limiter pour le login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Trop de tentatives, veuillez réessayer plus tard' }
});

// Connexion DB
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Middleware pour logger les requêtes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes publiques
app.get('/api/public/articles', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM articles');
    
    // Convertir les prix en nombres
    const articles = rows.map(row => ({
      ...row,
      prix_vente: parseFloat(row.prix_vente),
      achat_minimum: parseFloat(row.achat_minimum)
    }));
    
    res.json(articles);
  } catch (err) {
    console.error('Erreur récupération articles:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Gestion des utilisateurs
app.get('/api/admin/users', authenticate, isAdmin, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, name, username, role, created_at FROM users');
    res.json(users);
  } catch (err) {
    console.error('Erreur admin/users:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/admin/users', authenticate, isAdmin, async (req, res) => {
  const { name, username, password, role } = req.body;
  if (!name || !username || !password || !role) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      'INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)',
      [name, username, hashedPassword, role]
    );
    res.status(201).json({ id: result.insertId, name, username, role });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ce nom d\'utilisateur existe déjà' });
    }
    console.error('Erreur création utilisateur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.put('/api/admin/users/:id', authenticate, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, username, password, role } = req.body;

  try {
    let query = 'UPDATE users SET name = ?, username = ?, role = ?';
    const params = [name, username, role];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await pool.execute(query, params);
    res.json({ message: 'Utilisateur mis à jour' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ce nom d\'utilisateur existe déjà' });
    }
    console.error('Erreur mise à jour utilisateur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.delete('/api/admin/users/:id', authenticate, isAdmin, async (req, res) => {
  const { id } = req.params;

  // Empêcher la suppression de l'utilisateur admin principal (par exemple, id 1)
  if (String(id) === '1') {
    return res.status(403).json({ error: 'Impossible de supprimer l\'administrateur principal' });
  }

  try {
    await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'Utilisateur supprimé' });
  } catch (err) {
    console.error('Erreur suppression utilisateur:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Recherche d'articles
app.get('/api/public/articles/search', async (req, res) => {
  const searchTerm = req.query.q;
  if (!searchTerm) return res.status(400).json({ error: 'Terme manquant' });

  try {
    const [rows] = await pool.query(
      `SELECT * FROM articles 
       WHERE code LIKE ? OR description LIKE ? OR type LIKE ?`,
      [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
    );
    
    // Convertir les prix en nombres
    const articles = rows.map(row => ({
      ...row,
      prix_vente: parseFloat(row.prix_vente),
      achat_minimum: parseFloat(row.achat_minimum)
    }));
    
    res.json(articles);
  } catch (err) {
    console.error('Erreur recherche articles:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Authentification
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length === 0) return res.status(401).json({ error: 'Identifiants invalides' });

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Identifiants invalides' });

    // JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    }).json({ token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (err) {
    console.error('Erreur login:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Middleware d'authentification
const authenticate = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Session expirée' });
  }
};

// Middleware admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }
  next();
};

// CRUD Articles
app.get('/api/admin/articles', authenticate, isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM articles');
    res.json(rows);
  } catch (err) {
    console.error('Erreur admin/articles:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/admin/articles', authenticate, isAdmin, async (req, res) => {
  const { code, description, demar, prix_vente, achat_minimum, unite, type } = req.body;
  
  try {
    const [result] = await pool.execute(
      'INSERT INTO articles (code, description, demar, prix_vente, achat_minimum, unite, type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [code, description, demar, prix_vente, achat_minimum, unite, type]
    );
    
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('Erreur création article:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.put('/api/admin/articles/:id', authenticate, isAdmin, async (req, res) => {
  const id = req.params.id;
  const { code, description, demar, prix_vente, achat_minimum, unite, type } = req.body;
  
  try {
    await pool.execute(
      'UPDATE articles SET code=?, description=?, demar=?, prix_vente=?, achat_minimum=?, unite=?, type=? WHERE id=?',
      [code, description, demar, prix_vente, achat_minimum, unite, type, id]
    );
    
    res.json({ message: 'Article mis à jour' });
  } catch (err) {
    console.error('Erreur mise à jour article:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.delete('/api/admin/articles/:id', authenticate, isAdmin, async (req, res) => {
  const id = req.params.id;
  
  try {
    await pool.execute('DELETE FROM articles WHERE id=?', [id]);
    res.json({ message: 'Article supprimé' });
  } catch (err) {
    console.error('Erreur suppression article:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Gestion des utilisateurs (similaire mais avec username au lieu d'email)

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});

// Gestion des erreurs non catchées
process.on('uncaughtException', err => {
  console.error('Exception non gérée:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Rejet non géré:', reason);
});