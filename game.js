/* =========================================================
   GAME HUB — GAME LOGIC
   Версия: 1.0
   Все ★ пока виртуальные.
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

let data = loadData();

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

    } catch (error) {
        console.error("Storage error:", error);
        return { ...defaultData };
    }
}

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
   DOM HELPERS
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

    if (!element) {
        return;
    }

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

    if (!Number.isFinite(amount)) {
        return;
    }

    data.balance += amount;

    if (amount > 0) {
        data.totalWon += amount;
    }

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
   UI UPDATE
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


/* =========================================================
   GAMES MENU
========================================================= */

function openGame(gameName) {

    if (gameName === "mines") {
        openPage("mines");
        return;
    }

    if (gameName === "rocket") {
        openPage("rocket");
        return;
    }
}


/* =========================================================
   TAP GAME
========================================================= */

function tapStar() {

    data.taps += 1;
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

    if (!input) {
        return;
    }

    input.value = Math.floor(value);
}


function setQuickBet(inputId, value) {

    const input = $(inputId);

    if (!input) {
        return;
    }

    if (value === "MAX") {
        input.value = Math.floor(data.balance);
    } else {
        input.value = value;
    }
}


/* =========================================================
   QUICK BETS
========================================================= */

function updateQuickBets() {

    const maxButton = $("maxMines");

    if (maxButton) {
        maxButton.textContent =
            "MAX " +
            Math.floor(data.balance).toLocaleString("ru-RU");
    }

    const maxRocket = $("maxRocket");

    if (maxRocket) {
        maxRocket.textContent =
            "MAX " +
            Math.floor(data.balance).toLocaleString("ru-RU");
    }
}


/* =========================================================
   MINES
========================================================= */

/*
   Чем больше мин — тем быстрее растёт коэффициент.

   Формула:

   multiplier =
   1 + количество открытых безопасных клеток × рост

   Для 24 мин:
   первый безопасный ход = 25x

   Поэтому рост для 24 мин = 24.

   Значения можно потом спокойно изменить.
*/

const MINES_GROWTH = [

    0.10,  // 1
    0.20,  // 2
    0.30,  // 3
    0.45,  // 4
    0.60,  // 5
    0.80,  // 6
    1.00,  // 7
    1.25,  // 8
    1.50,  // 9
    1.80,  // 10
    2.20,  // 11
    2.70,  // 12
    3.20,  // 13
    3.80,  // 14
    4.50,  // 15
    5.30,  // 16
    6.20,  // 17
    7.30,  // 18
    8.50,  // 19
    10.0,  // 20
    12.0,  // 21
    14.5,  // 22
    18.0,  // 23
    24.0   // 24 → 25x после первой безопасной клетки
];

let minesGame = {
    active: false,
    bet: 0,
    mines: 5,
    cells: [],
    opened: [],
    multiplier: 1,
    safeOpened: 0
};


/* =========================================================
   MINES MULTIPLIER
========================================================= */

function getMinesGrowth(mines) {

    mines = Math.max(
        1,
        Math.min(24, Math.floor(mines))
    );

    return MINES_GROWTH[mines - 1];
}


function getMineMultiplier(mines, safeOpened) {

    const growth = getMinesGrowth(mines);

    if (safeOpened <= 0) {
        return 1;
    }

    return 1 + safeOpened * growth;
}


/* =========================================================
   CREATE MINES
========================================================= */

function createMinesBoard() {

    const minesInput = $("mineCount");

    let mineCount = Math.floor(
        Number(minesInput?.value || 5)
    );

    if (!Number.isFinite(mineCount)) {
        mineCount = 5;
    }

    mineCount = Math.max(
        1,
        Math.min(24, mineCount)
    );

    minesGame.mines = mineCount;

    const cells = Array.from(
        { length: 25 },
        (_, index) => index
    );

    shuffle(cells);

    const minePositions =
        cells.slice(0, mineCount);

    minesGame.cells = Array.from(
        { length: 25 },
        (_, index) => ({
            index,
            mine: minePositions.includes(index),
            open: false
        })
    );

    minesGame.opened = [];
    minesGame.safeOpened = 0;
    minesGame.multiplier = 1;

    renderMinesBoard();
    updateMinesMultiplier();
}


/* =========================================================
   SHUFFLE
========================================================= */

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


/* =========================================================
   MINES BOARD RENDER
========================================================= */

function renderMinesBoard() {

    const board = $("mineBoard");

    if (!board) {
        return;
    }

    board.innerHTML = "";

    minesGame.cells.forEach(cell => {

        const button =
            document.createElement("button");

        button.className = "mineCell";
        button.dataset.index = cell.index;

        button.textContent = "•";

        button.addEventListener(
            "click",
            () => openMineCell(cell.index)
        );

        board.appendChild(button);
    });
}


/* =========================================================
   START MINES
========================================================= */

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

    data.minesPlayed += 1;

    createMinesBoard();

    updateMinesButtons();

    toast("Игра началась");
}


/* =========================================================
   OPEN MINE CELL
========================================================= */

function openMineCell(index) {

    if (!minesGame.active) {
        return;
    }

    const cell =
        minesGame.cells[index];

    if (!cell || cell.open) {
        return;
    }

    cell.open = true;

    const board =
        $("mineBoard");

    const button =
        board?.querySelector(
            `[data-index="${index}"]`
        );

    if (!button) {
        return;
    }

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

    cell.open = true;

    button.classList.add(
        "open",
        "safe"
    );

    button.textContent = "✓";

    minesGame.opened.push(index);

    minesGame.safeOpened += 1;

    minesGame.multiplier =
        getMineMultiplier(
            minesGame.mines,
            minesGame.safeOpened
        );

    updateMinesMultiplier();

    checkMinesWin();
}


/* =========================================================
   REVEAL MINES
========================================================= */

function revealAllMines() {

    const board =
        $("mineBoard");

    if (!board) {
        return;
    }

    minesGame.cells.forEach(cell => {

        if (!cell.mine) {
            return;
        }

        const button =
            board.querySelector(
                `[data-index="${cell.index}"]`
            );

        if (!button) {
            return;
        }

        button.classList.add(
            "open",
            "mine"
        );

        button.textContent = "💣";
    });
}


/* =========================================================
   MINES CASHOUT
========================================================= */

function cashoutMines() {

    if (!minesGame.active) {
        return;
    }

    if (minesGame.safeOpened <= 0) {
        toast("Открой хотя бы одну клетку");
        return;
    }

    const result = Math.floor(
        minesGame.bet *
        minesGame.multiplier
    );

    const profit =
        result - minesGame.bet;

    addBalance(result);

    data.minesWins += 1;

    if (
        minesGame.multiplier >
        data.minesBest
    ) {
        data.minesBest =
            minesGame.multiplier;
    }

    minesGame.active = false;
    minesGame.bet = 0;

    updateMinesButtons();

    toast(
        `Вы выиграли ${result.toLocaleString("ru-RU")} ★`
    );

    saveData();
}


/* =========================================================
   MINES AUTO WIN
========================================================= */

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

        data.minesWins += 1;

        if (
            minesGame.multiplier >
            data.minesBest
        ) {
            data.minesBest =
                minesGame.multiplier;
        }

        minesGame.active = false;
        minesGame.bet = 0;

        updateMinesButtons();

        toast(
            `🎉 Поле пройдено! +${result.toLocaleString("ru-RU")} ★`
        );

        saveData();
    }
}


/* =========================================================
   MINES MULTIPLIER UI
========================================================= */

function updateMinesMultiplier() {

    setText(
        "mineMultiplier",
        minesGame.multiplier.toFixed(2) + "x"
    );
}


/* =========================================================
   MINES BUTTONS
========================================================= */

function updateMinesButtons() {

    const start =
        $("startMines");

    const cashout =
        $("cashoutMines");

    if (start) {
        start.disabled =
            minesGame.active;
    }

    if (cashout) {
        cashout.disabled =
            !minesGame.active ||
            minesGame.safeOpened === 0;

        cashout.textContent =
            minesGame.active
                ? `Забрать ${Math.floor(
                    minesGame.bet *
                    minesGame.multiplier
                ).toLocaleString("ru-RU")} ★`
                : "Забрать";
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
    crashTimer: null,
    animationFrame: null,

    roundNumber: 0
};


/* =========================================================
   ROCKET GENERATOR
========================================================= */

/*
   ВАЖНО:

   Результат не зависит от ставки игрока.

   Это только виртуальная игра.

   Есть несколько независимых тенденций:

   1. Низкие значения встречаются чаще.

   2. Если подряд были 2–3 значения <= 1.8x,
      вероятность следующего результата > 2x повышается.

   3. Для больших коэффициентов используются
      плавающие интервалы.

   Это не жёсткая последовательность.
*/

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

        if (history[i] <= 1.8) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}


function generateRocketCrashPoint() {

    /*
       Точный максимум 340x.
       Очень редкое событие.
    */

    if (Math.random() < 0.001) {
        return 340;
    }


    /*
       Увеличиваем счётчики.
    */

    rocketBigCounters.since10++;
    rocketBigCounters.since20++;
    rocketBigCounters.since30++;
    rocketBigCounters.since50++;
    rocketBigCounters.since100++;


    /*
       Если было 2–3 низких раунда,
       повышаем вероятность >2x.
    */

    const lowStreak =
        recentLowStreak();

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


    /*
       Большие значения.

       Не каждый ровно N-й раунд,
       а случайное окно.
    */

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


    /*
       Обычное распределение.
    */

    const roll =
        Math.random();

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

  
