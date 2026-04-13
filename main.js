let currentUser = null;
let updateInterval = null;

// Загрузка аватарки и названия сервера из Discord
async function loadServerInfo() {
    try {
        const response = await fetch('/api/guild-info');
        const data = await response.json();
        
        if (data.success) {
            // Обновляем аватарку сервера везде
            const serverAvatars = document.querySelectorAll('#serverAvatar, .nav-logo img');
            serverAvatars.forEach(img => {
                if (img) img.src = data.icon_url;
            });
            
            // Обновляем название сервера
            const serverNames = document.querySelectorAll('#serverName, .nav-logo span');
            serverNames.forEach(el => {
                if (el && el.tagName === 'SPAN') el.textContent = data.name;
            });
            
            // Обновляем приветствие
            const welcomeSpan = document.getElementById('welcomeServerName');
            if (welcomeSpan) welcomeSpan.textContent = data.name;
            
            // Обновляем фавикон
            const favicon = document.getElementById('serverFavicon');
            if (favicon) favicon.href = data.icon_url;
        }
    } catch (error) {
        console.error('Ошибка загрузки информации о сервере:', error);
    }
}

async function loadServerStats() {
    try {
        const response = await fetch('/api/server-stats');
        const data = await response.json();
        
        document.getElementById('totalMembers').textContent = data.total_members || '0';
        document.getElementById('onlineMembers').textContent = data.online_members || '0';
        document.getElementById('voiceMembers').textContent = data.voice_members || '0';
        
        const stats = document.querySelectorAll('.stat-value');
        stats.forEach(stat => {
            stat.style.transform = 'scale(1.05)';
            setTimeout(() => stat.style.transform = 'scale(1)', 200);
        });
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        document.getElementById('totalMembers').textContent = '❌';
        document.getElementById('onlineMembers').textContent = '❌';
        document.getElementById('voiceMembers').textContent = '❌';
    }
}

async function loadTopSupporters() {
    try {
        const response = await fetch('/api/supporters');
        const supporters = await response.json();
        
        const container = document.getElementById('topSupporters');
        
        if (!supporters || supporters.length === 0) {
            container.innerHTML = '<p style="color: var(--discord-gray); text-align: center;">Нет данных о саппортах</p>';
            return;
        }
        
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                ${supporters.slice(0, 10).map((supporter, index) => `
                    <div style="display: flex; align-items: center; gap: 1rem; background: var(--discord-lighter); padding: 1rem; border-radius: 12px; transition: transform 0.2s;">
                        <img src="${supporter.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
                             style="width: 56px; height: 56px; border-radius: 50%; border: 2px solid ${index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : 'var(--discord-gray)'}">
                        <div style="flex: 1;">
                            <div style="font-weight: bold; font-size: 1.1rem;">${escapeHtml(supporter.display_name || supporter.username)}</div>
                            <div style="color: var(--discord-gray); font-size: 0.875rem;">${supporter.role}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 1.75rem; font-weight: bold; color: var(--discord-yellow);">⭐ ${supporter.rating}</div>
                            <div style="color: var(--discord-gray); font-size: 0.75rem;">${supporter.reviewsCount} отзывов</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Ошибка загрузки саппортов:', error);
        document.getElementById('topSupporters').innerHTML = '<p style="color: var(--discord-red); text-align: center;">❌ Не удалось загрузить</p>';
    }
}

async function loadRecentReviews() {
    try {
        const response = await fetch('/api/reviews');
        const reviews = await response.json();
        
        const container = document.getElementById('recentReviews');
        
        if (!reviews || reviews.length === 0) {
            container.innerHTML = '<p style="color: var(--discord-gray); text-align: center;">📝 Пока нет отзывов</p>';
            return;
        }
        
        container.innerHTML = reviews.slice(0, 5).map(review => `
            <div class="review-item">
                <div class="review-header">
                    <span><strong>${escapeHtml(review.username)}</strong> <span style="color: var(--discord-gray);">о ${escapeHtml(review.supporter_name)}</span></span>
                    <span class="review-rating">⭐ ${review.rating}/5</span>
                </div>
                <div class="review-comment">💬 ${escapeHtml(review.comment || 'Без комментария')}</div>
                <div style="color: var(--discord-gray); font-size: 0.75rem; margin-top: 0.5rem;">
                    📅 ${new Date(review.created_at).toLocaleString('ru-RU')}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Ошибка загрузки отзывов:', error);
        document.getElementById('recentReviews').innerHTML = '<p style="color: var(--discord-red); text-align: center;">❌ Не удалось загрузить отзывы</p>';
    }
}

async function checkBotStatus() {
    try {
        const response = await fetch('/api/bot-status');
        const data = await response.json();
        
        const statusDiv = document.getElementById('botStatus');
        
        if (data.bot_ready && data.status === 'ok') {
            statusDiv.innerHTML = `✅ Бот активен | Статистика обновляется в реальном времени`;
            statusDiv.classList.add('alert-success');
            statusDiv.style.display = 'block';
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
        } else if (!data.bot_ready) {
            statusDiv.innerHTML = `⚠️ Бот не подключен к Discord. Статистика может быть неактуальна.`;
            statusDiv.classList.add('alert-warning');
            statusDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Бот не отвечает:', error);
        const statusDiv = document.getElementById('botStatus');
        statusDiv.innerHTML = `⚠️ Не удалось подключиться к боту.`;
        statusDiv.classList.add('alert-warning');
        statusDiv.style.display = 'block';
    }
}

async function updateAuthButton() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            const user = await response.json();
            currentUser = user;
            const authContainer = document.getElementById('authButton');
            authContainer.innerHTML = `
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span style="color: var(--discord-white);">👤 ${escapeHtml(user.username)}</span>
                    ${user.is_admin ? '<span style="background: linear-gradient(135deg, #FFD700, #FFA500); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; color: #1e1f22;">👑 Админ</span>' : ''}
                    ${user.can_review ? '<span style="background: var(--discord-blurple); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">Reviewer</span>' : ''}
                    <a href="/logout" class="discord-btn" style="background-color: var(--discord-red); padding: 0.25rem 0.75rem;">🚪 Выйти</a>
                </div>
            `;
        } else {
            document.getElementById('authButton').innerHTML = `<a href="/auth/discord" class="discord-btn">🎮 Войти через Discord</a>`;
        }
    } catch (error) {
        document.getElementById('authButton').innerHTML = `<a href="/auth/discord" class="discord-btn">🎮 Войти через Discord</a>`;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function startAutoUpdate() {
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(() => {
        loadServerStats();
        loadTopSupporters();
        loadRecentReviews();
    }, 30000);
}

document.addEventListener('DOMContentLoaded', () => {
    loadServerInfo();  // Загружаем аватарку и название сервера
    updateAuthButton();
    loadServerStats();
    loadTopSupporters();
    loadRecentReviews();
    checkBotStatus();
    startAutoUpdate();
    setInterval(checkBotStatus, 60000);
});