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
        cdDisplay.innerText = c > 0 ? c : "АЛГА!";
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

    // Видеолорду иштетүү жана кайталоо (loop)
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
    const shuffledQuestions = questions.sort(() => Math.random() - 0.5);

    function showQ() {
        if (gameFinished || qIdx >= shuffledQuestions.length) return;
        
        sessionRef.child('turn').once('value', s => {
            const currentTurn = s.val();
            const q = shuffledQuestions[qIdx];
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

                    let moveStep = 0;
                    let isCorrect = (txt === q.c);
                    
                    if (isCorrect) {
                        moveStep = 1.5;
                        // Аппак фонду жашыл кылып жаркылдатуу
                        document.getElementById('game-field').style.backgroundColor = "#d4edda";
                    } else {
                        moveStep = -1.0;
                        // Аппак фонду кызыл кылып жаркылдатуу
                        document.getElementById('game-field').style.backgroundColor = "#f8d7da";
                    }
                    
                    setTimeout(() => {
                        document.getElementById('game-field').style.backgroundColor = "#ffffff";
                    }, 400);

                    // Позицияны жана кезекти алмаштыруу
                    const nextTurn = myRole === "boy" ? "girl" : "boy";
                    sessionRef.update({
                        ['pos/' + myRole]: firebase.database.ServerValue.increment(moveStep),
                        turn: nextTurn
                    });

                    qIdx++;
                };
                optArea.appendChild(b);
            });
        });
    }

    // Кезек алмашканда суроону жаңылоо
    sessionRef.child('turn').on('value', () => {
        showQ();
    });

    sessionRef.child('pos').on('value', s => {
        const p = s.val();
        if (p && !gameFinished) {
            const boyPos = 5 + (p.boy || 0);
            const girlPos = 40 + (p.girl || 0);
            
            document.getElementById('boy-container').style.left = boyPos + "%";
            document.getElementById('girl-container').style.left = girlPos + "%";
            
            if (boyPos >= girlPos) checkWinner("ЖИГИТ КУУП ЖЕТТИ! 🏇");
            else if (girlPos >= 90) checkWinner("КЫЗ МААРАГА ЖЕТТИ! 🏁");
        }
    });

    function checkWinner(reason) {
        if (gameFinished) return;
        gameFinished = true;
        sessionRef.child('pos').off();
        sessionRef.child('turn').off();
        
        // Видеолорду токтотуу
        document.getElementById('boyVideo').pause();
        document.getElementById('girlVideo').pause();
        
        const lb = document.getElementById('leaderboard-screen');
        lb.style.display = "flex";
        lb.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 20px; text-align: center; color: #333;">
                <h1 style="margin:0">${reason}</h1>
                <p style="font-size: 18px; margin: 20px 0;">Оюн аяктады</p>
                <button class="btn" style="background: #3498db; color: white;" onclick="location.reload()">МЕНЮГА КАЙТУУ</button>
            </div>
        `;
        setTimeout(() => { sessionRef.remove(); }, 600000);
    }
}
