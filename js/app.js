/* Digital Menu - Advanced Version */
let menuData = null;
let cart = [];
let currentCategory = 'all';
let viewMode = 'grid';
let currentSort = 'none';

// ── Initialization ──────────────────────────────────────────

async function init() {
    try {
        const response = await fetch('data/menu.json?v=' + Date.now());
        menuData = await response.json();

        injectCategoriesContainer();
        loadRestaurantInfo();
        renderCategories();
        showCategoriesView();
        setupEventListeners();
    } catch (error) {
        console.error('Error loading menu:', error);
    }
}

function injectCategoriesContainer() {
    const main = document.querySelector('main');
    const catGrid = document.createElement('div');
    catGrid.id = 'categoriesGrid';
    catGrid.className = 'categories-grid';
    main.insertBefore(catGrid, document.getElementById('menuSection'));
}

function loadRestaurantInfo() {
    document.getElementById('restaurant-name').textContent = menuData.restaurant.name;
    document.title = menuData.restaurant.name;
}

// ── Menu Rendering & Filtering ──────────────────────────────

function getSortedProducts() {
    let products = [...menuData.products];

    if (currentCategory !== 'all') {
        products = products.filter(p => p.category === currentCategory);
    }

    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    if (searchQuery) {
        products = products.filter(p =>
            p.name.toLowerCase().includes(searchQuery) ||
            p.description.toLowerCase().includes(searchQuery)
        );
    }

    if (currentSort === 'price-low') products.sort((a, b) => a.price - b.price);
    else if (currentSort === 'price-high') products.sort((a, b) => b.price - a.price);
    else if (currentSort === 'name') products.sort((a, b) => a.name.localeCompare(b.name));

    return products;
}

function renderProducts() {
    const productsGrid = document.getElementById('productsGrid');
    productsGrid.innerHTML = '';
    productsGrid.className = `products-grid view-${viewMode}`;

    const products = getSortedProducts();

    if (products.length === 0) {
        productsGrid.innerHTML = `<p class="no-results">No se encontraron platillos.</p>`;
        return;
    }

    products.forEach(product => {
        const cat = menuData.categories.find(c => c.id === product.category);
        const catIcon = cat ? cat.icon : '🍽️';
        const card = document.createElement('div');
        card.className = `product-card ${viewMode}-item`;
        const imgSrc = product.image || '';
        const imgAlt = product.name || 'Platillo';
        const hasImage = imgSrc && imgSrc !== '';
        card.innerHTML = `
            <div class="product-image-container">
                ${hasImage
                ? `<img src="${imgSrc}" alt="${imgAlt}" class="product-card-img" loading="lazy" onerror="this.parentElement.innerHTML='<span class=\\'placeholder-icon\\'>${catIcon}</span>'">`
                : `<span class="placeholder-icon">${catIcon}</span>`
            }
            </div>
            <div class="product-info">
                <div class="product-header">
                    <h3>${product.name}</h3>
                    <span class="price">$${product.price.toLocaleString()}</span>
                </div>
                <p class="product-desc">${product.description}</p>
                <button class="add-btn" onclick="addToCart(${product.id})">
                    <i class="fas fa-plus"></i> ${viewMode === 'grid' ? 'Añadir' : ''}
                </button>
            </div>
        `;
        productsGrid.appendChild(card);
    });
}

// ── View State Logic ────────────────────────────────────────

function showCategoriesView() {
    document.getElementById('categoriesGrid').classList.remove('hidden');
    document.getElementById('menuSection').classList.add('hidden');
    currentCategory = 'all';
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-category="all"]').classList.add('active');
}

function showProductsView(catId) {
    document.getElementById('categoriesGrid').classList.add('hidden');
    document.getElementById('menuSection').classList.remove('hidden');

    currentCategory = catId;
    const catObj = menuData.categories.find(c => c.id === catId);
    document.getElementById('currentCategoryTitle').innerHTML =
        `<button class="back-btn" onclick="showCategoriesView()"><i class="fas fa-arrow-left"></i></button> ${catObj ? catObj.name : 'Menú'}`;

    renderProducts();
}

function renderCategories() {
    const nav = document.getElementById('categoryList');
    const grid = document.getElementById('categoriesGrid');

    nav.innerHTML = `
        <button class="cat-btn active" data-category="all">Categorías</button>
        ${menuData.categories.map(cat =>
        `<button class="cat-btn" data-category="${cat.id}">${cat.icon} ${cat.name}</button>`
    ).join('')}
    `;

    grid.innerHTML = menuData.categories.map(cat => `
        <div class="category-card" onclick="showProductsView('${cat.id}')">
            <div class="cat-card-icon">${cat.icon}</div>
            <h3>${cat.name}</h3>
        </div>
    `).join('');
}

// ── View Mode & Sorting ─────────────────────────────────────

function toggleView(mode) {
    viewMode = mode;
    document.getElementById('gridBtn').classList.toggle('active', mode === 'grid');
    document.getElementById('listBtn').classList.toggle('active', mode === 'list');
    if (!document.getElementById('menuSection').classList.contains('hidden')) renderProducts();
}

// ── Cart Logic ──────────────────────────────────────────────

function addToCart(productId, fromWizard = false) {
    const product = menuData.products.find(p => p.id === productId);
    const item = cart.find(i => i.id === productId);
    if (item) item.quantity++; else cart.push({ ...product, quantity: 1 });
    updateCartUI();

    if (!fromWizard && event?.currentTarget) {
        const btn = event.currentTarget;
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => {
            btn.innerHTML = viewMode === 'grid' ? '<i class="fas fa-plus"></i> Añadir' : '<i class="fas fa-plus"></i>';
        }, 1000);
    }

    // Update wizard UI if open
    if (document.getElementById('wizardModal').classList.contains('open')) {
        refreshWizardCart();
        updateWizardCategoryBadges();
        updateWizardProductRow(productId);
    }
}

function removeFromCart(productId) {
    const pid = typeof productId === 'string' ? parseInt(productId) : productId;
    cart = cart.filter(i => i.id !== pid);
    updateCartUI();
    if (document.getElementById('wizardModal').classList.contains('open')) {
        refreshWizardCart();
        updateWizardCategoryBadges();
        updateWizardProductRow(pid);
    }
}

function changeQty(id, delta) {
    const productId = typeof id === 'string' ? parseInt(id) : id;
    const product = menuData.products.find(p => p.id === productId);
    if (!product) return;

    let item = cart.find(i => i.id === productId);

    if (!item) {
        if (delta > 0) {
            cart.push({ ...product, quantity: 1 });
        }
    } else {
        item.quantity += delta;
        if (item.quantity <= 0) cart = cart.filter(i => i.id !== productId);
    }

    updateCartUI();
    if (document.getElementById('wizardModal').classList.contains('open')) {
        refreshWizardCart();
        updateWizardCategoryBadges();
        updateWizardProductRow(productId);
    }
}

function updateCartUI() {
    const count = cart.reduce((s, i) => s + i.quantity, 0);
    const total = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    document.getElementById('cartCount').textContent = count;
    document.getElementById('cartTotalPrice').textContent = `$${total.toLocaleString()}`;
    document.getElementById('cartButton').classList.toggle('hide-cart', count === 0);
}

function renderCartItems() {
    const container = document.getElementById('cartItems');
    const orderCode = Math.floor(Math.random() * 9000) + 1000;
    const sum = cart.reduce((s, i) => s + i.price * i.quantity, 0);

    container.innerHTML = cart.length
        ? `
            <div class="drawer-summary">
                <div class="summary-code">PEDIDO #${orderCode}</div>
                <div class="summary-items-list">
                    ${cart.map(item => `
                        <div class="summary-row">
                            <span class="summary-qty">${item.quantity}x</span>
                            <span class="summary-name">${item.name}</span>
                            <span class="summary-price">$${(item.price * item.quantity).toLocaleString()}</span>
                            <button class="summary-remove" onclick="removeFromCart(${item.id})"><i class="fas fa-trash"></i></button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `
        : '<p style="color:var(--muted);font-style:italic;padding:40px 0;text-align:center">Vacío</p>';

    document.getElementById('drawerSubtotal').textContent = `$${sum.toLocaleString()}`;
}

// ── Order Assistant (New Fluid Wizard) ──────────────────────

let wizardActiveCat = null;
let wizardCurrentCatIndex = 0;

function openWizard() {
    if (!menuData) return;
    document.getElementById('wizardModal').classList.add('open');
    wizardCurrentCatIndex = 0;

    // Build tabs only once
    const tabBar = document.getElementById('wizTabBar');
    if (tabBar && tabBar.children.length === 0) {
        buildWizardTabs();
    }

    // Build progress dots
    buildWizardProgress();

    // Activate first category tab
    const firstCat = menuData.categories[0];
    if (firstCat) {
        switchWizardTab(firstCat.id);
        wizardCurrentCatIndex = 0;
    }

    // Sync all qty displays with current cart state
    menuData.products.forEach(p => updateWizardProductRow(p.id));

    refreshWizardCart();
    updateWizardCategoryBadges();
    updateWizardNavButtons();
}

function closeWizard() {
    document.getElementById('wizardModal').classList.remove('open');
}

function buildWizardProgress() {
    const dotsContainer = document.getElementById('wizProgressDots');
    const totalSpan = document.getElementById('wizTotalCats');
    const progressLabel = document.getElementById('wizProgressLabel');

    totalSpan.textContent = menuData.categories.length;

    dotsContainer.innerHTML = menuData.categories.map((cat, i) => `
        <div class="wiz-progress-dot" id="wizdot-${i}" data-index="${i}"></div>
    `).join('');

    updateWizardProgress();
}

function updateWizardProgress() {
    const dots = document.querySelectorAll('.wiz-progress-dot');
    dots.forEach((dot, i) => {
        dot.classList.remove('done', 'active');
        if (i < wizardCurrentCatIndex) {
            dot.classList.add('done');
        } else if (i === wizardCurrentCatIndex) {
            dot.classList.add('active');
        }
    });

    document.getElementById('wizProgressLabel').innerHTML =
        `Categoría ${wizardCurrentCatIndex + 1} de ${menuData.categories.length}`;
}

function buildWizardTabs() {
    const tabBar = document.getElementById('wizTabBar');
    const panels = document.getElementById('wizPanels');

    tabBar.innerHTML = menuData.categories.map(cat => `
        <button class="wiz-tab" id="wiztab-${cat.id}" onclick="switchWizardTab('${cat.id}')">
            <span class="wiz-tab-icon">${cat.icon}</span>
            <span class="wiz-tab-name">${cat.name}</span>
            <span class="wiz-tab-badge hidden" id="wizbadge-${cat.id}">0</span>
        </button>
    `).join('');

    panels.innerHTML = menuData.categories.map(cat => {
        const products = menuData.products.filter(p => p.category === cat.id);
        const catIcon = cat.icon;
        return `
            <div class="wiz-panel hidden" id="wizpanel-${cat.id}">
                <div class="wiz-products">
                    ${products.map(p => {
            const hasImage = p.image && p.image.trim() !== '';
            return `
                        <div class="wiz-product-row" id="wizrow-${p.id}" onclick="toggleProductDesc(${p.id})">
                            ${hasImage
                    ? `<img src="${p.image}" alt="${p.name}" class="wiz-product-img" loading="lazy" onerror="handleWizImgError(this, '${catIcon}')">`
                    : `<div class="wiz-product-icon"><span>${catIcon}</span></div>`
                }
                            <div class="wiz-product-info">
                                <span class="wiz-product-name">${p.name}</span>
                                <span class="wiz-product-desc hidden" id="wizdesc-${p.id}">${p.description}</span>
                            </div>
                            <div class="wiz-product-price">$${p.price.toLocaleString()}</div>
                            <div class="wiz-qty-ctrl" id="wizqty-${p.id}" onclick="event.stopPropagation()">
                                <button class="wiz-qty-btn wiz-minus hidden" onclick="wizChangeQty(${p.id}, -1)">−</button>
                                <span class="wiz-qty-num hidden" id="wiznum-${p.id}">0</span>
                                <button class="wiz-qty-btn wiz-plus" onclick="wizChangeQty(${p.id}, 1)">+</button>
                            </div>
                        </div>
                    `;
        }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function handleWizImgError(img, icon) {
    const iconDiv = document.createElement('div');
    iconDiv.className = 'wiz-product-icon';
    iconDiv.innerHTML = `<span>${icon}</span>`;
    img.replaceWith(iconDiv);
}

function toggleProductDesc(productId) {
    const desc = document.getElementById(`wizdesc-${productId}`);
    const row = document.getElementById(`wizrow-${productId}`);
    if (desc) {
        desc.classList.toggle('hidden');
        row.classList.toggle('expanded');
    }
}

function switchWizardTab(catId) {
    wizardActiveCat = catId;

    // Update index
    const catIndex = menuData.categories.findIndex(c => c.id === catId);
    if (catIndex !== -1) wizardCurrentCatIndex = catIndex;

    // Tabs
    document.querySelectorAll('.wiz-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.getElementById(`wiztab-${catId}`);
    if (activeTab) {
        activeTab.classList.add('active');
        activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    // Panels
    document.querySelectorAll('.wiz-panel').forEach(p => p.classList.add('hidden'));
    const panel = document.getElementById(`wizpanel-${catId}`);
    if (panel) panel.classList.remove('hidden');

    // Sync qty displays
    menuData.products.filter(p => p.category === catId).forEach(p => {
        updateWizardProductRow(p.id);
    });

    // Update progress and nav buttons
    updateWizardProgress();
    updateWizardNavButtons();
}

function wizardNextCategory() {
    const totalCats = menuData.categories.length;

    if (wizardCurrentCatIndex < totalCats - 1) {
        // Go to next category
        wizardCurrentCatIndex++;
        const nextCat = menuData.categories[wizardCurrentCatIndex];
        switchWizardTab(nextCat.id);
    } else {
        // Last category - generate summary
        wizardGenerateSummary();
    }
}

function wizardPrevCategory() {
    if (wizardCurrentCatIndex > 0) {
        wizardCurrentCatIndex--;
        const prevCat = menuData.categories[wizardCurrentCatIndex];
        switchWizardTab(prevCat.id);
    }
}

function updateWizardNavButtons() {
    const backBtn = document.getElementById('wizBackBtn');
    const nextBtn = document.getElementById('wizNextBtn');
    const nextBtnText = document.getElementById('wizNextBtnText');
    const totalCats = menuData.categories.length;

    // Back button visibility
    backBtn.classList.toggle('hidden', wizardCurrentCatIndex === 0);

    // Next button text
    if (wizardCurrentCatIndex === totalCats - 1) {
        nextBtnText.innerHTML = '<i class="fas fa-clipboard-list"></i> Ver Resumen';
    } else {
        nextBtnText.innerHTML = 'Siguiente <i class="fas fa-arrow-right"></i>';
    }
}

function wizChangeQty(productId, delta) {
    const pid = typeof productId === 'string' ? parseInt(productId) : productId;
    changeQty(pid, delta);
    updateWizardProductRow(pid);
    refreshWizardCart();
    updateWizardCategoryBadges();
}

function updateWizardProductRow(productId) {
    const pid = typeof productId === 'string' ? parseInt(productId) : productId;
    const item = cart.find(i => i.id === pid);
    const qty = item ? item.quantity : 0;
    const minus = document.querySelector(`#wizqty-${pid} .wiz-minus`);
    const num = document.getElementById(`wiznum-${pid}`);
    const row = document.getElementById(`wizrow-${pid}`);
    const plus = document.querySelector(`#wizqty-${pid} .wiz-plus`);

    if (!num) return;

    num.textContent = qty;

    if (qty > 0) {
        minus?.classList.remove('hidden');
        num.classList.remove('hidden');
        row?.classList.add('wiz-row-active');
    } else {
        minus?.classList.add('hidden');
        num.classList.add('hidden');
        row?.classList.remove('wiz-row-active');
    }
}

function updateWizardCategoryBadges() {
    if (!menuData) return;
    menuData.categories.forEach(cat => {
        const badge = document.getElementById(`wizbadge-${cat.id}`);
        if (!badge) return;
        const count = cart
            .filter(i => i.category === cat.id)
            .reduce((s, i) => s + i.quantity, 0);
        badge.textContent = count;
        badge.classList.toggle('hidden', count === 0);
    });
    // Update mini cart footer
    refreshWizardCart();
}

function refreshWizardCart() {
    const footer = document.getElementById('wizCartFooter');
    const preview = document.getElementById('wizCartPreview');
    const total = document.getElementById('wizCartTotal');
    const countBadge = document.getElementById('wizCartCountBadge');
    const count = cart.reduce((s, i) => s + i.quantity, 0);
    const sum = cart.reduce((s, i) => s + i.price * i.quantity, 0);

    if (count === 0) {
        preview.innerHTML = `<span class="wiz-empty-msg">Aún no has añadido nada</span>`;
        countBadge.textContent = '';
    } else {
        preview.innerHTML = cart.map(i => `
            <div class="wiz-cart-chip">
                <span>${i.quantity}× ${i.name}</span>
                <button onclick="wizChangeQty(${i.id}, -1)" title="Quitar uno">×</button>
            </div>
        `).join('');
        countBadge.textContent = `(${count} ítems)`;
    }

    total.textContent = count > 0 ? `$${sum.toLocaleString()}` : '';
}

function wizardGenerateSummary() {
    if (cart.length === 0) {
        alert('Añade al menos un producto antes de ver el resumen.');
        return;
    }

    closeWizard();

    const sum = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    let html = `
        <div class="summary-list">
            ${cart.map(i => `
                <div class="summary-item">
                    <span>${i.quantity}x ${i.name}</span>
                    <span>$${(i.price * i.quantity).toLocaleString()}</span>
                </div>`).join('')}
        </div>
        <div class="summary-footer">
            <p><strong>Total: $${sum.toLocaleString()}</strong></p>
        </div>
        <div class="order-code">CÓDIGO: #${Math.floor(Math.random() * 9000) + 1000}</div>
    `;
    document.getElementById('summaryContent').innerHTML = html;
    document.getElementById('summaryModal').classList.add('open');
}

function wizardConfirm() {
    wizardGenerateSummary();
}

// ── Legacy Wizard shims (kept for HTML onclick refs) ─────────
function openWizardLegacy() { openWizard(); }
function closeWizardLegacy() { closeWizard(); }
function nextStep() { }
function generateSummary() {
    if (cart.length === 0) { alert('El carrito está vacío'); return; }
    const sum = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    let html = `
        <div class="summary-list">
            ${cart.map(i => `
                <div class="summary-item">
                    <span>${i.quantity}x ${i.name}</span>
                    <span>$${(i.price * i.quantity).toLocaleString()}</span>
                </div>`).join('')}
        </div>
        <div class="summary-footer">
            <p><strong>Total: $${sum.toLocaleString()}</strong></p>
        </div>
        <div class="order-code">CÓDIGO: #${Math.floor(Math.random() * 9000) + 1000}</div>
    `;
    document.getElementById('summaryContent').innerHTML = html;
    document.getElementById('summaryModal').classList.add('open');
    document.getElementById('overlay').classList.add('show');
}
function closeSummary() {
    document.getElementById('summaryModal').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
}

function cancelOrder() {
    if (!confirm('¿Cancelar la nota y empezar de nuevo?')) return;
    cart = [];
    updateCartUI();
    closeSummary();

    const wizardModal = document.getElementById('wizardModal');
    if (wizardModal && wizardModal.classList.contains('open')) {
        menuData.products.forEach(p => updateWizardProductRow(p.id));
        refreshWizardCart();
        updateWizardCategoryBadges();
    }

    document.getElementById('summaryModal').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
}
function shareOrder() {
    const content = document.getElementById('summaryContent').innerText;
    const shareData = { title: 'Mi Pedido', text: content, url: window.location.href };

    // Intentar usar Web Share API primero (móviles)
    if (navigator.share) {
        navigator.share(shareData).catch(() => { });
        return;
    }

    // Fallback: copiar al portapapeles
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(content).then(() => {
            alert('Resumen copiado al portapapeles.');
        }).catch(() => {
            // Último fallback para navegadores antiguos
            fallbackCopyToClipboard(content);
        });
    } else {
        fallbackCopyToClipboard(content);
    }
}

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        alert('Resumen copiado al portapapeles.');
    } catch (err) {
        alert('No se pudo copiar. Por favor, selecciona y copia manualmente.');
    }
    document.body.removeChild(textArea);
}

// ── Event Listeners ─────────────────────────────────────────

function setupEventListeners() {
    document.getElementById('categoryList').addEventListener('click', (e) => {
        const btn = e.target.closest('.cat-btn');
        if (!btn) return;
        const cat = btn.dataset.category;
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (cat === 'all') showCategoriesView(); else showProductsView(cat);
    });

    document.getElementById('searchInput').addEventListener('input', (e) => {
        if (e.target.value) showProductsView(currentCategory === 'all' ? 'all' : currentCategory);
        else if (currentCategory === 'all') showCategoriesView();
        renderProducts();
    });

    document.getElementById('sortSelect').addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderProducts();
    });

    document.getElementById('gridBtn').addEventListener('click', () => toggleView('grid'));
    document.getElementById('listBtn').addEventListener('click', () => toggleView('list'));
    document.getElementById('startWizard').addEventListener('click', openWizard);

    document.getElementById('cartButton').addEventListener('click', () => {
        generateSummary();
    });

    document.getElementById('overlay').addEventListener('click', () => {
        document.getElementById('summaryModal').classList.remove('open');
        document.getElementById('overlay').classList.remove('show');
    });

    document.getElementById('orderForm').addEventListener('submit', (e) => {
        e.preventDefault();
        generateSummary();
    });
}

document.addEventListener('DOMContentLoaded', init);
