const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'discord_site.db'));

// Создание таблиц
db.serialize(() => {
    // Таблица отзывов
    db.run(`
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supporter_id INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
            comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, supporter_id)
        )
    `);
    
    // Таблица жалоб
    db.run(`
        CREATE TABLE IF NOT EXISTS complaints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            username TEXT NOT NULL,
            player_name TEXT NOT NULL,
            reason TEXT NOT NULL,
            video_url TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolved_at DATETIME,
            resolved_by TEXT
        )
    `);
    
    // Таблица для хранения информации о саппортах
    db.run(`
        CREATE TABLE IF NOT EXISTS supporters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            discord_id TEXT UNIQUE NOT NULL,
            username TEXT NOT NULL,
            role TEXT,
            is_active INTEGER DEFAULT 1
        )
    `);
});

// Функции для работы с отзывами
function getAllReviews() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT r.*, s.username as supporter_name 
            FROM reviews r 
            JOIN supporters s ON r.supporter_id = s.id 
            ORDER BY r.created_at DESC
        `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getUserReviewForSupporter(userId, supporterId) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM reviews WHERE user_id = ? AND supporter_id = ?',
            [userId, supporterId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

function addReview(supporterId, userId, username, rating, comment) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO reviews (supporter_id, user_id, username, rating, comment) VALUES (?, ?, ?, ?, ?)',
            [supporterId, userId, username, rating, comment],
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

// Функции для работы с жалобами
function getAllComplaints() {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM complaints ORDER BY created_at DESC', (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function addComplaint(userId, username, playerName, reason, videoUrl) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO complaints (user_id, username, player_name, reason, video_url) VALUES (?, ?, ?, ?, ?)',
            [userId, username, playerName, reason, videoUrl],
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

function updateComplaintStatus(complaintId, status) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE complaints SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, complaintId],
            function(err) {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

// Функция для добавления саппортов
function addSupporter(discordId, username, role) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT OR REPLACE INTO supporters (discord_id, username, role) VALUES (?, ?, ?)',
            [discordId, username, role],
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

module.exports = {
    getAllReviews,
    getUserReviewForSupporter,
    addReview,
    getAllComplaints,
    addComplaint,
    updateComplaintStatus,
    addSupporter
};