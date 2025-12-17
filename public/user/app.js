const UserApp = (() => {
    try {
        // ---------- Konfigürasyon & Sabitler ----------
        const SELECTORS = {
            nav: '#user-navigation',
            main: '#user-main-content',
            sidebar: '#sidebar',
            pageTitle: '#page-title',
            userName: '#user-name',
            userAvatar: '#user-avatar',
            headerPoints: '#header-points',
            mobileToggle: '#mobile-toggle',
            refreshBtn: '#refresh-btn'
        };

        const API_ROUTES = {
            register: '/api/auth/register',
            login: '/api/auth/login',
            profile: '/api/auth/profile',
            habits: '/api/habits',
            complete: (id) => `/api/habits/${id}/complete`,
            stats: '/api/stats',
            badges: '/api/stats/badges',
            categoryStats: '/api/stats/category-stats',
            categoryStats: '/api/stats/category-stats',
            analytics: '/api/stats/analytics',
            updateProfile: '/api/auth/profile'
        };

        // Basit localStorage wrapper
        const Storage = {
            getToken() { return localStorage.getItem('token'); },
            setToken(t) { if (t) localStorage.setItem('token', t); else localStorage.removeItem('token'); }
        };

        // ---------- App State (reaktif değil ama merkezi) ----------
        const state = {
            token: Storage.getToken(),
            user: null,
            habits: [],
            stats: null,
            badges: []
        };

        // ---------- Küçük yardımcılar ----------
        const $ = (sel, scope = document) => scope.querySelector(sel);
        const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));

        // Fixed date formatting function to handle timezone properly
        const formatDateTR = (isoDate) => {
            try {
                // Parse the date string as local date, not UTC
                const [year, month, day] = isoDate.split('-').map(Number);
                const d = new Date(year, month - 1, day);
                return d.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            } catch (e) { return isoDate; }
        };

        // Fixed function to get today's date in YYYY-MM-DD format for local timezone
        function getTodayDate() {
            // Use local date string in YYYY-MM-DD format
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        // Helper function to convert any date to local date format
        function getLocalDateString(date) {
            const d = new Date(date);

            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        // Helper function to parse date string and ensure it's in YYYY-MM-DD format
        function parseDateString(dateStr) {
            if (!dateStr) return null;

            // If already in YYYY-MM-DD format, return as is
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                return dateStr;
            }

            // Try to parse other formats
            try {
                const date = new Date(dateStr);
                if (!isNaN(date.getTime())) {
                    return getLocalDateString(date);
                }
            } catch (e) {
                console.error('Date parsing error:', e);
            }

            return null;
        }

        const getLevelName = (level = 1) => {
            if (level === 1) return 'Yeni Başlayan';
            if (level === 2) return 'Gelişen';
            if (level >= 3) return 'Uzman';
            return 'Yeni Başlayan';
        };

        // Modern loading spinner markup
        const loadingSpinner = `<div class="loading"><div class="spinner"></div><p>Yükleniyor...</p></div>`;

        // Alert / Toast sistemi (ekran üstü, erişilebilir)
        function showAlert(message, type = 'info', options = {}) {
            // Önceki alert'leri temizle
            const existingAlerts = $$('.notification');
            existingAlerts.forEach(alert => alert.remove());

            const container = document.createElement('div');
            container.className = `notification notification-${type}`;
            container.setAttribute('role', 'alert');
            container.setAttribute('aria-live', 'assertive');

            container.innerHTML = `
                <div class="notification-content">
                    <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                    <span>${message}</span>
                    <button class="notification-close">&times;</button>
                </div>
    `;

            document.body.appendChild(container);

            // Close button event
            container.querySelector('.notification-close').addEventListener('click', () => container.remove());

            const timeout = options.duration ?? 4000;
            if (timeout > 0) setTimeout(() => container.remove(), timeout);
            return container;
        }

        // Modern confirm modal
        function confirmModal(message) {
            return new Promise((resolve) => {
                const modal = document.createElement('div');
                modal.className = 'modal-overlay';
                modal.innerHTML = `
                <div class="modal">
                    <div class="modal-header">
                        <h3><i class="fas fa-question-circle"></i> Onayla</h3>
                    </div>
                    <div class="modal-body">
                        <p>${message}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-action="cancel">İptal</button>
                        <button class="btn btn-primary" data-action="confirm">Onayla</button>
                    </div>
                </div>
    `;

                document.body.appendChild(modal);

                const closeModal = () => {
                    modal.classList.add('fade-out');
                    modal.querySelector('.modal').classList.add('scale-out');
                    setTimeout(() => modal.remove(), 200);
                };

                modal.addEventListener('click', (e) => {
                    if (e.target === modal) closeModal();
                });

                modal.querySelector('[data-action="cancel"]').addEventListener('click', () => {
                    closeModal();
                    resolve(false);
                });

                modal.querySelector('[data-action="confirm"]').addEventListener('click', () => {
                    closeModal();
                    resolve(true);
                });

                // Close on Escape key
                const handleEsc = (e) => {
                    if (e.key === 'Escape') {
                        closeModal();
                        resolve(false);
                        document.removeEventListener('keydown', handleEsc);
                    }
                };
                document.addEventListener('keydown', handleEsc);
            });
        }

        // ---------- Merkezi API Helper ----------
        // 1) Daha güvenli API helper (authorization boşluğu kaldırıldı + hata iletilerini daha bilgilendirici yap)
        async function apiRequest(path, { method = 'GET', body = null, auth = true } = {}) {
            const headers = {};
            if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
            // Eğer token varsa ve auth isteniyorsa Authorization header'ını koy (trailing space kaldırıldı)
            if (auth && state.token) headers['Authorization'] = `Bearer ${state.token}`;

            let res;
            try {
                res = await fetch(path, {
                    method,
                    headers,
                    body: body && !(body instanceof FormData) ? JSON.stringify(body) : body
                });
            } catch (networkErr) {
                // Ağ hatası (CORS, offline, DNS vs.)
                const e = new Error('Ağ hatası veya sunucuya erişilemiyor.');
                e.payload = networkErr;
                throw e;
            }

            // Try parse JSON safely
            let json = null;
            try { json = await res.json(); } catch (e) { /* body olmayabilir */ }

            if (!res.ok) {
                const msg = (json && json.message) ? json.message : `Sunucudan hata: ${res.status}`;
                const err = new Error(msg);
                err.status = res.status;
                err.payload = json;
                throw err;
            }

            return json;
        }

        // ---------- API Fonksiyonları (kullanıcı dostu isimlerle) ----------
        const api = {
            register: (data) => apiRequest(API_ROUTES.register, { method: 'POST', body: data, auth: false }),
            login: (data) => apiRequest(API_ROUTES.login, { method: 'POST', body: data, auth: false }),
            getProfile: () => apiRequest(API_ROUTES.profile, { method: 'GET' }),
            getHabits: () => apiRequest(API_ROUTES.habits, { method: 'GET' }),
            createHabit: (data) => apiRequest(API_ROUTES.habits, { method: 'POST', body: data }),
            updateHabit: (id, data) => apiRequest(`${API_ROUTES.habits}/${id}`, { method: 'PUT', body: data }),
            deleteHabit: (id) => apiRequest(`${API_ROUTES.habits}/${id}`, { method: 'DELETE' }),
            completeHabit: (id, date) => {
                // Ensure date is in proper format
                const formattedDate = parseDateString(date);
                if (!formattedDate) {
                    throw new Error('Geçersiz tarih formatı');
                }
                return apiRequest(API_ROUTES.complete(id), { method: 'POST', body: { date: formattedDate } });
            },
            getStats: () => apiRequest(API_ROUTES.stats, { method: 'GET' }),
            getBadges: () => apiRequest(API_ROUTES.badges, { method: 'GET' }),
            getCategoryStats: () => apiRequest(API_ROUTES.categoryStats, { method: 'GET' }),
            getMonthlyStats: (year, month) => {
                // Ensure year and month are valid numbers and convert to proper format
                const yearNum = parseInt(year);
                const monthNum = parseInt(month);
                if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 0 || monthNum > 11) {
                    throw new Error('Geçersiz yıl veya ay parametresi');
                }
                return apiRequest(`${API_ROUTES.stats.replace('stats', 'monthly-stats')}?year=${yearNum}&month=${monthNum}`, { method: 'GET' });
            },
            getAnalytics: (period = '30d') => apiRequest(`${API_ROUTES.analytics}?period=${period}`, { method: 'GET' }),
            updateProfile: (data) => apiRequest(API_ROUTES.updateProfile, { method: 'PUT', body: data })
        };

        // ---------- UI Render Fonksiyonları (template fonksiyonları) ----------
        function renderNavigation() {
            const navEl = document.querySelector(SELECTORS.nav);
            if (!navEl) return;

            if (state.token) {
                navEl.innerHTML = `
                    <nav aria-label="Kullanıcı navigasyonu">
                        <ul class="nav-list">
                            <li><button data-action="dashboard" class="nav-link"><i class="fas fa-home"></i> Panel</button></li>
                            <li><button data-action="habits" class="nav-link"><i class="fas fa-tasks"></i> Alışkanlıklarım</button></li>
                            <li><button data-action="calendar" class="nav-link"><i class="fas fa-calendar-alt"></i> Takvim</button></li>
                            <li><button data-action="stats" class="nav-link"><i class="fas fa-chart-bar"></i> İstatistikler</button></li>
                            <li><button data-action="settings" class="nav-link"><i class="fas fa-cog"></i> Ayarlar</button></li>
                            <li><button data-action="logout" class="btn btn-link nav-link"><i class="fas fa-sign-out-alt"></i> Çıkış Yap</button></li>
                        </ul>
                    </nav>
                `;

                // Update header user info if available
                if (state.user) {
                    const nameEl = document.querySelector(SELECTORS.userName);
                    const avatarEl = document.querySelector(SELECTORS.userAvatar);
                    if (nameEl) nameEl.textContent = state.user.username;
                    if (avatarEl) avatarEl.textContent = state.user.username.charAt(0).toUpperCase();

                    // Update points
                    const pointsEl = document.querySelector(SELECTORS.headerPoints);
                    if (pointsEl && state.stats) {
                        pointsEl.textContent = `${state.stats.total_points} Puan`;
                        pointsEl.parentElement.style.display = 'flex';
                    }
                }
            } else {
                navEl.innerHTML = `
                    <nav aria-label="Kullanıcı navigasyonu">
                        <ul class="nav-list">
                            <li><button data-action="login" class="nav-link"><i class="fas fa-sign-in-alt"></i> Giriş Yap</button></li>
                            <li><button data-action="register" class="btn btn-primary nav-link"><i class="fas fa-user-plus"></i> Kayıt Ol</button></li>
                        </ul>
                    </nav>
                `;
                // Hide points
                const pointsEl = document.querySelector(SELECTORS.headerPoints);
                if (pointsEl) pointsEl.parentElement.style.display = 'none';
            }
        }

        // Event delegation için navigation click handler
        function attachNavHandlers() {
            const navEl = document.querySelector(SELECTORS.nav);
            if (!navEl) return;

            navEl.addEventListener('click', (e) => {
                const action = e.target.getAttribute('data-action') || e.target.closest('[data-action]')?.getAttribute('data-action');
                if (!action) return;
                // e.preventDefault(); // button elements don't need preventDefault for navigation

                switch (action) {
                    case 'dashboard': showDashboard(); break;
                    case 'habits': showHabits(); break;
                    case 'calendar': showCalendar(); break;
                    case 'stats': showStats(); break;
                    case 'settings': showSettings(); break;
                    case 'login': showLogin(); break;
                    case 'register': showRegister(); break;
                    case 'logout': logout(); break;
                }
            });

            // Mobile toggle
            const toggle = document.querySelector(SELECTORS.mobileToggle);
            if (toggle) {
                toggle.addEventListener('click', () => {
                    document.querySelector(SELECTORS.sidebar).classList.toggle('active');
                });
            }

            // Refresh button
            const refresh = document.querySelector(SELECTORS.refreshBtn);
            if (refresh) {
                refresh.addEventListener('click', async () => {
                    refresh.classList.add('fa-spin');
                    await loadUserData();
                    showDashboard(); // Refresh current view ideally, but dashboard is safe
                    refresh.classList.remove('fa-spin');
                });
            }
        }

        // ---------- Sayfa Bölümleri (render + event binding) ----------
        function mountMain(html) {
            let main = document.querySelector(SELECTORS.main);
            if (!main) {
                console.error('Main element not found!');
                return;
            }

            // Clone main to remove all existing event listeners
            const newMain = main.cloneNode(true);
            main.parentNode.replaceChild(newMain, main);
            main = newMain; // Update reference

            main.innerHTML = html;

            // Scroll to top when content changes
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Close mobile sidebar if open
            document.querySelector(SELECTORS.sidebar).classList.remove('active');
        }

        function showLogin() {

            document.querySelector(SELECTORS.pageTitle).textContent = 'Giriş Yap';
            mountMain(`
                <section aria-labelledby="login-title" class="auth-container">
                    <div class="auth-card">
                        <div class="auth-header">
                            <h2 id="login-title"><i class="fas fa-sign-in-alt"></i> Giriş Yap</h2>
                            <p>Hesabınıza erişmek için bilgilerinizi girin</p>
                        </div>
                        <form id="login-form" class="form">
                            <div class="form-group">
                                <label for="email">E-posta</label>
                                <div class="input-with-icon">
                                    <i class="fas fa-envelope"></i>
                                    <input type="email" id="email" name="email" required placeholder="E-posta adresinizi girin">
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="password">Şifre</label>
                                <div class="input-with-icon">
                                    <i class="fas fa-lock"></i>
                                    <input type="password" id="password" name="password" required placeholder="Şifrenizi girin">
                                </div>
                            </div>
                            <div class="form-actions">
                                <button type="submit" class="btn btn-primary btn-block">Giriş Yap</button>
                                <button type="button" data-action="to-register" class="btn btn-link btn-block">Hesabınız yok mu? Kayıt Ol</button>
                            </div>
                        </form>
                    </div>
                </section>
            `);

            const form = document.getElementById('login-form');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const credentials = {
                    email: formData.get('email'),
                    password: formData.get('password')
                };

                // Basit validation
                if (!credentials.email || !credentials.password) {
                    showAlert('Lütfen tüm alanları doldurunuz', 'error');
                    return;
                }

                const btn = form.querySelector('button[type="submit"]');
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Giriş yapılıyor...';
                btn.disabled = true;

                try {
                    const res = await api.login(credentials);
                    if (res.success && res.data?.token) {
                        Storage.setToken(res.data.token);
                        state.token = res.data.token;
                        await loadUserData();
                        renderNavigation();
                        showDashboard();
                        showAlert('Giriş başarılı! Hoş geldiniz.', 'success');
                    } else {
                        showAlert(res.message || 'Giriş başarısız oldu', 'error');
                    }
                } catch (err) {
                    console.error(err);
                    showAlert(err.message || 'Sunucuya bağlanırken hata oluştu', 'error');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }
            });

            // delegation button
            document.querySelector(SELECTORS.main).addEventListener('click', function onclick(e) {
                const action = e.target.getAttribute('data-action') || e.target.closest('[data-action]')?.getAttribute('data-action');
                if (action === 'to-register') {
                    showRegister();
                }
                // remove listener after use to avoid duplication
                document.querySelector(SELECTORS.main).removeEventListener('click', onclick);
            });
        }

        function showRegister() {
            document.querySelector(SELECTORS.pageTitle).textContent = 'Kayıt Ol';
            mountMain(`
                <section aria-labelledby="register-title" class="auth-container">
                    <div class="auth-card">
                        <div class="auth-header">
                            <h2 id="register-title"><i class="fas fa-user-plus"></i> Yeni Hesap Oluştur</h2>
                            <p>Yeni bir hesap oluşturarak alışkanlıklarınızı takip etmeye başlayın</p>
                        </div>
                        <form id="register-form" class="form">
                            <div class="form-group">
                                <label for="username">Kullanıcı Adı</label>
                                <div class="input-with-icon">
                                    <i class="fas fa-user"></i>
                                    <input type="text" id="username" name="username" required placeholder="Kullanıcı adınızı girin">
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="reg-email">E-posta</label>
                                <div class="input-with-icon">
                                    <i class="fas fa-envelope"></i>
                                    <input type="email" id="reg-email" name="email" required placeholder="E-posta adresinizi girin">
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="reg-password">Şifre</label>
                                <div class="input-with-icon">
                                    <i class="fas fa-lock"></i>
                                    <input type="password" id="reg-password" name="password" required placeholder="Şifrenizi girin (en az 6 karakter)">
                                </div>
                            </div>
                            <div class="form-actions">
                                <button type="submit" class="btn btn-primary btn-block">Kayıt Ol</button>
                                <button type="button" data-action="to-login" class="btn btn-link btn-block">Zaten hesabınız var mı? Giriş Yap</button>
                            </div>
                        </form>
                    </div>
                </section>
            `);

            const form = document.getElementById('register-form');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const fd = new FormData(form);
                const data = { username: fd.get('username'), email: fd.get('email'), password: fd.get('password') };

                if (!data.username || !data.email || !data.password) { showAlert('Tüm alanları doldurun', 'error'); return; }
                if (data.password.length < 6) { showAlert('Şifre en az 6 karakter olmalıdır', 'error'); return; }

                const btn = form.querySelector('button[type="submit"]');
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Kayıt olunuyor...';
                btn.disabled = true;

                try {
                    const res = await api.register(data);
                    if (res.success && res.data?.token) {
                        Storage.setToken(res.data.token);
                        state.token = res.data.token;
                        await loadUserData();
                        renderNavigation();
                        showDashboard();
                        showAlert('Kayıt başarılı! Hoş geldiniz.', 'success');
                    } else {
                        showAlert(res.message || 'Kayıt başarısız oldu', 'error');
                    }
                } catch (err) {
                    console.error(err);
                    showAlert(err.message || 'Kayıt sırasında hata oluştu', 'error');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }
            });

            document.querySelector(SELECTORS.main).addEventListener('click', function onclick(e) {
                const action = e.target.getAttribute('data-action') || e.target.closest('[data-action]')?.getAttribute('data-action');
                if (action === 'to-login') showLogin();
                document.querySelector(SELECTORS.main).removeEventListener('click', onclick);
            });

        }

        function showSettings() {
            document.querySelector(SELECTORS.pageTitle).textContent = 'Ayarlar';

            const user = state.user || {};

            mountMain(`
                <section class="settings-container" style="max-width: 800px; margin: 0 auto;">
                    <div class="card settings-card">
                        <div class="card-header">
                            <h2 class="card-title"><i class="fas fa-user-cog"></i> Profil Ayarları</h2>
                        </div>
                        
                        <div class="card-body">
                             <form id="settings-form" class="form" style="padding: 0;">
                                <div class="form-grid" style="display: grid; grid-template-columns: 1fr; gap: 1.5rem;">
                                    <div class="form-group">
                                        <label for="update-username" class="form-label">Kullanıcı Adı</label>
                                        <div class="input-with-icon">
                                            <i class="fas fa-user"></i>
                                            <input type="text" id="update-username" name="username" class="form-control" value="${user.username || ''}" required placeholder="Kullanıcı adınız">
                                        </div>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label for="update-email" class="form-label">E-posta</label>
                                        <div class="input-with-icon">
                                            <i class="fas fa-envelope"></i>
                                            <input type="email" id="update-email" name="email" class="form-control" value="${user.email || ''}" required placeholder="E-posta adresiniz">
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="form-divider" style="margin: 2rem 0; border-top: 1px solid #e2e8f0; position: relative; text-align: center;">
                                    <span style="background: #fff; padding: 0 1rem; position: relative; top: -12px; color: var(--gray); font-size: 0.9rem;">Güvenlik</span>
                                </div>
                                
                                <div class="form-group">
                                    <label for="update-password" class="form-label">Yeni Şifre</label>
                                    <div class="input-with-icon">
                                        <i class="fas fa-lock"></i>
                                        <input type="password" id="update-password" name="password" class="form-control" placeholder="Değiştirmek için yeni şifre girin">
                                    </div>
                                    <small class="form-text" style="color: var(--secondary); font-size: 0.85rem; margin-top: 0.5rem; display: block;">
                                        <i class="fas fa-info-circle"></i> Şifrenizi değiştirmek istemiyorsanız bu alanı boş bırakın.
                                    </small>
                                </div>
                                
                                <div class="form-actions" style="margin-top: 2rem; display: flex; justify-content: flex-end;">
                                    <button type="submit" class="btn btn-primary">
                                        <i class="fas fa-save"></i> Değişiklikleri Kaydet
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </section>
            `);

            const form = document.getElementById('settings-form');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const formData = new FormData(form);
                const data = {
                    username: formData.get('username'),
                    email: formData.get('email'),
                    password: formData.get('password')
                };

                // Eğer şifre boşsa gönderilen objeden çıkaralım, backend handle etsin
                if (!data.password) delete data.password;

                const btn = form.querySelector('button[type="submit"]');
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Kaydediliyor...';
                btn.disabled = true;

                try {
                    const res = await api.updateProfile(data);
                    if (res.success) {
                        showAlert('Profiliniz başarıyla güncellendi', 'success');
                        // Kullanıcı bilgilerini tazeleyelim
                        await loadUserData();
                        renderNavigation(); // Header'daki ismi güncellemek için
                    } else {
                        showAlert(res.message || 'Güncelleme başarısız', 'error');
                    }
                } catch (err) {
                    console.error(err);
                    showAlert(err.message || 'Güncelleme sırasında hata oluştu', 'error');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }
            });
        }

        function dashboardHTML() {
            const totalPoints = state.stats?.total_points ?? 0;
            const level = state.stats?.level ?? 1;
            const toNext = 10 - (totalPoints % 10);
            const progressPercent = ((totalPoints % 10) * 10) + '%';

            const badgesHTML = (state.badges && state.badges.length)
                ? state.badges.map(b => `
                    <div class="badge-item" title="${b.description || ''}">
                        <div class="badge-icon">${b.icon || '🏆'}</div>
                        <div class="badge-name">${b.badge_name}</div>
                    </div>
                `).join('')
                : '<div class="empty-state"><i class="fas fa-medal"></i><p>Henüz rozetiniz yok. Alışkanlıkları tamamlayarak kazanın!</p></div>';

            const habitsPreview = state.habits.slice(0, 3).map(h => `
                <div class="habit-item" data-id="${h.id}">
                    <div class="habit-info">
                        <div class="habit-name">${h.name}</div>
                        <div class="habit-meta">
                            <span class="badge badge-primary">${h.category}</span>
                            <span class="badge badge-secondary">${h.frequency === 'daily' ? 'Günlük' : 'Haftalık'}</span>
                        </div>
                    </div>
                    <div class="habit-actions">
                        <button class="btn btn-success btn-sm" data-action="complete" data-id="${h.id}">
                            <i class="fas fa-check"></i> Tamamla
                        </button>
                    </div>
                </div>
            `).join('') || '<div class="empty-state"><i class="fas fa-tasks"></i><p>Henüz alışkanlığınız yok.</p><button class="btn btn-primary" data-action="add-habit"><i class="fas fa-plus"></i> İlk alışkanlığınızı ekleyin</button></div>';

            return `
                <section class="dashboard-container">
                    <div class="dashboard-header">
                        <div class="user-greeting">
                            <h2>Hoş geldin, ${state.user?.username ?? 'Kullanıcı'}!</h2>
                            <p>İlerlemenizi takip etmeye devam edin</p>
                        </div>
                        <div class="user-stats">
                            <div class="stat-card">
                                <div class="stat-icon primary">
                                    <i class="fas fa-coins"></i>
                                </div>
                                <div class="stat-details">
                                    <h3>Toplam Puan</h3>
                                    <div class="stat-value">${totalPoints}</div>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${progressPercent}"></div>
                                    </div>
                                    <p>${toNext} puan sonraki seviye</p>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon success">
                                    <i class="fas fa-chart-line"></i>
                                </div>
                                <div class="stat-details">
                                    <h3>Seviye</h3>
                                    <div class="stat-value">${level}</div>
                                    <p>${getLevelName(level)}</p>
                                </div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-icon warning">
                                    <i class="fas fa-list"></i>
                                </div>
                                <div class="stat-details">
                                    <h3>Alışkanlık</h3>
                                    <div class="stat-value">${state.habits.length}</div>
                                    <p>Aktif alışkanlık</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="dashboard-section">
                        <div class="section-header">
                            <h3><i class="fas fa-medal"></i> Rozetleriniz</h3>
                        </div>
                        <div class="badge-list">
                            ${badgesHTML}
                        </div>
                    </div>

                    <div class="dashboard-section">
                        <div class="section-header">
                            <h3><i class="fas fa-tasks"></i> Alışkanlıklarınız</h3>
                            <button class="btn btn-link" data-action="view-all">Tümünü Gör</button>
                        </div>
                        <div class="habit-list">
                            ${habitsPreview}
                        </div>
                    </div>
                </section>
            `;
        }

        function showDashboard() {

            document.querySelector(SELECTORS.pageTitle).textContent = 'Panel';
            mountMain(dashboardHTML());

            // Delegation: single listener for main area to handle habit complete and navigation actions
            const main = document.querySelector(SELECTORS.main);
            main.addEventListener('click', async function handler(e) {
                const action = e.target.getAttribute('data-action') || e.target.closest('[data-action]')?.getAttribute('data-action');
                if (!action) return;
                // e.preventDefault();

                if (action === 'complete') {
                    const habitId = e.target.getAttribute('data-id') || e.target.closest('[data-id]')?.getAttribute('data-id');

                    // Use fixed local date function with validation
                    const today = getTodayDate();

                    const confirmed = await confirmModal('Bu alışkanlığı tamamlamak istediğinize emin misiniz?');
                    if (!confirmed) return;

                    try {
                        const res = await api.completeHabit(habitId, today); // Use fixed local date
                        if (res.success) {
                            // local optimistic update: reload user data
                            await loadUserData();

                            // Real-time update: Eğer şu anda takvim sayfasındaysak, takvimi de güncelleyelim
                            const pageTitle = document.querySelector(SELECTORS.pageTitle)?.textContent;
                            if (pageTitle && pageTitle.includes('Takvim')) {
                                const calendarRoot = document.getElementById('calendar-root');
                                if (calendarRoot) {
                                    const currentYear = new Date().getFullYear();
                                    const currentMonth = new Date().getMonth();
                                    const calendarDataAttr = calendarRoot.getAttribute('data-calendar-data');
                                    if (calendarDataAttr) {
                                        try {
                                            const calendarData = JSON.parse(calendarDataAttr);
                                            // Find the completed habit info
                                            const habit = state.habits.find(h => String(h.id) === habitId);
                                            if (habit) {
                                                const currentDayData = calendarData[today] || { count: 0, habits: [], categories: [] };
                                                calendarData[today] = {
                                                    count: currentDayData.count + 1,
                                                    habits: [...currentDayData.habits, habit.name],
                                                    categories: [...currentDayData.categories, habit.category]
                                                };
                                                calendarRoot.setAttribute('data-calendar-data', JSON.stringify(calendarData));
                                                updateCalendarWithData(currentYear, currentMonth, calendarData);

                                                // Update daily details if this day is currently selected
                                                const selectedDay = document.querySelector('.calendar-day.selected');
                                                if (selectedDay && selectedDay.getAttribute('data-date') === today) {
                                                    renderDailyDetails(today, calendarData);
                                                }
                                            }
                                        } catch (e) {
                                            console.error('Calendar update error:', e);
                                        }
                                    }
                                }
                            }

                            // Eğer istatistik sayfasındaysak, istatistikleri de güncelleyelim
                            if (pageTitle && pageTitle.includes('İstatistik')) {
                                const currentPeriod = document.querySelector('.period-selector .btn.active')?.getAttribute('data-period') || '30d';
                                await loadStatsData(currentPeriod);
                            }

                            showDashboard();
                            showAlert('Alışkanlık tamamlandı!', 'success');
                        } else {
                            showAlert(res.message || 'Tamamlama başarısız', 'error');
                        }
                    } catch (err) {
                        console.error(err);
                        showAlert(err.message || 'Tamamlama sırasında hata oluştu', 'error');
                    }
                }

                if (action === 'add-habit' || action === 'view-all') {
                    showHabits();
                }

                // remove handler to avoid duplication when switching views
                main.removeEventListener('click', handler);
            });
        }

        // Habits list and CRUD
        function habitsHTML() {
            const listHTML = (state.habits.length > 0) ? state.habits.map(h => `
                <div class="habit-item" data-id="${h.id}">
                    <div class="habit-info">
                        <div class="habit-name">${h.name}</div>
                        <div class="habit-meta">
                            <span class="badge badge-primary">${h.category}</span>
                            <span class="badge badge-secondary">${h.frequency === 'daily' ? 'Günlük' : 'Haftalık'}</span>
                        </div>
                    </div>
                    <div class="habit-actions">
                        <button class="btn btn-success btn-sm" data-action="complete" data-id="${h.id}">
                            <i class="fas fa-check"></i> Tamamla
                        </button>
                        <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${h.id}">
                            <i class="fas fa-edit"></i> Düzenle
                        </button>
                        <button class="btn btn-danger btn-sm" data-action="delete" data-id="${h.id}">
                            <i class="fas fa-trash"></i> Sil
                        </button>
                    </div>
                </div>
            `).join('') : '<div class="empty-state"><i class="fas fa-tasks"></i><p>Henüz alışkanlık eklemediniz.</p><button class="btn btn-primary" data-action="add-new"><i class="fas fa-plus"></i> Hemen ekle</button></div>';

            return `
                <section class="habits-container">
                    <div class="toolbar">
                        <div class="toolbar-left">
                            <button class="btn btn-link" data-action="back"><i class="fas fa-arrow-left"></i> Geri</button>
                            <h2>Alışkanlıklarım</h2>
                        </div>
                        <div class="toolbar-right">
                            <div class="points-display">
                                <i class="fas fa-coins"></i> Puan: <strong>${state.stats?.total_points ?? 0}</strong>
                            </div>
                            <button class="btn btn-primary" data-action="add-new">
                                <i class="fas fa-plus"></i> Yeni Alışkanlık
                            </button>
                        </div>
                    </div>
                    <div class="habit-list">
                        ${listHTML}
                    </div>
                </section>
            `;
        }

        function showHabits() {
            document.querySelector(SELECTORS.pageTitle).textContent = 'Alışkanlıklarım';
            mountMain(habitsHTML());

            const main = document.querySelector(SELECTORS.main);
            main.addEventListener('click', async function handler(e) {
                const action = e.target.getAttribute('data-action') || e.target.closest('[data-action]')?.getAttribute('data-action');
                if (!action) return;
                // e.preventDefault();

                const id = e.target.getAttribute('data-id') || e.target.closest('[data-id]')?.getAttribute('data-id');

                try {
                    if (action === 'back') showDashboard();
                    else if (action === 'add-new') showHabitForm();
                    else if (action === 'edit') {
                        const habit = state.habits.find(h => String(h.id) === String(id));
                        if (habit) showHabitForm(habit);
                    }
                    else if (action === 'delete') {
                        const ok = await confirmModal('Bu alışkanlığı silmek istediğinize emin misiniz?');
                        if (!ok) return;
                        const res = await api.deleteHabit(id);
                        if (res.success) {
                            await loadUserData();
                            showHabits();
                            showAlert('Alışkanlık silindi', 'success');
                        } else showAlert(res.message || 'Silme işlemi başarısız', 'error');
                    }
                    else if (action === 'complete') {
                        const today = getTodayDate();
                        const ok = await confirmModal('Bu alışkanlığı tamamlamak istediğinize emin misiniz?');
                        if (!ok) return;
                        const res = await api.completeHabit(id, today);
                        if (res.success) {
                            await loadUserData();

                            // Real-time update: Eğer şu anda takvim sayfasındaysak, takvimi de güncelleyelim
                            const pageTitle = document.querySelector(SELECTORS.pageTitle)?.textContent;
                            if (pageTitle && pageTitle.includes('Takvim')) {
                                const calendarRoot = document.getElementById('calendar-root');
                                if (calendarRoot) {
                                    const currentYear = new Date().getFullYear();
                                    const currentMonth = new Date().getMonth();
                                    const calendarDataAttr = calendarRoot.getAttribute('data-calendar-data');
                                    if (calendarDataAttr) {
                                        try {
                                            const calendarData = JSON.parse(calendarDataAttr);
                                            // Find the completed habit info
                                            const habit = state.habits.find(h => String(h.id) === id);
                                            if (habit) {
                                                const currentDayData = calendarData[today] || { count: 0, habits: [], categories: [] };
                                                calendarData[today] = {
                                                    count: currentDayData.count + 1,
                                                    habits: [...currentDayData.habits, habit.name],
                                                    categories: [...currentDayData.categories, habit.category]
                                                };
                                                calendarRoot.setAttribute('data-calendar-data', JSON.stringify(calendarData));
                                                updateCalendarWithData(currentYear, currentMonth, calendarData);

                                                // Update daily details if this day is currently selected
                                                const selectedDay = document.querySelector('.calendar-day.selected');
                                                if (selectedDay && selectedDay.getAttribute('data-date') === today) {
                                                    renderDailyDetails(today, calendarData);
                                                }
                                            }
                                        } catch (e) {
                                            console.error('Calendar update error:', e);
                                        }
                                    }
                                }
                            }

                            // Eğer istatistik sayfasındaysak, istatistikleri de güncelleyelim
                            if (pageTitle && pageTitle.includes('İstatistik')) {
                                const currentPeriod = document.querySelector('.period-selector .btn.active')?.getAttribute('data-period') || '30d';
                                await loadStatsData(currentPeriod);
                            }

                            showHabits();
                            showAlert('Alışkanlık tamamlandı', 'success');
                        } else showAlert(res.message || 'Tamamlama başarısız', 'error');
                    }
                } catch (err) {
                    console.error(err);
                    showAlert(err.message || 'İşlem sırasında hata oluştu', 'error');
                }

                main.removeEventListener('click', handler);
            });
        }

        // Habit form (create / edit) - MODAL VERSION
        function showHabitForm(habit = null) {
            const isEditing = !!habit;

            // Create modal elements
            const modalOverlay = document.createElement('div');
            modalOverlay.className = 'modal-overlay';

            modalOverlay.innerHTML = `
                <div class="modal">
                    <div class="modal-header">
                        <h3>${isEditing ? '<i class="fas fa-edit"></i> Alışkanlığı Düzenle' : '<i class="fas fa-plus"></i> Yeni Alışkanlık Ekle'}</h3>
                    </div>
                    <div class="modal-body">
                        <form id="habit-form" class="form" style="padding: 0;">
                            <input type="hidden" name="id" value="${isEditing ? habit.id : ''}">
                            <div class="form-group">
                                <label for="name">Alışkanlık Adı</label>
                                <input type="text" id="name" name="name" class="form-control" required value="${isEditing ? escapeHtml(habit.name) : ''}" placeholder="Örn: Her gün 20 dakika kitap oku">
                            </div>
                            <div class="form-group">
                                <label for="category">Kategori</label>
                                <select id="category" name="category" class="form-control" required>
                                    <option value="">Bir kategori seçin</option>
                                    ${categoryOptions(habit?.category)}
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="frequency">Sıklık</label>
                                <select id="frequency" name="frequency" class="form-control" required>
                                    <option value="">Sıklık seçin</option>
                                    <option value="daily" ${isEditing && habit.frequency === 'daily' ? 'selected' : ''}>Günlük</option>
                                    <option value="weekly" ${isEditing && habit.frequency === 'weekly' ? 'selected' : ''}>Haftalık</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" data-action="cancel" class="btn btn-secondary">İptal</button>
                        <button type="button" data-action="save" class="btn btn-primary">${isEditing ? 'Güncelle' : 'Ekle'}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modalOverlay);

            // Event Handlers
            const form = modalOverlay.querySelector('#habit-form');
            const saveBtn = modalOverlay.querySelector('[data-action="save"]');
            const cancelBtn = modalOverlay.querySelector('[data-action="cancel"]');

            const closeModal = () => {
                modalOverlay.classList.add('fade-out');
                modalOverlay.querySelector('.modal').classList.add('scale-out');
                setTimeout(() => modalOverlay.remove(), 200);
            };

            // Close on click outside
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) closeModal();
            });

            // Close on Cancel
            cancelBtn.addEventListener('click', closeModal);

            // Handle Save
            saveBtn.addEventListener('click', async () => {
                const fd = new FormData(form);
                const data = { name: fd.get('name'), category: fd.get('category'), frequency: fd.get('frequency') };

                if (!data.name || !data.category || !data.frequency) {
                    showAlert('Lütfen tüm alanları doldurun', 'error');
                    return;
                }

                const originalText = saveBtn.innerHTML;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İşleniyor...';
                saveBtn.disabled = true;

                try {
                    let res;
                    if (isEditing) {
                        const id = fd.get('id');
                        res = await api.updateHabit(id, data);
                    } else {
                        res = await api.createHabit(data);
                    }

                    if (res.success) {
                        await loadUserData();
                        // Refresh the list if we are on the habits page
                        const habitsContainer = document.querySelector('.habits-container');
                        if (habitsContainer) showHabits();

                        // Eğer takvim sayfasındaysak, takvimi de güncelleyelim (yeni eklenen habitları göstermek için)
                        const pageTitle = document.querySelector(SELECTORS.pageTitle)?.textContent;
                        if (pageTitle && pageTitle.includes('Takvim')) {
                            const currentYear = new Date().getFullYear();
                            const currentMonth = new Date().getMonth();
                            const currentFilter = document.getElementById('habit-filter')?.value || 'all';
                            await loadCalendarData(currentYear, currentMonth, currentFilter);
                        }

                        showAlert(isEditing ? 'Alışkanlık güncellendi' : 'Alışkanlık eklendi', 'success');
                        closeModal();
                    } else {
                        showAlert(res.message || 'İşlem başarısız', 'error');
                    }
                } catch (err) {
                    console.error(err);
                    showAlert(err.message || 'Sunucu hatası', 'error');
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = originalText;
                }
            });
        }


        // Basit kategori seçenekleri fonksiyonu
        function categoryOptions(selected = '') {
            const cats = ['spor', 'kişisel gelişim', 'ders', 'sağlık', 'eğlence', 'diğer'];
            return cats.map(c => `<option value="${c}" ${selected === c ? 'selected' : ''}>${capitalize(c)}</option>`).join('\n');
        }

        function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

        // Güvenli HTML escape (form value içine koyarken)
        function escapeHtml(unsafe) {
            return (unsafe || '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#039;');
        }

        // Modern Statistics view with analytics
        async function showStats() {
            document.querySelector(SELECTORS.pageTitle).textContent = 'İstatistikler';
            mountMain(`
                <section class="stats-modern-container">
                    <div class="toolbar">
                        <div class="toolbar-left">
                            <button class="btn btn-secondary" data-action="back"><i class="fas fa-arrow-left"></i> Geri</button>
                            <h2><i class="fas fa-chart-bar"></i> Detaylı İstatistikler</h2>
                        </div>
                        <div class="toolbar-right">
                            <div class="period-selector">
                                <button class="btn btn-secondary btn-sm" data-period="7d">7 Gün</button>
                                <button class="btn btn-secondary btn-sm active" data-period="30d">30 Gün</button>
                                <button class="btn btn-secondary btn-sm" data-period="90d">90 Gün</button>
                                <button class="btn btn-secondary btn-sm" data-period="1y">1 Yıl</button>
                            </div>
                        </div>
                    </div>
                    
                    <div id="stats-content">
                        <div class="loading">
                            <div class="spinner"></div>
                            <p>İstatistikler yükleniyor...</p>
                        </div>
                    </div>
                </section>
            `);

            // Period selection handler
            const main = document.querySelector(SELECTORS.main);
            main.addEventListener('click', async function handler(e) {
                const action = e.target.getAttribute('data-action') || e.target.closest('[data-action]')?.getAttribute('data-action');
                const period = e.target.getAttribute('data-period') || e.target.closest('[data-period]')?.getAttribute('data-period');

                if (action === 'back') {
                    showDashboard();
                    main.removeEventListener('click', handler);
                    return;
                }

                if (period) {
                    // Update active button
                    document.querySelectorAll('.period-selector .btn').forEach(btn => btn.classList.remove('active'));
                    e.target.classList.add('active');

                    // Reload stats with new period
                    await loadStatsData(period);
                }
            });

            // Load initial data
            await loadStatsData('30d');
        }

        // Load statistics data for a specific period
        async function loadStatsData(period = '30d') {
            const content = document.getElementById('stats-content');
            if (!content) return;

            try {
                const [analyticsRes, categoryRes] = await Promise.all([
                    api.getAnalytics(period).catch(e => ({ success: false, message: e.message })),
                    api.getCategoryStats().catch(e => ({ success: false, message: e.message }))
                ]);

                const analytics = analyticsRes.success ? analyticsRes.data : null;
                const categories = categoryRes.success ? categoryRes.data : [];

                if (analytics) {
                    content.innerHTML = generateStatsHTML(analytics, categories, period);
                } else {
                    content.innerHTML = '<div class="empty-state"><i class="fas fa-chart-bar"></i><p>İstatistikler yüklenemedi.</p></div>';
                }
            } catch (err) {
                console.error('Stats loading error:', err);
                content.innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-circle"></i> İstatistikler yüklenirken hata oluştu</div>`;
            }
        }

        // Generate comprehensive statistics HTML
        function generateStatsHTML(analytics, categories, period) {
            const periodNames = { '7d': 'Son 7 Gün', '30d': 'Son 30 Gün', '90d': 'Son 90 Gün', '1y': 'Son 1 Yıl' };
            const totalStats = analytics.totalStats || {};

            return `
                <!-- Overview Cards -->
                <div class="stats-overview">
                    <div class="stat-card">
                        <div class="stat-icon primary">
                            <i class="fas fa-tasks"></i>
                        </div>
                        <div class="stat-details">
                            <h3>Toplam Alışkanlık</h3>
                            <div class="stat-value">${totalStats.total_habits || 0}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon success">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="stat-details">
                            <h3>Toplam Tamamlama</h3>
                            <div class="stat-value">${totalStats.total_completions || 0}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon warning">
                            <i class="fas fa-percentage"></i>
                        </div>
                        <div class="stat-details">
                            <h3>Başarı Oranı</h3>
                            <div class="stat-value">%${totalStats.overall_success_rate || 0}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon danger">
                            <i class="fas fa-fire"></i>
                        </div>
                        <div class="stat-details">
                            <h3>En Uzun Seri</h3>
                            <div class="stat-value">${getLongestStreak(analytics.streakData) || 0}</div>
                        </div>
                    </div>
                </div>

                <!-- Ayın Özeti - Monthly Summary -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-chart-line"></i> Ayın Özeti</h3>
                    </div>
                    <div class="card-body">
                        <div class="monthly-summary-stats">
                            <div class="summary-grid">
                                <div class="summary-item">
                                    <i class="fas fa-check-circle" style="color: var(--success);"></i>
                                    <div class="summary-info">
                                        <div class="summary-value">${analytics.totalStats?.total_completions || 0}</div>
                                        <div class="summary-label">Bu Ay Toplam Tamamlama</div>
                                    </div>
                                </div>
                                <div class="summary-item">
                                    <i class="fas fa-percentage" style="color: var(--primary);"></i>
                                    <div class="summary-info">
                                        <div class="summary-value">%${analytics.totalStats?.overall_success_rate || 0}</div>
                                        <div class="summary-label">Başarı Oranı</div>
                                    </div>
                                </div>
                                <div class="summary-item">
                                    <i class="fas fa-tasks" style="color: var(--warning);"></i>
                                    <div class="summary-info">
                                        <div class="summary-value">${analytics.totalStats?.total_habits || 0}</div>
                                        <div class="summary-label">Aktif Alışkanlık</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Bu Ay En Çok Tamamlananlar - Top Habits -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-trophy"></i> Bu Ay En Çok Tamamlananlar</h3>
                    </div>
                    <div class="card-body">
                        <div class="monthly-leaderboard">
                            ${generateMonthlyLeaderboard(analytics.habitStats || [])}
                        </div>
                    </div>
                </div>






            `;
        }



        // Generate category performance HTML
        function generateCategoryPerformance(categoryStats) {
            if (!categoryStats || categoryStats.length === 0) {
                return '<div class="empty-state"><i class="fas fa-layer-group"></i><p>Kategori verisi bulunmuyor.</p></div>';
            }

            return categoryStats.map(stat => {
                const successRate = stat.success_rate || 0;
                return `
                    <div class="performance-item">
                        <div class="performance-header">
                            <div class="performance-name">${capitalize(stat.category)}</div>
                            <div class="performance-percentage">%${successRate}</div>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${successRate}%"></div>
                        </div>
                        <div class="performance-stats">
                            <span class="text-success">${stat.completed} tamamlandı</span>
                            <span class="muted">/ ${stat.total} toplam</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Generate streak leaderboard HTML
        function generateStreakLeaderboard(streakData) {
            const sortedStreaks = streakData
                .filter(s => s.current_streak > 0)
                .sort((a, b) => b.current_streak - a.current_streak)
                .slice(0, 5);

            if (sortedStreaks.length === 0) {
                return '<div class="empty-state"><i class="fas fa-fire"></i><p>Henüz seri verisi bulunmuyor.</p></div>';
            }

            return sortedStreaks.map((streak, index) => `
                <div class="streak-item">
                    <div class="streak-rank">#${index + 1}</div>
                    <div class="streak-info">
                        <div class="streak-name">${streak.name}</div>
                        <div class="streak-category">${capitalize(streak.category)}</div>
                    </div>
                    <div class="streak-stats">
                        <div class="streak-current">
                            <span class="streak-number">${streak.current_streak}</span>
                            <span class="streak-label">gün</span>
                        </div>
                        ${streak.longest_streak > streak.current_streak ? `
                            <div class="streak-best">
                                En iyi: ${streak.longest_streak}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('');
        }

        // Helper function to get longest streak
        function getLongestStreak(streakData) {
            if (!streakData || streakData.length === 0) return 0;
            return Math.max(...streakData.map(s => s.longest_streak || 0));
        }

        // Generate monthly leaderboard HTML
        function generateMonthlyLeaderboard(habitStats) {
            if (!habitStats || habitStats.length === 0) {
                return '<div class="empty-state"><i class="fas fa-trophy"></i><p>Bu ayda henüz tamamlanan alışkanlık bulunmamaktadır.</p></div>';
            }

            return habitStats.slice(0, 5).map((stat, index) => {
                const maxCount = habitStats[0].completed_count;
                const barWidth = maxCount > 0 ? (stat.completed_count / maxCount) * 100 : 0;
                return `
                    <div class="leaderboard-item">
                        <div class="leaderboard-rank">#${index + 1}</div>
                        <div class="leaderboard-info">
                            <div class="leaderboard-name">${stat.name}</div>
                            <div class="leaderboard-meta">
                                <span class="badge badge-primary">${capitalize(stat.category)}</span>
                                <span class="leaderboard-count">${stat.completed_count} kez</span>
                            </div>
                        </div>
                        <div class="leaderboard-bar-container">
                            <div class="leaderboard-bar" style="width: ${barWidth}%; background-color: ${getHabitColor(stat.name)};"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }



        // ============================
        // MODERN TAKVİM FONKSİYONLARI
        // ============================

        // Alışkanlık isminden tutarlı bir renk üretmek için yardımcı fonksiyon
        function getHabitColor(habitName) {
            let hash = 0;
            for (let i = 0; i < habitName.length; i++) {
                hash = habitName.charCodeAt(i) + ((hash << 5) - hash);
            }
            const hue = hash % 360;
            return `hsl(${hue}, 70%, 60%)`;
        }

        // Takvim ana görüntüleme fonksiyonu - backend verileriyle birlikte
        async function showCalendar(year = new Date().getFullYear(), month = new Date().getMonth(), selectedHabitId = 'all') {
            // Sayfa başlığını güncelle
            document.querySelector(SELECTORS.pageTitle).textContent = 'Takvim & İlerleme';

            mountMain(`
                <section class="calendar-modern-container">
                    <div class="toolbar">
                        <div class="toolbar-left">
                            <button class="btn btn-secondary" data-action="back"><i class="fas fa-arrow-left"></i> Geri</button>
                            <h2><i class="fas fa-calendar-alt"></i> Takvim</h2>
                        </div>
                    </div>

                    <div class="calendar-controls">
                        <div class="calendar-filter">
                            <label for="habit-filter">Alışkanlık Filtresi:</label>
                            <select id="habit-filter" class="form-control" data-action="filter-change">
                                <option value="all">Tüm Alışkanlıklar</option>
                                ${state.habits.map(h => `
                                    <option value="${h.id}" ${selectedHabitId == h.id ? 'selected' : ''}>${h.name}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div class="calendar-layout">
                        <div class="calendar-main">
                            <div id="calendar-root">
                                <div class="loading">
                                    <div class="spinner"></div>
                                    <p>Takvim verileri yükleniyor...</p>
                                </div>
                            </div>
                        </div>
                        <div class="calendar-sidebar">
                            <div class="card">
                                <div class="card-header">
                                    <h3 class="card-title"><i class="fas fa-info-circle"></i> Günün Detayları</h3>
                                </div>
                                <div id="daily-details">
                                    <p class="muted">Takvimden bir tarih seçerek o gün tamamlanan alışkanlıkları görebilirsiniz.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            `);

            // Backend'den takvim verilerini yükle
            await loadCalendarData(year, month, selectedHabitId);

            // Olay dinleyicileri ata
            const main = document.querySelector(SELECTORS.main);
            main.addEventListener('click', async function handler(e) {
                const action = e.target.getAttribute('data-action') || e.target.closest('[data-action]')?.getAttribute('data-action');

                // Takvimdeki bir güne tıklandığında
                if (e.target.closest('.calendar-day')) {
                    const dayElement = e.target.closest('.calendar-day');
                    const date = dayElement.getAttribute('data-date');
                    if (date) {
                        // Remove previous selection
                        document.querySelectorAll('.calendar-day.selected').forEach(el => {
                            el.classList.remove('selected');
                        });

                        // Add selection to clicked day
                        dayElement.classList.add('selected');

                        // Get calendar data from the current monthly stats
                        const monthlyData = document.querySelector('#calendar-root')?.getAttribute('data-calendar-data');
                        let calendarData = null;
                        if (monthlyData) {
                            try {
                                calendarData = JSON.parse(monthlyData);
                            } catch (e) { }
                        }

                        // If no calendar data in DOM, use local state data
                        if (!calendarData) {
                            const completedHabits = state.habits
                                .map(habit => ({
                                    ...habit,
                                    completed: (habit.completed_dates || []).includes(date)
                                }))
                                .filter(habit => habit.completed);

                            if (completedHabits.length > 0) {
                                calendarData = {
                                    [date]: {
                                        count: completedHabits.length,
                                        habits: completedHabits.map(h => h.name),
                                        categories: completedHabits.map(h => h.category)
                                    }
                                };
                            }
                        }

                        renderDailyDetails(date, calendarData);
                    }
                }

                if (!action) return;
                // e.preventDefault();

                if (action === 'back') showDashboard();
                if (action === 'prev-month') {
                    const prevMonth = month === 0 ? 11 : month - 1;
                    const prevYear = month === 0 ? year - 1 : year;
                    const currentFilter = document.getElementById('habit-filter').value;
                    showCalendar(prevYear, prevMonth, currentFilter);
                }
                if (action === 'next-month') {
                    const nextMonth = month === 11 ? 0 : month + 1;
                    const nextYear = month === 11 ? year + 1 : year;
                    const currentFilter = document.getElementById('habit-filter').value;
                    showCalendar(nextYear, nextMonth, currentFilter);
                }

                // Filter change is handled by 'change' event, but if it bubbles up as click on option? No.
                // We need a separate change listener for the select.

                // main.removeEventListener('click', handler); // Don't remove immediately if we want multiple interactions?
                // Actually, for navigation (back), we want to remove. For calendar nav, we re-render, so listeners are lost anyway?
                // No, mountMain replaces innerHTML, so listeners on 'main' (the container) persist if not removed.
                // But we are re-attaching the listener every time showCalendar is called.
                // So we MUST remove the old listener or use a named function and remove it.
                // The pattern used in this file seems to be: attach, handle, remove.
                // But for calendar navigation (prev/next), we stay in the calendar view.
                // So we should probably NOT remove the listener unless we leave the view.
                // OR we re-render and re-attach.

                if (action === 'back') {
                    main.removeEventListener('click', handler);
                }
            });

            // Select change listener
            const filterSelect = document.getElementById('habit-filter');
            if (filterSelect) {
                filterSelect.addEventListener('change', (e) => {
                    const filterId = e.target.value;
                    showCalendar(year, month, filterId);
                });
            }
        }

        // Backend'den takvim verilerini yükleyen fonksiyon
        async function loadCalendarData(year, month, selectedHabitId = 'all') {
            const calendarRoot = document.getElementById('calendar-root');
            if (!calendarRoot) return;

            try {
                // Backend'den aylık istatistikleri çek
                const monthlyData = await api.getMonthlyStats(year, month);

                if (monthlyData.success && monthlyData.data) {
                    const { calendarData } = monthlyData.data;

                    // Takvim HTML'ini backend verileriyle birlikte oluştur
                    calendarRoot.innerHTML = generateCalendarHTML(year, month, selectedHabitId, calendarData);

                    // Calendar data'yı DOM'a kaydet
                    calendarRoot.setAttribute('data-calendar-data', JSON.stringify(calendarData));
                } else {
                    // Backend verisi yoksa fallback olarak local state kullan
                    calendarRoot.innerHTML = generateCalendarHTML(year, month, selectedHabitId, null);
                    console.warn('Takvim verisi backend\'den gelemedi, local data kullanılıyor');
                }
            } catch (error) {
                console.error('Takvim verisi yüklenirken hata:', error);
                // Error durumunda da local state ile çalış
                calendarRoot.innerHTML = generateCalendarHTML(year, month, selectedHabitId, null);
            }
        }






        // Günlük detayları render eden fonksiyon (geliştirilmiş)
        function renderDailyDetails(date, calendarData = null) {
            const detailsContainer = document.getElementById('daily-details');
            if (!detailsContainer) return;

            // Backend'den gelen veriyi kullan, yoksa local veriyi kullan
            let completedHabits = [];

            if (calendarData && calendarData[date]) {
                const dayData = calendarData[date];
                completedHabits = dayData.habits.map((habitName, index) => {
                    const category = dayData.categories[index] || 'diğer';
                    return {
                        name: habitName,
                        category: category,
                        completed_dates: [date] // Mark as completed for this date
                    };
                });
            } else {
                // Fallback to local data
                // Önce tamamlanan habitları bul
                const completedFromLocal = state.habits
                    .map(habit => ({
                        ...habit,
                        completed: (habit.completed_dates || []).includes(date)
                    }))
                    .filter(habit => habit.completed);

                // Eğer hiç tamamlanan habit yoksa, o gün oluşturulan habitları göster
                if (completedFromLocal.length === 0) {
                    const todayCreated = state.habits.filter(habit => {
                        if (!habit.created_at) return false;
                        const createdDate = parseDateString(habit.created_at);
                        return createdDate === date;
                    });

                    if (todayCreated.length > 0) {
                        completedHabits = todayCreated;
                    }
                } else {
                    completedHabits = completedFromLocal;
                }
            }

            if (completedHabits.length > 0) {
                // Kontrol et - bu habitlar tamamlanmış mı yoksa sadece oluşturulmuş mu?
                const hasCompletedHabits = completedHabits.some(habit => (habit.completed_dates || []).includes(date));
                const hasNewHabits = completedHabits.some(habit => {
                    if (!habit.created_at) return false;
                    const createdDate = parseDateString(habit.created_at);
                    return createdDate === date && !(habit.completed_dates || []).includes(date);
                });

                let title = '';
                if (hasCompletedHabits && hasNewHabits) {
                    title = `${formatDateTR(date)} - Tamamlananlar ve Yeni Eklenenler`;
                } else if (hasCompletedHabits) {
                    title = `${formatDateTR(date)} Tarihinde Tamamlananlar`;
                } else if (hasNewHabits) {
                    title = `${formatDateTR(date)} Tarihinde Eklenen Alışkanlıklar`;
                }

                detailsContainer.innerHTML = `
                    <h4>${title}</h4>
                    <div class="daily-habits-list">
                        ${completedHabits.map(habit => {
                    const isCompleted = (habit.completed_dates || []).includes(date);
                    const isNew = !isCompleted && habit.created_at && parseDateString(habit.created_at) === date;
                    const icon = isCompleted ? 'fas fa-check' : 'fas fa-plus';

                    return `
                                <div class="habit-item-mini">
                                    <div class="habit-icon-mini" style="background-color: ${getHabitColor(habit.name)};">
                                        <i class="${icon}"></i>
                                    </div>
                                    <div class="habit-info-mini">
                                        <div class="habit-name">${habit.name}</div>
                                        <span class="badge badge-secondary">${capitalize(habit.category)}</span>
                                        ${isNew ? '<span class="badge badge-primary">Yeni</span>' : ''}
                                    </div>
                                </div>
                            `;
                }).join('')}
                    </div>
                `;
            } else {
                detailsContainer.innerHTML = `
                    <h4>${formatDateTR(date)} - Alışkanlık Durumu</h4>
                    <p class="muted">Bu tarihte tamamlanan veya eklenen alışkanlık bulunmamaktadır.</p>
                `;
            }
        }


        // Takvim verilerini güncelleyen fonksiyon
        function updateCalendarWithData(year, month, calendarData) {
            const calendarDays = document.querySelectorAll('.calendar-day[data-date]');
            calendarDays.forEach(dayEl => {
                const date = dayEl.getAttribute('data-date');
                const data = calendarData[date];

                if (data && data.count > 0) {
                    dayEl.classList.add('completed');

                    // Add completion indicators
                    const indicators = dayEl.querySelector('.day-indicators');
                    if (indicators) {
                        indicators.innerHTML = '';
                        if (data.habits && data.habits.length > 0) {
                            data.habits.slice(0, 3).forEach((habitName, index) => {
                                const indicator = document.createElement('div');
                                indicator.className = 'indicator';
                                indicator.style.backgroundColor = getHabitColor(habitName);
                                indicator.title = habitName;
                                indicators.appendChild(indicator);
                            });

                            if (data.habits.length > 3) {
                                const moreIndicator = document.createElement('div');
                                moreIndicator.className = 'indicator more';
                                moreIndicator.textContent = `+${data.habits.length - 3}`;
                                moreIndicator.title = `${data.habits.length - 3} daha fazla`;
                                indicators.appendChild(moreIndicator);
                            }
                        }
                    }
                }
            });
        }

        // Takvim HTML'ini üreten, backend verileri ve filtreleme destekleyen gelişmiş fonksiyon
        function generateCalendarHTML(year, month, selectedHabitId = 'all', backendCalendarData = null) {
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate();
            const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Pazartesi 0 olsun diye

            let html = `
                <div class="calendar-nav">
                    <button class="btn btn-secondary btn-sm" data-action="prev-month"><i class="fas fa-chevron-left"></i></button>
                    <div class="calendar-title">${firstDay.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</div>
                    <button class="btn btn-secondary btn-sm" data-action="next-month"><i class="fas fa-chevron-right"></i></button>
                </div>
                <div class="calendar-grid-modern">
                    <div class="calendar-day-header">Pzt</div>
                    <div class="calendar-day-header">Sal</div>
                    <div class="calendar-day-header">Çar</div>
                    <div class="calendar-day-header">Per</div>
                    <div class="calendar-day-header">Cum</div>
                    <div class="calendar-day-header">Cmt</div>
                    <div class="calendar-day-header">Paz</div>
            `;

            // Boş günleri ekle
            for (let i = 0; i < startingDayOfWeek; i++) {
                html += '<div class="calendar-day empty"></div>';
            }

            // Günleri doldur
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const isToday = dateStr === getTodayDate();

                let isCompleted = false;
                let completedHabits = [];

                // Backend verisi varsa onu kullan
                if (backendCalendarData && backendCalendarData[dateStr]) {
                    const dayData = backendCalendarData[dateStr];
                    if (selectedHabitId === 'all') {
                        // Tüm alışkanlıklar gösterilecek
                        isCompleted = dayData.count > 0;
                        completedHabits = (dayData.habits || []).map((habitName, index) => ({
                            name: habitName,
                            category: dayData.categories[index] || 'diğer'
                        }));
                    } else {
                        // Seçilen alışkanlığa göre filtrele
                        const filteredHabits = (dayData.habits || []).map((habitName, index) => ({
                            name: habitName,
                            category: dayData.categories[index] || 'diğer'
                        })).filter(habit => {
                            // Backend verisinde habit ID yok, bu yüzden habit adına göre eşleştirme yapalım
                            const matchingHabit = state.habits.find(h => String(h.id) === selectedHabitId);
                            return matchingHabit && matchingHabit.name === habit.name;
                        });
                        completedHabits = filteredHabits;
                        isCompleted = filteredHabits.length > 0;
                    }
                } else {
                    // Backend verisi yoksa local state kullan
                    // Tüm habitları göster (tamamlanmış ve tamamlanmamış)
                    const dayHabits = state.habits
                        .filter(habit => selectedHabitId === 'all' || String(habit.id) === selectedHabitId);

                    const localCompleted = dayHabits
                        .filter(habit => (habit.completed_dates || []).includes(dateStr));

                    isCompleted = localCompleted.length > 0;
                    completedHabits = localCompleted;

                    // Eğer hiç tamamlanmış habit yoksa, o gün oluşturulan habitları göster
                    if (completedHabits.length === 0 && dayHabits.length > 0) {
                        // Bugün oluşturulan habitları göster (created_at kontrolü)
                        const todayCreated = dayHabits.filter(habit => {
                            if (!habit.created_at) return false;
                            const createdDate = parseDateString(habit.created_at);
                            return createdDate === dateStr;
                        });

                        if (todayCreated.length > 0) {
                            completedHabits = todayCreated;
                            isCompleted = true;
                        }
                    }
                }

                html += `<div class="calendar-day ${isCompleted ? 'completed' : ''} ${isToday ? 'today' : ''}" data-date="${dateStr}">
                            <div class="day-number">${d}</div>
                            <div class="day-indicators">
                                ${completedHabits.slice(0, 3).map(habit => `
                                    <div class="indicator" style="background-color: ${getHabitColor(habit.name)};" title="${habit.name}"></div>
                                `).join('')}
                                ${completedHabits.length > 3 ? `<div class="indicator more" title="+${completedHabits.length - 3} daha">+${completedHabits.length - 3}</div>` : ''}
                            </div>
                        </div>`;
            }

            html += '</div>';
            return html;
        }

        // 2) Habits normalizasyon fonksiyonu
        // Amaç: backend'den gelen her habit objesini tutarlı hale getirmek (id, name, category, frequency, completed_dates -> ['YYYY-MM-DD', ...])
        function normalizeHabits(rawHabits = []) {
            return (rawHabits || []).map(h => {
                // id normalization: backend farklı alan kullanmış olabilir
                const id = h.id ?? h._id ?? h.habit_id ?? null;

                // completed_dates normalization with timezone awareness:
                // - eğer array içindeki elemanlar datetime ise sadece date kısmını al
                // - eğer tek bir datetime string ise onu array yap
                // - eğer yoksa boş array
                let completed = [];
                if (Array.isArray(h.completed_dates)) {
                    completed = h.completed_dates.map(dt => {
                        // dt örn: '2025-11-29 16:16:53' veya '2025-11-29T16:16:53Z' veya '2025-11-29'
                        if (!dt) return null;
                        // Extract first 10 chars if looks like ISO/datetime, else try to parse Date
                        if (typeof dt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dt)) {
                            return dt.slice(0, 10);
                        }
                        // fallback: try Date -> yyyy-mm-dd (Turkey timezone)
                        try {
                            const D = new Date(dt);
                            if (isNaN(D)) return null;
                            // Use local date string to avoid timezone shifts
                            const year = D.getFullYear();
                            const month = String(D.getMonth() + 1).padStart(2, '0');
                            const day = String(D.getDate()).padStart(2, '0');
                            return `${year}-${month}-${day}`;
                        } catch (e) { return null; }
                    }).filter(Boolean);
                } else if (typeof h.completed_dates === 'string') {
                    const dt = h.completed_dates;
                    if (/^\d{4}-\d{2}-\d{2}/.test(dt)) completed = [dt.slice(0, 10)];
                    else {
                        try {
                            const D = new Date(dt);
                            if (!isNaN(D)) {
                                const year = D.getFullYear();
                                const month = String(D.getMonth() + 1).padStart(2, '0');
                                const day = String(D.getDate()).padStart(2, '0');
                                completed = [`${year}-${month}-${day}`];
                            }
                        } catch (e) { }
                    }
                } else if (Array.isArray(h.completions) && h.completions.length) {
                    // bazı API'lerde farklı alan adı olabilir ( örn: completions: [{date: '...'}, ...] )
                    completed = h.completions.map(c => {
                        if (c.date && typeof c.date === 'string') {
                            if (/^\d{4}-\d{2}-\d{2}/.test(c.date)) {
                                return c.date.slice(0, 10);
                            }
                            try {
                                const D = new Date(c.date);
                                if (!isNaN(D)) {
                                    const year = D.getFullYear();
                                    const month = String(D.getMonth() + 1).padStart(2, '0');
                                    const day = String(D.getDate()).padStart(2, '0');
                                    return `${year}-${month}-${day}`;
                                }
                            } catch (e) { }
                        }
                        if (c.created_at) {
                            try {
                                const D = new Date(c.created_at);
                                if (!isNaN(D)) {
                                    const year = D.getFullYear();
                                    const month = String(D.getMonth() + 1).padStart(2, '0');
                                    const day = String(D.getDate()).padStart(2, '0');
                                    return `${year}-${month}-${day}`;
                                }
                            } catch (e) { }
                        }
                        return null;
                    }).filter(Boolean);
                }

                return {
                    // preserve other fields too for display (name, category, frequency)
                    ...h,
                    id,
                    completed_dates: completed
                };
            });
        }

        // 3) loadUserData'ı güncelle — normalize et ve debug log ekle
        async function loadUserData() {
            try {
                const [profile, stats, habitsRes, badges] = await Promise.all([
                    api.getProfile().catch(e => ({ success: false, message: e.message })),
                    api.getStats().catch(e => ({ success: false, message: e.message })),
                    api.getHabits().catch(e => ({ success: false, message: e.message })),
                    api.getBadges().catch(e => ({ success: false, message: e.message }))
                ]);

                if (profile && profile.success) {
                    state.user = profile.data;
                } else {
                    console.warn('Profil yüklenemedi:', profile && profile.message);
                }

                if (stats && stats.success) {
                    state.stats = stats.data;
                } else {
                    console.warn('Stats yüklenemedi:', stats && stats.message);
                }

                if (habitsRes && habitsRes.success && Array.isArray(habitsRes.data)) {
                    // normalize habits so calendar logic works
                    state.habits = normalizeHabits(habitsRes.data);
                } else if (habitsRes && habitsRes.success && habitsRes.data && typeof habitsRes.data === 'object') {
                    // bazen API data bir obje içinde olabilir (ör: { habits: [...] })
                    const raw = habitsRes.data.habits ?? habitsRes.data.items ?? [];
                    state.habits = normalizeHabits(raw);
                } else {
                    console.warn('Habits yüklenemedi veya format beklenmiyor:', habitsRes && habitsRes.message);
                    state.habits = [];
                }

                if (badges && badges.success) {
                    state.badges = badges.data;
                } else {
                    console.warn('Badges yüklenemedi:', badges && badges.message);
                    state.badges = [];
                }

                // Debug: console print summary so frontend log'larına bakınca anlarsın
                console.info('User data loaded. user:', state.user?.username, 'habits:', state.habits.length, 'badges:', state.badges.length, 'points:', state.stats?.total_points);

                renderNavigation();
            } catch (err) {
                console.error('Error loading user data:', err);
                throw err;
            }
        }

        function logout() {
            Storage.setToken(null);
            state.token = null;
            state.user = null;
            state.habits = [];
            state.stats = null;
            state.badges = [];
            showAlert('Çıkış yapıldı', 'success');
            // Ana sayfaya yönlendir
            window.location.href = '/';
        }

        async function init() {
            // console.log('UserApp.init called'); // DEBUG
            try {
                attachNavHandlers();
                renderNavigation();
                // console.log('Nav rendered, token: ' + state.token); // DEBUG

                if (state.token) {
                    try {
                        // console.log('Loading user data...'); // DEBUG
                        await loadUserData();
                        // console.log('User data loaded'); // DEBUG
                        showDashboard();
                    } catch (err) {
                        // console.error('Error loading data: ' + err.message); // DEBUG
                        console.error('Session expired or invalid', err);
                        Storage.setToken(null);
                        state.token = null;
                        renderNavigation();
                        showLogin();
                    }
                } else {
                    // console.log('No token, showing login'); // DEBUG
                    showLogin();
                }
            } catch (e) {
                console.error('CRITICAL INIT ERROR: ', e);
            }
        }

        return { init, showDayDetails: renderDailyDetails }; // Export renderDailyDetails as showDayDetails for consistency if needed
    } catch (err) {
        console.error("IIFE CRASH: ", err);
        return { init: () => console.error("App crashed during load") };
    }
})();

if (typeof UserApp !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // console.log('DOMContentLoaded fired'); // DEBUG
        if (UserApp && UserApp.init) {
            UserApp.init();
        } else {
            console.error('FATAL: UserApp.init is missing!');
        }
    });
}
