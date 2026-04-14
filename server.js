const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const PYTHON_BOT_API = 'https://legion-of-mist-bot.onrender.com';

// ID пользователей с правами администратора (Глава и Зам. Главы)
const ADMIN_USER_IDS = ['997073531470888980', '539049296885186560'];

function isAdmin(userId) {
    return ADMIN_USER_IDS.includes(userId);
}

// Создаем папку для загрузок
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
        cb(null, allowedTypes.includes(file.mimetype));
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadDir));
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

// ============== БАЗА ДАННЫХ ==============
const dbPath = path.join(__dirname, 'discord_site.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supporter_id INTEGER NOT NULL,
        supporter_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        player_name TEXT NOT NULL,
        reason TEXT NOT NULL,
        video_path TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        resolved_by TEXT
    )`);
    
    console.log('✅ База данных подключена');
});

// ============== ФУНКЦИИ ==============
async function getServerStats() {
    try {
        const response = await axios.get(`${PYTHON_BOT_API}/stats`);
        return response.data.server;
    } catch (error) {
        return { total_members: 0, online_members: 0, voice_members: 0 };
    }
}

async function getSupportersFromBot() {
    try {
        const response = await axios.get(`${PYTHON_BOT_API}/supporters`);
        return response.data.supporters || [];
    } catch (error) {
        console.error('Ошибка загрузки саппортов:', error.message);
        return [];
    }
}

async function checkUserRoles(userId) {
    try {
        const response = await axios.post(`${PYTHON_BOT_API}/check-role`, { user_id: userId });
        return response.data;
    } catch (error) {
        console.error('Ошибка проверки роли:', error.message);
        return { can_review: false, is_moderator: false };
    }
}

// Отправка уведомления о новом отзыве
async function sendReviewNotification(reviewData) {
    try {
        console.log('📤 Отправка уведомления об отзыве в бот:', reviewData);
        const response = await axios.post(`${PYTHON_BOT_API}/notify-review`, reviewData);
        console.log('✅ Уведомление об отзыве отправлено');
        return response.data;
    } catch (error) {
        console.error('❌ Ошибка отправки уведомления об отзыве:', error.message);
        return null;
    }
}

// Отправка уведомления о новой жалобе
async function sendComplaintNotification(complaintData) {
    try {
        console.log('📤 Отправка уведомления о жалобе в бот:', complaintData);
        const response = await axios.post(`${PYTHON_BOT_API}/notify-complaint`, complaintData);
        console.log('✅ Уведомление о жалобе отправлено');
        return response.data;
    } catch (error) {
        console.error('❌ Ошибка отправки уведомления о жалобе:', error.message);
        return null;
    }
}

// ============== API ==============

app.get('/api/server-stats', async (req, res) => {
    res.json(await getServerStats());
});

app.get('/api/server-info', async (req, res) => {
    const stats = await getServerStats();
    res.json({
        name: 'Legion of Mist',
        memberCount: stats.total_members,
        onlineCount: stats.online_members,
        voiceCount: stats.voice_members,
        channels: 15,
        boostLevel: 2,
        features: ['Активное сообщество', 'Регулярные ивенты', 'Дружелюбная атмосфера', 'Опытные модераторы']
    });
});

app.get('/api/supporters', async (req, res) => {
    const supporters = await getSupportersFromBot();
    
    db.all('SELECT supporter_id, AVG(rating) as avg_rating, COUNT(*) as count FROM reviews GROUP BY supporter_id', (err, ratings) => {
        const ratingMap = {};
        if (ratings) {
            ratings.forEach(r => {
                ratingMap[r.supporter_id] = {
                    rating: parseFloat(r.avg_rating).toFixed(1),
                    count: r.count
                };
            });
        }
        
        const supportersWithRating = supporters.map(s => ({
            ...s,
            rating: ratingMap[s.id]?.rating || 0,
            reviewsCount: ratingMap[s.id]?.count || 0
        }));
        
        supportersWithRating.sort((a, b) => b.rating - a.rating);
        res.json(supportersWithRating);
    });
});

app.get('/api/guild-info', async (req, res) => {
    try {
        const response = await axios.get(`${PYTHON_BOT_API}/guild-info`);
        res.json(response.data);
    } catch (error) {
        console.error('Ошибка получения информации о сервере:', error.message);
        res.json({
            success: false,
            name: 'Legion of Mist',
            icon_url: 'https://cdn.discordapp.com/embed/avatars/0.png'
        });
    }
});

app.get('/api/user', async (req, res) => {
    if (req.session.user) {
        const roleCheck = await checkUserRoles(req.session.user.id);
        req.session.user.can_review = roleCheck.can_review || false;
        req.session.user.is_moderator = roleCheck.is_moderator || false;
        req.session.user.is_admin = isAdmin(req.session.user.id);
        console.log(`👤 ${req.session.user.username} (${req.session.user.id}): is_admin=${req.session.user.is_admin}, can_review=${req.session.user.can_review}`);
        res.json(req.session.user);
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

app.post('/api/can-review', async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) return res.json({ can_review: false });
    
    const roleCheck = await checkUserRoles(user_id);
    res.json({
        can_review: roleCheck.can_review || false,
        is_moderator: roleCheck.is_moderator || false,
        is_admin: isAdmin(user_id),
        reviewer_roles: roleCheck.reviewer_roles || [],
        moderator_roles: roleCheck.moderator_roles || [],
        username: roleCheck.username
    });
});

// Отзывы
app.get('/api/reviews', (req, res) => {
    db.all('SELECT * FROM reviews ORDER BY created_at DESC', (err, rows) => {
        res.json(err ? [] : rows);
    });
});

app.post('/api/reviews', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Не авторизован' });
    
    const roleCheck = await checkUserRoles(req.session.user.id);
    if (!roleCheck.can_review) return res.status(403).json({ error: 'Нет прав' });
    
    const { supporterId, supporterName, rating, comment } = req.body;
    
    db.get('SELECT * FROM reviews WHERE user_id = ? AND supporter_id = ?', 
        [req.session.user.id, supporterId], async (err, existing) => {
        if (existing) return res.status(400).json({ error: 'Вы уже оставляли отзыв' });
        
        db.run(`INSERT INTO reviews (supporter_id, supporter_name, user_id, username, rating, comment) 
                VALUES (?, ?, ?, ?, ?, ?)`,
            [supporterId, supporterName, req.session.user.id, req.session.user.username, rating, comment || ''],
            async function(err) {
                if (err) {
                    console.error('Ошибка:', err);
                    return res.status(500).json({ error: 'Ошибка' });
                }
                
                const newReview = {
                    reviewId: this.lastID,
                    supporterId: supporterId,
                    userId: req.session.user.id,
                    username: req.session.user.username,
                    rating: rating,
                    comment: comment || ''
                };
                
                await sendReviewNotification(newReview);
                res.json({ success: true });
            });
    });
});

// Удаление отзыва
app.delete('/api/reviews/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Не авторизован' });
    if (!isAdmin(req.session.user.id)) return res.status(403).json({ error: 'Нет прав' });
    
    const reviewId = req.params.id;
    db.run('DELETE FROM reviews WHERE id = ?', [reviewId], (err) => {
        if (err) return res.status(500).json({ error: 'Ошибка удаления' });
        res.json({ success: true });
    });
});

// Жалобы
app.get('/api/complaints', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Не авторизован' });
    
    const roleCheck = await checkUserRoles(req.session.user.id);
    if (!roleCheck.is_moderator && !isAdmin(req.session.user.id)) {
        return res.status(403).json({ error: 'Нет прав' });
    }
    
    db.all('SELECT * FROM complaints ORDER BY created_at DESC', (err, rows) => {
        res.json(err ? [] : rows);
    });
});

app.post('/api/complaints', upload.single('video'), async (req, res) => {
    try {
        if (!req.session.user) return res.status(401).json({ error: 'Не авторизован' });
        
        const { playerName, reason } = req.body;
        const videoFile = req.file;
        
        if (!playerName || !reason) return res.status(400).json({ error: 'Заполните все поля' });
        if (!videoFile) return res.status(400).json({ error: 'Видео обязательно' });
        
        const fullUrl = `${req.protocol}://${req.get('host')}${videoPath}`;
        
        db.run(`INSERT INTO complaints (user_id, username, player_name, reason, video_path) 
                VALUES (?, ?, ?, ?, ?)`,
            [req.session.user.id, req.session.user.username, playerName, reason, videoPath],
            async function(err) {
                if (err) {
                    console.error('Ошибка сохранения жалобы:', err);
                    res.status(500).json({ error: 'Ошибка сохранения' });
                } else {
                    const newComplaint = {
                        complaintId: this.lastID,
                        userId: req.session.user.id,
                        username: req.session.user.username,
                        playerName: playerName,
                        reason: reason,
                        videoPath: fullUrl
                    };
                    
                    await sendComplaintNotification(newComplaint);
                    res.json({ success: true, complaintId: this.lastID });
                }
            });
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).json({ error: 'Ошибка' });
    }
});

// Удаление жалобы
app.delete('/api/complaints/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Не авторизован' });
    if (!isAdmin(req.session.user.id)) return res.status(403).json({ error: 'Нет прав' });
    
    const complaintId = req.params.id;
    
    db.get('SELECT video_path FROM complaints WHERE id = ?', [complaintId], (err, row) => {
        if (row && row.video_path) {
            const videoPath = path.join(__dirname, row.video_path);
            if (fs.existsSync(videoPath)) {
                fs.unlinkSync(videoPath);
            }
        }
        
        db.run('DELETE FROM complaints WHERE id = ?', [complaintId], (err) => {
            if (err) return res.status(500).json({ error: 'Ошибка удаления' });
            res.json({ success: true });
        });
    });
});

app.put('/api/complaints/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Не авторизован' });
    
    const roleCheck = await checkUserRoles(req.session.user.id);
    if (!roleCheck.is_moderator && !isAdmin(req.session.user.id)) {
        return res.status(403).json({ error: 'Нет прав' });
    }
    
    const { status } = req.body;
    db.run(`UPDATE complaints SET status = ?, resolved_at = CURRENT_TIMESTAMP, resolved_by = ? WHERE id = ?`,
        [status, req.session.user.username, req.params.id],
        (err) => res.json({ success: !err }));
});

app.get('/api/bot-status', async (req, res) => {
    try {
        const response = await axios.get(`${PYTHON_BOT_API}/health`);
        res.json(response.data);
    } catch (error) {
        res.json({ status: 'error', bot_ready: false });
    }
});

// Auth
app.get('/auth/discord', (req, res) => {
    const redirectUri = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify`;
    res.redirect(redirectUri);
});

app.get('/auth/discord/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
            new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: process.env.DISCORD_REDIRECT_URI,
            }));
        
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
        });
        
        req.session.user = {
            id: userResponse.data.id,
            username: userResponse.data.username,
            avatar: userResponse.data.avatar
        };
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.redirect('/');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`✅ Сайт: http://localhost:${PORT}`);
    console.log(`🤖 Бот API: ${PYTHON_BOT_API}`);
    console.log(`💾 БД: ${dbPath}`);
    console.log(`👑 Админы: ${ADMIN_USER_IDS.join(', ')}`);
    console.log(`${'='.repeat(50)}\n`);
});
