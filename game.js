/* =========================================================
   GAME HUB — GAME LOGIC
   Версия 1.1
   Все ★ виртуальные.
========================================================= */

"use strict";

/* =========================================================
   TELEGRAM
========================================================= */

const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
}

/* =========================================================
   STORAGE
========================================================= */

const STORAGE_KEY = "game_hub_data_v1";

const defaultData = {
    balance: 1000,
    taps: 0,

    minesPlayed: 0,
    minesWins: 0,
    minesBest: 0,

    rocketPlayed: 0,
    rocketWins: 0,
    rocketBest: 0,

    totalWon: 0,
    totalLost: 0,

    rocketHistory: [],
    achievements: []
};

function loadData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            return { ...defaultData };
        }

        return {
            ...defaultData,
            ...JSON.parse(saved)
        };

    } catch (e) {
        console.error(e);
        return { ...defaultData };
    }
}

let data = loadData();

function saveData() {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
    );

    updateAllUI();
}

/* =========================================================
   TELEGRAM USER
========================================================= */

function getTelegramUser() {

    const user = tg?.initDataUnsafe?.user;

    if (user) {
        return {
            id: user.id,
            name:
                user.first_name ||
                user.username ||
                "Игрок",
            username: user.username || ""
        };
    }

    return {
        id: "local",
        name: "Игрок",
        username: ""
    };
}

const currentUser = getTelegramUser();

/* =========================================================
   DOM
========================================================= */

function $(id) {
    return document.getElementById(id);
}

function setText(id, value) {

    const element = $(id);

    if (element) {
        element.textContent = value;
    }
}

/* =========================================================
   TOAST
========================================================= */

let toastTimer = null;

function toast(message) {

    const element = $("toast");

    if (!element) return;

    element.textContent = message;
    element.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        element.classList.remove("show");
    }, 2200);
}

/* =========================================================
   BALANCE
========================================================= */

function addBalance(amount) {

    amount = Math.floor(Number(amount));

    if (!Number.isFinite(amount) || amount <= 0) {
        return;
    }

    data.balance += amount;
    data.totalWon += amount;

    saveData();
}

function removeBalance(amount) {

    amount = Math.floor(Number(amount));

    if (!Number.isFinite(amount) || amount <= 0) {
        return false;
    }

    if (data.balance < amount) {
        return false;
    }

    data.balance -= amount;
    data.totalLost += amount;

    saveData();

    return true;
}

/* =========================================================
   UI
========================================================= */

function updateAllUI() {

    setText(
        "balance",
        Math.floor(data.balance).toLocaleString("ru-RU")
    );

    setText(
        "profileBalance",
        Math.floor(data.balance).toLocaleString("ru-RU")
    );

    setText(
        "profileName",
        currentUser.name
    );

    setText(
        "profileTaps",
        data.taps.toLocaleString("ru-RU")
    );

    setText(
        "profileMines",
        data.minesWins.toLocaleString("ru-RU")
    );

    setText(
        "profileRocket",
        data.rocketBest
            ? data.rocketBest.toFixed(2) + "x"
            : "—"
    );

    setText(
        "profileTotalWon",
        data.totalWon.toLocaleString("ru-RU")
    );

    updateQuickBets();
    updateLeaderboard();
}

/* =========================================================
   NAVIGATION
========================================================= */

function openPage(pageName) {

    document
        .querySelectorAll(".page")
        .forEach(page => {
            page.classList.remove("active");
        });

    const page = $(`page-${pageName}`);

    if (page) {
        page.classList.add("active");
    }

    document
        .querySelectorAll(".navButton")
        .forEach(button => {
            button.classList.remove("active");
        });

    const nav = $(`nav-${pageName}`);

    if (nav) {
        nav.classList.add("active");
    }
}

function openGame(gameName) {

    if (gameName === "mines") {
        openPage("mines");
    }

    if (gameName === "rocket") {
        openPage("rocket");
    }
}

/* =========================================================
   TAPPER
========================================================= */

function tapStar() {

    data.taps++;
    data.balance += 100;

    saveData();

    toast("+100 ★");

    checkAchievements();
}

/* =========================================================
   BET INPUT
========================================================= */

function getBetInput(id) {

    const input = $(id);

    if (!input) {
        return 0;
    }

    let value = Math.floor(Number(input.value));

    if (!Number.isFinite(value)) {
        value = 0;
    }

    return value;
}

function setBetInput(id, value) {

    const input = $(id);

    if (!input) return;

    input.value = Math.floor(value);
}

function setQuickBet(inputId, value) {

    const input = $(inputId);

    if (!input) return;

    if (value === "MAX") {
        input.value = Math.floor(data.balance);
    } else {
        input.value = value;
    }
}

function updateQuickBets() {

    const mines = $("maxMines");

    if (mines) {
        mines.textContent =
            "MAX " +
            Math.floor(data.balance)
                .toLocaleString("ru-RU");
    }

    const rocket = $("maxRocket");

    if (rocket) {
        rocket.textContent =
            "MAX " +
            Math.floor(data.balance)
                .toLocaleString("ru-RU");
    }
}

/* =========================================================
   MINES
========================================================= */

/*
   Рост коэффициента за каждую безопасную клетку.

   24 мины:
   1 безопасная клетка = 25x.

   Формула:

   1 + safeOpened * growth
*/

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
    mines: 5,
    cells: [],
    safeOpened: 0,
    multiplier: 1
};

function getMinesGrowth(mines) {

    mines = Math.max(
        1,
        Math.min(24, Math.floor(mines))
    );

    return MINES_GROWTH[mines - 1];
}

function getMineMultiplier(mines, safeOpened) {

    if (safeOpened <= 0) {
        return 1;
    }

    return 1 +
        safeOpened *
        getMinesGrowth(mines);
}

function shuffle(array) {

    for (
        let i = array.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(Math.random() * (i + 1));

        [
            array[i],
            array[j]
        ] = [
            array[j],
            array[i]
        ];
    }

    return array;
}

function createMinesBoard() {

    const input = $("mineCount");

    let mineCount =
        Math.floor(Number(input?.value || 5));

    if (!Number.isFinite(mineCount)) {
        mineCount = 5;
    }

    mineCount = Math.max(
        1,
        Math.min(24, mineCount)
    );

    if (input) {
        input.value = mineCount;
    }

    const positions =
        Array.from(
            { length: 25 },
            (_, i) => i
        );

    shuffle(positions);

    const minePositions =
        positions.slice(0, mineCount);

    minesGame.mines = mineCount;

    minesGame.cells =
        Array.from(
            { length: 25 },
            (_, index) => ({
                index,
                mine:
                    minePositions.includes(index),
                open: false
            })
        );

    minesGame.safeOpened = 0;
    minesGame.multiplier = 1;

    renderMinesBoard();
    updateMinesMultiplier();
}

function renderMinesBoard() {

    const board = $("mineBoard");

    if (!board) return;

    board.innerHTML = "";

    minesGame.cells.forEach(cell => {

        const button =
            document.createElement("button");

        button.className = "mineCell";

        button.dataset.index =
            cell.index;

        button.textContent = "•";

        button.addEventListener(
            "click",
            () => openMineCell(cell.index)
        );

        board.appendChild(button);
    });
}

function startMines() {

    if (minesGame.active) {
        return;
    }

    const bet =
        getBetInput("minesBet");

    if (bet < 10) {
        toast("Минимум 10 ★");
        return;
    }

    if (bet > data.balance) {
        toast("Недостаточно ★");
        return;
    }

    if (!removeBalance(bet)) {
        toast("Не удалось поставить ★");
        return;
    }

    minesGame.active = true;
    minesGame.bet = bet;

    data.minesPlayed++;

    createMinesBoard();

    updateMinesButtons();

    toast("Игра началась");
}

function openMineCell(index) {

    if (!minesGame.active) {
        return;
    }

    const cell =
        minesGame.cells[index];

    if (!cell || cell.open) {
        return;
    }

    const board = $("mineBoard");

    const button =
        board?.querySelector(
            `[data-index="${index}"]`
        );

    if (!button) return;

    cell.open = true;

    /* МИНА */

    if (cell.mine) {

        button.classList.add(
            "open",
            "mine"
        );

        button.textContent = "💣";

        revealAllMines();

        minesGame.active = false;
        minesGame.bet = 0;
        minesGame.multiplier = 1;

        updateMinesButtons();
        updateMinesMultiplier();

        toast("💥 Мина! Ставка потеряна");

        return;
    }

    /* БЕЗОПАСНАЯ КЛЕТКА */

    button.classList.add(
        "open",
        "safe"
    );

    button.textContent = "✓";

    minesGame.safeOpened++;

    minesGame.multiplier =
        getMineMultiplier(
            minesGame.mines,
            minesGame.safeOpened
        );

    updateMinesMultiplier();

    checkMinesWin();
}

function revealAllMines() {

    const board = $("mineBoard");

    if (!board) return;

    minesGame.cells.forEach(cell => {

        if (!cell.mine) return;

        const button =
            board.querySelector(
                `[data-index="${cell.index}"]`
            );

        if (!button) return;

        button.classList.add(
            "open",
            "mine"
        );

        button.textContent = "💣";
    });
}

function cashoutMines() {

    if (!minesGame.active) {
        return;
    }

    if (minesGame.safeOpened <= 0) {
        toast("Открой хотя бы одну клетку");
        return;
    }

    const result =
        Math.floor(
            minesGame.bet *
            minesGame.multiplier
        );

    addBalance(result);

    data.minesWins++;

    data.minesBest =
        Math.max(
            data.minesBest,
            minesGame.multiplier
        );

    minesGame.active = false;
    minesGame.bet = 0;

    updateMinesButtons();

    toast(
        `Вы выиграли ${result.toLocaleString("ru-RU")} ★`
    );

    saveData();
}

function checkMinesWin() {

    const safeCells =
        25 - minesGame.mines;

    if (
        minesGame.safeOpened >=
        safeCells
    ) {

        const result =
            Math.floor(
                minesGame.bet *
                minesGame.multiplier
            );

        addBalance(result);

        data.minesWins++;

        data.minesBest =
            Math.max(
                data.minesBest,
                minesGame.multiplier
            );

        minesGame.active = false;
        minesGame.bet = 0;

        updateMinesButtons();

        toast(
            `🎉 Поле пройдено! +${result.toLocaleString("ru-RU")} ★`
        );

        saveData();
    }
}

function updateMinesMultiplier() {

    setText(
        "mineMultiplier",
        minesGame.multiplier.toFixed(2) + "x"
    );
}

function updateMinesButtons() {

    const start = $("startMines");
    const cashout = $("cashoutMines");

    if (start) {
        start.disabled =
            minesGame.active;
    }

    if (cashout) {

        cashout.disabled =
            !minesGame.active ||
            minesGame.safeOpened === 0;

        if (minesGame.active) {

            cashout.textContent =
                `Забрать ${Math.floor(
                    minesGame.bet *
                    minesGame.multiplier
                ).toLocaleString("ru-RU")} ★`;

        } else {

            cashout.textContent =
                "Забрать";
        }
    }
}

/* =========================================================
   ROCKET
========================================================= */

let rocketState = "waiting";

let rocketGame = {
    bet: 0,
    hasBet: false,
    cashedOut: false,

    multiplier: 1,
    crashPoint: 1.5,

    startTime: 0,
    roundNumber: 0,

    countdownTimer: null,
    animationFrame: null
};

let rocketBigCounters = {
    since10: 0,
    since20: 0,
    since30: 0,
    since50: 0,
    since100: 0
};

function randomFloat(min, max) {

    return min +
        Math.random() *
        (max - min);
}

function recentLowStreak() {

    const history =
        data.rocketHistory || [];

    let streak = 0;

    for (
        let i = history.length - 1;
        i >= 0;
        i--
    ) {

        if (Number(history[i]) <= 1.8) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}

/*
   Генерация результата Rocket.

   Важное:
   результат НЕ зависит от ставки игрока.

   После 2–3 маленьких значений
   шанс следующего результата выше 2x
   становится больше.

   Большие коэффициенты имеют
   плавающие интервалы.
*/

function generateRocketCrashPoint() {

    /* Очень редкий максимум */

    if (Math.random() < 0.001) {
        return 340;
    }

    rocketBigCounters.since10++;
    rocketBigCounters.since20++;
    rocketBigCounters.since30++;
    rocketBigCounters.since50++;
    rocketBigCounters.since100++;

    const lowStreak =
        recentLowStreak();

    /* После серии маленьких */

    if (lowStreak >= 3) {

        if (Math.random() < 0.72) {

            return Number(
                randomFloat(2.05, 7.5)
                    .toFixed(2)
            );
        }
    }

    if (lowStreak === 2) {

        if (Math.random() < 0.58) {

            return Number(
                randomFloat(2.05, 6.5)
                    .toFixed(2)
            );
        }
    }

    /* 100x */

    if (
        rocketBigCounters.since100 >=
        Math.floor(randomFloat(145, 210))
    ) {

        rocketBigCounters.since100 = 0;

        return Number(
            randomFloat(100, 180)
                .toFixed(2)
        );
    }

    /* 50x */

    if (
        rocketBigCounters.since50 >=
        Math.floor(randomFloat(90, 125))
    ) {

        rocketBigCounters.since50 = 0;

        return Number(
            randomFloat(50, 95)
                .toFixed(2)
        );
    }

    /* 30x */

    if (
        rocketBigCounters.since30 >=
        Math.floor(randomFloat(58, 82))
    ) {

        rocketBigCounters.since30 = 0;

        return Number(
            randomFloat(30, 65)
                .toFixed(2)
        );
    }

    /* 20x */

    if (
        rocketBigCounters.since20 >=
        Math.floor(randomFloat(37, 53))
    ) {

        rocketBigCounters.since20 = 0;

        return Number(
            randomFloat(20, 42)
                .toFixed(2)
        );
    }

    /* 10x */

    if (
        rocketBigCounters.since10 >=
        Math.floor(randomFloat(17, 26))
    ) {

        rocketBigCounters.since10 = 0;

        return Number(
            randomFloat(10, 19)
                .toFixed(2)
        );
    }

    /* Обычное распределение */

    const roll = Math.random();

    if (roll < 0.48) {

        return Number(
            randomFloat(1.01, 1.80)
                .toFixed(2)
        );
    }

    if (roll < 0.76) {

        return Number(
            randomFloat(1.81, 2.80)
                .toFixed(2)
        );
    }

    if (roll < 0.91) {

        return Number(
            randomFloat(2.81, 5.00)
                .toFixed(2)
        );
    }

    if (roll < 0.975) {

        return Number(
            randomFloat(5.01, 10.00)
                .toFixed(2)
        );
    }

    return Number(
        randomFloat(10.01, 18.00)
            .toFixed(2)
    );
}

/* =========================================================
   ROCKET UI
========================================================= */

function updateRocketMultiplier() {

    setText(
        "rocketMultiplier",
        rocketGame.multiplier.toFixed(2) + "x"
    );
}

function updateRocketStatus(text) {

    setText(
        "rocketStatus",
        text
    );
}

function updateRocketButtons() {

    const place =
        $("placeRocketBet");

    const cashout =
        $("cashoutRocket");

    if (place) {

        place.disabled =
            rocketState !== "waiting" ||
            rocketGame.hasBet;
    }

    if (cashout) {

        cashout.disabled =
            rocketState !== "flying" ||
            !rocketGame.hasBet ||
            rocketGame.cashedOut;

        if (
            rocketState === "flying" &&
            rocketGame.hasBet &&
            !rocketGame.cashedOut
        ) {

            cashout.textContent =
                `Забрать ${Math.floor(
                    rocketGame.bet *
                    rocketGame.multiplier
                ).toLocaleString("ru-RU")} ★`;

        } else {

            cashout.textContent =
                "Забрать";
        }
    }
}

/* =========================================================
   ROCKET BET
========================================================= */

function placeRocketBet() {

    if (rocketState !== "waiting") {
        toast("Ставки принимаются только до запуска");
        return;
    }

    if (rocketGame.hasBet) {
        return;
    }

    const bet =
        getBetInput("rocketBet");

    if (bet < 10) {
        toast("Минимум 10 ★");
        return;
    }

    if (bet > data.balance) {
        toast("Недостаточно ★");
        return;
    }

    if (!removeBalance(bet)) {
        toast("Не удалось поставить ★");
        return;
    }

    rocketGame.bet = bet;
    rocketGame.hasBet = true;
    rocketGame.cashedOut = false;

    data.rocketPlayed++;

    updateRocketButtons();

    toast(
        `Ставка ${bet.toLocaleString("ru-RU")} ★ принята`
    );
}

/* =========================================================
   ROCKET CASHOUT
========================================================= */

function cashoutRocket() {

    if (rocketState !== "flying") {
        return;
    }

    if (!rocketGame.hasBet) {
        return;
    }

    if (rocketGame.cashedOut) {
        return;
    }

    const result =
        Math.floor(
            rocketGame.bet *
            rocketGame.multiplier
        );

    rocketGame.cashedOut = true;

    addBalance(result);

    data.rocketWins++;

    data.rocketBest =
        Math.max(
            data.rocketBest,
            rocketGame.multiplier
        );

    updateRocketButtons();

    toast(
        `Вы выиграли ${result.to
                           return Number(
        randomFloat(10.01, 18.00)
            .toFixed(2)
    );
}


/* =========================================================
   ROCKET UI
========================================================= */

function updateRocketMultiplier() {

    setText(
        "rocketMultiplier",
        rocketGame.multiplier.toFixed(2) + "x"
    );
}


function updateRocketStatus(text) {

    setText(
        "rocketStatus",
        text
    );
}


function updateRocketButtons() {

    const place =
        $("placeRocketBet");

    const cashout =
        $("cashoutRocket");

    if (place) {

        place.disabled =
            rocketState !== "waiting" ||
            rocketGame.hasBet;
    }

    if (cashout) {

        cashout.disabled =
            rocketState !== "flying" ||
            !rocketGame.hasBet ||
            rocketGame.cashedOut;

        if (
            rocketState === "flying" &&
            rocketGame.hasBet &&
            !rocketGame.cashedOut
        ) {

            cashout.textContent =
                `Забрать ${Math.floor(
                    rocketGame.bet *
                    rocketGame.multiplier
                ).toLocaleString("ru-RU")} ★`;

        } else {

            cashout.textContent = "Забрать";
        }
    }
}


/* =========================================================
   ROCKET BET
========================================================= */

function placeRocketBet() {

    if (rocketState !== "waiting") {
        toast("Ставки принимаются только до запуска");
        return;
    }

    if (rocketGame.hasBet) {
        return;
    }

    const bet =
        getBetInput("rocketBet");

    if (bet < 10) {
        toast("Минимум 10 ★");
        return;
    }

    if (bet > data.balance) {
        toast("Недостаточно ★");
        return;
    }

    if (!removeBalance(bet)) {
        toast("Не удалось поставить ★");
        return;
    }

    rocketGame.bet = bet;
    rocketGame.hasBet = true;
    rocketGame.cashedOut = false;

    data.rocketPlayed += 1;

    updateRocketButtons();

    toast(
        `Ставка ${bet.toLocaleString("ru-RU")} ★ принята`
    );
}


/* =========================================================
   ROCKET CASHOUT
========================================================= */

function cashoutRocket() {

    if (rocketState !== "flying") {
        return;
    }

    if (!rocketGame.hasBet) {
        return;
    }

    if (rocketGame.cashedOut) {
        return;
    }

    const result =
        Math.floor(
            rocketGame.bet *
            rocketGame.multiplier
        );

    rocketGame.cashedOut = true;

    addBalance(result);

    data.rocketWins += 1;

    data.rocketBest =
        Math.max(
            data.rocketBest,
            rocketGame.multiplier
        );

    updateRocketButtons();

    toast(
        `Вы выиграли ${result.toLocaleString("ru-RU")} ★`
    );

    saveData();
}


/* =========================================================
   ROCKET HISTORY
========================================================= */

function addRocketHistory(value) {

    if (!Array.isArray(data.rocketHistory)) {
        data.rocketHistory = [];
    }

    data.rocketHistory.push(value);

    if (data.rocketHistory.length > 30) {
        data.rocketHistory.shift();
    }

    renderRocketHistory();

    saveData();
}


function renderRocketHistory() {

    const element =
        $("rocketHistory");

    if (!element) {
        return;
    }

    element.innerHTML = "";

    const history =
        data.rocketHistory || [];

    history
        .slice(-12)
        .reverse()
        .forEach(value => {

            const item =
                document.createElement("div");

            item.className =
                "historyItem";

            item.textContent =
                Number(value).toFixed(2) + "x";

            element.appendChild(item);
        });
}


/* =========================================================
   ROCKET VISUAL
========================================================= */

function resetRocketVisual() {

    const ship =
        $("rocketShip");

    const trail =
        $("rocketTrail");

    if (ship) {

        ship.style.left = "8%";
        ship.style.bottom = "10%";

        ship.style.transform =
            "translate(-50%, 50%) rotate(-25deg)";
    }

    if (trail) {
        trail.style.width = "0%";
    }
}


function animateRocket(timestamp) {

    if (rocketState !== "flying") {
        return;
    }

    const elapsed =
        timestamp - rocketGame.startTime;

    const seconds =
        elapsed / 1000;

    const progress =
        Math.min(
            0.96,
            seconds / 12
        );

    rocketGame.multiplier =
        Math.min(
            rocketGame.crashPoint,

            Number(
                (
                    1 +
                    (rocketGame.crashPoint - 1) *
                    progress
                ).toFixed(2)
            )
        );

    updateRocketMultiplier();
    updateRocketButtons();

    const ship =
        $("rocketShip");

    const trail =
        $("rocketTrail");

    if (ship) {

        const x =
            8 + progress * 78;

        const y =
            10 + progress * 72;

        ship.style.left = `${x}%`;
        ship.style.bottom = `${y}%`;

        ship.style.transform =
            "translate(-50%, 50%) rotate(-25deg)";
    }

    if (trail) {
        trail.style.width =
            `${progress * 82}%`;
    }

    if (
        rocketGame.multiplier >=
        rocketGame.crashPoint
    ) {

        crashRocket();

        return;
    }

    rocketGame.animationFrame =
        requestAnimationFrame(
            animateRocket
        );
}


/* =========================================================
   ROCKET START
========================================================= */

function startRocketRound() {

    clearTimeout(
        rocketGame.crashTimer
    );

    rocketState = "flying";

    rocketGame.roundNumber += 1;

    rocketGame.multiplier = 1;

    rocketGame.crashPoint =
        generateRocketCrashPoint();

    rocketGame.startTime =
        performance.now();

    resetRocketVisual();

    updateRocketMultiplier();

    updateRocketStatus("🚀 Летим!");

    updateRocketButtons();

    rocketGame.animationFrame =
        requestAnimationFrame(
            animateRocket
        );
}


/* =========================================================
   ROCKET COUNTDOWN
========================================================= */

function startRocketCountdown() {

    rocketState = "waiting";

    rocketGame.multiplier = 1;

    resetRocketVisual();

    updateRocketMultiplier();

    let seconds = 5;

    updateRocketStatus(
        `Следующий запуск через ${seconds}`
    );

    updateRocketButtons();

    const tick = () => {

        if (rocketState !== "waiting") {
            return;
        }

        seconds -= 1;

        if (seconds <= 0) {

            startRocketRound();

            return;
        }

        updateRocketStatus(
            `Следующий запуск через ${seconds}`
        );

        rocketGame.crashTimer =
            setTimeout(
                tick,
                1000
            );
    };

    rocketGame.crashTimer =
        setTimeout(
            tick,
            1000
        );
}


/* =========================================================
   ROCKET CRASH
========================================================= */

function crashRocket() {

    if (rocketState !== "flying") {
        return;
    }

    cancelAnimationFrame(
        rocketGame.animationFrame
    );

    rocketState = "crashed";

    rocketGame.multiplier =
        rocketGame.crashPoint;

    updateRocketMultiplier();

    updateRocketStatus(
        `💥 Краш на ${rocketGame.crashPoint.toFixed(2)}x`
    );

    addRocketHistory(
        rocketGame.crashPoint
    );

    if (
        rocketGame.hasBet &&
        !rocketGame.cashedOut
    ) {

        toast(
            `💥 Ракета упала на ${rocketGame.crashPoint.toFixed(2)}x`
        );
    }

    rocketGame.bet = 0;
    rocketGame.hasBet = false;
    rocketGame.cashedOut = false;

    updateRocketButtons();

    setTimeout(() => {

        startRocketCountdown();

    }, 2000);
}


/* =========================================================
   LEADERBOARD
========================================================= */

function updateLeaderboard() {

    const element =
        $("leaderboard");

    if (!element) {
        return;
    }

    element.innerHTML = "";

    const row =
        document.createElement("div");

    row.className =
        "leaderboardRow";

    row.innerHTML = `
        <div class="leaderPlace">
            1
        </div>

        <div class="leaderInfo">

            <div class="leaderName">
                ${escapeHtml(currentUser.name)}
            </div>

            <div class="leaderStats">
                🚀 ${Number(data.rocketBest || 0).toFixed(2)}x
                · 💣 ${Number(data.minesBest || 0).toFixed(2)}x
            </div>

        </div>

        <div class="leaderBalance">
            ★ ${Math.floor(data.balance).toLocaleString("ru-RU")}
        </div>
    `;

    element.appendChild(row);

    const note =
        document.createElement("div");

    note.className =
        "leaderboardEmpty";

    note.textContent =
        "Онлайн-топ появится после подключения сервера.";

    element.appendChild(note);
}


function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   ACHIEVEMENTS
========================================================= */

function checkAchievements() {

    if (!Array.isArray(data.achievements)) {
        data.achievements = [];
    }

    const achievements = [];

    if (data.taps >= 10) {
        achievements.push("10_taps");
    }

    if (data.taps >= 100) {
        achievements.push("100_taps");
    }

    if (data.minesWins >= 5) {
        achievements.push("5_mines");
    }

    if (data.rocketWins >= 5) {
        achievements.push("5_rocket");
    }

    achievements.forEach(id => {

        if (!data.achievements.includes(id)) {

            data.achievements.push(id);

            const messages = {
                "10_taps":
                    "🏆 10 нажатий!",
                "100_taps":
                    "🏆 100 нажатий!",
                "5_mines":
                    "🏆 5 побед в Минах!",
                "5_rocket":
                    "🏆 5 побед в Rocket!"
            };

            if (messages[id]) {
                toast(messages[id]);
            }
        }
    });

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
    );
}


/* =========================================================
   INPUTS
========================================================= */

function setupInputs() {

    const inputs = [
        $("minesBet"),
        $("rocketBet")
    ];

    inputs.forEach(input => {

        if (!input) {
            return;
        }

        input.addEventListener(
            "input",
            () => {

                let value =
                    Math.floor(
                        Number(input.value)
                    );

                if (
                    !Number.isFinite(value) ||
                    value < 0
                ) {

                    input.value = "";
                }
            }
        );
    });


    const mineCount =
        $("mineCount");

    if (mineCount) {

        mineCount.addEventListener(
            "change",
            () => {

                let value =
                    Math.floor(
                        Number(mineCount.value)
                    );

                if (
                    !Number.isFinite(value)
                ) {
                    value = 5;
                }

                value =
                    Math.max(
                        1,
                        Math.min(24, value)
                    );

                mineCount.value = value;
            }
        );
    }
}


/* =========================================================
   INIT
========================================================= */

function initGame() {

    setupInputs();

    createMinesBoard();

    updateMinesButtons();

    updateMinesMultiplier();

    renderRocketHistory();

    updateAllUI();

    resetRocketVisual();

    checkAchievements();

    startRocketCountdown();

    console.log(
        "GAME HUB initialized successfully"
    );
}


/* =========================================================
   START
========================================================= */

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
                       
