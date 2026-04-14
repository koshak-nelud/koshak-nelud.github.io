let currentUser = null;
let isModerator = false;

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
            
            const statusDiv = document.getElementById('userStatus');
            statusDiv.innerHTML = `✅ Вы вошли как ${currentUser.username}`;
            statusDiv.style.display = 'block';
            statusDiv.classList.add('alert-success');
            
            checkModeratorStatus();
        } else {
            const statusDiv = document.getElementById('userStatus');
            statusDiv.innerHTML = '⚠️ Для подачи жалобы необходимо <a href="/auth/discord" style="color: var(--discord-blurple);">войти через Discord</a>';
            statusDiv.style.display = 'block';
            statusDiv.classList.add('alert-info');
            document.getElementById('complaintForm').style.display = 'none';
        }
    } catch (error) {
        console.error('Ошибка загрузки пользователя:', error);
    }
}

async function checkModeratorStatus() {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/can-review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.id })
        });
        
        const data = await response.json();
        console.log('Проверка прав модератора:', data);
        
        if (data.moderator_roles && data.moderator_roles.length > 0) {
            isModerator = true;
            document.getElementById('moderatorPanel').style.display = 'block';
            loadComplaints();
        } else if (data.is_moderator) {
            isModerator = true;
            document.getElementById('moderatorPanel').style.display = 'block';
            loadComplaints();
        } else if (currentUser.is_admin) {
            isModerator = true;
            document.getElementById('moderatorPanel').style.display = 'block';
            loadComplaints();
        }
    } catch (error) {
        console.error('Ошибка проверки статуса модератора:', error);
    }
}

async function loadComplaints() {
    if (!isModerator) return;
    
    try {
        const response = await fetch('/api/complaints');
        const complaints = await response.json();
        console.log('Жалобы загружены:', complaints);
        
        const container = document.getElementById('complaintsList');
        
        if (!complaints || complaints.length === 0) {
            container.innerHTML = '<p style="color: var(--discord-gray); text-align: center;">📭 Нет активных жалоб</p>';
            return;
        }
        
        container.innerHTML = complaints.map(complaint => `
            <div class="complaint-item">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                    <span class="complaint-status status-${complaint.status}">${getStatusText(complaint.status)}</span>
                    ${currentUser?.is_admin ? `<button onclick="deleteComplaint(${complaint.id})" class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">🗑️ Удалить</button>` : ''}
                </div>
                <div><strong>👤 От:</strong> ${escapeHtml(complaint.username)}</div>
                <div><strong>🎮 На игрока:</strong> ${escapeHtml(complaint.player_name)}</div>
                <div><strong>📝 Причина:</strong> ${escapeHtml(complaint.reason)}</div>
                <div><strong>🎬 Видеодоказательство:</strong></div>
                <video controls style="max-width: 100%; max-height: 300px; margin-top: 0.5rem; border-radius: 8px;">
                    <source src="${complaint.video_path}" type="video/mp4">
                    Ваш браузер не поддерживает видео
                </video>
                <div><strong>📅 Дата:</strong> ${new Date(complaint.created_at).toLocaleString('ru-RU')}</div>
                ${complaint.status === 'pending' ? `
                    <div style="margin-top: 1rem;">
                        <button onclick="updateComplaintStatus(${complaint.id}, 'resolved')" class="btn btn-success">✅ Принять</button>
                        <button onclick="updateComplaintStatus(${complaint.id}, 'rejected')" class="btn btn-danger">❌ Отклонить</button>
                    </div>
                ` : ''}
                ${complaint.resolved_at ? `<div style="color: var(--discord-gray); font-size: 0.75rem; margin-top: 0.5rem;">Рассмотрено: ${new Date(complaint.resolved_at).toLocaleString('ru-RU')} ${complaint.resolved_by ? 'модератором ' + escapeHtml(complaint.resolved_by) : ''}</div>` : ''}
            </div>
        `).join('');
    } catch (error) {
        console.error('Ошибка загрузки жалоб:', error);
        document.getElementById('complaintsList').innerHTML = 
            '<p style="color: var(--discord-red); text-align: center;">❌ Не удалось загрузить жалобы</p>';
    }
}

function getStatusText(status) {
    const statusMap = {
        'pending': '⏳ На рассмотрении',
        'resolved': '✅ Принято',
        'rejected': '❌ Отклонено'
    };
    return statusMap[status] || status;
}

window.updateComplaintStatus = async (complaintId, status) => {
    try {
        const response = await fetch(`/api/complaints/${complaintId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            alert(`✅ Жалоба ${status === 'resolved' ? 'принята' : 'отклонена'}`);
            loadComplaints();
        } else {
            const error = await response.json();
            alert(error.error || '❌ Ошибка при обновлении статуса');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Произошла ошибка');
    }
};

window.deleteComplaint = async function(complaintId) {
    if (!currentUser?.is_admin) {
        alert('❌ У вас нет прав на удаление жалоб');
        return;
    }
    
    if (!confirm('Удалить эту жалобу? Видео файл также будет удален.')) return;
    
    try {
        const response = await fetch(`/api/complaints/${complaintId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('✅ Жалоба удалена');
            loadComplaints();
        } else {
            const error = await response.json();
            alert(error.error || '❌ Ошибка удаления');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Ошибка при удалении');
    }
};

document.getElementById('video').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('videoPreview');
    
    if (file && file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onload = function(event) {
            preview.innerHTML = `
                <video controls style="max-width: 100%; max-height: 200px; border-radius: 8px;">
                    <source src="${event.target.result}" type="${file.type}">
                </video>
                <div style="color: var(--discord-gray); font-size: 0.75rem; margin-top: 0.5rem;">
                    📁 Файл: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)
                </div>
            `;
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '<div style="color: var(--discord-red);">❌ Пожалуйста, выберите видео файл</div>';
    }
});

document.getElementById('complaintForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
        alert('❌ Необходимо авторизоваться через Discord');
        return;
    }
    
    const formData = new FormData();
    const playerName = document.getElementById('playerName').value;
    const reason = document.getElementById('reason').value;
    const videoFile = document.getElementById('video').files[0];
    
    if (!playerName) {
        alert('❌ Введите никнейм игрока');
        return;
    }
    
    if (!reason) {
        alert('❌ Введите причину жалобы');
        return;
    }
    
    if (!videoFile) {
        alert('❌ Пожалуйста, выберите видеофайл');
        return;
    }
    
    if (videoFile.size > 100 * 1024 * 1024) {
        alert('❌ Размер видео не должен превышать 100MB');
        return;
    }
    
    const fileInput = document.getElementById('video');
    
    formData.append('playerName', playerName);
    formData.append('reason', reason);
    formData.append('video', fileInput.files[0]);
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Отправка...';
    
    try {
        const response = await fetch('/api/complaints', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('✅ Жалоба успешно отправлена! Модераторы рассмотрят её в ближайшее время.');
            document.getElementById('complaintForm').reset();
            document.getElementById('videoPreview').innerHTML = '';
            if (isModerator) {
                loadComplaints();
            }
        } else {
            alert(result.error || '❌ Ошибка при отправке жалобы');
        }
    } catch (error) {
        console.error('Ошибка отправки:', error);
        alert('❌ Произошла ошибка при отправке жалобы');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '📤 Отправить жалобу';
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
