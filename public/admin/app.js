// ============================
// Modern Admin Panel Application
// ============================

const AdminApp = (() => {
    // ---------- Konfigürasyon & Sabitler ----------
    const SELECTORS = {
        nav: '#admin-navigation',
        main: '#admin-main-content',
        sidebar: '#sidebar',
        pageTitle: '#page-title',
        userName: '#user-name',
        userAvatar: '#user-avatar',
        mobileToggle: '#mobile-toggle',
        refreshBtn: '#refresh-btn'
    };

    const API_ROUTES = {
        profile: '/api/auth/profile',
        users: '/api/admin/users',
        stats: '/api/admin/stats',
        deleteUser: '/api/admin/users',
        updateUserRole: '/api/admin/users'
    };

    const Storage = {
        getToken() { return localStorage.getItem('token'); },
        setToken(t) { if (t) localStorage.setItem('token', t); else localStorage.removeItem('token'); }
    };

    const state = {
        token: Storage.getToken(),
        user: null,
        usersList: [],
        systemStats: null
    };

    // ---------- Helpers ----------
    const $ = (sel, scope = document) => scope.querySelector(sel);
    const loadingSpinner = `<div class="loading"><div class="spinner"></div><p>Yükleniyor...</p></div>`;

    function showAlert(message, type = 'info') {
        const existingAlerts = document.querySelectorAll('.notification');
        existingAlerts.forEach(alert => alert.remove());

        const container = document.createElement('div');
        container.className = `notification notification-${type}`;
        container.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;
        document.body.appendChild(container);
        container.querySelector('.notification-close').addEventListener('click', () => container.remove());
        setTimeout(() => container.remove(), 4000);
    }

    function confirmModal(message) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal">
                    <div class="modal-header"><h3>Onayla</h3></div>
                    <div class="modal-body"><p>${message}</p></div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-action="cancel">İptal</button>
                        <button class="btn btn-primary" data-action="confirm">Onayla</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            const close = () => modal.remove();
            modal.addEventListener('click', (e) => { if(e.target === modal) { close(); resolve(false); } });
            modal.querySelector('[data-action="cancel"]').addEventListener('click', () => { close(); resolve(false); });
            modal.querySelector('[data-action="confirm"]').addEventListener('click', () => { close(); resolve(true); });
        });
    }

    async function apiRequest(path, { method = 'GET', body = null, auth = true } = {}) {
        const headers = {};
        if (body) headers['Content-Type'] = 'application/json';
        if (auth && state.token) headers['Authorization'] = `Bearer ${state.token}`;

        const res = await fetch(path, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        });

        let json = null;
        try { json = await res.json(); } catch(e) {}

        if (!res.ok) {
            const err = new Error(json?.message || `Hata: ${res.status}`);
            if (res.status === 401 || res.status === 403) {
                logout();
                throw new Error('Oturum süresi doldu veya yetkisiz erişim.');
            }
            throw err;
        }
        return json;
    }

    const api = {
        getProfile: () => apiRequest(API_ROUTES.profile),
        getStats: () => apiRequest(API_ROUTES.stats),
        getUsers: () => apiRequest(API_ROUTES.users),
        deleteUser: (id) => apiRequest(`${API_ROUTES.deleteUser}/${id}`, { method: 'DELETE' }),
        updateUserRole: (id, role) => apiRequest(`${API_ROUTES.updateUserRole}/${id}/role`, { method: 'PUT', body: { role } })
    };

    // ---------- Render ----------
    function renderNavigation() {
        const navEl = document.querySelector(SELECTORS.nav);
        if (!navEl) return;

        if (state.token) {
            navEl.innerHTML = `
                <ul class="nav-list">
                    <li><button data-action="dashboard" class="nav-link"><i class="fas fa-chart-pie"></i> Genel Bakış</button></li>
                    <li><button data-action="users" class="nav-link"><i class="fas fa-users"></i> Kullanıcılar</button></li>
                    <li><button data-action="logout" class="btn btn-link nav-link"><i class="fas fa-sign-out-alt"></i> Çıkış Yap</button></li>
                </ul>
            `;
            if (state.user) {
                const nameEl = document.querySelector(SELECTORS.userName);
                if (nameEl) nameEl.textContent = state.user.username;
            }
        } else {
            navEl.innerHTML = `
                <ul class="nav-list">
                    <li><a href="/" class="nav-link"><i class="fas fa-home"></i> Ana Sayfa</a></li>
                </ul>
            `;
        }
    }

    function attachNavHandlers() {
        const navEl = document.querySelector(SELECTORS.nav);
        if (!navEl) return;
        navEl.addEventListener('click', (e) => {
            const action = e.target.getAttribute('data-action') || e.target.closest('[data-action]')?.getAttribute('data-action');
            if (!action) return;
            switch(action) {
                case 'dashboard': showDashboard(); break;
                case 'users': showUsers(); break;
                case 'logout': logout(); break;
            }
        });

        const toggle = document.querySelector(SELECTORS.mobileToggle);
        if (toggle) toggle.addEventListener('click', () => document.querySelector(SELECTORS.sidebar).classList.toggle('active'));
    }

    function mountMain(html) {
        const main = document.querySelector(SELECTORS.main);
        if (main) {
            main.innerHTML = html;
            window.scrollTo(0, 0);
            document.querySelector(SELECTORS.sidebar).classList.remove('active');
        }
    }

    function showLogin() {
        document.querySelector(SELECTORS.pageTitle).textContent = 'Yönetici Girişi';
        mountMain(`
            <section class="auth-container">
                <div class="auth-card">
                    <div class="auth-header">
                        <h2><i class="fas fa-user-shield"></i> Yönetici Paneli</h2>
                        <p>Bu alana erişim için önce ana sayfadan giriş yapmanız gerekmektedir.</p>
                    </div>
                    <div class="auth-actions">
                        <a href="/" class="btn btn-primary btn-block">
                            <i class="fas fa-home"></i>
                            Ana Sayfaya Dön
                        </a>
                        <button onclick="logout()" class="btn btn-secondary btn-block">
                            <i class="fas fa-sign-out-alt"></i>
                            Oturumu Temizle
                        </button>
                    </div>
                </div>
            </section>
        `);

        // Add some styles for the auth actions
        const style = document.createElement('style');
        style.textContent = `
            .auth-actions {
                display: flex;
                flex-direction: column;
                gap: 1rem;
                margin-top: 2rem;
            }
            .auth-actions .btn {
                width: 100%;
                justify-content: center;
                padding: 1rem;
                font-size: 1.1rem;
            }
            .auth-header p {
                color: #6b7280;
                text-align: center;
                margin-top: 1rem;
                font-size: 0.95rem;
            }
        `;
        document.head.appendChild(style);
    }

    async function showDashboard() {
        document.querySelector(SELECTORS.pageTitle).textContent = 'Genel Bakış';
        mountMain(loadingSpinner);
        
        try {
            const res = await api.getStats();
            if (res.success) {
                state.systemStats = res.data;
                const s = state.systemStats;
                mountMain(`
                    <div class="dashboard-grid">
                        <div class="stat-card large">
                            <div class="stat-icon primary"><i class="fas fa-users"></i></div>
                            <div class="stat-details">
                                <h3>Toplam Kullanıcı</h3>
                                <div class="stat-value">${s.total_users || 0}</div>
                            </div>
                        </div>
                    </div>
                `);
            } else {
                mountMain('<div class="alert alert-danger">İstatistikler yüklenemedi</div>');
            }
        } catch (err) {
            mountMain(`<div class="alert alert-danger">${err.message}</div>`);
        }
    }

    async function showUsers() {
        document.querySelector(SELECTORS.pageTitle).textContent = 'Kullanıcı Yönetimi';
        mountMain(loadingSpinner);

        try {
            const res = await api.getUsers();
            if (res.success) {
                state.usersList = res.data;
                const rows = state.usersList.map(u => `
                    <tr>
                        <td>#${u.id}</td>
                        <td>${u.username}</td>
                        <td>${u.email}</td>
                        <td><span class="badge ${u.role === 'admin' ? 'badge-primary' : 'badge-secondary'}">${u.role}</span></td>
                        <td>${new Date(u.created_at).toLocaleDateString('tr-TR')}</td>
                        <td>
                            ${u.role !== 'admin' ? `
                            <button class="btn btn-danger btn-sm" data-action="delete-user" data-id="${u.id}">
                                <i class="fas fa-trash"></i> Sil
                            </button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('');

                mountMain(`
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Kayıtlı Kullanıcılar</h3>
                        </div>
                        <div class="card-body table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Kullanıcı Adı</th>
                                        <th>E-posta</th>
                                        <th>Rol</th>
                                        <th>Kayıt Tarihi</th>
                                        <th>İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `);

                document.querySelector(SELECTORS.main).addEventListener('click', async (e) => {
                    const btn = e.target.closest('[data-action="delete-user"]');
                    if (!btn) return;
                    const id = btn.getAttribute('data-id');
                    if (await confirmModal('Bu kullanıcıyı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
                        try {
                            const delRes = await api.deleteUser(id);
                            if (delRes.success) {
                                showAlert('Kullanıcı silindi', 'success');
                                showUsers(); // Refresh
                            } else {
                                showAlert(delRes.message, 'error');
                            }
                        } catch (err) {
                            showAlert(err.message, 'error');
                        }
                    }
                });
            }
        } catch (err) {
            mountMain(`<div class="alert alert-danger">${err.message}</div>`);
        }
    }

    async function loadAdminData() {
        const res = await api.getProfile();
        if (res.success) {
            state.user = res.data;
            // Check if user is admin and specifically admin@gmail.com
            if (state.user.role !== 'admin' || state.user.email !== 'admin@gmail.com') {
                throw new Error('Bu alana sadece admin@gmail.com hesabı erişebilir.');
            }
        } else {
            throw new Error('Profil yüklenemedi');
        }
    }

    function logout() {
        Storage.setToken(null);
        localStorage.removeItem('user');
        window.location.href = '/';
    }

    async function init() {
        attachNavHandlers();
        renderNavigation();
        if (state.token) {
            try {
                await loadAdminData();
                showDashboard();
            } catch (err) {
                showAlert(err.message, 'error');
                showLogin();
            }
        } else {
            showLogin();
        }
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', AdminApp.init);