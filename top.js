let currentUser = null;
let refreshInterval;

async function loadServerAvatar() {
    try {
        const response = await fetch('/api/guild-info');
        const data = await response.json();
        
        if (data.success) {
            const avatarImg = document.getElementById('serverAvatar');
            if (avatarImg) avatarImg.src = data.icon_url;
            
            const serverNameSpan = document.getElementById('serverName');
            if (serverNameSpan) serverNameSpan.textContent = data.name;
            
            const favicon = document.getElementById('serverFavicon');
            if (favicon) favicon.href = data.icon_url;
        }
    } catch (error) {
        console.error('Ошибка загрузки аватарки сервера:', error);
    }
}

async function loadTopMessages() {
    try {
        const response = await fetch('/api/top-messages?limit=10');
        const data = await response.json();
        
        const container = document.getElementById('messagesTop');
        
        if (!data.success || !data.top || data.top.length === 0) {
            container.innerHTML = '<div class="loading">📊 Пока нет данных. Отправляйте сообщения чтобы попасть в топ!</div>';
            return;
        }
        
        container.innerHTML = data.top.map((user, index) => `
            <div class="top-item">
                <div class="top-rank ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : ''}">
                    ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                </div>
                <img src="${user.avatar_url}" class="top-avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                <div class="top-info">
                    <div class="top-name">${escapeHtml(user.user_id)}</div>
                    <div class="top-id">ID: ${user.user_id}</div>
                </div>
                <div class="top-value">
                    ${user.count || 0} <span class="top-unit">сообщ.</span>
                </div>
            </div>
        `).join('');
        
        loadUsernames(data.top);
        
    } catch (error) {
        console.error('Ошибка загрузки топа сообщений:', error);
        document.getElementById('messagesTop').innerHTML = '<div class="loading">❌ Ошибка загрузки</div>';
    }
}

async function loadTopVoice() {
    try {
        const response = await fetch('/api/top-voice?limit=10');
        const data = await response.json();
        
        const container = document.getElementById('voiceTop');
        
        if (!data.success || !data.top || data.top.length === 0) {
            container.innerHTML = '<div class="loading">🎤 Пока нет данных. Заходите в голосовые каналы чтобы попасть в топ!</div>';
            return;
        }
        
        container.innerHTML = data.top.map((user, index) => `
            <div class="top-item">
                <div class="top-rank ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : ''}">
                    ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                </div>
                <img src="${user.avatar_url}" class="top-avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                <div class="top-info">
                    <div class="top-name">${escapeHtml(user.user_id)}</div>
                    <div class="top-id">ID: ${user.user_id}</div>
                </div>
                <div class="top-value">
                    ${user.hours} <span class="top-unit">ч</span> ${user.minutes} <span class="top-unit">мин</span>
                </div>
            </div>
        `).join('');
        
        loadUsernames(data.top);
        
    } catch (error) {
        console.error('Ошибка загрузки топа голосового времени:', error);
        document.getElementById('voiceTop').innerHTML = '<div class="loading">❌ Ошибка загрузки</div>';
    }
}

async function loadUsernames(users) {
    for (const user of users) {
        try {
            const response = await fetch('/api/can-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.user_id })
            });
            const data = await response.json();
            
            if (data.username) {
                const elements = document.querySelectorAll(`.top-id`);
                for (const el of elements) {
                    if (el.textContent.includes(user.user_id)) {
                        const parent = el.parentElement;
                        const nameDiv = parent.querySelector('.top-name');
                        if (nameDiv) {
                            nameDiv.textContent = escapeHtml(data.username);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки имени:', error);
        }
    }
}

window.refreshTops = async function() {
    await loadTopMessages();
    await loadTopVoice();
};

function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        loadTopMessages();
        loadTopVoice();
    }, 30000);
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

document.addEventListener('DOMContentLoaded', () => {
    loadServerAvatar();
    updateAuthButton();
    loadTopMessages();
    loadTopVoice();
    startAutoRefresh();
});
