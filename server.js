const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

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

    const playerName = socket.id.slice(0, 4);

    players[socket.id] = {
        x: (Math.random() - 0.5) * 20,
        z: (Math.random() - 0.5) * 20,
        score: 0,
        rotation: 0
    };

    socket.emit('init', {
        id: socket.id,
        players: players,
        coins: coins
    });

    socket.broadcast.emit('playerJoined', { id: socket.id, data: players[socket.id] });

    io.emit('chatMessage', {
        id: 'system',
        msg: `🟢 Игрок ${playerName} присоединился к игре`
    });

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

    socket.on('chatMessage', (msg) => {
        io.emit('chatMessage', { id: socket.id, msg: msg });
    });

    socket.on('disconnect', () => {
        const playerName = socket.id.slice(0, 4);
        delete players[socket.id];

        io.emit('chatMessage', {
            id: 'system',
            msg: `🔴 Игрок ${playerName} покинул игру`
        });

        io.emit('playerLeft', socket.id);
    });
});

http.listen(3000, () => {
    console.log('Сервер запущен на http://localhost:3000');
});