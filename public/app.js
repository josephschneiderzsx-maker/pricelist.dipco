async function loadArticles() {
    try {
        showLoading(true);
        
        const response = await fetch('https://dipco.itxpress.net/api/public/articles');
        if (!response.ok) throw new Error('Erreur de chargement des données');
        
        const articles = await response.json();
        renderArticles(articles);
        showLoading(false);
    } catch (error) {
        showError(error.message);
    }
}

function renderArticles(articles) {
    const table = document.getElementById('articles-table');
    table.innerHTML = '';
    
    if (articles.length === 0) {
        table.innerHTML = `<tr><td colspan="7" class="text-center py-4">Aucun article trouvé</td></tr>`;
        return;
    }
    
    articles.forEach(article => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="fw-bold">${article.code || ''}</td>
            <td>${article.description || ''}</td>
            <td>${article.demar || ''}</td>
            <td>${formatCurrency(article.prix_vente)}</td>
            <td>${formatCurrency(article.achat_minimum)}</td>
            <td>${article.unite || ''}</td>
            <td>${article.type || ''}</td>
        `;
        table.appendChild(row);
    });
}

function formatCurrency(value) {
    if (!value && value !== 0) return '';
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2
    }).format(value);
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    loading.style.display = show ? 'block' : 'none';
}

function showError(message) {
    const errorMsg = document.getElementById('error-message');
    errorMsg.textContent = message;
    errorMsg.classList.remove('d-none');
    showLoading(false);
}

// Recherche dynamique
document.getElementById('searchInput').addEventListener('input', function() {
    const searchTerm = this.value.trim().toLowerCase();
    const rows = document.querySelectorAll('#articles-table tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
        
        // Mise en évidence des correspondances
        if (searchTerm && text.includes(searchTerm)) {
            row.classList.add('highlight');
        } else {
            row.classList.remove('highlight');
        }
    });
});

window.addEventListener('DOMContentLoaded', loadArticles);