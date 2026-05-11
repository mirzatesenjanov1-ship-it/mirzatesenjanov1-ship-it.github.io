// game-logic.js
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
    document.getElementById('wait-status').innerHTML = `КОД: ${code}<br>Күтүңүз...`;
    sessionRef = firebase.database().ref('rooms/' + code);
    sessionRef.set({ players: { boy: myName }, sync: { boy: false, girl: false }, pos: { boy: 0, girl: 0 }, level: selectedLevelIdx });
    sessionRef.child('players/girl').on('value', s => { if(s.exists()) startSync(); });
}

function joinRoom() {
    myName = document.getElementById('player-name').value;
    const code = document.getElementById('room-input').value;
    if (!myName || !code) return alert("Маалыматты толтуруңуз!");
    myRole = "girl";
    sessionRef = firebase.database().ref('rooms/' + code);
    sessionRef.once('value', s => {
        if (s.exists() && !s.val().players.girl) {
            selectedLevelIdx = s.val().level;
            sessionRef.child('players/girl').set(myName);
            startSync();
        } else { alert("Ката!"); }
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

function startCountdown() {
    gameActive = true;
    let c = 3;
    const timer = setInterval(() => {
        document.getElementById('countdown').innerText = c > 0 ? c : "GO!";
        if (c === 0) { clearInterval(timer); setTimeout(launch, 500); }
        c--;
    }, 1000);
}

function launch() {
    document.getElementById('menuMusic').pause();
    document.getElementById('sync-overlay').style.display = "none";
    document.getElementById('ui-top').style.display = "block";
    document.getElementById('ui-bottom').style.display = "flex";
    document.getElementById('bgMusic').play();
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
                if (txt === q.c) {
                    let step = (myRole === 'boy' ? 1.0 : 0.8);
                    sessionRef.child('pos/' + myRole).transaction(p => (p || 0) + step);
                    b.classList.add('correct-flash');
                    setTimeout(() => { qIdx++; showQ(); }, 400);
                } else { b.classList.add('wrong-flash'); }
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
        const screen = document.getElementById('leaderboard-screen');
        screen.style.display = "flex";
        screen.innerHTML = `<h1>ОЮН БҮТТҮ!</h1><p>${reason}</p><button onclick="location.reload()">Меню</button>`;
    }
}
