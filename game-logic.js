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
        gMusic.volume = 0.7; // Оюн музыкасынын катуулугу
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
        el.style.pointerEvents = 'none';
        el.style.zIndex = '1000';
        
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
        turn: "boy" // Оюнду жигит баштайт
    });

    sessionRef.child('players/girl').on('value', s => { 
        if(s.exists()) startSync(); 
    });
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
        } else { 
            alert("Бөлмө табылган жок же бөлмө толуп калган!"); 
        }
    });
}

function startSync() {
    document.getElementById('setup-screen').style.display = "none";
    document.getElementById('sync-overlay').style.display = "flex";
    
    sessionRef.child('sync').on('value', s => {
        const sync = s.val();
        if (sync && sync.boy && sync.girl && !gameActive) {
            startCountdown();
        }
    });
}

function triggerReady() { 
    document.getElementById('ready-btn').style.opacity = "0.5";
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
        if (c === 0) { 
            clearInterval(timer); 
            setTimeout(launch, 500); 
        }
        c--;
    }, 1000);
}

// --- ОЮНДУ БАШТОО (LAUNCH) ---
function launch() {
    stopMenuMusic();
    playGameMusic();
    listenReactions();

    const bVideo = document.getElementById('boyVideo');
    const gVideo = document.getElementById('girlVideo');
    if (bVideo && gVideo) {
        bVideo.play();
        gVideo.play();
        bVideo.loop = true;
        gVideo.loop = true;
    }

    document.getElementById('sync-overlay').style.display = "none";
    const gameField = document.getElementById('game-field');
    const bottomUI = document.getElementById('ui-bottom');
    
    if(gameField) gameField.style.display = "block";
    if(bottomUI) bottomUI.style.display = "flex";
    
    renderGame();
}

// --- НЕГИЗГИ ОЮН ПРОЦЕССИ ---
function renderGame() {
    let qIdx = 0;
    let gameFinished = false;
    const questions = allQuestions[selectedLevelIdx] || [];
    const currentQuestions = questions.slice(0, 30); 

    function showQ() {
        if (gameFinished || qIdx >= currentQuestions.length) {
            if (qIdx >= currentQuestions.length && !gameFinished) {
                // Суроолор бүткөндө ким алдыда экенин текшерүү
                sessionRef.child('pos').once('value', snapshot => {
                    const p = snapshot.val();
                    const bP = 5 + (p.boy || 0);
                    const gP = 45 + (p.girl || 0);
                    if (bP >= (gP - 2)) {
                        checkWinner("Жигит кызга жетти! 🏇 Жигит утту!");
                    } else {
                        checkWinner("Кыз качып кетти! 🐎 Кыз утту!");
                    }
                });
            }
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

            const emojiBar = document.createElement('div');
            emojiBar.style.gridColumn = "1 / span 2";
            emojiBar.style.display = "flex";
            emojiBar.style.justifyContent = "center";
            emojiBar.style.gap = "15px";
            emojiBar.style.marginBottom = "10px";
            ["😂", "🚀", "😎", "😜", "🔥"].forEach(e => {
                const eb = document.createElement('span');
                eb.innerText = e;
                eb.style.fontSize = "24px";
                eb.style.cursor = "pointer";
                eb.onclick = (ev) => { ev.stopPropagation(); sendEmoji(e); };
                emojiBar.appendChild(eb);
            });
            optArea.appendChild(emojiBar);

            q.a.forEach(txt => {
                const b = document.createElement('button');
                b.className = 'btn opt-btn'; 
                b.innerText = txt;
                b.onclick = () => {
                    if (currentTurn !== myRole) return;

                    let moveStep = 0;
                    let isCorrect = (txt === q.c);
                    
                    if (isCorrect) {
                        moveStep = 3.5;
                        document.getElementById('game-field').style.backgroundColor = "#d4edda";
                    } else {
                        moveStep = -1.5;
                        document.getElementById('game-field').style.backgroundColor = "#f8d7da";
                    }
                    
                    setTimeout(() => {
                        document.getElementById('game-field').style.backgroundColor = "#ffffff";
                    }, 400);

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
            const boyPos = 5 + (p.boy || 0);
            const girlPos = 45 + (p.girl || 0);
            
            document.getElementById('boy-container').style.left = boyPos + "%";
            document.getElementById('girl-container').style.left = girlPos + "%";
            
            if (boyPos >= (girlPos - 2)) {
                checkWinner("Жигит кызга жетти! 🏇 Жигит утту!");
            } 
            else if (girlPos >= 95) {
                checkWinner("Кыз качып кетти! 🐎 Кыз утту!");
            }
        }
    });

    function checkWinner(reason) {
        if (gameFinished) return;
        gameFinished = true;
        sessionRef.child('pos').off();
        sessionRef.child('turn').off();
        sessionRef.child('reactions').off();
        
        document.getElementById('boyVideo').pause();
        document.getElementById('girlVideo').pause();
        
        const lb = document.getElementById('leaderboard-screen');
        lb.style.display = "flex";
        lb.innerHTML = `
            <div style="background: white; padding: 40px; border-radius: 30px; text-align: center; color: #333; box-shadow: 0 15px 50px rgba(0,0,0,0.3); border: 4px solid #f1c40f;">
                <h1 style="margin:0; color: #e67e22; font-size: 32px;">🏆 ОЮН АЯКТАДЫ</h1>
                <h2 style="margin: 20px 0; color: #2c3e50;">${reason}</h2>
                <div style="background: #f9f9f9; padding: 20px; border-radius: 15px; margin-bottom: 25px;">
                    <h3 style="margin:0 0 10px 0; color: #7f8c8d;">РЕЙТИНГ</h3>
                    <p style="font-size: 20px; margin: 5px 0;">🥇 <b>${reason.includes("Жигит утту") ? "Жигит" : "Кыз"}</b></p>
                    <p style="font-size: 18px; margin: 5px 0; opacity: 0.6;">🥈 ${reason.includes("Жигит утту") ? "Кыз" : "Жигит"}</p>
                </div>
                <button class="btn" style="background: linear-gradient(to right, #3498db, #2980b9); color: white; padding: 15px 40px; border-radius: 50px; font-weight: bold; cursor: pointer; border: none; font-size: 18px;" onclick="location.reload()">БАШКЫ МЕНЮ</button>
            </div>
        `;
        setTimeout(() => { if(sessionRef) sessionRef.remove(); }, 600000);
    }
}
