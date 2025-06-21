const connectionStatusElem = document.getElementById('connection-status');
const nicknameInput = document.getElementById('nickname-input');
const nicknameBtn = document.getElementById('nickname-btn');
const shareLinkBtn = document.getElementById('share-link');
const chatDiv = document.getElementById('chat');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const categoryArea = document.getElementById('category-area');
const startArea = document.getElementById('start-area');
const notifDot = document.getElementById('notification-dot');
const chatModal = document.getElementById("chat-modal");
const connectedPlayersElem = document.getElementById("connected-players-count");
const startBtn = document.getElementById("start-btn");
const categorySelect = document.getElementById("category-select");
const startPage = document.getElementById("start");
const gamePage = document.getElementById("game");
const categoryTitle = document.getElementById("category-title");
const toastContainer = document.getElementById("toast-container");
const toastMsg = document.getElementById("toast-msg");
const turnOrderArea = document.getElementById("turn-order-area");
const winCategorySelect = document.getElementById("win-category-select");

const peer = new Peer();

// Used only for host
let connections = [];
let votes = [];
let turnOrderIds = [];
let prevData;

// Used only for non-host;
let hostConn = null;

let nameDict = {};
let MYID = "";
let GAMESTATE = {};

peer.once('open', (id) => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('roomId');
    MYID = id;

    console.log('My ID:', id);

    if (roomId) {
        connectionStatusElem.textContent = `Joining room:\n${roomId}`;
    } else {
        connectionStatusElem.textContent = `Creating new room:\n${id}`;
    }

    nicknameInput.classList.remove('disabled');
    nicknameBtn.classList.remove('disabled');
    nicknameBtn.onclick = () => {
        if (nicknameInput.value) {
            nameDict[id] = nicknameInput.value;
            connectionStatusElem.textContent = `Hi ${nameDict[id]}!`;
            nicknameInput.classList.add('disabled');
            nicknameBtn.classList.add('disabled'); 
            shareLinkBtn.classList.remove('disabled');
            categoryArea.classList.remove('disabled');
            startArea.classList.remove('disabled');
            turnOrderArea.classList.remove('disabled');

            shareLinkBtn.onclick = () => {
                const url = window.location.href.split('?')[0];
                const link = `${url}?roomId=${roomId || id}`;
                navigator.clipboard.writeText(link).then(() => {
                    toast("Copied room link to clipboard!");
                }).catch(err => {
                    toast("Failed to copy room link.");
                });
    
            };
        
            if (roomId) {
                joinRoom(roomId);
            } else {
                displayMessage(`You are the host of room: ${id}`);
                turnOrderIds.push(id);
                displayPlayerOrder(turnOrderIds);
                updateConnectionsText();
            }
        }
    }
});

sendBtn.onclick = () => {
    const message = messageInput.value;
    if (message) {
        peerSend({type: 'message', message, from: MYID});            
        messageInput.value = '';
    }
}

// Code for non-hosts
function joinRoom(roomId) {
    hostConn = peer.connect(roomId);
    hostConn.on('open', () => {
        displayMessage(`Connected to room: ${roomId}`);
        hostConn.send({type: 'get-names', myName: nameDict[MYID]});

        hostConn.on('data', function(data) {
            console.log(data);
            if (data.type === 'names') {
                for (const id in data.nameDict) {
                    if (id in nameDict || id === MYID) continue;
                    nameDict[id] = data.nameDict[id];
                    displayMessage(`${nameDict[id]} joined the game`);
                    displayPlayerOrder(data.turnOrderIds);
                }
                updateConnectionsText();
            } else {
                processData(data);
            }
        });
    });
}

function displayPlayerOrder(ids) {
    const turnOrder = document.getElementById("turn-order");

    let newTurnOrder = document.createElement('div');
    newTurnOrder.id = 'turn-order';
    for (let [i, id] of ids.entries()) {
        let playerLine = document.createElement('div');
        playerLine.classList.add('player-line');
        playerLine.innerHTML = `
            <div class="player-line-name">${nameDict[id]}</div>
            <div class="player-line-buttons">
                <button class="player-line-raise ${i === 0 ? 'button-inactive' : ''}">
                    <span class="material-symbols-outlined">keyboard_arrow_up</span>
                </button>
                <button class="player-line-lower ${i === ids.length - 1 ? 'button-inactive' : ''}">
                    <span class="material-symbols-outlined">keyboard_arrow_down</span>
                </button>
            </div>
        `;
        if (i !== 0) {
            playerLine.querySelector('.player-line-raise').onclick = () => {
                peerSend({type: 'raise-order', player: id});
            }
        }
        if (i !== ids.length - 1) {
            playerLine.querySelector('.player-line-lower').onclick = () => {
                peerSend({type: 'lower-order', player: id});
            }
        }
        newTurnOrder.appendChild(playerLine);
    }
    console.log(newTurnOrder);
    turnOrder.replaceWith(newTurnOrder);
}

// Code for hosts
peer.on('connection', (conn) => {
    connections.push(conn);

    conn.on('data', (data) => {
        console.log(data);
        if (data.type === 'get-names') {
            nameDict[conn.peer] = data.myName;
            turnOrderIds.push(conn.peer);
            for (let allConn of connections) {
                allConn.send({type: 'names', nameDict: nameDict, turnOrderIds: turnOrderIds});
            }
            displayMessage(`${data.myName} joined the game`);
            displayPlayerOrder(turnOrderIds);
            updateConnectionsText();
        } else if (data.type === 'get-game-state') {
            conn.send({type: 'game-state', gameState: GAMESTATE, prevData: prevData});
        } else {
            processData(data);
        }

        prevData = data;
    });

    conn.on('close', () => {
        displayMessage(`${nameDict[conn.peer]} has disconnected`);
        connections.splice(connections.indexOf(conn), 1);
        updateConnectionsText();
    })

    updateConnectionsText();
});

const revealModal = document.getElementById("reveal-modal");
const revealTitle = document.getElementById("reveal-title");
const revealWords = document.getElementById("reveal-words");
const revealAcceptBtn = document.getElementById("reveal-accept-btn");
const revealRejectBtn = document.getElementById("reveal-reject-btn");

const waitingModal = document.getElementById("waiting-modal");

function processData(data) {
    if (data.type === 'game-state') {
        GAMESTATE = data.gameState;
        displayGame();
        setAvailableActions();

        if (data.prevData.type === 'reveal') {
            data = data.prevData;
        } 
    }
    if (data.type === 'raise-order') {
        if (hostConn === null) {
            let i = turnOrderIds.indexOf(data.player);
            [turnOrderIds[i], turnOrderIds[i - 1]] = [turnOrderIds[i - 1], turnOrderIds[i]];
            data = {type: 'order-update', turnOrderIds: turnOrderIds};
        }
    }
    if (data.type === 'lower-order') {
        if (hostConn === null) {
            let i = turnOrderIds.indexOf(data.player);
            [turnOrderIds[i], turnOrderIds[i + 1]] = [turnOrderIds[i + 1], turnOrderIds[i]];
            data = {type: 'order-update', turnOrderIds: turnOrderIds};
        }
    }
    if (data.type === 'order-update') {
        displayPlayerOrder(data.turnOrderIds);
    }
    if (data.type === 'message') {
        displayMessage(data.message, data.from);
    }
    if (data.type === 'categoryUpdate') {
        categorySelect.value = data.category;
    }
    if (data.type === 'winCategoryUpdate') {
        winCategorySelect.value = data.category;
    }
    if (data.type === 'start') {
        if (hostConn === null) {
            let category = categorySelect.value;
            if (category === "random") {
                category = Object.keys(categories)[Math.floor(Math.random() * (Object.keys(categories).length - 1))];
            }
            data = {type: 'start-all', gameState: newGameState(category)};
        }
    }
    if (data.type === 'restart') {
        if (hostConn === null) {
            let category = winCategorySelect.value;
            if (category === "random") {
                category = Object.keys(categories)[Math.floor(Math.random() * (Object.keys(categories).length - 1))];
            }
            data = {type: 'start-all', gameState: nextGameState(category)};
        }
    }
    if (data.type === 'start-all') {
        winModal.classList.add('disabled');
        finalHandModal.classList.add('disabled');
        endActions.classList.add('disabled');
        eatActions.classList.add('disabled');
        declareWinActions.classList.add('disabled');
        mainActions.classList.remove('disabled');
        finalHand.replaceChildren();
        GAMESTATE = data.gameState;
        startPage.classList.add('disabled');
        gamePage.classList.remove('disabled');
        setAvailableActions();
        displayGame();
    }
    if (data.type === 'draw') {
        actionDraw(data.player);
        if (hostConn !== null) {
            deepVerifyState(data.verifyState);
        }
    }
    if (data.type === 'discard') {
        actionDiscard(data.tile, data.player);
        if (hostConn !== null) {
            deepVerifyState(data.verifyState);
        }
    }
    if (data.type === 'eat') {
        actionEat(data.player);
        if (hostConn !== null) {
            deepVerifyState(data.verifyState);
        }
    }
    if (data.type === 'reveal') {
        votes = [];
        if (data.player !== MYID) {
            revealModal.classList.remove('disabled');
            if (data.isFinal) {
                revealTitle.textContent = `${nameDict[data.player]} would like to declare a win:`;
            } else {
                revealTitle.textContent = `${nameDict[data.player]} would like to play:`;
            }
            revealWords.innerHTML = data.words.map(word => `
                <div class="formed-word">
                ${word.map(tile => {
                    return `<div class="mini-tile">${tile}</div>`
                }).join("")}
                </div>
            `).join("");
            revealAcceptBtn.onclick = () => {
                peerSend({type: 'vote-accept', player: data.player, words: data.words, isFinal: data.isFinal});
                revealModal.classList.add('disabled');
                waitingModal.classList.remove('disabled');
            }
            revealRejectBtn.onclick = () => {
                peerSend({type: 'vote-reject', player: data.player, words: data.words, isFinal: data.isFinal});
                revealModal.classList.add('disabled');
                waitingModal.classList.remove('disabled');
            }
        } else {
            waitingModal.classList.remove('disabled');
        }
    }
    if (data.type === 'vote-accept') {
        if (hostConn === null) {
            votes.push(true);
            if (votes.length === 3) endVoting(data);
        }
    }
    if (data.type === 'vote-reject') {
        if (hostConn === null) {
            votes.push(false);
            if (votes.length === 3) endVoting(data);
        }
    }
    if (data.type === 'reveal-accept') {
        requestAnimationFrame(() => waitingModal.classList.add('disabled'));
        if (data.isFinal) {
            showWin(data.player, data.words);
        } else {
            toast(`${nameDict[data.player]}'s word was accepted`);
            actionRevealAccept(data.words[0], data.player);
            if (hostConn !== null) {
                deepVerifyState(data.verifyState);
            }
        }
    }
    if (data.type === 'reveal-reject') {
        requestAnimationFrame(() => waitingModal.classList.add('disabled'));
        if (data.isFinal) {
            toast(`${nameDict[data.player]}'s final hand was rejected`);
        } else {
            toast(`${nameDict[data.player]}'s word was rejected`);
        }
    }
    if (data.type === 'eat-back') {
        actionEatBack(data.player);
        if (hostConn !== null) {
            deepVerifyState(data.verifyState);
        }
    }
    if (data.type === 'touch') {
        actionTouch(data.player);
        if (hostConn !== null) {
            deepVerifyState(data.verifyState);
        }
    }
    if (data.type === 'strike') {
        actionStrike(data.player);
        if (hostConn !== null) {
            deepVerifyState(data.verifyState);
        }
    }

    if (hostConn === null) {
        if (['draw', 'discard', 'eat', 'reveal-accept', 'reveal-reject', 'eat-back', 'touch', 'strike'].includes(data.type)) {
            data['verifyState'] = GAMESTATE;
        }
        for (let allConn of connections) {
            allConn.send(data);
        }
    }
}

function endVoting(data) {
    if (votes.filter(v => v === true).length >= 2) {
        data.type = 'reveal-accept';
    } else {
        data.type = 'reveal-reject';
    }
}

function updateConnectionsText() {
    connectedPlayersElem.textContent = `${Object.keys(nameDict).length}/4 connected`;
    if (Object.keys(nameDict).length === 4) {
        startBtn.classList.remove('button-inactive');
    } else {
        startBtn.classList.add('button-inactive');
    }
}

// Function to display chat messages in the chat div
function displayMessage(message, senderID) {
    if (senderID) {
        const messageDiv = document.createElement('div');
        const messageSender = document.createElement('div');
        messageSender.textContent = nameDict[senderID];
        messageSender.classList.add('message-sender');
        messageDiv.appendChild(messageSender);

        const messageContent = document.createElement('div');
        messageContent.textContent = message;
        messageContent.classList.add('message-content');
        messageDiv.appendChild(messageContent);

        if (senderID === MYID) {
            messageDiv.classList.add('message-self');
        } else {
            messageDiv.classList.add('message-other');
        }
        chatDiv.appendChild(messageDiv);
    } else {
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        messageDiv.classList.add('message-info');
        chatDiv.appendChild(messageDiv);
    }
    
    if (chatModal.classList.contains('disabled')) {
        notifDot.classList.remove('disabled');
    }

    chatDiv.scrollTop = chatDiv.scrollHeight;  // Scroll to the bottom
}

messageInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); // Prevent new line
        sendBtn.click();
    }
});

function peerSend(data) {
    if (hostConn !== null) {
        hostConn.send(data);
    } else {
        processData(data);
    }
}

categorySelect.addEventListener('change', function () {
    let newValue = this.value;
    peerSend({type: 'categoryUpdate', category: newValue});
});

winCategorySelect.addEventListener('change', function () {
    let newValue = this.value;
    peerSend({type: 'winCategoryUpdate', category: newValue});
});

startBtn.addEventListener('click', function () {
    if (Object.keys(nameDict).length < 4) {
        return;
    }
    
    peerSend({type: 'start'});
});



peer.on('disconnected', () => {
    toast("Disconnected, attempting to reconnect...");
    displayMessage("You have disconnected");

    peer.once('open', () => {
        displayMessage(`Reconnection successful`);
        hostConn.send({type: 'get-game-state'});
    });
    
    peer.reconnect();
});

function toast(message) {
    toastContainer.classList.remove('disabled');
    toastMsg.textContent = message;
    setTimeout(() => {
        toastContainer.classList.add('disabled');
    }, 3000);
}

function newGameState(category) {
    let state = {
        category: category,
        discardedTiles: [],
        players: turnOrderIds.map(id => ({
            id: id,
            name: nameDict[id],
            money: 100,
            revealedTiles: [],
            hand: [],
        })),
        turnIndex: 0,
        dealerIndex: 0,
        discardIsActive: false,
    };

    dealCards(state);
    return state;
}

function dealCards(state) {
    const vowels = 'AEIOU'.split('');
    const consonants = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(c => !vowels.includes(c));

    const repeat = (arr, times) => Array(times).fill(arr).flat();

    let ALL_TILES = [
        ...repeat(vowels, 8),
        ...repeat(consonants, 4),
        ...Array(4).fill('')
    ];

    shuffle(ALL_TILES);

    for (const player of state.players) {
        for (let i = 0; i < 13; i++) {
            player.hand.push(ALL_TILES.pop());
        }
    }

    state.drawDeck = ALL_TILES;
}

const uiTopRow = document.getElementById("ui-top-row");
const uiHistory = document.getElementById("ui-history");
const uiBottomRow = document.getElementById("ui-bottom-row");
const tileTray = document.getElementById("tile-tray");
const revealTray = document.getElementById("reveal-tray");

function displayGame() {
    uiTopRow.replaceChildren();
    uiHistory.replaceChildren();
    uiBottomRow.replaceChildren();
    tileTray.replaceChildren();
    revealTray.replaceChildren();

    let playerInfos = [];
    for (const [i, player] of GAMESTATE.players.entries()) {
        let playerInfo = document.createElement("div");
        playerInfo.innerHTML = `
            <div class="info-header">
                <div class="info-header-left">
                    <div class="player-name">${player.name}</div>
                </div>
                <div class="info-header-right">
                    <div class="player-active fade disabled"></div>
                    <div class="player-dealer disabled"></div>
                    <div class="player-money">${player.money < 0 ? '-' : ''}$${Math.abs(player.money)}</div>
                </div>
            </div>
            <div class="formed-words">
                ${player.revealedTiles.map(word => {
                    return `
                        <div class="formed-word">
                            ${word.map(tile => {
                                return `
                                    <div class="mini-tile">${tile}</div>
                                `;
                            }).join("")}
                        </div>
                    `;
                }).join("")}
                <div class="remaining-tiles-container">
                    <div class="mini-tile">${player.hand.length}</div>
                    <div class="remaining-text">in hand</div>
                </div>
            </div>
        `;
        playerInfo.classList.add('player-info');
        playerInfo.id = player.id;
        const activeIndicator = playerInfo.querySelector('.player-active');
        const dealerIndicator = playerInfo.querySelector('.player-dealer');
        if (i === GAMESTATE.turnIndex) {
            activeIndicator.classList.remove('disabled');
        } 
        if (i === GAMESTATE.dealerIndex) {
            dealerIndicator.classList.remove('disabled');
        }

        playerInfos.push(playerInfo);
    }
    uiTopRow.appendChild(playerInfos[0]);
    uiTopRow.appendChild(playerInfos[1]);
    uiBottomRow.appendChild(playerInfos[3]);

    let deckRemaining = document.createElement("div");
    deckRemaining.id = 'deck-remaining';
    deckRemaining.innerHTML = `
        <div class="mini-tile">${GAMESTATE.drawDeck.length}</div>
        <div class="remaining-text">left</div>
    `;
    uiBottomRow.appendChild(deckRemaining);

    uiBottomRow.appendChild(playerInfos[2]);
    
    for (let tileText of GAMESTATE.discardedTiles) {
        let tile = document.createElement("div");
        tile.classList.add('mini-tile');
        tile.textContent = tileText;
        uiHistory.appendChild(tile);
    }

    for (let tileText of GAMESTATE.players.find(player => player.id === MYID).hand) {
        let tile = document.createElement("div");
        tile.classList.add('tile');
        tile.textContent = tileText;
        tileTray.appendChild(tile);
    }

    categoryTitle.textContent = categories[GAMESTATE.category].label;
}



function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function nextGameState(category) {
    let state = {
        category: category,
        discardedTiles: [],
        drawDeck: [],
        players: turnOrderIds.map(id => ({
            id: id,
            name: nameDict[id],
            money: GAMESTATE.players.find(player => player.id === id).money,
            revealedTiles: [],
            hand: [],
        })),
        turnIndex: (GAMESTATE.dealerIndex + 1) % 4,
        dealerIndex: (GAMESTATE.dealerIndex + 1) % 4,
        discardIsActive: false,
    }

    dealCards(state);
    return state;
}

function redrawCardsInHand(id) {
    const playerInfo = document.getElementById(id);
    const player = GAMESTATE.players.find(player => player.id === id);
    playerInfo.querySelector('.remaining-tiles-container .mini-tile').innerHTML = player.hand.length;
}

const mainActions = document.getElementById("main-actions");
const endActions = document.getElementById("end-actions");
const eatActions = document.getElementById("eat-actions");
const declareWinActions = document.getElementById("declare-win-actions");

function actionDraw(playerID) {
    let newTile = GAMESTATE.drawDeck.pop()

    if (newTile === undefined) {
        let winStandingsInnerHTML = '';
        for (let [i, p] of GAMESTATE.players.entries()) {
            winStandingsInnerHTML += `
                <div class="win-standings-player">
                    <div class="win-standings-player-name">${nameDict[p.id]}</div>
                    <div class="win-standings-player-change">$0</div>
                    <div class="win-standings-player-money">${p.money < 0 ? '-' : ''}$${Math.abs(p.money)}</div>
                </div>
            `;
        }
        winStandings.innerHTML = winStandingsInnerHTML;

        winWinnerName.textContent = "No one";
        winNextDealerName.textContent = nameDict[GAMESTATE.players[(GAMESTATE.dealerIndex + 1) % 4].id];

        winModal.classList.remove('disabled');
    } else {
        GAMESTATE.players.find(player => player.id === playerID).hand.push(newTile);
        redrawCardsInHand(playerID);
        let deckRemainingCount = document.querySelector('#deck-remaining .mini-tile');
        deckRemainingCount.innerHTML = GAMESTATE.drawDeck.length;

        GAMESTATE.responsiblePlayer = playerID;

        GAMESTATE.discardIsActive = false;
        setAvailableActions();
        
        if (playerID == MYID) {
            let tile = document.createElement("div");
            tile.classList.add('tile');
            tile.textContent = newTile;
            tileTray.appendChild(tile);
        }
    }
}

const drawBtn = document.getElementById("draw");
drawBtn.addEventListener('click', function () {
    if (drawBtn.classList.contains('button-inactive')) {
        return;
    }
    
    setInitialAction('draw');
    mainActions.classList.add('disabled');
    endActions.classList.remove('disabled');

    peerSend({type: 'draw', player: MYID});
});

function setInitialAction(actionType) {
    if (actionType === 'draw') {
        let wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="main-button button-inactive">
                <div class="button-icon">摸</div>
                <div class="button-text">DRAW</div>
            </div>
        `;
        endActions.firstElementChild.replaceWith(wrapper.firstElementChild);
    }
    if (actionType === 'eat') {
        console.log('eat');
        let wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="main-button button-inactive">
                <div class="button-icon">吃</div>
                <div class="button-text">EAT</div>
            </div>
        `;
        endActions.firstElementChild.replaceWith(wrapper.firstElementChild);
    }
    if (actionType === 'touch') {
        console.log('touch');
        let wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="main-button button-inactive">
                <div class="button-icon">碰</div>
                <div class="button-text">TOUCH</div>
            </div>
        `;
        endActions.firstElementChild.replaceWith(wrapper.firstElementChild);
    }
    if (actionType === 'strike') {
        console.log('strike');
        let wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="main-button button-inactive">
                <div class="button-icon">杠</div>
                <div class="button-text">STRIKE</div>
            </div>
        `;
        endActions.firstElementChild.replaceWith(wrapper.firstElementChild);
    }
}

function jumpTurn(increment) {
    const playerInfo = document.getElementById(GAMESTATE.players[GAMESTATE.turnIndex].id);
    const activeIndicator = playerInfo.querySelector('.player-active');
    activeIndicator.classList.add('disabled');
    
    GAMESTATE.turnIndex = (GAMESTATE.turnIndex + increment) % 4;

    const newPlayerInfo = document.getElementById(GAMESTATE.players[GAMESTATE.turnIndex].id);
    const newActiveIndicator = newPlayerInfo.querySelector('.player-active');
    newActiveIndicator.classList.remove('disabled');
}

function addToUiHistory(tileText) {
    let tileElement = document.createElement("div");
    tileElement.classList.add('mini-tile');
    tileElement.textContent = tileText;
    uiHistory.appendChild(tileElement);
}

function actionDiscard(tile, playerID) {
    GAMESTATE.discardedTiles.push(tile);
    let index = GAMESTATE.players.find(player => player.id === playerID).hand.findIndex(t => t === tile);
    GAMESTATE.players.find(player => player.id === playerID).hand.splice(index, 1);
    GAMESTATE.discardIsActive = true;

    addToUiHistory(tile);

    redrawCardsInHand(playerID);

    jumpTurn(1);

    setAvailableActions();

    if (playerID == MYID) {
        endActions.classList.add('disabled');
        mainActions.classList.remove('disabled');
    }
}

const discardBtn = document.getElementById("discard");
discardBtn.addEventListener('click', function () {
    if (discardBtn.classList.contains('button-inactive')) {
        return;
    }

    if (revealTray.children.length !== 1) {
        toast("Place one tile in the tray to discard");
        return;
    }
    
    let tile = revealTray.children[0].textContent;
    revealTray.children[0].remove();
    
    peerSend({type: 'discard', tile: tile, player: MYID});
});

const eatBtn = document.getElementById("eat");
eatBtn.addEventListener('click', function () {
    if (eatBtn.classList.contains('button-inactive')) {
        return;
    }

    mainActions.classList.add('disabled');
    eatActions.classList.remove('disabled');

    peerSend({type: 'eat', player: MYID});
});

function actionEat(playerID) {
    let tileText = GAMESTATE.discardedTiles.pop();
    GAMESTATE.players.find(player => player.id === playerID).hand.push(tileText);
    GAMESTATE.players.find(player => player.id === playerID)['lastEaten'] = tileText;
    redrawCardsInHand(playerID);

    uiHistory.lastElementChild.remove();

    GAMESTATE.discardIsActive = false;
    setAvailableActions();

    if (playerID == MYID) {
        let tile = document.createElement("div");
        tile.classList.add('tile');
        tile.textContent = tileText;
        revealTray.appendChild(tile);
    }
}

const eatBackBtn = document.getElementById("eat-back");
eatBackBtn.addEventListener('click', function () {
    let player = GAMESTATE.players.find(player => player.id === MYID);
    let indexInReveal = Array.from(revealTray.children).map(tile => tile.textContent).indexOf(player.lastEaten)
    if (indexInReveal !== -1) {
        revealTray.children[indexInReveal].remove();
    } else {
        let indexInTileTray = Array.from(tileTray.children).map(tile => tile.textContent).indexOf(player.lastEaten)
        if (indexInTileTray !== -1) {
            tileTray.children[indexInTileTray].remove();
        }
    }

    eatActions.classList.add('disabled');
    mainActions.classList.remove('disabled');

    peerSend({type: 'eat-back', player: MYID});
});

function actionEatBack(playerID) {
    let player = GAMESTATE.players.find(player => player.id === playerID);
    GAMESTATE.discardedTiles.push(player.lastEaten);
    player.hand.splice(player.hand.indexOf(player.lastEaten), 1);
    addToUiHistory(player.lastEaten);

    player.lastEaten = null;

    redrawCardsInHand(playerID);
    GAMESTATE.discardIsActive = true;
    setAvailableActions();
}


const revealBtn = document.getElementById("reveal");
revealBtn.addEventListener('click', function () {
    if (revealBtn.classList.contains('button-inactive')) {
        return;
    }

    if (!Array.from(revealTray.children).map(tile => tile.textContent).includes(GAMESTATE.players.find(player => player.id === MYID).lastEaten)) {
        toast("Revealed word must include eaten tile");
        return;
    }

    if (revealTray.children.length < 3) {
        toast("Words must be at least 3 letters long");
        return;
    }
    
    let word = Array.from(revealTray.children).map(tile => tile.textContent);    
    peerSend({type: 'reveal', words: [word], player: MYID, isFinal: false});
});

function pushWordToInfoBox(word, playerID) {
    let player = GAMESTATE.players.find(player => player.id === playerID);
    player.revealedTiles.push(word);
    let playerInfo = document.getElementById(playerID);
    let miniWord = document.createElement("div");
    miniWord.classList.add('formed-word');
    miniWord.innerHTML = word.map(tile => {
        return `
            <div class="mini-tile">${tile}</div>
        `;
    }).join("");

    playerInfo.querySelector('.formed-words').insertBefore(miniWord, playerInfo.querySelector('.remaining-tiles-container'));
    redrawCardsInHand(playerID);
}

function actionRevealAccept(word, playerID) {
    const player = GAMESTATE.players.find(player => player.id === playerID);
    word.forEach(ltr => player.hand.splice(player.hand.indexOf(ltr), 1));

    pushWordToInfoBox(word, playerID);

    GAMESTATE.responsiblePlayer = GAMESTATE.players[mod(GAMESTATE.turnIndex - 1, 4)].id;

    if (playerID === MYID) {
        revealTray.replaceChildren();
    
        setInitialAction('eat');
        eatActions.classList.add('disabled');
        endActions.classList.remove('disabled');
    }
}

const touchBtn = document.getElementById("touch");
touchBtn.addEventListener('click', function () {
    if (touchBtn.classList.contains('button-inactive')) {
        return;
    }

    let lastTile = GAMESTATE.discardedTiles[GAMESTATE.discardedTiles.length - 1];
    if ('AEIOU'.includes(lastTile)) {
        toast("Cannot touch this letter");
        return;
    }

    let numCopies = GAMESTATE.players.find(player => player.id === MYID).hand.filter(tile => tile === lastTile).length;
    if (numCopies <= 1) {
        toast("Cannot touch this letter");
    } 

    setInitialAction('touch');
    mainActions.classList.add('disabled');
    endActions.classList.remove('disabled');
    
    peerSend({type: 'touch', player: MYID});

});

function mod(a, b) {
    return ((a % b) + b) % b;
}

function actionTouch(playerID) {
    GAMESTATE.responsiblePlayer = GAMESTATE.players[mod(GAMESTATE.turnIndex - 1, 4)].id;

    let skippedTurns = GAMESTATE.players.findIndex(player => player.id === playerID) - GAMESTATE.turnIndex;
    jumpTurn(skippedTurns);

    let lastTile = GAMESTATE.discardedTiles.pop();
    uiHistory.lastElementChild.remove();

    let player = GAMESTATE.players.find(player => player.id === playerID);
    player.hand.splice(player.hand.indexOf(lastTile), 1);
    player.hand.splice(player.hand.indexOf(lastTile), 1);

    pushWordToInfoBox([lastTile, lastTile, lastTile], playerID);

    GAMESTATE.discardIsActive = false;
    setAvailableActions();

    if (playerID === MYID) {
        let n_deleted = 0;
        while (n_deleted < 2) {
            let revealTrayIndex = Array.from(revealTray.children).map(tile => tile.textContent).indexOf(lastTile);
            if (revealTrayIndex !== -1) {
                revealTray.children[revealTrayIndex].remove();
                n_deleted++;
            } else {
                let tileTrayIndex = Array.from(tileTray.children).map(tile => tile.textContent).indexOf(lastTile);
                if (tileTrayIndex !== -1) {
                    tileTray.children[tileTrayIndex].remove();
                    n_deleted++;
                }
            }
        }
    }
}

const strikeBtn = document.getElementById("strike");
strikeBtn.addEventListener('click', function () {
    if (strikeBtn.classList.contains('button-inactive')) {
        return;
    }

    let lastTile = GAMESTATE.discardedTiles[GAMESTATE.discardedTiles.length - 1];
    if ('AEIOU'.includes(lastTile)) {
        toast("Cannot strike this letter");
        return;
    }

    let numCopies = GAMESTATE.players.find(player => player.id === MYID).hand.filter(tile => tile === lastTile).length;
    if (numCopies <= 2) {
        toast("Cannot strike this letter");
    }

    setInitialAction('strike');
    mainActions.classList.add('disabled');
    endActions.classList.remove('disabled');
    
    peerSend({type: 'strike', player: MYID});
});

function actionStrike(playerID) {
    GAMESTATE.responsiblePlayer = GAMESTATE.players[mod(GAMESTATE.turnIndex - 1, 4)].id;

    let skippedTurns = GAMESTATE.players.findIndex(player => player.id === playerID) - GAMESTATE.turnIndex;
    jumpTurn(skippedTurns);

    let lastTile = GAMESTATE.discardedTiles.pop();
    uiHistory.lastElementChild.remove();

    let player = GAMESTATE.players.find(player => player.id === playerID);
    player.hand.splice(player.hand.indexOf(lastTile), 1);
    player.hand.splice(player.hand.indexOf(lastTile), 1);
    player.hand.splice(player.hand.indexOf(lastTile), 1);

    pushWordToInfoBox([lastTile, lastTile, lastTile, lastTile], playerID);

    GAMESTATE.discardIsActive = false;
    setAvailableActions();

    if (playerID === MYID) {
        let n_deleted = 0;
        while (n_deleted < 3) {
            let revealTrayIndex = Array.from(revealTray.children).map(tile => tile.textContent).indexOf(lastTile);
            if (revealTrayIndex !== -1) {
                revealTray.children[revealTrayIndex].remove();
                n_deleted++;
            } else {
                let tileTrayIndex = Array.from(tileTray.children).map(tile => tile.textContent).indexOf(lastTile);
                if (tileTrayIndex !== -1) {
                    tileTray.children[tileTrayIndex].remove();
                    n_deleted++;
                }
            }
        }
    }
}

const declareWinBtn = document.getElementById("win");
const finalHandModal = document.getElementById("final-hand-modal");
const finalHandSubmitBtn = document.getElementById("final-hand-submit-btn");
let finalHandWords = [];

declareWinBtn.addEventListener('click', function () {
    endActions.classList.add('disabled');
    declareWinActions.classList.remove('disabled');

    finalHandModal.classList.remove('disabled');
    if (tileTray.children.length + revealTray.children.length === 0) {
        finalHandSubmitBtn.classList.remove('button-inactive');
    } else {
        finalHandSubmitBtn.classList.add('button-inactive');
    }
    finalHandWords = [];
});

const revealWinBtn = document.getElementById("reveal-win");
const finalHand = document.getElementById("final-hand");
revealWinBtn.addEventListener('click', function () {
    if (revealTray.children.length < 2) {
        toast("Sets must contain at least 2 letters");
        return;
    }

    if (revealTray.children.length == 2) {
        let c1 = revealTray.children[0].textContent;
        let c2 = revealTray.children[1].textContent;
        if (c1 !== c2) {
            toast("2-letter sets must be pairs");
            return;
        }
    }
    
    let set = Array.from(revealTray.children).map(tile => tile.textContent);

    if (set.every(x => x === set[0]) && "AEIOU".includes(set[0])) {
        toast("Pairs, triples, and strikes must use consonants");
        return;
    }

    let finalHandLine = document.createElement("div");
    finalHandLine.classList.add("final-hand-line");
    finalHandLine.innerHTML = `
        <div class="final-hand-word">
            <div class="formed-word">
                ${set.map(tile => {
                    return `
                        <div class="mini-tile">${tile}</div>
                    `;
                }).join('')}
            </div>
        </div>
        <button class="final-hand-remove-btn">
            <span class="material-symbols-outlined">close</span>
        </button>
    `;
    finalHandLine.querySelector('.final-hand-remove-btn').addEventListener('click', function () {
        finalHandLine.remove();
        set.forEach(tile => {
            let tileElement = document.createElement("div");
            tileElement.classList.add('tile');
            tileElement.textContent = tile;
            tileTray.appendChild(tileElement);
        })
        finalHandSubmitBtn.classList.add('button-inactive');
        finalHandWords.splice(finalHandWords.indexOf(set), 1);
    })
    finalHand.appendChild(finalHandLine);

    revealTray.replaceChildren();

    if (tileTray.children.length === 0) {
        finalHandSubmitBtn.classList.remove('button-inactive');
    }
    finalHandWords.push(set);
});

finalHandSubmitBtn.addEventListener('click', function () {
    if (finalHandSubmitBtn.classList.contains('button-inactive')) {
        return;
    }
    
    peerSend({type: 'reveal', player: MYID, words: finalHandWords, isFinal: true});
});

const winBackBtn = document.getElementById("win-back");
winBackBtn.addEventListener('click', function () {
    Array.from(document.getElementsByClassName("final-hand-remove-btn")).forEach(button => button.click());
    finalHandWords = [];
    finalHandModal.classList.add('disabled');
   
    declareWinActions.classList.add('disabled');
    endActions.classList.remove('disabled');
});

const winModal = document.getElementById("win-modal");
const winWinnerName = document.getElementById("win-winner-name");
const winStandings = document.getElementById("win-standings");
const winNextDealerName = document.getElementById("win-next-dealer-name");
const restartBtn = document.getElementById("restart-btn");
const handValueCalculation = document.getElementById("hand-value-calculation");
const multipliersList = document.getElementById("multipliers-list");

restartBtn.addEventListener('click', function () {
    peerSend({type: 'restart'});
});

function showWin(playerID, finalHandWords) {
    let score = 0;
    let handValueCalculationInnerHTML = "";
    let winner = GAMESTATE.players.find(player => player.id === playerID);
    for (let word of winner.revealedTiles) {
        if (word.length === 2) {
            score += 1;
            handValueCalculationInnerHTML += `
                <div class="word-value">
                    <div class="word-container">
                        <div class="word-type">
                            Pair
                        </div>
                        <div class="formed-word">
                            ${word.map(tile => {
                                return `
                                    <div class="mini-tile">${tile}</div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    
                    <div class="word-money">
                        $1
                    </div>
                </div>
            `;
        } else if (word.length === 3 && word.every(ltr => !"AEIOU".includes(ltr) && ltr === word[0])) {
            score += 3;
            handValueCalculationInnerHTML += `
                <div class="word-value">
                    <div class="word-container">
                        <div class="word-type">
                            Triple
                        </div>
                        <div class="formed-word">
                            ${word.map(tile => {
                                return `
                                    <div class="mini-tile">${tile}</div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    
                    <div class="word-money">
                        $3
                    </div>
                </div>
            `;
        } else if (word.length === 4 && word.every(ltr => !"AEIOU".includes(ltr) && ltr === word[0])) {
            score += 4;
            handValueCalculationInnerHTML += `
                <div class="word-value">
                    <div class="word-container">
                        <div class="word-type">
                            Revealed strike
                        </div>
                        <div class="formed-word">
                            ${word.map(tile => {
                                return `
                                    <div class="mini-tile">${tile}</div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    
                    <div class="word-money">
                        $10
                    </div>
                </div>
            `;
        } else {
            score += word.length * 2 - 3;
            handValueCalculationInnerHTML += `
                <div class="word-value">
                    <div class="word-container">
                        <div class="word-type">
                            Word
                        </div>
                        <div class="formed-word">
                            ${word.map(tile => {
                                return `
                                    <div class="mini-tile">${tile}</div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    
                    <div class="word-money">
                        $${word.length * 2 - 3}
                    </div>
                </div>
            `;
        }
    }

    for (let word of finalHandWords) {
        if (word.length === 2) {
            score += 1;
            handValueCalculationInnerHTML += `
                <div class="word-value">
                    <div class="word-container">
                        <div class="word-type">
                            Pair
                        </div>
                        <div class="formed-word">
                            ${word.map(tile => {
                                return `
                                    <div class="mini-tile">${tile}</div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    
                    <div class="word-money">
                        $1
                    </div>
                </div>
            `;
        } else if (word.length === 3 && word.every(ltr => !"AEIOU".includes(ltr) && ltr === word[0])) {
            score += 3;
            handValueCalculationInnerHTML += `
                <div class="word-value">
                    <div class="word-container">
                        <div class="word-type">
                            Triple
                        </div>
                        <div class="formed-word">
                            ${word.map(tile => {
                                return `
                                    <div class="mini-tile">${tile}</div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    
                    <div class="word-money">
                        $3
                    </div>
                </div>
            `;
        } else if (word.length === 4 && word.every(ltr => !"AEIOU".includes(ltr) && ltr === word[0])) {
            score += 4;
            handValueCalculationInnerHTML += `
                <div class="word-value">
                    <div class="word-container">
                        <div class="word-type">
                            Hidden strike
                        </div>
                        <div class="formed-word">
                            ${word.map(tile => {
                                return `
                                    <div class="mini-tile">${tile}</div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    
                    <div class="word-money">
                        $20
                    </div>
                </div>
            `;
        } else {
            score += word.length * 2 - 3;
            handValueCalculationInnerHTML += `
                <div class="word-value">
                    <div class="word-container">
                        <div class="word-type">
                            Word
                        </div>
                        <div class="formed-word">
                            ${word.map(tile => {
                                return `
                                    <div class="mini-tile">${tile}</div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    
                    <div class="word-money">
                        $${word.length * 2 - 3}
                    </div>
                </div>
            `;
        }
    }

    let allWords = [...winner.revealedTiles, ...finalHandWords];
    if (allWords.every(word => word.length === 7)) {
        score += 13;
        handValueCalculationInnerHTML += `
            <div class="word-value">
                <div class="word-container">
                    Two 7-letter words bonus
                </div>
                
                <div class="word-money">
                    $13
                </div>
            </div>
        `;
    }
    if (allWords.every(word => word.length === 2)) {
        score += 18;
        handValueCalculationInnerHTML += `
            <div class="word-value">
                <div class="word-container">
                    Seven pairs bonus
                </div>
                
                <div class="word-money">
                    $18
                </div>
            </div>
        `;
    }
    
    handValueCalculationInnerHTML += `
        <div class="word-value">
            <div class="word-container">
                Subtotal
            </div>
            
            <div class="word-money">
                $${score}
            </div>
        </div>
    `
    handValueCalculation.innerHTML = handValueCalculationInnerHTML;
    multipliersList.innerHTML = `
        <div class="multiplier">
            <div class="multiplier-container">
                <div class="multiplier-reason">Dealer</div>
                <div class="multiplier-player">${nameDict[GAMESTATE.players[GAMESTATE.dealerIndex].id]}</div>
            </div>
            
            <div class="multiplier-value">x2</div>
        </div>
        <div class="multiplier">
            <div class="multiplier-container">
                <div class="multiplier-reason">Played/drew the winnng card</div>
                <div class="multiplier-player">${nameDict[GAMESTATE.responsiblePlayer]}</div>
            </div>
            
            <div class="multiplier-value">x2</div>
        </div>
    `

    let changes = [0, 0, 0, 0];
    for (let [i, p] of GAMESTATE.players.entries()) {
        if (p.id !== playerID) {
            changes[i] = -score;
            if (i === GAMESTATE.dealerIndex || playerID === GAMESTATE.players[GAMESTATE.dealerIndex].id) {
                changes[i] *= 2;
            }
            if (p.id === GAMESTATE.responsiblePlayer || playerID === GAMESTATE.responsiblePlayer) {
                changes[i] *= 2;
            }
        }
    }
    changes[GAMESTATE.turnIndex] = -changes.reduce((a, b) => a + b, 0);

    let winStandingsInnerHTML = '';
    for (let [i, p] of GAMESTATE.players.entries()) {
        p.money += changes[i];
        winStandingsInnerHTML += `
            <div class="win-standings-player">
                <div class="win-standings-player-name">${nameDict[p.id]}</div>
                <div class="win-standings-player-change">${changes[i] > 0 ? '+' : '-'}$${Math.abs(changes[i])}</div>
                <div class="win-standings-player-money">${p.money < 0 ? '-' : ''}$${Math.abs(p.money)}</div>
            </div>
        `;
    }
    winStandings.innerHTML = winStandingsInnerHTML;

    winWinnerName.textContent = nameDict[playerID];
    winNextDealerName.textContent = nameDict[GAMESTATE.players[(GAMESTATE.dealerIndex + 1) % 4].id];

    winModal.classList.remove('disabled');

}

function setAvailableActions() {
    if (GAMESTATE.players[GAMESTATE.turnIndex].id === MYID) {
        drawBtn.classList.remove('button-inactive');
    } else {
        drawBtn.classList.add('button-inactive');
    }
    if (GAMESTATE.discardedTiles.length > 0 && GAMESTATE.discardIsActive) {
        if (GAMESTATE.players[GAMESTATE.turnIndex].id === MYID) {
            eatBtn.classList.remove('button-inactive');
        } else {
            eatBtn.classList.add('button-inactive');
        }
        let lastTile = GAMESTATE.discardedTiles[GAMESTATE.discardedTiles.length - 1];
        if (!('AEIOU'.includes(lastTile))) {
            let numCopies = GAMESTATE.players.find(player => player.id === MYID).hand.filter(tile => tile === lastTile).length;
            if (numCopies >= 2) {
                touchBtn.classList.remove('button-inactive');
            } else {
                touchBtn.classList.add('button-inactive');
            }
            if (numCopies >= 3) {
                strikeBtn.classList.remove('button-inactive');
            } else {
                strikeBtn.classList.add('button-inactive');
            }
        }
    } else {
        eatBtn.classList.add('button-inactive');
        touchBtn.classList.add('button-inactive');
        strikeBtn.classList.add('button-inactive');
    }
}

function deepEqual(a, b) {
    if (a === b) return true;

    if (a == null || typeof a !== 'object' ||
        b == null || typeof b !== 'object') {
        console.log(a, b);
        return false;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
        console.log(keysA, keysB);
        return false;
    }

    for (let key of keysA) {
        if (!keysB.includes(key))  {
            console.log(keysA, keysB);
            return false;
        }
        if (!deepEqual(a[key], b[key])) return false;
    }

    return true;
}

function deepVerifyState(GAMESTATE_other) {
    if (!deepEqual(GAMESTATE, GAMESTATE_other)) {
        toast("Game out of sync, redrawing now...")
        GAMESTATE = GAMESTATE_other;
        displayGame();
        setAvailableActions();
    }
}
