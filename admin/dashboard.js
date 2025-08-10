/*
  DIPCO Dashboard Admin
  - CRUD articles with API at /api/admin/articles
  - Features: search, filters, sort, add, edit, delete, batch add, export, toasts, auto-refresh
*/

/* ================= Configuration ================= */
const API_BASE = '/api/admin/articles';
const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes
let autoRefreshTimer = null;

/* ================= State ================= */
let articles = [];          // full list from server
let filtered = [];          // after search/filters/sort
let sortState = { key: null, dir: 1 }; // dir: 1 asc, -1 desc
let allUnits = [];          // unités existantes
let allTypes = [];          // types existants
let allDemars = [];         // démarques existantes

/* ================= Utils ================= */
function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` };
}

function toast(message, type='success', timeout=3500){
  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'success' ? '' : (type === 'err' ? 'err' : 'warn'));
  el.innerHTML = `
    <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'err' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle'}"></i>
    <div style="flex:1">${message}</div>
    <button style="background:transparent;border:none;color:var(--text-secondary);cursor:pointer" onclick="this.closest('.toast').remove()">
      <i class="fas fa-times"></i>
    </button>
  `;
  document.getElementById('toasts').appendChild(el);
  if(timeout) setTimeout(()=> el.remove(), timeout);
}

function formatCurrency(v) {
  if (v === null || v === undefined || isNaN(v)) return '';
  return Number(v).toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2});
}

/* ================= Rendering ================= */

function renderTable(list = filtered) {
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';

  if(!list.length){
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center;padding:40px;color:var(--text-secondary)">
          <i class="fas fa-inbox" style="font-size:48px;margin-bottom:16px;opacity:0.3"></i>
          <div>Aucun article trouvé</div>
        </td>
      </tr>
    `;
    return;
  }

  list.forEach(a => {
    const valeur = (Number(a.prix_vente) || 0) * (Number(a.achat_minimum) || 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Code">${escapeHtml(a.code)}</td>
      <td data-label="Description">${escapeHtml(a.description)}</td>
      <td data-label="Demar">${escapeHtml(a.demar || '')}</td>
      <td data-label="Prix ($)">${formatCurrency(a.prix_vente)}</td>
      <td data-label="Achat">${formatCurrency(a.achat_minimum)}</td>
      <td data-label="Valeur ($)" class="value-cell">${formatCurrency(valeur)}</td>
      <td data-label="Unité">${escapeHtml(a.unite || '')}</td>
      <td data-label="Type"><span class="tag">${escapeHtml(a.type || '')}</span></td>
      <td class="actions">
        <button title="Éditer" onclick="openEdit('${a.id}')"><i class="fas fa-edit"></i></button>
        <button title="Supprimer" onclick="deleteArticle('${a.id}')"><i class="fas fa-trash" style="color:var(--danger)"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ================= Filters / Search / Sort ================= */

function applyFiltersSortSearch(){
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const fType = document.getElementById('filterType').value;
  const fDemar = document.getElementById('filterDemar').value;

  filtered = articles.filter(a => {
    if(fType && ((a.type||'').toLowerCase() !== fType.toLowerCase())) return false;
    if(fDemar && ((a.demar||'').toLowerCase() !== fDemar.toLowerCase())) return false;

    if(!q) return true;
    return (a.code && a.code.toLowerCase().includes(q)) ||
           (a.description && a.description.toLowerCase().includes(q)) ||
           (a.type && a.type.toLowerCase().includes(q)) ||
           (a.demar && a.demar.toLowerCase().includes(q));
  });

  if(sortState.key){
    const key = sortState.key;
    const dir = sortState.dir;
    filtered.sort((x,y)=>{
      const a = (x[key] === null || x[key] === undefined) ? '' : x[key];
      const b = (y[key] === null || y[key] === undefined) ? '' : y[key];
      if(typeof a === 'number' || typeof b === 'number'){
        return (Number(a) - Number(b)) * dir;
      }
      return String(a).localeCompare(String(b), 'fr', {numeric:true}) * dir;
    });
  }

  renderTable();
  updateStats();
}

/* ============ Stats ============ */
function updateStats(){
  const count = filtered.length;
  const prixSum = filtered.reduce((s, a)=> s + (Number(a.prix_vente)||0), 0);
  const prixAvg = count ? (prixSum / count) : 0;

  const valeurSum = filtered.reduce((s, a)=> {
    const prix = Number(a.prix_vente) || 0;
    const achat = Number(a.achat_minimum) || 0;
    return s + (prix * achat);
  }, 0);

  const valeurAvg = count ? (valeurSum / count) : 0;

  document.getElementById('statCount').textContent = count;
  document.getElementById('statAvg').textContent = count ? formatCurrency(prixAvg) : '-';
  document.getElementById('statTotal').textContent = formatCurrency(valeurSum);
  document.getElementById('statValueAvg').textContent = formatCurrency(valeurAvg);
}

/* ============ Utils sécurité ============ */
function escapeHtml(s){
  if(s === null || s === undefined) return '';
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;');
}

/* ================= API Calls ================= */

async function loadArticles(){
  try {
    setLoading(true);
    const res = await fetch(API_BASE, { headers: authHeaders() });
    if(!res.ok) throw new Error('Impossible de charger les articles');
    articles = await res.json();
    // ensure id present
    articles = articles.map(a => ({ ...a, id: a.id || a._id || a.code }));

    // Extraire les unités, types, et démarques uniques
    const units = new Set();
    const types = new Set();
    const demars = new Set();

    articles.forEach(item => {
      if (item.unite) units.add(item.unite);
      if (item.type) types.add(item.type);
      if (item.demar) demars.add(item.demar);
    });

    allUnits = Array.from(units);
    allTypes = Array.from(types);
    allDemars = Array.from(demars);

    populateFilterOptions();
    applyFiltersSortSearch();
  } catch (e){
    console.error(e);
    toast('Erreur chargement articles: ' + e.message, 'err');
  } finally {
    setLoading(false);
  }
}

async function saveArticle(data, id){
  try {
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_BASE}/${id}` : API_BASE;
    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(data)
    });
    if(!res.ok){
      const txt = await res.text();
      throw new Error(txt || 'Erreur sauvegarde');
    }
    toast('Article enregistré');
    closeArticleModal();
    await loadArticles();
  } catch (e){
    console.error(e);
    toast('Erreur enregistrement: ' + e.message, 'err');
    throw e;
  }
}

async function deleteArticle(id){
  if(!confirm('Supprimer cet article ?')) return;
  try {
    const res = await fetch(`${API_BASE}/${id}`, { method:'DELETE', headers: authHeaders() });
    if(!res.ok) throw new Error('Erreur suppression');
    toast('Article supprimé');
    await loadArticles();
  } catch (e){
    console.error(e);
    toast('Erreur suppression: ' + e.message, 'err');
  }
}

/* ================= Modal control ================= */
function openAdd(){
  document.getElementById('modalTitle').textContent = 'Ajouter un article';
  document.getElementById('articleId').value = '';
  document.getElementById('f_code').value = '';
  document.getElementById('f_type').value = '';
  document.getElementById('f_description').value = '';
  document.getElementById('f_prix_vente').value = '';
  document.getElementById('f_achat_minimum').value = '';
  document.getElementById('f_valeur').value = '';
  document.getElementById('f_unite').value = '';
  document.getElementById('f_demar').value = '';
  showArticleModal();
}

function openEdit(id){
  const a = articles.find(x => String(x.id) === String(id));
  if(!a){ toast('Article introuvable','err'); return; }
  document.getElementById('modalTitle').textContent = 'Modifier un article';
  document.getElementById('articleId').value = a.id;
  document.getElementById('f_code').value = a.code || '';
  document.getElementById('f_type').value = a.type || '';
  document.getElementById('f_description').value = a.description || '';
  document.getElementById('f_prix_vente').value = a.prix_vente || '';
  document.getElementById('f_achat_minimum').value = a.achat_minimum || '';

  // Calculate and show value
  const prix = Number(a.prix_vente) || 0;
  const achat = Number(a.achat_minimum) || 0;
  document.getElementById('f_valeur').value = formatCurrency(prix * achat);

  document.getElementById('f_unite').value = a.unite || '';
  document.getElementById('f_demar').value = a.demar || '';
  showArticleModal();
}

function showArticleModal(){
  document.getElementById('modalArticle').style.display='flex';
  // Add event listeners for value calculation
  document.getElementById('f_prix_vente').addEventListener('input', calculateValue);
  document.getElementById('f_achat_minimum').addEventListener('input', calculateValue);

  // Setup autocomplete
  setupAutocomplete(document.getElementById('f_type'), allTypes);
  setupAutocomplete(document.getElementById('f_unite'), allUnits);
  setupAutocomplete(document.getElementById('f_demar'), allDemars);
}

function calculateValue() {
  const prix = parseFloat(document.getElementById('f_prix_vente').value) || 0;
  const achat = parseFloat(document.getElementById('f_achat_minimum').value) || 0;
  const valeur = prix * achat;
  document.getElementById('f_valeur').value = formatCurrency(valeur);
}

function closeArticleModal(){
  document.getElementById('modalArticle').style.display='none';
  // Remove event listeners
  document.getElementById('f_prix_vente').removeEventListener('input', calculateValue);
  document.getElementById('f_achat_minimum').removeEventListener('input', calculateValue);
}

function showBatchPage() {
  const page = document.getElementById('batch-add-page');
  const mainWrap = document.querySelector('.wrap');
  page.style.display = 'block';
  mainWrap.style.display = 'none';
  setTimeout(() => page.classList.add('visible'), 10);
  initBatchTable();
}

function hideBatchPage() {
  const page = document.getElementById('batch-add-page');
  const mainWrap = document.querySelector('.wrap');
  page.classList.remove('visible');
  setTimeout(() => {
    page.style.display = 'none';
    mainWrap.style.display = 'block';
  }, 300); // Wait for transition to finish
}

/* ================= Form handling ================= */

function validateArticleForm(){
  const code = document.getElementById('f_code').value.trim();
  const desc = document.getElementById('f_description').value.trim();
  const prix = document.getElementById('f_prix_vente').value;

  let ok = true;
  if(!code){
    document.getElementById('f_code').style.borderColor = 'var(--danger)';
    ok = false;
  }
  if(!desc){
    document.getElementById('f_description').style.borderColor = 'var(--danger)';
    ok = false;
  }
  if(prix === '' || isNaN(prix)){
    document.getElementById('f_prix_vente').style.borderColor = 'var(--danger)';
    ok = false;
  }

  // duplicate check: code must be unique (except if editing same id)
  const id = document.getElementById('articleId').value;
  const dup = articles.find(a => a.code && a.code.toLowerCase() === code.toLowerCase() && String(a.id) !== String(id));
  if(dup){
    document.getElementById('f_code').style.borderColor = 'var(--danger)';
    toast('Code dupliqué détecté: ' + dup.code, 'err');
    ok = false;
  }

  return ok;
}

/* ================= Batch import ================= */
function initBatchTable() {
  const tableBody = document.getElementById('batch-items-table');
  tableBody.innerHTML = '';

  // Ajouter 3 lignes initiales
  for (let i = 0; i < 3; i++) {
    addBatchRow();
  }

  // Gestion des événements
  document.getElementById('batch-add-row').addEventListener('click', addBatchRow);
  document.getElementById('batch-save-all').addEventListener('click', saveBatchData);
}

function addBatchRow() {
  const tableBody = document.getElementById('batch-items-table');
  const newRow = document.createElement('tr');

  newRow.innerHTML = `
    <td><input type="text" class="batch-code" placeholder="Ex: W0110-F4-08"></td>
    <td><input type="text" class="batch-desc" placeholder="Description"></td>
    <td><input type="text" class="batch-demar" placeholder="Demar"></td>
    <td><input type="number" step="0.01" min="0" class="batch-price" placeholder="0.00"></td>
    <td><input type="number" step="0.01" min="0" class="batch-min" placeholder="0"></td>
    <td><input type="text" class="batch-unit" placeholder="Unité" list="unit-list"></td>
    <td><input type="text" class="batch-type" placeholder="Type" list="type-list"></td>
    <td class="actions-cell">
      <button class="remove-btn">
        <i class="fas fa-trash-alt"></i>
      </button>
    </td>
  `;

  tableBody.appendChild(newRow);

  // Ajouter l'écouteur d'événement pour le bouton de suppression
  const removeBtn = newRow.querySelector('.remove-btn');
  removeBtn.addEventListener('click', function() {
    if (tableBody.querySelectorAll('tr').length > 1) {
      tableBody.removeChild(newRow);
    } else {
      toast('Vous devez conserver au moins une ligne', 'warn');
    }
  });

  // Ajouter des suggestions d'autocomplétion
  setupAutocomplete(newRow.querySelector('.batch-unit'), allUnits);
  setupAutocomplete(newRow.querySelector('.batch-type'), allTypes);
  setupAutocomplete(newRow.querySelector('.batch-demar'), allDemars);

  // Navigation au clavier
  setupKeyboardNavigation(newRow);
}

function setupAutocomplete(inputElement, suggestions) {
  inputElement.addEventListener('input', function() {
    const value = this.value.toLowerCase();
    // Créer une datalist si elle n'existe pas
    let datalist = document.getElementById(`${inputElement.id}-list`);
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = `${inputElement.id}-list`;
      document.body.appendChild(datalist);
      inputElement.setAttribute('list', datalist.id);
    }

    // Vider les options existantes
    datalist.innerHTML = '';

    if (value.length > 0) {
      // Filtrer les suggestions
      const filtered = suggestions.filter(item =>
        item.toLowerCase().includes(value)
      );

      // Ajouter les nouvelles options
      filtered.forEach(item => {
        const option = document.createElement('option');
        option.value = item;
        datalist.appendChild(option);
      });
    }
  });
}

function setupKeyboardNavigation(row) {
  const inputs = row.querySelectorAll('input');

  inputs.forEach(input => {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();

        // Trouver l'index de l'input actuel
        const allInputs = Array.from(document.querySelectorAll('#batch-items-table input'));
        const currentIndex = allInputs.indexOf(this);

        // Si c'est le dernier champ de la ligne, ajouter une nouvelle ligne
        if (currentIndex === allInputs.length - 1) {
          addBatchRow();
          // Focus sur le premier champ de la nouvelle ligne
          document.querySelector('#batch-items-table tr:last-child input').focus();
        } else {
          // Sinon, passer au champ suivant
          allInputs[currentIndex + 1].focus();
        }
      }
    });
  });
}

async function saveBatchData() {
  const rows = document.querySelectorAll('#batch-items-table tr');
  let isValid = true;
  const items = [];
  const newUnits = [];
  const newTypes = [];

  rows.forEach(row => {
    const code = row.querySelector('.batch-code').value.trim();
    const description = row.querySelector('.batch-desc').value.trim();
    const demar = row.querySelector('.batch-demar').value.trim();
    const price = row.querySelector('.batch-price').value;
    const min = row.querySelector('.batch-min').value;
    const unit = row.querySelector('.batch-unit').value.trim();
    const type = row.querySelector('.batch-type').value.trim();

    // Validation des champs obligatoires
    if (!code || !description) {
      isValid = false;
      if (!code) row.querySelector('.batch-code').style.borderColor = '#e53e3e';
      if (!description) row.querySelector('.batch-desc').style.borderColor = '#e53e3e';
    } else {
      const item = {
        code,
        description,
        demar,
        prix_vente: price ? parseFloat(price) : 0,
        achat_minimum: min ? parseFloat(min) : 0,
        unite: unit,
        type
      };
      items.push(item);

      // Ajouter les nouvelles unités et types
      if (unit && !allUnits.includes(unit)) {
        newUnits.push(unit);
      }
      if (type && !allTypes.includes(type)) {
        newTypes.push(type);
      }
    }
  });

  if (!isValid) {
    toast('Veuillez remplir les champs obligatoires (CODE et DESCRIPTION) pour toutes les lignes', 'error');
    return;
  }

  // Envoyer les données à l'API un par un
  let successCount = 0;
  for (const item of items) {
    try {
      // Vérifier si le code existe déjà
      const exists = articles.some(a => a.code.toLowerCase() === item.code.toLowerCase());
      if (exists) {
        toast(`Ignoré (dupliqué): ${item.code}`, 'warn');
        continue;
      }

      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(item)
      });

      if (!res.ok) {
        const error = await res.text();
        toast(`Erreur: ${error}`, 'err');
      } else {
        successCount++;
      }
    } catch (e) {
      toast(`Erreur: ${e.message}`, 'err');
    }
  }

  if (successCount > 0) {
    toast(`${successCount} article(s) ajoutés avec succès`, 'success');

    // Mettre à jour les listes d'autocomplétion
    if (newUnits.length > 0) {
      allUnits = [...new Set([...allUnits, ...newUnits])];
    }
    if (newTypes.length > 0) {
      allTypes = [...new Set([...allTypes, ...newTypes])];
    }

    // Recharger les articles
    await loadArticles();
    hideBatchPage();
  }
}

/* ================= Export filtered to Excel ================= */
function exportFilteredToExcel(){
  if(!filtered.length){ toast('Aucune donnée à exporter','warn'); return; }
  const data = filtered.map(a => ({
    Code: a.code,
    Description: a.description,
    Demar: a.demar,
    'Prix Vente ($)': a.prix_vente,
    'Achat Minimum': a.achat_minimum,
    'Valeur ($)': (Number(a.prix_vente) || 0) * (Number(a.achat_minimum) || 0),
    Unite: a.unite,
    Type: a.type,
    'ID': a.id
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Articles');
  XLSX.writeFile(wb, 'articles_export.xlsx');
  toast('Export terminé');
}

/* ================= Loading UI ================= */
function setLoading(is){
  const wrap = document.querySelector('.wrap');
  if(is){
    if(!document.querySelector('#spinnerOverlay')){
      const overlay = document.createElement('div');
      overlay.id = 'spinnerOverlay';
      overlay.style.position='fixed';
      overlay.style.inset='0';
      overlay.style.background='rgba(255,255,255,0.7)';
      overlay.style.zIndex='200';
      overlay.style.display='flex';
      overlay.style.alignItems='center';
      overlay.style.justifyContent='center';
      overlay.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center">
          <div class="loading-spinner" style="width:40px;height:40px;border-width:3px;border-top-color:var(--accent)"></div>
          <div style="margin-top:16px;color:var(--text-secondary)">Chargement...</div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
  } else {
    const node = document.getElementById('spinnerOverlay');
    if(node) node.remove();
  }
}

/* ================= Sorting handlers ================= */
document.querySelectorAll('thead th.sortable').forEach(th=>{
  th.style.cursor='pointer';
  th.addEventListener('click', ()=>{
    const key = th.getAttribute('data-key');
    if(sortState.key === key) sortState.dir *= -1; else { sortState.key = key; sortState.dir = 1; }
    applyFiltersSortSearch();
  });
});

/* ================= Populate filter dropdowns ================= */
function populateFilterOptions(){
  const types = Array.from(new Set(articles.map(a=>a.type).filter(Boolean))).sort();
  const demars = Array.from(new Set(articles.map(a=>a.demar).filter(Boolean))).sort();

  const tsel = document.getElementById('filterType');
  tsel.innerHTML = `<option value="">Filtrer par Type</option>`;
  types.forEach(t => tsel.innerHTML += `<option value="${escapeHtml(t)}">${t}</option>`);

  const dsel = document.getElementById('filterDemar');
  dsel.innerHTML = `<option value="">Filtrer par Démarque</option>`;
  demars.forEach(d => dsel.innerHTML += `<option value="${escapeHtml(d)}">${d}</option>`);
}

/* ================= Events binding ================= */
document.getElementById('btnAdd').addEventListener('click', openAdd);
document.getElementById('btnBatch').addEventListener('click', showBatchPage);
document.getElementById('btnBackToDashboard').addEventListener('click', hideBatchPage);
document.getElementById('btnExport').addEventListener('click', exportFilteredToExcel);
document.getElementById('btnRefresh').addEventListener('click', ()=>loadArticles());

document.getElementById('filterType').addEventListener('change', applyFiltersSortSearch);
document.getElementById('filterDemar').addEventListener('change', applyFiltersSortSearch);

let searchTimer = null;
document.getElementById('searchInput').addEventListener('input', ()=>{
  clearTimeout(searchTimer);
  searchTimer = setTimeout(()=> applyFiltersSortSearch(), 220);
});

/* Submit article form */
document.getElementById('articleForm').addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  if(!validateArticleForm()) return;
  const id = document.getElementById('articleId').value || null;
  const data = {
    code: document.getElementById('f_code').value.trim(),
    type: document.getElementById('f_type').value.trim(),
    description: document.getElementById('f_description').value.trim(),
    prix_vente: Number(document.getElementById('f_prix_vente').value) || 0,
    achat_minimum: Number(document.getElementById('f_achat_minimum').value) || 0,
    unite: document.getElementById('f_unite').value.trim(),
    demar: document.getElementById('f_demar').value.trim(),
  };
  await saveArticle(data, id);
});

/* ================= Auto-refresh ================= */
function startAutoRefresh(){
  if(autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(()=> {
    loadArticles();
    const txt = document.getElementById('autoRefreshTxt');
    if(txt) txt.textContent = '5min (auto)';
  }, AUTO_REFRESH_MS);
}
startAutoRefresh();

/* ================= User Management ================= */
let users = [];

async function loadUsers() {
  try {
    const res = await fetch('/api/admin/users', { headers: authHeaders() });
    if (!res.ok) throw new Error('Impossible de charger les utilisateurs');
    users = await res.json();
    renderUsers();
  } catch (e) {
    toast('Erreur chargement utilisateurs: ' + e.message, 'err');
  }
}

function renderUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '';
  users.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Nom">${escapeHtml(u.name)}</td>
      <td data-label="Nom d'utilisateur">${escapeHtml(u.username)}</td>
      <td data-label="Rôle"><span class="tag">${escapeHtml(u.role)}</span></td>
      <td data-label="Créé le">${new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
      <td class="actions">
        <button title="Éditer" onclick="openUserModal('${u.id}')"><i class="fas fa-edit"></i></button>
        <button title="Supprimer" onclick="deleteUser('${u.id}')"><i class="fas fa-trash" style="color:var(--danger)"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openUserModal(id = null) {
  const form = document.getElementById('userForm');
  form.reset();
  document.getElementById('userId').value = '';
  const passLabel = document.getElementById('u_password_label');
  const passInput = document.getElementById('u_password');

  if (id) {
    const user = users.find(u => String(u.id) === String(id));
    if (!user) return toast('Utilisateur introuvable', 'err');
    document.getElementById('userModalTitle').textContent = 'Modifier un utilisateur';
    document.getElementById('userId').value = user.id;
    document.getElementById('u_name').value = user.name;
    document.getElementById('u_username').value = user.username;
    document.getElementById('u_role').value = user.role;
    passLabel.textContent = 'Nouveau mot de passe';
    passInput.placeholder = 'Laissez vide pour ne pas changer';
    passInput.required = false;
  } else {
    document.getElementById('userModalTitle').textContent = 'Ajouter un utilisateur';
    passLabel.textContent = 'Mot de passe';
    passInput.placeholder = 'Mot de passe';
    passInput.required = true;
  }
  document.getElementById('modalUser').style.display = 'flex';
}

function closeUserModal() {
  document.getElementById('modalUser').style.display = 'none';
}

async function saveUser(e) {
  e.preventDefault();
  const id = document.getElementById('userId').value;
  const data = {
    name: document.getElementById('u_name').value.trim(),
    username: document.getElementById('u_username').value.trim(),
    role: document.getElementById('u_role').value,
  };
  const password = document.getElementById('u_password').value;
  if (password) {
    data.password = password;
  }

  const url = id ? `/api/admin/users/${id}` : '/api/admin/users';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur sauvegarde');
    }
    toast('Utilisateur enregistré');
    closeUserModal();
    await loadUsers();
  } catch (err) {
    toast('Erreur: ' + err.message, 'err');
  }
}

async function deleteUser(id) {
  if (String(id) === JSON.parse(localStorage.getItem('user') || '{}').id) {
    return toast('Vous ne pouvez pas supprimer votre propre compte', 'warn');
  }
  if (!confirm('Supprimer cet utilisateur ? Cette action est irréversible.')) return;

  try {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur suppression');
    }
    toast('Utilisateur supprimé');
    await loadUsers();
  } catch (e) {
    toast('Erreur suppression: ' + e.message, 'err');
  }
}


/* ================= Tab Handling ================= */
function setupTabs() {
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabContents = document.querySelectorAll('.tab-content');

  tabLinks.forEach(link => {
    link.addEventListener('click', () => {
      const tab = link.dataset.tab;

      tabLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      tabContents.forEach(c => c.classList.remove('active'));
      document.getElementById(`${tab}-view`).classList.add('active');

      document.getElementById('page-subtitle').textContent = tab === 'articles' ? 'Gestion des Articles & Prix' : 'Gestion des Utilisateurs';
    });
  });
}


/* ================= On load ================= */
(async function init(){
  setupTabs();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.name) {
    document.getElementById('username-display').textContent = `Bonjour, ${user.name}`;
  }
  document.getElementById('logout-button').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
  });

  document.getElementById('userForm').addEventListener('submit', saveUser);
  document.getElementById('btnAddUser').addEventListener('click', () => openUserModal());

  await loadArticles();
  await loadUsers();
  applyFiltersSortSearch();
})();
