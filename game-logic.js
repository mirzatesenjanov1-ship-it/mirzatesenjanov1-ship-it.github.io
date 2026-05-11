let myRole = "", myName = "", sessionRef = null, gameActive = false;
let selectedLevelIdx = null;
const levelNames = ["МЕХАНИКА", "МОЛЕКУЛАЛЫК ФИЗИКА", "ЭЛЕКТРОДИНАМИКА", "ТЕРМЕЛҮҮЛӨР", "ОПТИКА", "АТОМДУК ФИЗИКА", "АСТРОНОМИЯ"];

// --- МУЗЫКА ---
function playMenuMusic() {
    const music = document.getElementById('menuMusic');
    if (music && music.paused) music.play().catch(e => {});
}
function stopMenuMusic() {
    const music = document.getElementById('menuMusic');
    if (music) { music.pause(); music.currentTime = 0; }
}
function playGameMusic() {
    const gMusic = document.getElementById('gameMusic');
    if (gMusic) { gMusic.volume = 0.5; gMusic.play().catch(e => {}); }
}

// --- ЭМОЦИЯЛАР (ОҢДОЛГОН) ---
function sendEmoji(emoji) {
    if (!sessionRef) return;
    sessionRef.child('reactions').set({
        sender: myRole,
        emoji: emoji,
        time: Date.now()
    });
}

function listenReactions() {
    sessionRef.child('reactions').on('value', s => {
        const data = s.val();
        if (!data) return;

        const containerId = data.sender === "boy" ? "boy-container" : "girl-container";
        const container = document.getElementById(containerId);
        if (!container) return;

        const el = document.createElement('div');
        el.className = 'emoji-pop';
        el.innerText = data.emoji;
        el.style.cssText = `
            position: absolute; top: -60px; left: 50%;
            transform: translateX(-50%); font-size: 50px;
            animation: floatUp 1.5s forwards; z-index: 1000;
        `;
        
        container.appendChild(el);
        setTimeout(() => el.remove(), 1500);
    });
}

// --- МЕНЮ ЛОГИКАСЫ ---
function selectLevel(idx) {
    selectedLevelIdx = idx;
    playMenuMusic();
    document.getElementById('level-screen').style.display = "none";
    document.getElementById('setup-screen').style.display = "flex";
    document.getElementById('display-level-name').innerText = levelNames[idx];
}

function createRoom() {
    myName = document.getElementById('player-name').value.trim();
    if (!myName) return alert("Атыңызды жазыңыз!");
    myRole = "boy";
    const code = Math.floor(100 + Math.random() * 899);
    document.getElementById('room-controls').style.display = "none";
    document.getElementById('wait-status').innerHTML = `БӨЛМӨ КОДУ: <b>${code}</b><br>Кызды күтүңүз...`;
    sessionRef = firebase.database().ref('rooms/' + code);
    sessionRef.set({ 
        players: { boy: myName }, sync: { boy: false, girl: false }, 
        pos: { boy: 0, girl: 0 }, level: selectedLevelIdx, turn: "boy" 
    });
    sessionRef.child('players/girl').on('value', s => { if(s.exists()) startSync(); });
}

function joinRoom() {
    myName = document.getElementById('player-name').value.trim();
    const code = document.getElementById('room-input').value.trim();
    if (!myName || !code) return alert("Атыңызды жана кодду жазыңыз!");
    myRole = "girl";
    sessionRef = firebase.database().ref('rooms/' + code);
    sessionRef.once('value', s => {
        const data = s.val();
        if (s.exists() && data.players && !data.players.girl) {
            selectedLevelIdx = data.level;
            sessionRef.child('players/girl').set(myName);
            startSync();
        } else { alert("Бөлмө табылган жок!"); }
    });
}

function startSync() {
    document.getElementById('setup-screen').style.display = "none";
    document.getElementById('sync-overlay').style.display = "flex";
    sessionRef.child('sync').on('value', s => {
        const sync = s.val();
        if (sync && sync.boy && sync.girl && !gameActive) startCountdown();
    });
}

function triggerReady() { 
    document.getElementById('ready-btn').innerText = "КҮТҮҮ...";
    sessionRef.child('sync/' + myRole).set(true); 
}

function startCountdown() {
    gameActive = true;
    let c = 3;
    const timer = setInterval(() => {
        document.getElementById('countdown').innerText = c > 0 ? c : "АЛГА!";
        if (c === 0) { clearInterval(timer); setTimeout(launch, 500); }
        c--;
    }, 1000);
}

function launch() {
    stopMenuMusic();
    playGameMusic();
    listenReactions();
    document.getElementById('sync-overlay').style.display = "none";
    document.getElementById('game-field').style.display = "block";
    document.getElementById('ui-bottom').style.display = "flex";
    
    document.getElementById('boyVideo').play();
    document.getElementById('girlVideo').play();
    
    renderGame();
}

// --- ОЮНДУН ӨЗӨГҮ (ОҢДОЛГОН) ---
function renderGame() {
    let qIdx = 0;
    let gameFinished = false;
    const questions = allQuestions[selectedLevelIdx] || [];
    const currentQuestions = questions.slice(0, 30); 

    function showQ() {
        if (gameFinished) return;
        sessionRef.child('turn').once('value', s => {
            const turn = s.val();
            const q = currentQuestions[qIdx];
            if (!q) return checkWinner("Суроолор бүттү!");

            const optArea = document.getElementById('options');
            const qText = document.getElementById('q-text');

            optArea.innerHTML = "";
            
            // Эмоциялар панелин кошуу
            const eBar = document.createElement('div');
            eBar.style.cssText = "grid-column: 1/span 2; display: flex; justify-content: center; gap: 20px; margin-bottom: 10px;";
            ["😂", "🚀", "🔥", "😎"].forEach(emoji => {
                const span = document.createElement('span');
                span.innerText = emoji;
                span.style.cursor = "pointer";
                span.style.fontSize = "30px";
                span.onclick = () => sendEmoji(emoji);
                eBar.appendChild(span);
            });
            optArea.appendChild(eBar);

            if (turn === myRole) {
                optArea.classList.remove('disabled-overlay');
                qText.innerText = q.q;
                q.a.forEach(txt => {
                    const b = document.createElement('button');
                    b.className = 'btn opt-btn';
                    b.innerText = txt;
                    b.onclick = () => {
                        let step = (txt === q.c) ? 3.5 : -1.5;
                        sessionRef.update({
                            ['pos/' + myRole]: firebase.database.ServerValue.increment(step),
                            turn: myRole === "boy" ? "girl" : "boy",
                            lastQ: qIdx
                        });
                    };
                    optArea.appendChild(b);
                });
            } else {
                optArea.classList.add('disabled-overlay');
                qText.innerText = "АТААНДАШТЫ КҮТҮҮ...";
            }
        });
    }

    sessionRef.child('turn').on('value', () => {
        sessionRef.child('lastQ').once('value', s => {
            qIdx = (s.val() || 0) + 1;
            showQ();
        });
    });

    sessionRef.child('pos').on('value', s => {
        const p = s.val() || {boy:0, girl:0};
        const bPos = 5 + p.boy;
        const gPos = 45 + p.girl;
        document.getElementById('boy-container').style.left = bPos + "%";
        document.getElementById('girl-container').style.left = gPos + "%";
        
        if (bPos >= (gPos - 2)) checkWinner("ЖИГИТ КЫЗГА ЖЕТТИ! 🏇");
        else if (gPos >= 95) checkWinner("КЫЗ КАЧЫП КЕТТИ! 🐎");
    });

    function checkWinner(reason) {
        if (gameFinished) return;
        gameFinished = true;
        sessionRef.child('pos').off();
        sessionRef.child('turn').off();
        
        const lb = document.getElementById('leaderboard-screen');
        lb.style.display = "flex";
        lb.style.zIndex = "1000";
        lb.innerHTML = `
            <div style="background: white; padding: 40px; border-radius: 20px; text-align: center;">
                <h1 style="color: #e67e22;">ОЮН АЯКТАДЫ</h1>
                <h2>${reason}</h2>
                <button class="btn" style="background:#3498db; color:white;" onclick="location.reload()">МЕНЮГА КАЙТУУ</button>
            </div>
        `;
    }
}
