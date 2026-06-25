const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const sqlite3 = require('sqlite3').verbose();

// ─── БАЗА ДАННЫХ ────────────────────────────────────────
const db = new sqlite3.Database('./game.db');

db.serialize(() => {
    // Таблица игроков
    db.run(`CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        total_coins INTEGER DEFAULT 0,
        games_played INTEGER DEFAULT 1
    )`);

    // Таблица лидеров (дублируем для быстрых запросов)
    db.run(`CREATE TABLE IF NOT EXISTS leaderboard (
        player_id INTEGER,
        total_coins INTEGER,
        FOREIGN KEY(player_id) REFERENCES players(id)
    )`);
});

// ─── ХЕЛПЕРЫ ─────────────────────────────────────────────

function getPlayer(name, callback) {
    db.get("SELECT * FROM players WHERE name = ?", [name], (err, row) => {
        if (err) return callback(null);
        callback(row);
    });
}

function createPlayer(name, callback) {
    db.run("INSERT INTO players (name, total_coins) VALUES (?, 0)", [name], function (err) {
        if (err) return callback(null);
        getPlayer(name, callback);
    });
}

function updateCoins(name, coins, callback) {
    db.run("UPDATE players SET total_coins = total_coins + ? WHERE name = ?", [coins, name], function (err) {
        if (err) return callback(false);
        callback(true);
    });
}

function getLeaderboard(callback) {
    db.all("SELECT name, total_coins FROM players ORDER BY total_coins DESC LIMIT 10", (err, rows) => {
        if (err) return callback([]);
        callback(rows);
    });
}

// ─── СЕРВЕР ──────────────────────────────────────────────

app.use(express.static('public'));

const players = {};
const coins = [];

for (let i = 0; i < 30; i++) {
    coins.push({
        x: (Math.random() - 0.5) * 60,
        z: (Math.random() - 0.5) * 60
    });
}

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);

    let playerName = socket.handshake.query.name || 'Player_' + socket.id.slice(0, 4);

    // Регистрируем игрока
    getPlayer(playerName, (row) => {
        if (!row) {
            createPlayer(playerName, (newRow) => {
                if (newRow) {
                    players[socket.id] = {
                        name: newRow.name,
                        x: (Math.random() - 0.5) * 20,
                        z: (Math.random() - 0.5) * 20,
                        score: newRow.total_coins,
                        rotation: 0
                    };
                    socket.emit('init', { id: socket.id, players: players, coins: coins });
                    socket.broadcast.emit('playerJoined', { id: socket.id, data: players[socket.id] });
                    sendLeaderboard();
                }
            });
        } else {
            players[socket.id] = {
                name: row.name,
                x: (Math.random() - 0.5) * 20,
                z: (Math.random() - 0.5) * 20,
                score: row.total_coins,
                rotation: 0
            };
            socket.emit('init', { id: socket.id, players: players, coins: coins });
            socket.broadcast.emit('playerJoined', { id: socket.id, data: players[socket.id] });
            sendLeaderboard();
        }
    });

    // ─── ДВИЖЕНИЕ ──────────────────────────────────────────
    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].z = data.z;
            players[socket.id].rotation = data.rotation || 0;

            for (let i = coins.length - 1; i >= 0; i--) {
                const coin = coins[i];
                const dx = players[socket.id].x - coin.x;
                const dz = players[socket.id].z - coin.z;
                if (Math.sqrt(dx * dx + dz * dz) < 1.5) {
                    coins.splice(i, 1);
                    players[socket.id].score++;
                    // Сохраняем монету в БД
                    updateCoins(players[socket.id].name, 1, (ok) => {
                        if (ok) {
                            sendLeaderboard();
                        }
                    });
                    io.emit('coinCollected', { id: socket.id, score: players[socket.id].score });
                    coins.push({
                        x: (Math.random() - 0.5) * 60,
                        z: (Math.random() - 0.5) * 60
                    });
                    io.emit('coinSpawned', coins);
                }
            }
            io.emit('playerMoved', { id: socket.id, data: players[socket.id] });
        }
    });

    // ─── ЧАТ ──────────────────────────────────────────────
    socket.on('chatMessage', (msg) => {
        const name = players[socket.id]?.name || socket.id.slice(0, 4);
        io.emit('chatMessage', { id: socket.id, name: name, msg: msg });
    });

    // ─── ЛИДЕРЫ ────────────────────────────────────────────
    function sendLeaderboard() {
        getLeaderboard((rows) => {
            io.emit('leaderboard', rows);
        });
    }

    // ─── ОТКЛЮЧЕНИЕ ───────────────────────────────────────
    socket.on('disconnect', () => {
        if (players[socket.id]) {
            const name = players[socket.id].name;
            delete players[socket.id];
            io.emit('playerLeft', socket.id);
            sendLeaderboard();
            console.log('Игрок вышел:', name);
        }
    });
});

http.listen(3000, () => {
    console.log('🚀 Сервер запущен на http://localhost:3000');
});