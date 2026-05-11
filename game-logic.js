let myRole = "", myName = "", sessionRef = null, gameActive = false;
let selectedLevelIdx = null;
const levelNames = ["МЕХАНИКА", "МОЛЕКУЛАЛЫК ФИЗИКА", "ЭЛЕКТРОДИНАМИКА", "ТЕРМЕЛҮҮЛӨР", "ОПТИКА", "АТОМДУК ФИЗИКА", "АСТРОНОМИЯ"];

// --- МУЗЫКАНЫ БАШКАРУУ ---
function playMenuMusic() {
    const music = document.getElementById('menuMusic');
    if (music && music.paused) {
        music.play().catch(e => console.log("Музыканы иштетүү үчүн колдонуучунун аракети керек"));
    }
}

function stopMenuMusic() {
    const music = document.getElementById('menuMusic');
    if (music) {
        music.pause();
        music.currentTime = 0;
    }
}

function playGameMusic() {
    const gMusic = document.getElementById('gameMusic');
    if (gMusic) {
        gMusic.volume = 0.7;
        gMusic.play().catch(e => console.log("Оюн музыкасы иштебей калды"));
    }
}

// --- ЭМОЦИЯЛАР СИСТЕМАСЫ ---
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
        const oldEmoji = container.querySelector('.emoji-pop');
        if (oldEmoji) oldEmoji.remove();
        const el = document.createElement('div');
        el.className = 'emoji-pop';
        el.innerText = data.emoji;
        el.style.position = 'absolute';
        el.style.top = '-50px';
        el.style.left = '50%';
        el.style.transform = 'translateX(-50%)';
        el.style.fontSize = '40px';
        el.style.animation = 'floatUp 1.5s forwards';
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
    playMenuMusic();
    myRole = "boy";
    const code = Math.floor(100 + Math.random() * 899);
    document.getElementById('room-controls').style.display = "none";
    document.getElementById('wait-status').innerHTML = `БӨЛМӨ КОДУ: <b>${code}</b><br>Кыздын кошулуусун күтүңүз...`;
    sessionRef = firebase.database().ref('rooms/' + code);
    sessionRef.set({ 
        players: { boy: myName }, 
        sync: { boy: false, girl: false }, 
        pos: { boy: 0, girl: 0 }, 
        level: selectedLevelIdx,
        status: "waiting",
        turn: "boy" 
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
            playMenuMusic();
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
    document.getElementById('ready-btn').disabled = true;
    document.getElementById('ready-btn').innerText = "КҮТҮҮ...";
    sessionRef.child('sync/' + myRole).set(true); 
}

function startCountdown() {
    gameActive = true;
    let c = 3;
    const timer = setInterval(() => {
        const cdDisplay = document.getElementById('countdown');
        if(cdDisplay) cdDisplay.innerText = c > 0 ? c : "АЛГА!";
        if (c === 0) { clearInterval(timer); setTimeout(launch, 500); }
        c--;
    }, 1000);
}

function launch() {
    stopMenuMusic();
    playGameMusic();
    listenReactions();
    document.getElementById('boyVideo').play();
    document.getElementById('girlVideo').play();
    document.getElementById('sync-overlay').style.display = "none";
    document.getElementById('game-field').style.display = "block";
    document.getElementById('ui-bottom').style.display = "flex";
    renderGame();
}

// --- НЕГИЗГИ ОЮН ПРОЦЕССИ ЖАНА РЕЙТИНГ ---
function renderGame() {
    let qIdx = 0;
    let gameFinished = false;
    const questions = allQuestions[selectedLevelIdx] || [];
    const currentQuestions = questions.slice(0, 30); 

    function showQ() {
        if (gameFinished) return;
        if (qIdx >= currentQuestions.length) {
            checkWinner("УБАКЫТ БҮТТҮ: Кыз качып кетти! 🐎");
            return;
        }
        
        sessionRef.child('turn').once('value', s => {
            const currentTurn = s.val();
            const q = currentQuestions[qIdx];
            const optArea = document.getElementById('options');
            const qText = document.getElementById('q-text');

            if (currentTurn === myRole) {
                optArea.classList.remove('disabled-overlay');
                qText.innerText = q.q;
            } else {
                optArea.classList.add('disabled-overlay');
                qText.innerText = "АТААНДАШТЫ КҮТҮҮ...";
            }

            optArea.innerHTML = "";
            q.a.forEach(txt => {
                const b = document.createElement('button');
                b.className = 'btn opt-btn'; 
                b.innerText = txt;
                b.onclick = () => {
                    if (currentTurn !== myRole) return;
                    let isCorrect = (txt === q.c);
                    let moveStep = isCorrect ? 3.5 : -1.5;
                    
                    const nextTurn = myRole === "boy" ? "girl" : "boy";
                    sessionRef.update({
                        ['pos/' + myRole]: firebase.database.ServerValue.increment(moveStep),
                        turn: nextTurn,
                        lastQ: qIdx 
                    });
                };
                optArea.appendChild(b);
            });
        });
    }

    sessionRef.child('turn').on('value', () => {
        sessionRef.child('lastQ').once('value', s => {
            qIdx = (s.val() || 0) + 1;
            showQ();
        });
    });

    sessionRef.child('pos').on('value', s => {
        const p = s.val();
        if (p && !gameFinished) {
            const bPos = 5 + (p.boy || 0);
            const gPos = 45 + (p.girl || 0);
            document.getElementById('boy-container').style.left = bPos + "%";
            document.getElementById('girl-container').style.left = gPos + "%";
            
            if (bPos >= (gPos - 2)) checkWinner("ЖИГИТ КЫЗГА ЖЕТТИ! 🏇 Жигит утту!");
            else if (gPos >= 95) checkWinner("КЫЗ КАЧЫП КЕТТИ! 🐎 Кыз утту!");
        }
    });

    function checkWinner(reason) {
        if (gameFinished) return;
        gameFinished = true;
        sessionRef.child('pos').off();
        sessionRef.child('turn').off();
        document.getElementById('boyVideo').pause();
        document.getElementById('girlVideo').pause();
        
        const lb = document.getElementById('leaderboard-screen');
        lb.style.display = "flex";
        lb.innerHTML = `
            <div style="background: white; padding: 40px; border-radius: 20px; text-align: center; border: 5px solid #f1c40f;">
                <h1 style="color: #e67e22;">🏆 ЖЫЙЫНТЫК</h1>
                <h2 style="margin: 20px 0;">${reason}</h2>
                <div style="background: #eee; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                    <p><b>1-орун:</b> ${reason.includes("Жигит утту") ? "Жигит" : "Кыз"}</p>
                    <p style="opacity: 0.6;"><b>2-орун:</b> ${reason.includes("Жигит утту") ? "Кыз" : "Жигит"}</p>
                </div>
                <button class="btn" onclick="location.reload()" style="background: #3498db; color: white; padding: 10px 30px;">МЕНЮГА КАЙТУУ</button>
            </div>
        `;
    }
}
