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
    // Суроолорду аралаштыруу, бирок эки тарапка бирдей иретте болушу үчүн
    // (Firebase'де суроолордун тартибин сактоо сунушталат, бирок бул жерде жөнөкөй калтырабыз)
    const currentQuestions = questions.slice(0, 30); 

    function showQ() {
        if (gameFinished || qIdx >= currentQuestions.length) {
            if (qIdx >= currentQuestions.length && !gameFinished) {
                checkWinner("УБАКЫТ БҮТТҮ: Кыз качып кетти! 🐎");
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
                        // 30 суроого ылайыкталган кадам (3.5 * 30 = 105%)
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
                        lastQ: qIdx // Суроо индексин синхрондоо
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
            // Баштапкы позициялар: Жигит 5%, Кыз 45% (Арасы 40%)
            const boyPos = 5 + (p.boy || 0);
            const girlPos = 45 + (p.girl || 0);
            
            document.getElementById('boy-container').style.left = boyPos + "%";
            document.getElementById('girl-container').style.left = girlPos + "%";
            
            // ЖЕҢИШ ШАРТТАРЫ:
            // 1. Жигиттин аты кыздын куйругуна (артына) жеткенде
            if (boyPos >= (girlPos - 2)) {
                checkWinner("ЖИГИТ КЫЗГА ЖЕТТИ! 🏇 Жигит утту!");
            } 
            // 2. Кыз маарага (95%) жеткенде
            else if (girlPos >= 95) {
                checkWinner("КЫЗ КАЧЫП КЕТТИ! 🐎 Кыз утту!");
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
            <div style="background: white; padding: 30px; border-radius: 20px; text-align: center; color: #333; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <h1 style="margin:0; color: #2c3e50;">${reason}</h1>
                <p style="font-size: 18px; margin: 20px 0;">Оюн аяктады</p>
                <button class="btn" style="background: #3498db; color: white; padding: 10px 30px;" onclick="location.reload()">МЕНЮГА КАЙТУУ</button>
            </div>
        `;
        setTimeout(() => { sessionRef.remove(); }, 600000);
    }
}
