const LEADER_USER_ID = '997073531470888980';
const DEPUTY_USER_ID = '539049296885186560';

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

async function getUserInfo(userId) {
    try {
        const response = await fetch('/api/can-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка API');
        }
        
        const data = await response.json();
        
        let avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
        if (data.avatar) {
            avatarUrl = `https://cdn.discordapp.com/avatars/${userId}/${data.avatar}.png?size=256`;
        } else {
            const defaultAvatarNum = parseInt(data.discriminator) % 5 || 0;
            avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNum}.png`;
        }
        
        return {
            username: data.username || 'Unknown',
            avatar_url: avatarUrl,
            user_id: userId
        };
    } catch (error) {
        console.error('Ошибка получения информации о пользователе:', error);
        return {
            username: userId === LEADER_USER_ID ? 'Глава' : 'Зам. Главы',
            avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
            user_id: userId
        };
    }
}

async function loadHonorMembers() {
    const leaderData = await getUserInfo(LEADER_USER_ID);
    const leaderContainer = document.getElementById('leaderContent');
    
    leaderContainer.innerHTML = `
        <div class="honor-avatar-wrapper">
            <img src="${leaderData.avatar_url}" class="honor-avatar" alt="avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
        </div>
        <div class="honor-info">
            <div class="honor-title">👑 ${escapeHtml(leaderData.username)}</div>
            <div class="honor-subtitle">Верховный правитель сервера</div>
            <div class="honor-id">ID: ${LEADER_USER_ID}</div>
            <div class="honor-stats">
                <div class="honor-stat">
                    <div class="honor-stat-value">🏆</div>
                    <div class="honor-stat-label">Основатель</div>
                </div>
                <div class="honor-stat">
                    <div class="honor-stat-value">⭐</div>
                    <div class="honor-stat-label">Легенда</div>
                </div>
                <div class="honor-stat">
                    <div class="honor-stat-value">👑</div>
                    <div class="honor-stat-label">Лидер</div>
                </div>
            </div>
            <span class="honor-role role-leader">Глава</span>
        </div>
    `;
    
    const deputyData = await getUserInfo(DEPUTY_USER_ID);
    const deputyContainer = document.getElementById('deputyContent');
    
    deputyContainer.innerHTML = `
        <div class="honor-avatar-wrapper">
            <img src="${deputyData.avatar_url}" class="honor-avatar" alt="avatar" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
        </div>
        <div class="honor-info">
            <div class="honor-title">⚜️ ${escapeHtml(deputyData.username)}</div>
            <div class="honor-subtitle">Правая рука правителя</div>
            <div class="honor-id">ID: ${DEPUTY_USER_ID}</div>
            <div class="honor-stats">
                <div class="honor-stat">
                    <div class="honor-stat-value">🤝</div>
                    <div class="honor-stat-label">Помощник</div>
                </div>
                <div class="honor-stat">
                    <div class="honor-stat-value">⚜️</div>
                    <div class="honor-stat-label">Доверие</div>
                </div>
                <div class="honor-stat">
                    <div class="honor-stat-value">⭐</div>
                    <div class="honor-stat-label">Уважение</div>
                </div>
            </div>
            <span class="honor-role role-deputy">Зам. Главы</span>
        </div>
    `;
}

async function updateAuthButton() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            const user = await response.json();
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
    loadHonorMembers();
});
