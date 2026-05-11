let myRole = "", myName = "", sessionRef = null, gameActive = false;
let selectedLevelIdx = null;
const levelNames = ["МЕХАНИКА", "МОЛЕКУЛАЛЫК ФИЗИКА", "ЭЛЕКТРОДИНАМИКА", "ТЕРМЕЛҮҮЛӨР", "ОПТИКА", "АТОМДУК ФИЗИКА", "АСТРОНОМИЯ"];

function selectLevel(idx) {
    selectedLevelIdx = idx;
    document.getElementById('level-screen').style.display = "none";
    document.getElementById('setup-screen').style.display = "flex";
    document.getElementById('display-level-name').innerText = levelNames[idx];
}

function createRoom() {
    myName = document.getElementById('player-name').value;
    if (!myName) return alert("Атыңызды жазыңыз!");
    myRole = "boy";
    const code = Math.floor(100 + Math.random() * 899);
    document.getElementById('room-controls').style.display = "none";
    document.getElementById('wait-status').innerHTML = `БӨЛМӨ КОДУ: <b>${code}</b><br>Күтүңүз...`;
    sessionRef = firebase.database().ref('rooms/' + code);
    sessionRef.set({ players: { boy: myName }, sync: { boy: false, girl: false }, pos: { boy: 0, girl: 0 }, level: selectedLevelIdx });
    sessionRef.child('players/girl').on('value', s => { if(s.exists()) startSync(); });
}

function joinRoom() {
    myName = document.getElementById('player-name').value;
    const code = document.getElementById('room-input').value;
    if (!myName || !code) return alert("Атыңызды жана кодду жазыңыз!");
    myRole = "girl";
    sessionRef = firebase.database().ref('rooms/' + code);
    sessionRef.once('value', s => {
        if (s.exists() && !s.val().players.girl) {
            selectedLevelIdx = s.val().level;
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

function triggerReady() { sessionRef.child('sync/' + myRole).set(true); }

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
    document.getElementById('sync-overlay').style.display = "none";
    document.getElementById('ui-top').style.display = "block";
    document.getElementById('ui-bottom').style.display = "flex";
    renderGame();
}

function renderGame() {
    let qIdx = 0;
    let gameFinished = false;
    const questions = allQuestions[selectedLevelIdx] || [];

    function showQ() {
        if (gameFinished || qIdx >= questions.length) return;
        const q = questions[qIdx];
        document.getElementById('q-text').innerText = q.q;
        const optArea = document.getElementById('options');
        optArea.innerHTML = "";
        
        q.a.forEach(txt => {
            const b = document.createElement('button');
            b.className = 'btn'; b.innerText = txt;
            b.onclick = () => {
                let moveStep = 0;
                if (txt === q.c) {
                    moveStep = 1.2; // ТУУРА ЖООП: АЛДЫГА
                    b.classList.add('correct-flash');
                } else {
                    moveStep = -0.8; // КАТА ЖООП: АРТКА
                    b.classList.add('wrong-flash');
                }
                
                sessionRef.child('pos/' + myRole).transaction(p => {
                    let newPos = (p || 0) + moveStep;
                    return newPos < 0 ? 0 : newPos; // Позиция 0дөн аз болбошу керек
                });
                
                setTimeout(() => { qIdx++; if(qIdx < questions.length) showQ(); else checkWinner("Суроолор бүттү!"); }, 500);
            };
            optArea.appendChild(b);
        });
    }
    showQ();

    sessionRef.child('pos').on('value', s => {
        const p = s.val();
        if (p && !gameFinished) {
            const boyPos = 5 + (p.boy || 0);
            const girlPos = 45 + (p.girl || 0);
            document.getElementById('boy-container').style.left = boyPos + "%";
            document.getElementById('girl-container').style.left = girlPos + "%";
            
            if (boyPos >= girlPos) checkWinner("Жигит кууп жетти!");
            else if (girlPos >= 85) checkWinner("Кыз маарага жетти!");
        }
    });

    function checkWinner(reason) {
        if (gameFinished) return;
        gameFinished = true;
        document.getElementById('leaderboard-screen').style.display = "flex";
        document.getElementById('leaderboard-screen').innerHTML = `<h2>${reason}</h2><button class="secondary-btn" onclick="location.reload()">Меню</button>`;
    }
}
