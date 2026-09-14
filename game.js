/* =========================================================
   GAME HUB — COMPLETE GAME.JS
   Virtual Stars only
========================================================= */

"use strict";

/* =========================
   TELEGRAM
========================= */

const tg = window.Telegram && window.Telegram.WebApp
    ? window.Telegram.WebApp
    : null;

if (tg) {
    tg.ready();
    tg.expand();
}


/* =========================
   STATE
========================= */

const DEFAULT_BALANCE = 1000;

let balance = Number(localStorage.getItem("gh_balance"));

if (!Number.isFinite(balance)) {
    balance = DEFAULT_BALANCE;
}

let taps = Number(localStorage.getItem("gh_taps")) || 0;
let minesWins = Number(localStorage.getItem("gh_minesWins")) || 0;
let totalWon = Number(localStorage.getItem("gh_totalWon")) || 0;
let bestRocket = Number(localStorage.getItem("gh_bestRocket")) || 0;


/* =========================
   MINES
========================= */

const MINES_GROWTH = [
    0.10,
    0.20,
    0.30,
    0.45,
    0.60,
    0.80,
    1.00,
    1.25,
    1.50,
    1.80,
    2.20,
    2.70,
    3.20,
    3.80,
    4.50,
    5.30,
    6.20,
    7.30,
    8.50,
    10.0,
    12.0,
    14.5,
    18.0,
    24.0
];

let minesGame = {
    active: false,
    bet: 0,
    mineCount: 5,
    mines: [],
    opened: [],
    multiplier: 1
};


/* =========================
   ROCKET
========================= */

let rocketGame = {
    active: false,
    bet: 0,
    multiplier: 1,
    crashPoint: 2,
    round: 0,
    countdown: 5,
    timer: null,
    animation: null
};

let rocketHistory = [];


/* =========================
   BASIC HELPERS
========================= */

function $(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const el = $(id);

    if (el) {
        el.textContent = value;
    }
}

function saveState() {
    localStorage.setItem("gh_balance", String(balance));
    localStorage.setItem("gh_taps", String(taps));
    localStorage.setItem("gh_minesWins", String(minesWins));
    localStorage.setItem("gh_totalWon", String(totalWon));
    localStorage.setItem("gh_bestRocket", String(bestRocket));
}

function addBalance(amount) {
    balance += Number(amount);
    balance = Math.max(0, Math.floor(balance));
    saveState();
    updateAllUI();
}

function removeBalance(amount) {
    amount = Math.floor(Number(amount));

    if (amount <= 0 || amount > balance) {
        return false;
    }

    balance -= amount;
    saveState();
    updateAllUI();

    return true;
}


/* =========================
   UI
========================= */

function updateAllUI() {

    document.querySelectorAll("#balance").forEach(el => {
        el.textContent = Math.floor(balance);
    });

    setText("profileBalance", Math.floor(balance));
    setText("profileTaps", taps);
    setText("profileMines", minesWins);
    setText(
        "profileRocket",
        bestRocket > 0 ? bestRocket.toFixed(2) + "x" : "—"
    );
    setText("profileTotalWon", Math.floor(totalWon));

    const maxMines = $("maxMines");
    if (maxMines) {
        maxMines.textContent = "MAX " + Math.floor(balance);
    }

    const maxRocket = $("maxRocket");
    if (maxRocket) {
        maxRocket.textContent = "MAX " + Math.floor(balance);
    }

    updateMinesButtons();
    updateRocketButtons();
}


/* =========================
   PAGES
========================= */

function openPage(page) {

    document.querySelectorAll(".page").forEach(el => {
        el.classList.remove("active");
    });

    const target = $("page-" + page);

    if (target) {
        target.classList.add("active");
    }

    document.querySelectorAll(".navButton").forEach(el => {
        el.classList.remove("active");
    });

    if (page === "games") {
        $("nav-games")?.classList.add("active");
    }

    if (page === "top") {
        $("nav-top")?.classList.add("active");
    }

    if (page === "profile") {
        $("nav-profile")?.classList.add("active");
    }
}

function openGame(game) {

    if (game === "mines") {
        openPage("mines");
    }

    if (game === "rocket") {
        openPage("rocket");
    }
}


/* =========================
   TOAST
========================= */

let toastTimer = null;

function toast(message) {

    const el = $("toast");

    if (!el) {
        return;
    }

    el.textContent = message;
    el.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        el.classList.remove("show");
    }, 1800);
}


/* =========================
   PROFILE TAPPER
========================= */

function tapStar() {

    balance += 100;
    taps++;

    saveState();
    updateAllUI();

    toast("+100 ★");
}


/* =========================
   BET INPUTS
========================= */

function getBetInput(id) {

    const el = $(id);

    if (!el) {
        return 10;
    }

    let value = Math.floor(Number(el.value));

    if (!Number.isFinite(value)) {
        value = 10;
    }

    value = Math.max(10, value);

    if (value > balance) {
        value = balance;
    }

    el.value = value;

    return value;
}

function setBetInput(id, value) {

    const el = $(id);

    if (!el) {
        return;
    }

    if (value === "MAX") {
        value = Math.floor(balance);
    }

    value = Math.floor(Number(value));

    if (!Number.isFinite(value)) {
        value = 10;
    }

    value = Math.max(10, Math.min(balance, value));

    el.value = value;
}

function setQuickBet(id, value) {
    setBetInput(id, value);
    updateAllUI();
}


/* =========================
   MINES SETTINGS
========================= */

function getMinesCount() {

    const input = $("mineCount");

    if (!input) {
        return 5;
    }

    let value = Math.floor(Number(input.value));

    if (!Number.isFinite(value)) {
        value = 5;
    }

    value = Math.max(1, Math.min(24, value));

    input.value = value;

    return value;
}

function updateMinesButtons() {

    const start = $("startMines");
    const cashout = $("cashoutMines");

    if (start) {
        start.disabled = minesGame.active;
    }

    if (cashout) {
        cashout.disabled = !minesGame.active || minesGame.opened.length === 0;
    }
}


/* =========================
   MINES MULTIPLIER
========================= */

function getMinesGrowth() {

    const count = minesGame.mineCount;

    return MINES_GROWTH[count - 1] || 0.10;
}

function getMineMultiplier(safeOpened) {

    if (safeOpened <= 0) {
        return 1;
    }

    const growth = getMinesGrowth();

    return 1 + safeOpened * growth;
}

function updateMinesMultiplier() {

    const multiplier = getMineMultiplier(minesGame.opened.length);

    minesGame.multiplier = multiplier;

    document.querySelectorAll("#mineMultiplier").forEach(el => {
        el.textContent = multiplier.toFixed(2) + "x";
    });
}


/* =========================
   SHUFFLE
========================= */

function shuffle(array) {

    for (let i = array.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
}


/* =========================
   MINES BOARD
========================= */

function createMinesBoard() {

    const board = $("mineBoard");

    if (!board) {
        return;
    }

    board.innerHTML = "";

    for (let i = 0; i < 25; i++) {

        const cell = document.createElement("button");

        cell.className = "mineCell";
        cell.dataset.index = String(i);

        cell.addEventListener("click", () => {
            openMineCell(i);
        });

        board.appendChild(cell);
    }
}

function renderMinesBoard() {

    const board = $("mineBoard");

    if (!board) {
        return;
    }

    const cells = board.querySelectorAll(".mineCell");

    cells.forEach((cell, index) => {

        cell.classList.remove("safe", "mine", "opened");

        cell.textContent = "";

        if (minesGame.opened.includes(index)) {

            if (minesGame.mines.includes(index)) {
                cell.classList.add("mine");
                cell.textContent = "💣";
            } else {
                cell.classList.add("safe");
                cell.classList.add("opened");
                cell.textContent = "★";
            }
        }
    });
}


/* =========================
   START MINES
========================= */

function startMines() {

    if (minesGame.active) {
        return;
    }

    const bet = getBetInput("minesBet");
    const mineCount = getMinesCount();

    if (bet < 10) {
        toast("Минимум 10 ★");
        return;
    }

    if (bet > balance) {
        toast("Недостаточно ★");
        return;
    }

    if (!removeBalance(bet)) {
        return;
    }

    const positions = [];

    for (let i = 0; i < 25; i++) {
        positions.push(i);
    }

    shuffle(positions);

    minesGame = {
        active: true,
        bet: bet,
        mineCount: mineCount,
        mines: positions.slice(0, mineCount),
        opened: [],
        multiplier: 1
    };

    createMinesBoard();
    renderMinesBoard();
    updateMinesMultiplier();
    updateMinesButtons();

    toast("Игра началась!");
}


/* =========================
   OPEN MINE CELL
========================= */

function openMineCell(index) {

    if (!minesGame.active) {
        return;
    }

    if (minesGame.opened.includes(index)) {
        return;
    }

    minesGame.opened.push(index);

    const isMine = minesGame.mines.includes(index);

    if (isMine) {

        revealAllMines();

        minesGame.active = false;

        updateMinesButtons();

        toast("💣 Мина! Ты проиграл.");

        setTimeout(() => {
            startNewMinesBoard();
        }, 900);

        return;
    }

    updateMinesMultiplier();
    renderMinesBoard();

    const safeTotal = 25 - minesGame.mineCount;

    if (minesGame.opened.length >= safeTotal) {
        checkMinesWin();
    }
}


/* =========================
   REVEAL MINES
========================= */

function revealAllMines() {

    const board = $("mineBoard");

    if (!board) {
        return;
    }

    const cells = board.querySelectorAll(".mineCell");

    cells.forEach((cell, index) => {

        if (minesGame.mines.includes(index)) {

            cell.classList.add("mine");
            cell.textContent = "💣";

        } else if (minesGame.opened.includes(index)) {

            cell.classList.add("safe", "opened");
            cell.textContent = "★";
        }
    });
}


/* =========================
   MINES CASHOUT
========================= */

function cashoutMines() {

    if (!minesGame.active) {
        return;
    }

    if (minesGame.opened.length <= 0) {
        toast("Сначала открой клетку");
        return;
    }

    const win = Math.floor(
        minesGame.bet * minesGame.multiplier
    );

    minesGame.active = false;

    addBalance(win);

    totalWon += Math.max(0, win - minesGame.bet);
    minesWins++;

    saveState();
    updateAllUI();

    revealAllMines();
    updateMinesButtons();

    toast("+" + win + " ★");

    setTimeout(() => {
        startNewMinesBoard();
    }, 900);
}

function checkMinesWin() {

    if (!minesGame.active) {
        return;
    }

    const win = Math.floor(
        minesGame.bet * minesGame.multiplier
    );

    minesGame.active = false;

    addBalance(win);

    totalWon += Math.max(0, win - minesGame.bet);
    minesWins++;

    saveState();
    updateAllUI();

    revealAllMines();
    updateMinesButtons();

    toast("Победа! +" + win + " ★");
}

function startNewMinesBoard() {

    minesGame.active = false;

    createMinesBoard();
    updateMinesMultiplier();
    updateMinesButtons();
}


/* =========================
   ROCKET RANDOM
========================= */

function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

function recentLowStreak() {

    const lows = rocketHistory
        .slice(0, 3)
        .map(Number)
        .filter(Number.isFinite);

    if (lows.length < 2) {
        return 0;
    }

    let streak = 0;

    for (const value of lows) {

        if (value <= 1.8) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}




/* =========================
   ROCKET UI
========================= */

function updateRocketMultiplier() {

    setText(
        "rocketMultiplier",
        rocketGame.multiplier.toFixed(2) + "x"
    );
}

function updateRocketStatus(text, className) {

    const el = $("rocketStatus");

    if (!el) {
        return;
    }

    el.textContent = text;

    el.classList.remove(
        "rocketCrash",
        "rocketFlying"
    );

    if (className) {
        el.classList.add(className);
    }
}

function updateRocketButtons() {

    const betButton = $("placeRocketBet");
    const cashoutButton = $("cashoutRocket");

    if (betButton) {
        betButton.disabled =
            rocketGame.bet > 0 ||
            rocketGame.active;
    }

    if (cashoutButton) {
        cashoutButton.disabled =
            !rocketGame.active ||
            rocketGame.bet <= 0;
    }
}
function generateRocketCrashPoint() {

    // Очень редкий супер-раунд
    if (Math.random() < 0.001) {
        return 340.00;
    }

    const streak = recentLowStreak();

    // Если несколько раундов подряд были маленькими,
    // повышаем шанс на более крупный коэффициент.
    if (streak >= 3 && Math.random() < 0.55) {
        return Number(
            randomFloat(2.01, 7.00).toFixed(2)
        );
    }

    const roll = Math.random();

    // 1.01–1.50x — теперь только 25%
    if (roll < 0.25) {
        return Number(
            randomFloat(1.01, 1.50).toFixed(2)
        );
    }

    // 1.51–2.50x — 30%
    if (roll < 0.55) {
        return Number(
            randomFloat(1.51, 2.50).toFixed(2)
        );
    }

    // 2.51–5.00x — 25%
    if (roll < 0.80) {
        return Number(
            randomFloat(2.51, 5.00).toFixed(2)
        );
    }

    // 5.01–10x — 10%
    if (roll < 0.90) {
        return Number(
            randomFloat(5.01, 10.00).toFixed(2)
        );
    }

    // 10.01–25x — 6%
    if (roll < 0.96) {
        return Number(
            randomFloat(10.01, 25.00).toFixed(2)
        );
    }

    // 25.01–100x — 3.5%
    if (roll < 0.995) {
        return Number(
            randomFloat(25.01, 100.00).toFixed(2)
        );
    }

    // 100.01–200x — 0.4%
    if (roll < 0.999) {
        return Number(
            randomFloat(100.01, 200.00).toFixed(2)
        );
    }

    return 340.00;
}

/* =========================
   PLACE ROCKET BET
========================= */

function placeRocketBet() {

    if (rocketGame.bet > 0) {
        toast("Ставка уже сделана");
        return;
    }

    if (rocketGame.active) {
        toast("Раунд уже идёт");
        return;
    }

    const bet = getBetInput("rocketBet");

    if (bet < 10) {
        toast("Минимум 10 ★");
        return;
    }

    if (bet > balance) {
        toast("Недостаточно ★");
        return;
    }

    if (!removeBalance(bet)) {
        return;
    }

    rocketGame.bet = bet;

    updateRocketButtons();

    toast("Ставка " + bet + " ★");
}


/* =========================
   ROCKET CASHOUT
========================= */

function cashoutRocket() {

    if (!rocketGame.active) {
        return;
    }

    if (rocketGame.bet <= 0) {
        return;
    }

    const win = Math.floor(
        rocketGame.bet * rocketGame.multiplier
    );

    addBalance(win);

    totalWon += Math.max(
        0,
        win - rocketGame.bet
    );

    if (rocketGame.multiplier > bestRocket) {
        bestRocket = rocketGame.multiplier;
    }

    saveState();

    rocketGame.bet = 0;

    updateAllUI();
    updateRocketButtons();

    toast("Забрано +" + win + " ★");
}


/* =========================
   ROCKET HISTORY
========================= */

function addRocketHistory(value) {

    rocketHistory.unshift(value);

    if (rocketHistory.length > 15) {
        rocketHistory.length = 15;
    }

    renderRocketHistory();
}

function renderRocketHistory() {

    const container = $("rocketHistory");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    rocketHistory.forEach(value => {

        const item = document.createElement("div");

        item.className = "historyItem";

        if (value < 1.8) {
            item.classList.add("low");
        } else if (value < 5) {
            item.classList.add("medium");
        } else {
            item.classList.add("high");
        }

        item.textContent = value.toFixed(2) + "x";

        container.appendChild(item);
    });
}


/* =========================
   ROCKET VISUAL
========================= */

function resetRocketVisual() {

    const ship = $("rocketShip");
    const trail = $("rocketTrail");

    if (ship) {
        ship.style.left = "28px";
        ship.style.bottom = "30px";
        ship.classList.remove("flying");
    }

    if (trail) {
        trail.style.width = "180px";
    }
}

function animateRocket() {
    const ship = $("rocketShip");
    const trail = $("rocketTrail");

    if (!ship) {
        return;
    }

    const area = ship.parentElement;

    if (!area) {
        return;
    }

    const start = performance.now();

    function frame(now) {
        if (!rocketGame.active) {
            return;
        }

        const elapsed = (now - start) / 1000;

        // Плавный равномерный рост коэффициента
        rocketGame.multiplier = 1 + elapsed * 0.65;

        if (rocketGame.multiplier >= rocketGame.crashPoint) {
            rocketGame.multiplier = rocketGame.crashPoint;

            updateRocketMultiplier();
            crashRocket();
            return;
        }

        updateRocketMultiplier();

        // Размеры области ракеты
        const areaWidth = area.clientWidth;
        const areaHeight = area.clientHeight;

        const shipWidth = ship.offsetWidth || 43;
        const shipHeight = ship.offsetHeight || 43;

        // Максимальные координаты внутри области
        const maxLeft = Math.max(
            28,
            areaWidth - shipWidth - 20
        );

        const maxBottom = Math.max(
            30,
            areaHeight - shipHeight - 20
        );

        // Одинаковая траектория на разных экранах
        const progress = Math.min(
            1,
            elapsed / 12
        );

        const left =
            28 + progress * (maxLeft - 28);

        const bottom =
            30 + progress * (maxBottom - 30);

        ship.style.left =
            left + "px";

        ship.style.bottom =
            bottom + "px";

        if (trail) {
            trail.style.width =
                (180 + progress * 80) + "px";
        }

        rocketGame.animation =
            requestAnimationFrame(frame);
    }

    ship.classList.add("flying");

    rocketGame.animation =
        requestAnimationFrame(frame);
}

/* =========================
   ROCKET ROUND
========================= */

function startRocketRound() {

    if (rocketGame.active) {
        return;
    }

    rocketGame.round++;

    rocketGame.active = true;
    rocketGame.multiplier = 1;
    rocketGame.crashPoint =
        generateRocketCrashPoint();

    resetRocketVisual();

    updateRocketMultiplier();

    updateRocketStatus(
        "Полет!",
        "rocketFlying"
    );

    updateRocketButtons();

    animateRocket();
}

function startRocketCountdown() {

    clearInterval(rocketGame.timer);

    if (rocketGame.active) {
        return;
    }

    rocketGame.countdown = 5;

    updateRocketStatus(
        "Старт через " +
        rocketGame.countdown
    );

    rocketGame.timer = setInterval(() => {

        if (rocketGame.active) {
            clearInterval(rocketGame.timer);
            return;
        }

        rocketGame.countdown--;

        if (rocketGame.countdown <= 0) {

            clearInterval(rocketGame.timer);

            startRocketRound();

        } else {

            updateRocketStatus(
                "Старт через " +
                rocketGame.countdown
            );
        }

    }, 1000);
}


/* =========================
   ROCKET CRASH
========================= */

function crashRocket() {

    if (!rocketGame.active) {
        return;
    }

    rocketGame.active = false;

    if (rocketGame.animation) {
        cancelAnimationFrame(
            rocketGame.animation
        );
    }

    const result = rocketGame.crashPoint;

    rocketGame.multiplier = result;

    updateRocketMultiplier();

    updateRocketStatus(
        "💥 Упала на " +
        result.toFixed(2) +
        "x",
        "rocketCrash"
    );

    addRocketHistory(result);

    /*
       If the player still has a bet,
       it is lost because they did not cash out.
    */

    rocketGame.bet = 0;

    updateAllUI();
    updateRocketButtons();

    setTimeout(() => {

        resetRocketVisual();

        startRocketCountdown();

    }, 1800);
}


/* =========================
   LEADERBOARD
========================= */

function updateLeaderboard() {

    const board = $("leaderboard");

    if (!board) {
        return;
    }

    const name =
        tg &&
        tg.initDataUnsafe &&
        tg.initDataUnsafe.user
            ? (
                tg.initDataUnsafe.user.first_name ||
                "Игрок"
            )
            : "Игрок";


    const players = [

        {
            name: "RocketMaster",
            score: 15420,
            avatar: "R",
            avatarClass: "gold"
        },

        {
            name: "StarKing",
            score: 12100,
            avatar: "S",
            avatarClass: "blue"
        },

        {
            name: "PlayerOne",
            score: 9800,
            avatar: "P",
            avatarClass: "pink"
        },

        {
            name: name,
            score: Math.floor(balance),
            avatar: name
                .charAt(0)
                .toUpperCase(),
            avatarClass: "user"
        }

    ];


    players.sort(
        (a, b) => b.score - a.score
    );


    board.innerHTML = "";


    players.forEach((player, index) => {

        const row =
            document.createElement("div");

        row.className =
            "leaderRow";


        const avatar =
            document.createElement("div");

        avatar.className =
            "leaderAvatar " +
            player.avatarClass;

        avatar.textContent =
            player.avatar;


        const place =
            document.createElement("div");

        place.className =
            "leaderPlace";

        place.textContent =
            index + 1;


        const nameElement =
            document.createElement("div");

        nameElement.className =
            "leaderName";

        nameElement.textContent =
            player.name;


        const score =
            document.createElement("div");

        score.className =
            "leaderScore";

        score.textContent =
            player.score.toLocaleString("ru-RU") +
            " ★";


        row.appendChild(place);

        row.appendChild(avatar);

        row.appendChild(nameElement);

        row.appendChild(score);


        board.appendChild(row);

    });

}


function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================
   PROFILE
========================= */

function updateProfile() {

    let name = "Игрок";

    if (
        tg &&
        tg.initDataUnsafe &&
        tg.initDataUnsafe.user
    ) {
        name =
            tg.initDataUnsafe.user.first_name ||
            "Игрок";
    }

    setText("profileName", name);

    updateAllUI();
}


/* =========================
   INPUTS
========================= */

function setupInputs() {

    const mineCount = $("mineCount");

    if (mineCount) {

        mineCount.addEventListener(
            "change",
            () => {

                let value =
                    Math.floor(
                        Number(mineCount.value)
                    );

                if (!Number.isFinite(value)) {
                    value = 5;
                }

                value =
                    Math.max(
                        1,
                        Math.min(24, value)
                    );

                mineCount.value = value;

                if (!minesGame.active) {
                    minesGame.mineCount =
                        value;

                    updateMinesMultiplier();
                }
            }
        );
    }


    const minesBet = $("minesBet");

    if (minesBet) {

        minesBet.addEventListener(
            "change",
            () => getBetInput("minesBet")
        );
    }


    const rocketBet = $("rocketBet");

    if (rocketBet) {

        rocketBet.addEventListener(
            "change",
            () => getBetInput("rocketBet")
        );
    }
}


/* =========================
   INIT
========================= */

function initGame() {

    setupInputs();

    createMinesBoard();

    updateMinesMultiplier();

    renderRocketHistory();

    updateProfile();

    updateLeaderboard();

    resetRocketVisual();

    updateAllUI();

    updateRocketStatus(
        "Подготовка..."
    );

    /*
       Start Rocket countdown automatically.
    */

    setTimeout(() => {
        startRocketCountdown();
    }, 800);

    console.log(
        "GAME HUB initialized successfully"
    );
}


/* =========================
   START
========================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initGame
    );

} else {

    initGame();
}
