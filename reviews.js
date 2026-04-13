let currentUser = null;

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

async function loadUser() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            currentUser = await response.json();
            console.log('Пользователь загружен:', currentUser);
            await checkUserPermissions();
            await loadReviews();
        } else {
            const statusDiv = document.getElementById('userStatus');
            statusDiv.innerHTML = '⚠️ Для оставления отзыва необходимо <a href="/auth/discord" style="color: var(--discord-blurple);">войти через Discord</a>';
            statusDiv.style.display = 'block';
            statusDiv.className = 'alert alert-info';
            document.getElementById('reviewFormCard').style.display = 'none';
        }
    } catch (error) {
        console.error('Ошибка загрузки пользователя:', error);
    }
}

async function checkUserPermissions() {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/can-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.id })
        });
        
        const data = await response.json();
        console.log('Проверка прав:', data);
        
        const statusDiv = document.getElementById('userStatus');
        
        if (data.can_review === true || currentUser.can_review === true) {
            document.getElementById('reviewFormCard').style.display = 'block';
            statusDiv.innerHTML = `✅ Вы вошли как ${currentUser.username}. Вы можете оставлять отзывы!`;
            statusDiv.className = 'alert alert-success';
            await loadSupporters();
        } else {
            statusDiv.innerHTML = `❌ Вы не можете оставлять отзывы. У вас нет специальной роли на сервере.`;
            statusDiv.className = 'alert alert-error';
            document.getElementById('reviewFormCard').style.display = 'none';
        }
        statusDiv.style.display = 'block';
    } catch (error) {
        console.error('Ошибка проверки прав:', error);
        const statusDiv = document.getElementById('userStatus');
        statusDiv.innerHTML = '❌ Ошибка при проверке прав. Убедитесь, что бот запущен.';
        statusDiv.className = 'alert alert-error';
        statusDiv.style.display = 'block';
    }
}

async function loadSupporters() {
    try {
        const response = await fetch('/api/supporters');
        const supporters = await response.json();
        console.log('Саппорты из Discord:', supporters);
        
        const select = document.getElementById('supporter');
        if (supporters && supporters.length > 0) {
            select.innerHTML = '<option value="">Выберите саппорта...</option>' +
                supporters.map(s => `<option value="${s.id}" data-name="${escapeHtml(s.username)}">${escapeHtml(s.display_name || s.username)} (${s.role})</option>`).join('');
        } else {
            select.innerHTML = '<option value="">Нет доступных саппортов</option>';
        }
    } catch (error) {
        console.error('Ошибка загрузки саппортов:', error);
        document.getElementById('supporter').innerHTML = '<option value="">Ошибка загрузки саппортов</option>';
    }
}

async function loadReviews() {
    try {
        const response = await fetch('/api/reviews');
        const reviews = await response.json();
        
        const container = document.getElementById('reviewsList');
        
        if (!reviews || reviews.length === 0) {
            container.innerHTML = '<p style="color: var(--discord-gray); text-align: center;">📝 Пока нет отзывов. Будьте первым!</p>';
            return;
        }
        
        const userResponse = await fetch('/api/user');
        if (userResponse.ok) {
            currentUser = await userResponse.json();
        }
        
        container.innerHTML = reviews.map(review => `
            <div class="review-item">
                <div class="review-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                    <div>
                        <span>👤 ${escapeHtml(review.username)}</span>
                        <span style="margin-left: 1rem;">🎮 Саппорт: ${escapeHtml(review.supporter_name)}</span>
                        <span style="margin-left: 1rem;" class="review-rating">⭐ ${review.rating}/5</span>
                    </div>
                    ${currentUser?.is_admin === true ? `<button onclick="deleteReview(${review.id})" class="btn btn-danger" style="padding: 0.25rem 0.75rem; font-size: 0.75rem;">🗑️ Удалить</button>` : ''}
                </div>
                <div class="review-comment">💬 ${escapeHtml(review.comment || 'Без комментария')}</div>
                <div style="color: var(--discord-gray); font-size: 0.75rem; margin-top: 0.5rem;">
                    📅 ${new Date(review.created_at).toLocaleString('ru-RU')}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Ошибка загрузки отзывов:', error);
        document.getElementById('reviewsList').innerHTML = '<p style="color: var(--discord-red); text-align: center;">❌ Не удалось загрузить отзывы</p>';
    }
}

window.deleteReview = async function(reviewId) {
    const userResponse = await fetch('/api/user');
    if (userResponse.ok) {
        currentUser = await userResponse.json();
    }
    
    if (!currentUser?.is_admin) {
        alert('❌ У вас нет прав на удаление отзывов');
        return;
    }
    
    if (!confirm('Удалить этот отзыв?')) return;
    
    try {
        const response = await fetch(`/api/reviews/${reviewId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('✅ Отзыв удален');
            loadReviews();
        } else {
            const error = await response.json();
            alert(error.error || '❌ Ошибка удаления');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Ошибка при удалении');
    }
};

document.getElementById('reviewForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
        alert('Пожалуйста, войдите через Discord');
        return;
    }
    
    const select = document.getElementById('supporter');
    const supporterId = select.value;
    const supporterName = select.options[select.selectedIndex]?.getAttribute('data-name');
    
    if (!supporterId) {
        alert('Пожалуйста, выберите саппорта');
        return;
    }
    
    const formData = {
        supporterId: parseInt(supporterId),
        supporterName: supporterName,
        rating: parseInt(document.getElementById('rating').value),
        comment: document.getElementById('comment').value
    };
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Отправка...';
    
    try {
        const response = await fetch('/api/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('✅ Отзыв успешно отправлен!');
            document.getElementById('reviewForm').reset();
            loadReviews();
        } else {
            alert(result.error || '❌ Ошибка при отправке');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Произошла ошибка');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '📤 Отправить отзыв';
    }
});

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

document.addEventListener('DOMContentLoaded', () => {
    loadServerAvatar();
    updateAuthButton();
    loadUser();
});