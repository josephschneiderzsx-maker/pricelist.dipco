// Variables globales
let articles = [];
let users = [];

// Modals Bootstrap
const articleModal = new bootstrap.Modal(document.getElementById('articleModal'));
const userModal = new bootstrap.Modal(document.getElementById('userModal'));

// Headers avec token JWT
function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    };
}

// Chargement initial
window.addEventListener('DOMContentLoaded', () => {
    loadArticles();
    loadUsers();
});

// ====================== ARTICLES ======================

async function loadArticles() {
    try {
        setLoading('articles', true);
        const res = await fetch('/api/admin/articles', {
            headers: authHeaders()
        });
        if (!res.ok) throw new Error('Erreur lors du chargement des articles');
        articles = await res.json();
        renderArticles();
    } catch (e) {
        showError('articles', e.message);
    } finally {
        setLoading('articles', false);
    }
}

function renderArticles() {
    const tbody = document.getElementById('articlesTable');
    tbody.innerHTML = articles.length ? '' : `<tr><td colspan="8" class="text-center py-4">Aucun article trouvé</td></tr>`;

    articles.forEach(article => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${article.code}</td>
            <td>${article.description}</td>
            <td>${article.demar || ''}</td>
            <td>${formatCurrency(article.prix_vente)}</td>
            <td>${formatCurrency(article.achat_minimum)}</td>
            <td>${article.unite || ''}</td>
            <td>${article.type || ''}</td>
            <td>
                <button class="btn btn-sm btn-primary edit-article" data-id="${article.id}"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger delete-article" data-id="${article.id}"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    attachArticleActions();
}

function attachArticleActions() {
    document.querySelectorAll('.edit-article').forEach(btn => {
        btn.onclick = () => openArticleModal(btn.dataset.id);
    });
    document.querySelectorAll('.delete-article').forEach(btn => {
        btn.onclick = () => deleteArticle(btn.dataset.id);
    });
}

function openArticleModal(id = null) {
    clearArticleForm();
    const modalTitle = document.getElementById('articleModalTitle');

    if (id) {
        const article = articles.find(a => a.id == id);
        if (!article) return alert("Article non trouvé");
        modalTitle.textContent = 'Modifier un article';
        document.getElementById('articleId').value = article.id;
        document.getElementById('code').value = article.code;
        document.getElementById('type').value = article.type;
        document.getElementById('description').value = article.description;
        document.getElementById('prix_vente').value = article.prix_vente;
        document.getElementById('achat_minimum').value = article.achat_minimum;
        document.getElementById('unite').value = article.unite;
        document.getElementById('demar').value = article.demar;
    } else {
        modalTitle.textContent = 'Ajouter un article';
    }

    articleModal.show();
}

function clearArticleForm() {
    document.getElementById('articleForm').reset();
    document.getElementById('articleId').value = '';
}

async function saveArticle() {
    const id = document.getElementById('articleId').value;
    const data = {
        code: document.getElementById('code').value.trim(),
        type: document.getElementById('type').value.trim(),
        description: document.getElementById('description').value.trim(),
        prix_vente: parseFloat(document.getElementById('prix_vente').value),
        achat_minimum: parseFloat(document.getElementById('achat_minimum').value) || 0,
        unite: document.getElementById('unite').value.trim(),
        demar: document.getElementById('demar').value.trim(),
    };

    if (!data.code || !data.description || isNaN(data.prix_vente)) {
        return alert('Veuillez remplir tous les champs obligatoires.');
    }

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/admin/articles/${id}` : `/api/admin/articles`;
        const res = await fetch(url, {
            method,
            headers: authHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Erreur lors de l\'enregistrement');
        articleModal.hide();
        await loadArticles();
        alert('Article enregistré avec succès.');
    } catch (e) {
        alert(e.message);
    }
}

async function deleteArticle(id) {
    if (!confirm('Supprimer cet article ?')) return;
    try {
        const res = await fetch(`/api/admin/articles/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (!res.ok) throw new Error('Erreur lors de la suppression');
        await loadArticles();
        alert('Article supprimé.');
    } catch (e) {
        alert(e.message);
    }
}

// ====================== UTILISATEURS ======================

async function loadUsers() {
    try {
        setLoading('users', true);
        const res = await fetch('/api/admin/users', {
            headers: authHeaders()
        });
        if (!res.ok) throw new Error('Erreur lors du chargement des utilisateurs');
        users = await res.json();
        renderUsers();
    } catch (e) {
        showError('users', e.message);
    } finally {
        setLoading('users', false);
    }
}

function renderUsers() {
    const tbody = document.getElementById('usersTable');
    tbody.innerHTML = users.length ? '' : `<tr><td colspan="5" class="text-center py-4">Aucun utilisateur trouvé</td></tr>`;

    users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.name}</td>
            <td>${user.username}</td>
            <td>${user.role}</td>
            <td>${formatDate(user.created_at)}</td>
            <td>
                <button class="btn btn-sm btn-primary edit-user" data-id="${user.id}"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger delete-user" data-id="${user.id}"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    attachUserActions();
}

function attachUserActions() {
    document.querySelectorAll('.edit-user').forEach(btn => {
        btn.onclick = () => openUserModal(btn.dataset.id);
    });
    document.querySelectorAll('.delete-user').forEach(btn => {
        btn.onclick = () => deleteUser(btn.dataset.id);
    });
}

function openUserModal(id = null) {
    clearUserForm();
    const modalTitle = document.getElementById('userModalTitle');

    if (id) {
        const user = users.find(u => u.id == id);
        if (!user) return alert("Utilisateur non trouvé");
        modalTitle.textContent = 'Modifier un utilisateur';
        document.getElementById('userId').value = user.id;
        document.getElementById('name').value = user.name;
        document.getElementById('username').value = user.username;
        document.getElementById('role').value = user.role;
        document.getElementById('password').required = false;
        document.getElementById('passwordLabel').textContent = "Mot de passe (laisser vide pour ne pas modifier)";
    } else {
        modalTitle.textContent = 'Ajouter un utilisateur';
        document.getElementById('password').required = true;
        document.getElementById('passwordLabel').textContent = "Mot de passe*";
    }

    userModal.show();
}

function clearUserForm() {
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
}

async function saveUser() {
    const id = document.getElementById('userId').value;
    const data = {
        name: document.getElementById('name').value.trim(),
        username: document.getElementById('username').value.trim(),
        role: document.getElementById('role').value,
    };

    const password = document.getElementById('password').value;
    if (!id && password) data.password = password;
    if (id && password) data.password = password;

    if (!data.name || !data.username || (!id && !password)) {
        return alert('Merci de remplir tous les champs obligatoires.');
    }

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/admin/users/${id}` : `/api/admin/users`;
        const res = await fetch(url, {
            method,
            headers: authHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Erreur lors de l\'enregistrement');
        userModal.hide();
        await loadUsers();
        alert('Utilisateur enregistré avec succès.');
    } catch (e) {
        alert(e.message);
    }
}

async function deleteUser(id) {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    try {
        const res = await fetch(`/api/admin/users/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (!res.ok) throw new Error('Erreur lors de la suppression');
        await loadUsers();
        alert('Utilisateur supprimé.');
    } catch (e) {
        alert(e.message);
    }
}

// ====================== UTILITAIRES ======================

function formatCurrency(value) {
    if (value === null || value === undefined) return '';
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
    }).format(value);
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('fr-FR');
}

function setLoading(type, show) {
    const section = document.getElementById(`${type}-section`);
    if (section) section.style.opacity = show ? 0.5 : 1;
}

function showError(type, message) {
    alert(`Erreur (${type}) : ${message}`);
}

// ====================== EVENTS ======================

document.getElementById('btnAddArticle').onclick = () => openArticleModal();
document.getElementById('btnAddUser').onclick = () => openUserModal();

document.getElementById('articleForm').addEventListener('submit', e => {
    e.preventDefault();
    saveArticle();
});

document.getElementById('userForm').addEventListener('submit', e => {
    e.preventDefault();
    saveUser();
});

document.getElementById('searchArticles').addEventListener('input', e => {
    const val = e.target.value.toLowerCase();
    const filtered = articles.filter(a =>
        a.code.toLowerCase().includes(val) ||
        a.description.toLowerCase().includes(val) ||
        a.type.toLowerCase().includes(val)
    );
    renderArticles(filtered);
});

document.getElementById('searchUsers').addEventListener('input', e => {
    const val = e.target.value.toLowerCase();
    const filtered = users.filter(u =>
        u.name.toLowerCase().includes(val) ||
        u.username.toLowerCase().includes(val) ||
        u.role.toLowerCase().includes(val)
    );
    renderUsers(filtered);
});
