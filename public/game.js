const socket = io();

// === СЦЕНА ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 15, 20);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// === СВЕТ ===
const ambient = new THREE.AmbientLight(0x404060);
scene.add(ambient);
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(10, 20, 10);
light.castShadow = true;
scene.add(light);
const backLight = new THREE.DirectionalLight(0x4466ff, 0.3);
backLight.position.set(-10, -10, -10);
scene.add(backLight);

// === КОСМИЧЕСКИЙ ФОН ===
const starsGeometry = new THREE.BufferGeometry();
const starCount = 2000;
const positions = new Float32Array(starCount * 3);
const colors = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
    const r = 150 + Math.random() * 50;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i*3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i*3+2] = r * Math.cos(phi);
    const c = 0.5 + Math.random() * 0.5;
    colors[i*3] = c;
    colors[i*3+1] = c * (0.8 + Math.random() * 0.2);
    colors[i*3+2] = c;
}
starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
const starsMaterial = new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, opacity: 0.9 });
const stars = new THREE.Points(starsGeometry, starsMaterial);
scene.add(stars);

function createNebula(color, position, size) {
    const geom = new THREE.SphereGeometry(size, 16, 16);
    const mat = new THREE.MeshPhongMaterial({
        color: color,
        emissive: color,
        transparent: true,
        opacity: 0.08,
        side: THREE.BackSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(position.x, position.y, position.z);
    scene.add(mesh);
    return mesh;
}
createNebula(0x4444ff, {x: -40, y: 10, z: -30}, 30);
createNebula(0xff44aa, {x: 50, y: -20, z: -40}, 35);
createNebula(0x44ffaa, {x: 10, y: 30, z: -50}, 25);
createNebula(0xffaa44, {x: -30, y: -30, z: -60}, 40);

// === ЗВУК МОНЕТКИ ===
function playCoinSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.value = 1200;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {}
}

// === ЦВЕТА ===
const COLORS = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xff8800, 0x88ff00];
let myColor = COLORS[Math.floor(Math.random() * COLORS.length)];

// === ИГРОК ===
let myId = null;
const players = {};
let cameraMode = 0;

// === СОЗДАЁМ МАШИНУ ===
function createCar(color = 0xff0000) {
    const group = new THREE.Group();
    const bodyGeom = new THREE.BoxGeometry(1.0, 0.3, 2.0);
    const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.2;
    body.castShadow = true;
    group.add(body);

    const hoodGeom = new THREE.BoxGeometry(0.8, 0.15, 0.5);
    const hoodMat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3 });
    const hood = new THREE.Mesh(hoodGeom, hoodMat);
    hood.position.set(0, 0.4, 0.9);
    hood.rotation.x = -0.2;
    group.add(hood);

    const roofGeom = new THREE.BoxGeometry(0.6, 0.2, 0.6);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.set(0, 0.45, -0.1);
    group.add(roof);

    const glassGeom = new THREE.BoxGeometry(0.55, 0.15, 0.4);
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0x88ddff,
        metalness: 0.9,
        roughness: 0.1,
        transparent: true,
        opacity: 0.5,
    });
    const glass = new THREE.Mesh(glassGeom, glassMat);
    glass.position.set(0, 0.5, -0.1);
    group.add(glass);

    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffff88, emissive: 0xffff44, emissiveIntensity: 0.5 });
    const lightGeom = new THREE.SphereGeometry(0.08, 8, 8);
    const lightLeft = new THREE.Mesh(lightGeom, lightMat);
    lightLeft.position.set(-0.35, 0.15, 1.05);
    group.add(lightLeft);
    const lightRight = new THREE.Mesh(lightGeom, lightMat);
    lightRight.position.set(0.35, 0.15, 1.05);
    group.add(lightRight);

    const tailMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.3 });
    const tailGeom = new THREE.BoxGeometry(0.15, 0.08, 0.05);
    const tailLeft = new THREE.Mesh(tailGeom, tailMat);
    tailLeft.position.set(-0.35, 0.15, -1.05);
    group.add(tailLeft);
    const tailRight = new THREE.Mesh(tailGeom, tailMat);
    tailRight.position.set(0.35, 0.15, -1.05);
    group.add(tailRight);

    function addWheel(x, z) {
        const wheelGroup = new THREE.Group();
        const tireGeom = new THREE.CylinderGeometry(0.22, 0.22, 0.12, 12);
        const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
        const tire = new THREE.Mesh(tireGeom, tireMat);
        tire.rotation.x = Math.PI / 2;
        wheelGroup.add(tire);

        const rimGeom = new THREE.CylinderGeometry(0.14, 0.14, 0.14, 8);
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 });
        const rim = new THREE.Mesh(rimGeom, rimMat);
        rim.rotation.x = Math.PI / 2;
        wheelGroup.add(rim);

        const nutGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.16, 6);
        const nutMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.3 });
        const nut = new THREE.Mesh(nutGeom, nutMat);
        nut.rotation.x = Math.PI / 2;
        wheelGroup.add(nut);

        const spokeMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.3 });
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.15), spokeMat);
            spoke.position.set(Math.sin(angle) * 0.08, Math.cos(angle) * 0.08, 0);
            spoke.rotation.z = angle;
            wheelGroup.add(spoke);
        }

        wheelGroup.position.set(x, 0.12, z);
        group.add(wheelGroup);
    }

    addWheel(-0.5, 0.65);
    addWheel(0.5, 0.65);
    addWheel(-0.5, -0.65);
    addWheel(0.5, -0.65);

    const engineMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.3 });
    const engineGeom = new THREE.BoxGeometry(0.4, 0.1, 0.2);
    const engine = new THREE.Mesh(engineGeom, engineMat);
    engine.position.set(0, 0.15, -1.0);
    group.add(engine);

    const spoilerMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5, roughness: 0.4 });
    const spoilerGeom = new THREE.BoxGeometry(0.6, 0.05, 0.2);
    const spoiler = new THREE.Mesh(spoilerGeom, spoilerMat);
    spoiler.position.set(0, 0.3, -0.95);
    group.add(spoiler);

    const glowGeom = new THREE.SphereGeometry(0.5, 8, 8);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0 });
    const glow = new THREE.Mesh(glowGeom, glowMat);
    glow.position.set(0, 0, -1.2);
    glow.scale.set(1, 0.5, 1);
    group.add(glow);
    group.userData.glow = glow;

    return group;
}

// === ТЕКСТ ===
function createLabel(text, color = '#ffffff') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    if (ctx.roundRect) {
        ctx.roundRect(10, 10, 236, 44, 12);
        ctx.fill();
    } else {
        ctx.fillRect(10, 10, 236, 44);
    }
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 36);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(2, 0.5, 1);
    sprite.position.y = 1.2;
    return sprite;
}

// === МОЯ МАШИНА ===
const myShip = createCar(myColor);
scene.add(myShip);
const myLabel = createLabel('ТЫ', '#ff4444');
myShip.add(myLabel);

// === МОНЕТЫ ===
let coins = [];
const coinMeshes = [];

function createCoinMesh(coin) {
    const group = new THREE.Group();
    const geom = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffdd44, emissive: 0x442200 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = Math.PI / 2;
    group.add(mesh);
    group.position.set(coin.x, 0.5, coin.z);
    group.scale.set(0, 0, 0);
    group.userData = { targetScale: 1, animating: true, phase: Math.random() * Math.PI * 2 };
    scene.add(group);
    return group;
}

function animateCoinSpawn() {
    coinMeshes.forEach((group, index) => {
        if (group.userData.animating) {
            group.scale.x += (1 - group.scale.x) * 0.1;
            group.scale.y += (1 - group.scale.y) * 0.1;
            group.scale.z += (1 - group.scale.z) * 0.1;
            if (Math.abs(group.scale.x - 1) < 0.01) {
                group.scale.set(1, 1, 1);
                group.userData.animating = false;
            }
        }
        group.children[0].rotation.z += 0.05;
        group.position.y = 0.5 + Math.sin(Date.now() / 1000 + index) * 0.1;
    });
}

// === МЕТЕОРИТЫ ===
const meteorMeshes = [];

function createMeteor() {
    const size = 0.3 + Math.random() * 0.5;
    const geom = new THREE.DodecahedronGeometry(size);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x886644,
        emissive: 0x442200,
        roughness: 0.8,
        metalness: 0.2,
    });
    const mesh = new THREE.Mesh(geom, mat);
    const angle = Math.random() * Math.PI * 2;
    const distance = 15 + Math.random() * 20;
    mesh.position.set(
        Math.cos(angle) * distance,
        (Math.random() - 0.5) * 20,
        Math.sin(angle) * distance - 20
    );
    mesh.castShadow = true;
    mesh.userData = {
        speed: 0.02 + Math.random() * 0.04,
        rotSpeed: (Math.random() - 0.5) * 0.05,
        angle: angle,
        distance: distance,
        yOffset: (Math.random() - 0.5) * 20,
        active: true
    };
    scene.add(mesh);
    meteorMeshes.push(mesh);
    return mesh;
}

for (let i = 0; i < 15; i++) {
    createMeteor();
}

function updateMeteors() {
    meteorMeshes.forEach(mesh => {
        if (!mesh.userData.active) return;
        mesh.userData.angle += mesh.userData.speed * 0.02;
        mesh.position.x = Math.cos(mesh.userData.angle) * mesh.userData.distance;
        mesh.position.z = Math.sin(mesh.userData.angle) * mesh.userData.distance - 20;
        mesh.position.y += Math.sin(Date.now() / 2000 + mesh.userData.angle) * 0.002;
        mesh.rotation.x += mesh.userData.rotSpeed;
        mesh.rotation.y += mesh.userData.rotSpeed * 0.7;
        
        const dx = myShip.position.x - mesh.position.x;
        const dz = myShip.position.z - mesh.position.z;
        if (Math.sqrt(dx*dx + dz*dz) < 1.5 && mesh.userData.active) {
            const angle = Math.atan2(dz, dx);
            myShip.position.x += Math.cos(angle) * 2;
            myShip.position.z += Math.sin(angle) * 2;
            mesh.userData.active = false;
            mesh.visible = false;
            setTimeout(() => {
                mesh.userData.active = true;
                mesh.visible = true;
                mesh.userData.angle = Math.random() * Math.PI * 2;
                mesh.userData.distance = 15 + Math.random() * 20;
                mesh.position.x = Math.cos(mesh.userData.angle) * mesh.userData.distance;
                mesh.position.z = Math.sin(mesh.userData.angle) * mesh.userData.distance - 20;
            }, 3000);
        }
    });
}

// === ТАБЛИЦА ЛИДЕРОВ (ОБНОВЛЯЕТСЯ В РЕАЛЬНОМ ВРЕМЕНИ) ===
function updateLeaderboard() {
    const container = document.getElementById('leaderboardContent');
    if (!container) return;

    // Собираем всех игроков + себя
    const allPlayers = [];
    
    // Добавляем себя
    if (myId) {
        allPlayers.push({
            id: myId,
            name: 'ТЫ',
            score: parseInt(document.getElementById('score').textContent.replace('🪙 ', '')) || 0,
            isMe: true
        });
    }

    // Добавляем других игроков
    for (const [id, p] of Object.entries(players)) {
        allPlayers.push({
            id: id,
            name: id.slice(0, 4),
            score: p.data.score || 0,
            isMe: false
        });
    }

    // Сортируем по убыванию счёта
    allPlayers.sort((a, b) => b.score - a.score);

    let html = '';
    if (allPlayers.length === 0) {
        html = '<div style="color: rgba(255,255,255,0.3);">Нет игроков</div>';
    } else {
        allPlayers.forEach((p, i) => {
            const color = p.isMe ? '#ff4444' : '#88ccff';
            html += `<div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.03);">
                <span style="color: ${color};">${i+1}. ${p.name}</span>
                <span style="color: rgba(255,255,255,0.4);">${p.score} 🪙</span>
            </div>`;
        });
    }

    container.innerHTML = html;
}

// === СПИСОК ИГРОКОВ (ПОЛНЫЙ) ===
function updatePlayersListFull() {
    const container = document.getElementById('playersListFull');
    if (!container) return;

    let html = '';

    // Сначала добавляем себя
    html += `<div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span style="color: #ff4444;">ТЫ</span>
        <span style="color: rgba(255,255,255,0.3);">${myId ? myId.slice(0, 4) : ''}</span>
    </div>`;

    // Добавляем других игроков
    for (const [id, p] of Object.entries(players)) {
        const name = id.slice(0, 4);
        html += `<div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.03);">
            <span style="color: #88ccff;">${name}</span>
            <span style="color: rgba(255,255,255,0.2);">${p.data.score || 0} 🪙</span>
        </div>`;
    }

    container.innerHTML = html;
}

// === ИНИЦИАЛИЗАЦИЯ ===
socket.on('init', (data) => {
    myId = data.id;
    for (const [id, info] of Object.entries(data.players)) {
        if (id !== myId) {
            const car = createCar(0x00aaff);
            car.position.set(info.x, 0, info.z);
            const label = createLabel(id.slice(0, 4), '#88ccff');
            car.add(label);
            scene.add(car);
            players[id] = { mesh: car, data: info };
        }
    }
    coins = data.coins;
    coins.forEach(c => {
        const mesh = createCoinMesh(c);
        coinMeshes.push(mesh);
    });
    updatePlayersList();
    updateLeaderboard();
    updatePlayersListFull();
});

// === НОВЫЙ ИГРОК ===
socket.on('playerJoined', (data) => {
    if (data.id !== myId) {
        const car = createCar(0x00aaff);
        car.position.set(data.data.x, 0, data.data.z);
        const label = createLabel(data.id.slice(0, 4), '#88ccff');
        car.add(label);
        scene.add(car);
        players[data.id] = { mesh: car, data: data.data };
        updatePlayersList();
        updateLeaderboard();
        updatePlayersListFull();
    }
});

// === ДВИЖЕНИЕ ===
const lerp = (a, b, t) => a + (b - a) * t;

socket.on('playerMoved', (data) => {
    if (data.id !== myId && players[data.id]) {
        const targetX = data.data.x;
        const targetZ = data.data.z;
        players[data.id].mesh.position.x = lerp(players[data.id].mesh.position.x, targetX, 0.3);
        players[data.id].mesh.position.z = lerp(players[data.id].mesh.position.z, targetZ, 0.3);
        if (data.data.rotation !== undefined) {
            players[data.id].mesh.rotation.y = data.data.rotation;
        }
        players[data.id].data = data.data;
    }
});

// === ИГРОК ВЫШЕЛ ===
socket.on('playerLeft', (id) => {
    if (players[id]) {
        scene.remove(players[id].mesh);
        delete players[id];
        updatePlayersList();
        updateLeaderboard();
        updatePlayersListFull();
    }
});

// === МОНЕТЫ ===
socket.on('coinCollected', (data) => {
    if (data.id === myId) {
        document.getElementById('score').innerHTML = `🪙 ${data.score}`;
        playCoinSound();
    }
    updateLeaderboard();
});

socket.on('coinSpawned', (newCoins) => {
    coinMeshes.forEach(m => scene.remove(m));
    coinMeshes.length = 0;
    coins = newCoins;
    coins.forEach(c => {
        const mesh = createCoinMesh(c);
        coinMeshes.push(mesh);
    });
});

// === ЧАТ ===
socket.on('chatMessage', (data) => {
    const msgs = document.getElementById('chatMessages');
    const div = document.createElement('div');

    if (data.id === 'system') {
        // Системное сообщение с анимацией
        div.style.color = '#88ccff';
        div.style.fontStyle = 'italic';
        div.style.textAlign = 'center';
        div.style.opacity = '0';
        div.style.transform = 'translateX(-30px)';
        div.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        div.textContent = data.msg;

        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;

        requestAnimationFrame(() => {
            div.style.opacity = '1';
            div.style.transform = 'translateX(0)';
        });

        setTimeout(() => {
            div.style.opacity = '0';
            div.style.transform = 'translateX(30px)';
            setTimeout(() => {
                if (div.parentNode) {
                    div.remove();
                }
            }, 400);
        }, 5000);
    } else {
        // Обычное сообщение
        const name = data.id === myId ? 'ТЫ' : data.id.slice(0, 4);
        div.textContent = `[${name}]: ${data.msg}`;
        msgs.appendChild(div);
        msgs.scrollTop = msgs.scrollHeight;
    }
});

document.getElementById('chatInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const input = document.getElementById('chatInput');
        if (input.value.trim()) {
            socket.emit('chatMessage', input.value.trim());
            input.value = '';
        }
    }
});

// === УПРАВЛЕНИЕ ===
const keys = {};
document.addEventListener('keydown', (e) => keys[e.key] = true);
document.addEventListener('keyup', (e) => keys[e.key] = false);

function updatePlayersList() {
    const count = Object.keys(players).length + 1;
    document.getElementById('playersList').textContent = `👥 Игроки: ${count}`;
}

// === КАМЕРА ===
let isRotating = false;
let prevMouseX = 0;
let prevMouseY = 0;
let cameraAngleH = 0;
let cameraAngleV = 0.3;
let cameraDistance = 18;

renderer.domElement.addEventListener('mousedown', (e) => {
    if (e.button === 2) {
        isRotating = true;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
    }
});

renderer.domElement.addEventListener('mousemove', (e) => {
    if (isRotating) {
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        cameraAngleH += deltaX * 0.005;
        cameraAngleV += deltaY * 0.005;
        cameraAngleV = Math.max(-1.0, Math.min(1.0, cameraAngleV));
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
    }
});

renderer.domElement.addEventListener('mouseup', (e) => {
    if (e.button === 2) {
        isRotating = false;
    }
});

renderer.domElement.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// === ЗУМ ===
renderer.domElement.addEventListener('wheel', (e) => {
    cameraDistance += e.deltaY * 0.01;
    cameraDistance = Math.max(5, Math.min(30, cameraDistance));
});

// === СМЕНА КАМЕРЫ (КЛАВИША C) ===
document.addEventListener('keydown', (e) => {
    if (e.key === 'c' || e.key === 'C') {
        cameraMode = (cameraMode + 1) % 3;
        if (cameraMode === 0) {
            cameraDistance = 18;
            cameraAngleV = 0.3;
            document.getElementById('cameraInfo').textContent = '📷 Сзади | C';
        } else if (cameraMode === 1) {
            cameraDistance = 25;
            cameraAngleV = 1.2;
            document.getElementById('cameraInfo').textContent = '📷 Сверху | C';
        } else {
            cameraDistance = 2;
            cameraAngleV = 0;
            document.getElementById('cameraInfo').textContent = '📷 1-е лицо | C';
        }
    }
});

// === НАДПИСЬ С КАМЕРОЙ (ЛЕВЫЙ ВЕРХНИЙ УГОЛ) ===
const cameraInfo = document.createElement('div');
cameraInfo.id = 'cameraInfo';
cameraInfo.style.position = 'absolute';
cameraInfo.style.top = '80px';
cameraInfo.style.left = '20px';
cameraInfo.style.color = 'rgba(255, 255, 255, 0.6)';
cameraInfo.style.backgroundColor = 'rgba(0, 0, 0, 0.4)';
cameraInfo.style.padding = '6px 14px';
cameraInfo.style.borderRadius = '8px';
cameraInfo.style.fontSize = '13px';
cameraInfo.style.zIndex = '10';
cameraInfo.style.fontWeight = '500';
cameraInfo.textContent = '📷 Сзади | C';
document.body.appendChild(cameraInfo);

// === ИГРОВОЙ ЦИКЛ ===
let speed = 0.15;
let boost = false;
let boostCooldown = 0;

function gameLoop() {
    let forward = 0;
    let turn = 0;
    
    // Буст (Shift)
    boost = keys['Shift'] && boostCooldown <= 0;
    let currentSpeed = boost ? speed * 2.5 : speed;
    if (boost) {
        boostCooldown = 60;
        if (myShip.userData.glow) {
            myShip.userData.glow.material.opacity = 0.5;
            myShip.userData.glow.scale.set(1.5, 0.8, 1.5);
        }
    } else {
        if (myShip.userData.glow) {
            myShip.userData.glow.material.opacity *= 0.95;
            myShip.userData.glow.scale.x += (1 - myShip.userData.glow.scale.x) * 0.05;
            myShip.userData.glow.scale.z += (1 - myShip.userData.glow.scale.z) * 0.05;
        }
        if (boostCooldown > 0) boostCooldown--;
    }

    // Управление относительно машины
    if (keys['w'] || keys['ArrowUp']) forward = 1;
    if (keys['s'] || keys['ArrowDown']) forward = -1;
    if (keys['a'] || keys['ArrowLeft']) turn = 1;
    if (keys['d'] || keys['ArrowRight']) turn = -1;

    // Движение вперёд/назад относительно поворота машины
    const angle = myShip.rotation.y;
    let dx = Math.sin(angle) * forward * currentSpeed;
    let dz = Math.cos(angle) * forward * currentSpeed;

    // Поворот
    myShip.rotation.y += turn * 0.03;

    // Применяем движение
    myShip.position.x += dx;
    myShip.position.z += dz;

    // === ОТПРАВКА НА СЕРВЕР (АБСОЛЮТНЫЕ КООРДИНАТЫ) ===
    socket.emit('move', {
        x: myShip.position.x,
        z: myShip.position.z,
        rotation: myShip.rotation.y
    });

    // Обновления
    updateMeteors();
    animateCoinSpawn();

    // === КАМЕРА ===
    const targetX = myShip.position.x;
    const targetZ = myShip.position.z;
    
    if (cameraMode === 2) {
        const forwardVec = new THREE.Vector3(0, 0, -1);
        forwardVec.applyQuaternion(myShip.quaternion);
        const camPos = new THREE.Vector3(
            targetX + forwardVec.x * 3,
            0.5,
            targetZ + forwardVec.z * 3
        );
        camera.position.lerp(camPos, 0.1);
        camera.lookAt(
            targetX + forwardVec.x * 10,
            0.5,
            targetZ + forwardVec.z * 10
        );
    } else {
        const camX = targetX + cameraDistance * Math.sin(cameraAngleH) * Math.cos(cameraAngleV);
        const camY = (cameraMode === 1 ? 25 : 8) + cameraDistance * Math.sin(cameraAngleV);
        const camZ = targetZ + cameraDistance * Math.cos(cameraAngleH) * Math.cos(cameraAngleV);
        camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.1);
        camera.lookAt(targetX, 1, targetZ);
    }

    renderer.render(scene, camera);
    
    // === ОБНОВЛЯЕМ ЛИДЕРОВ КАЖДЫЙ КАДР ===
    updateLeaderboard();

    requestAnimationFrame(gameLoop);
}

gameLoop();

// === РЕСАЙЗ ===
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});