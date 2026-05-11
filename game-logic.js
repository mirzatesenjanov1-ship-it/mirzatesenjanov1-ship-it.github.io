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
    myName = document.getElementById('player-name').value.trim();
    if (!myName) return alert("Атыңызды жазыңыз!");
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
        status: "waiting" 
    });

    // Кыз кошулганда синхрондоштурууга өтүү
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
            startSync();
        } else { 
            alert("Бөлмө табылган жок же бөлмө толуп калган!"); 
        }
    });
}

function startSync() {
    document.getElementById('setup-screen').style.display = "none";
    document.getElementById('sync-overlay').style.display = "flex";
    
    // Эки оюнчу тең "Даярмын" баскычын басканын көзөмөлдөө
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

function launch() {
    document.getElementById('sync-overlay').style.display = "none";
    // Эгер index.html'де бул ID'лер болсо, аларды көрсөтүү
    const topUI = document.getElementById('ui-top');
    const bottomUI = document.getElementById('ui-bottom');
    if(topUI) topUI.style.display = "block";
    if(bottomUI) bottomUI.style.display = "flex";
    
    renderGame();
}

function renderGame() {
    let qIdx = 0;
    let gameFinished = false;
    const questions = allQuestions[selectedLevelIdx] || [];

    // Суроолорду туш келди аралаштыруу (опция)
    const shuffledQuestions = questions.sort(() => Math.random() - 0.5);

    function showQ() {
        if (gameFinished || qIdx >= shuffledQuestions.length) return;
        
        const q = shuffledQuestions[qIdx];
        document.getElementById('q-text').innerText = q.q;
        const optArea = document.getElementById('options');
        optArea.innerHTML = "";
        
        // Жоопторду да аралаштырып чыгаруу
        q.a.forEach(txt => {
            const b = document.createElement('button');
            b.className = 'btn opt-btn'; 
            b.innerText = txt;
            b.onclick = () => {
                let moveStep = 0;
                if (txt === q.c) {
                    moveStep = 1.5; // Туура жооп: алдыга (бир аз көбөйтүлдү)
                    b.style.background = "#2ecc71";
                } else {
                    moveStep = -1.0; // Ката жооп: артка
                    b.style.background = "#e74c3c";
                }
                
                // Позицияны жаңыртуу
                sessionRef.child('pos/' + myRole).transaction(p => {
                    let newPos = (p || 0) + moveStep;
                    if (newPos < 0) newPos = 0; // Артка кеткенде нөлдөн ашпайт
                    return newPos;
                });
                
                // Кийинки суроого өтүү
                setTimeout(() => { 
                    qIdx++; 
                    if(qIdx < shuffledQuestions.length) {
                        showQ(); 
                    } else {
                        checkWinner("Суроолор бүттү!");
                    }
                }, 600);
            };
            optArea.appendChild(b);
        });
    }
    showQ();

    // Аттардын кыймылын көзөмөлдөө (Firebase аркылуу реалдуу убакытта)
    sessionRef.child('pos').on('value', s => {
        const p = s.val();
        if (p && !gameFinished) {
            // Кыймылдын чектери (экранга жараша)
            const boyPos = 5 + (p.boy || 0);
            const girlPos = 40 + (p.girl || 0);
            
            document.getElementById('boy-container').style.left = boyPos + "%";
            document.getElementById('girl-container').style.left = girlPos + "%";
            
            // ЖЕҢИШ ШАРТТАРЫ
            if (boyPos >= girlPos) {
                checkWinner("ЖИГИТ КУУП ЖЕТТИ! 🏇");
            } else if (girlPos >= 90) {
                checkWinner("КЫЗ МААРАГА ЖЕТТИ! 🏁");
            }
        }
    });

    function checkWinner(reason) {
        if (gameFinished) return;
        gameFinished = true;
        
        // Firebase байланышын үзүү
        sessionRef.child('pos').off();
        
        const lb = document.getElementById('leaderboard-screen');
        lb.style.display = "flex";
        lb.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 20px; text-align: center; color: #333;">
                <h1 style="margin:0">${reason}</h1>
                <p style="font-size: 18px; margin: 20px 0;">Оюн аяктады</p>
                <button class="btn" style="background: #3498db; color: white;" onclick="location.reload()">МЕНЮГА КАЙТУУ</button>
            </div>
        `;
        
        // Оюн бүткөндөн кийин 10 мүнөттөн соң маалыматтарды өчүрүү (автоматтык тазалоо)
        setTimeout(() => { sessionRef.remove(); }, 600000);
    }
}
