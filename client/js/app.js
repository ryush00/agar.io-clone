var playerName;
var playerNameInput = document.getElementById('playerNameInput');
var socket;
var reason;
var KEY_ENTER = 13;
var borderDraw = false;


function startGame() {
    playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '');
    document.getElementById('gameAreaWrapper').style.display = 'block';
    document.getElementById('startMenuWrapper').style.display = 'none';
    socket = io();
    setupSocket(socket);
    animloop();
}

// check if nick is valid alphanumeric characters (and underscores)
function validNick() {
    return true;
    var regex = /^.{1,10}$/;
    console.log("Regex Test", regex.exec(playerNameInput.value));
    return regex.exec(playerNameInput.value) !== null;
}

window.onload = function() {
    'use strict';

    var btn = document.getElementById('startButton'),
        nickErrorText = document.querySelector('#startMenu .input-error');

    btn.onclick = function () {

        // check if the nick is valid
        if (validNick()) {
            startGame();
        } else {
            nickErrorText.style.display = 'inline';
        }
    };

    var settingsMenu = document.getElementById('settingsButton');

    settingsMenu.onclick = function () {
        if (settings.style.display != 'block') {
            instructions.style.display = 'none';
            settings.style.display = 'block';
        } else {
            instructions.style.display = 'block';
            settings.style.display = 'none';
        }
    };

    playerNameInput.addEventListener('keypress', function (e) {
        var key = e.which || e.keyCode;

        if (key === KEY_ENTER) {
            if (validNick()) {
                startGame();
            } else {
                nickErrorText.style.display = 'inline';
            }
        }
    });
};

// Canvas
var screenWidth = window.innerWidth;
var screenHeight = window.innerHeight;
var gameWidth = 0;
var gameHeight = 0;
var xoffset = -gameWidth;
var yoffset = -gameHeight;

var gameStart = false;
var disconnected = false;
var died = false;
var kicked = false;

var startPingTime = 0;

var chatCommands = {};
var backgroundColor = '#EEEEEE';

var toggleMassState = 0;

var foodConfig = {
    border: 0,
    borderColor: '#f39c12',
    fillColor: '#f1c40f',
    mass: 0.5
};

var playerConfig = {
    border: 5,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

var enemyConfig = {
    border: 5,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

var player = {
    id: -1,
    x: screenWidth / 2,
    y: screenHeight / 2,
    screenWidth: screenWidth,
    screenHeight: screenHeight,
};

var foods = [];
var enemies = [];
var target = {x: player.x, y: player.y};

var c = document.getElementById('cvs');
c.addEventListener('mousemove', gameInput, false);
c.width = screenWidth; c.height = screenHeight;
c.addEventListener('mouseout', outOfBounds, false);

// register when the mouse goes off the canvas
function outOfBounds() {
    target = { x : 0, y: 0 };
}

function visibleBorder() {
        if (document.getElementById('visBord').checked) {
            borderDraw = true;
        } else {
            borderDraw= false;
        }
}

var graph = c.getContext('2d');

var chatInput = document.getElementById('chatInput');
chatInput.addEventListener('keypress', sendChat);

// Chat
function addChatLine(name, text) {
    var chatLine = document.createElement('li');
    chatLine.className = (name == player.name)?'me':'friend';
    chatLine.innerHTML = '<b>' + name + '</b>: ' + text;
    var chatList = document.getElementById('chatList');
    if (chatList.childNodes.length >=11) {
        chatList.removeChild(chatList.childNodes[0]);
    }
    chatList.appendChild(chatLine);
}

function addSystemLine(text) {
    var chatLine = document.createElement('li');
    chatLine.className = 'system';
    chatLine.innerHTML = text;
    var chatList = document.getElementById('chatList');
    if (chatList.childNodes.length >=11) {
        chatList.removeChild(chatList.childNodes[0]);
    }
    chatList.appendChild(chatLine);
}

function registerChatCommand(name, description, callback) {
    chatCommands[name] = {
        description: description,
        callback: callback
    };
}

function checkLatency() {
    // Ping
    startPingTime = Date.now();
    socket.emit('ping');
}

function toggleDarkMode(args) {
    var LIGHT = '#EEEEEE';
    var DARK = '#181818';
    var on = args[0] === 'on';
    var off = args[0] === 'off';

    if (on || (!off && backgroundColor === LIGHT)) {
        backgroundColor = DARK;
        addSystemLine('Dark mode enabled');
    } else {
        backgroundColor = LIGHT;
        addSystemLine('Dark mode disabled');
    }
}

function printHelp() {
    for (var command in chatCommands) {
        if (chatCommands.hasOwnProperty(command)) {
            addSystemLine('-' + command + ': ' + chatCommands[command].description);
        }
    }
}

function toggleMass() {
	if (toggleMassState === 0) {
		toggleMassState = 1;
		addSystemLine('Mass mode activated!');
	}
	else {
		toggleMassState = 0;
		addSystemLine('Mass mode deactivated!');
	}
}

registerChatCommand('ping', 'Check your latency', function () {
    checkLatency();
});

registerChatCommand('dark', 'Toggle dark mode', function (args) {
    toggleDarkMode(args);
});

registerChatCommand('help', 'Chat commands information', function () {
    printHelp();
});

registerChatCommand('login', 'Login as an admin', function (args) {
    socket.emit('pass', args);
});

registerChatCommand('kick', 'Kick a player', function (args) {
    socket.emit('kick', args);
});

registerChatCommand('mass', 'View Mass', function () {
	toggleMass();
});

function sendChat(key) {
    key = key.which || key.keyCode;
    if (key == KEY_ENTER) {
        var text = chatInput.value.replace(/(<([^>]+)>)/ig,'');
        if (text !== '') {
            if (text.indexOf('-') === 0) {
                var args = text.substring(1).split(' ');
                if (chatCommands[args[0]]) {
                    chatCommands[args[0]].callback(args.slice(1));
                } else {
                    addSystemLine('Unrecoginised Command: ' + text + ', type -help for more info');
                }
            } else {
                socket.emit('playerChat', { sender: player.name, message: text });
                addChatLine(player.name, text);
            }
            chatInput.value = '';
        }
    }
}

function setupSocket(socket) {
    // Handle ping
    socket.on('pong', function () {
        var latency = Date.now() - startPingTime;
        console.log('Latency: ' + latency + 'ms');
        addSystemLine('Ping: ' + latency + 'ms');
    });

    // Handle error
    socket.on('connect_failed', function () {
        socket.close();
        disconnected = true;
    });

    socket.on('disconnect', function () {
        socket.close();
        disconnected = true;
    });

    // Handle connection
    socket.on('welcome', function (playerSettings) {
        player = playerSettings;
        player.name = playerName;
        player.screenWidth = screenWidth;
        player.screenHeight = screenHeight;
        socket.emit('gotit', player);
        gameStart = true;
        console.log('Game is started: ' + gameStart);
        addSystemLine('접속 성공!');
        addSystemLine('<b>-help</b>을 입력해서 명령어 목록을 확인 가능합니다.');
    });

    socket.on('gameSetup', function(data){
        gameWidth = data.gameWidth;
        gameHeight = data.gameHeight;
     });

    socket.on('playerDisconnect', function (data) {
        enemies = data.playersList;
        document.getElementById('status').innerHTML = '접속자 수: ' + enemies.length;
        addSystemLine('Player <b>' + data.disconnectName + '</b>님이 나갔습니다!');
    });

    socket.on('playerDied', function (data) {
        enemies = data.playersList;
        document.getElementById('status').innerHTML = '접속자 수: ' + enemies.length;
        addSystemLine('Player <b>' + data.disconnectName + '</b>님이 죽었습니!');
    });

    socket.on('playerJoin', function (data) {
        console.log(data);
        enemies = data.playersList;
        document.getElementById('status').innerHTML = '접속자 수: ' + enemies.length;
        addSystemLine('Player <b>' + data.connectedName + '</b>님이 참여했습니다!');
    });

    socket.on('serverMSG', function (data) {
        addSystemLine(data);
    });

    // Chat
    socket.on('serverSendPlayerChat', function (data) {
        addChatLine(data.sender, data.message);
    });

    // Handle movement
    socket.on('serverTellPlayerMove', function (playerData, userData, foodsList) {
        var xoffset = player.x - playerData.x;
        var yoffset = player.y - playerData.y;

        player = playerData;
        player.xoffset = isNaN(xoffset) ? 0 : xoffset;
        player.yoffset = isNaN(yoffset) ? 0 : yoffset;

        enemies = userData;
        foods = foodsList;
    });

    socket.on('serverUpdateAll', function (players, foodsList) {
        enemies = players;
        if(foodsList !== 0){
        foods = foodsList;
        }
    });

    // Die
    socket.on('RIP', function () {
        gameStart = false;
        died = true;
        // socket.close();
    });

    socket.on('kick', function (data) {
        gameStart = false;
        reason = data;
        kicked = true;
        socket.close();
    });
}

function massToRadius(mass){
    return Math.sqrt(mass / Math.PI) * 10;
}

function drawCircle(centerX, centerY, mass, sides) {
    var theta = 0;
    var x = 0;
    var y = 0;
    var radius = massToRadius(mass);

    graph.beginPath();

    for (var i = 0; i < sides; i++) {
        theta = (i / sides) * 2 * Math.PI;
        x = centerX + radius * Math.sin(theta);
        y = centerY + radius * Math.cos(theta);
        graph.lineTo(x, y);
    }

    graph.closePath();
    graph.stroke();
    graph.fill();
}

function drawFood(food) {
    graph.strokeStyle = food.color.border || foodConfig.borderColor;
    graph.fillStyle = food.color.fill || foodConfig.fillColor;
    graph.lineWidth = foodConfig.border;
    drawCircle(food.x - player.x + screenWidth / 2, food.y - player.y + screenHeight / 2, massToRadius(foodConfig.mass), 10);
}

function drawPlayer() {
    graph.strokeStyle = 'hsl(' + player.hue + ', 80%, 40%)';
    graph.fillStyle = 'hsl(' + player.hue + ', 70%, 50%)';
    graph.lineWidth = playerConfig.border;
    graph.beginPath();
    graph.arc(screenWidth / 2, screenHeight / 2, massToRadius(player.mass), 0, 2 * Math.PI);
    graph.stroke();
    graph.fill();

    var fontSize = (massToRadius(player.mass) / 2);
    graph.lineWidth = playerConfig.textBorderSize;
    graph.miterLimit = 1;
    graph.lineJoin = 'round';
    graph.textAlign = 'center';
    graph.fillStyle = playerConfig.textColor;
    graph.textBaseline = 'middle';
    graph.strokeStyle = playerConfig.textBorder;
    graph.font = 'bold ' + fontSize + 'px sans-serif';
    if(toggleMassState === 0) {
    	graph.strokeText(player.name, screenWidth / 2, screenHeight / 2);
        graph.fillText(player.name, screenWidth / 2, screenHeight / 2);
 	}
 	else {
 	    graph.strokeText(player.name + ' (' + player.mass + ')', screenWidth / 2, screenHeight / 2);
        graph.fillText(player.name + ' (' + player.mass + ')', screenWidth / 2, screenHeight / 2);
 	}
}

function drawEnemy(enemy) {
    graph.strokeStyle = 'hsl(' + enemy.hue + ', 80%, 40%)';
    graph.fillStyle = 'hsl(' + enemy.hue + ', 70%, 50%)';
    graph.lineWidth = enemyConfig.border;
    graph.beginPath();
    graph.arc(enemy.x - player.x + screenWidth / 2, enemy.y - player.y + screenHeight / 2, massToRadius(enemy.mass), 0, 2 * Math.PI);
    graph.fill();
    graph.stroke();

    var fontSize = (massToRadius(enemy.mass) / 2);

    graph.lineWidth = enemyConfig.textBorderSize;
    graph.textAlign = 'center';
    graph.fillStyle = enemyConfig.textColor;
    graph.textBaseline = 'middle';
    graph.strokeStyle = enemyConfig.textBorder;
    graph.font = 'bold ' + fontSize + 'px sans-serif';
    if(toggleMassState === 0) {
    	graph.strokeText(enemy.name, enemy.x - player.x + screenWidth / 2, enemy.y - player.y + screenHeight / 2);
    	graph.fillText(enemy.name, enemy.x - player.x + screenWidth / 2, enemy.y - player.y + screenHeight / 2);
    }
    else {
    	graph.strokeText(enemy.name + ' (' + enemy.mass + ')', enemy.x - player.x + screenWidth / 2, enemy.y - player.y + screenHeight / 2);
    	graph.fillText(enemy.name + ' (' + enemy.mass + ')', enemy.x - player.x + screenWidth / 2, enemy.y - player.y + screenHeight / 2);
    }
}

function drawgrid(){
    for (var x = xoffset - player.x; x < screenWidth; x += screenHeight / 20) {
        graph.moveTo(x, 0);
        graph.lineTo(x, screenHeight);
    }

    for (var y = yoffset - player.y ; y < screenHeight; y += screenHeight / 20) {
        graph.moveTo(0, y);
        graph.lineTo(screenWidth, y);
    }

    graph.strokeStyle = '#ddd';
    graph.stroke();
}

function drawborder() {
    var borderX = 0;
    var borderY = 0;

    graph.strokeStyle = playerConfig.borderColor;

    // Left-vertical
    if (player.x <= screenWidth/2) {
        graph.beginPath();
        graph.moveTo(screenWidth/2 - player.x, 0 ? player.y > screenHeight/2 : screenHeight/2 - player.y);
        graph.lineTo(screenWidth/2 - player.x, gameHeight + screenHeight/2 - player.y);
        graph.strokeStyle = "#000000";
        graph.stroke();
    }

    // Top-horizontal
    if (player.y <= screenHeight/2) {
        graph.beginPath();
        graph.moveTo(0 ? player.x > screenWidth/2 : screenWidth/2 - player.x, screenHeight/2 - player.y);
        graph.lineTo(gameWidth + screenWidth/2 - player.x, screenHeight/2 - player.y);
        graph.strokeStyle = "#000000";
        graph.stroke();
    }

    // Right-vertical
    if (gameWidth - player.x <= screenWidth/2) {
        graph.beginPath();
        graph.moveTo(gameWidth + screenWidth/2 - player.x, screenHeight/2 - player.y);
        graph.lineTo(gameWidth + screenWidth/2 - player.x, gameHeight + screenHeight/2 - player.y);
        graph.strokeStyle = "#000000";
        graph.stroke();
    }

    // Bottom-horizontal
    if (gameHeight - player.y <= screenHeight/2) {
        graph.beginPath();
        graph.moveTo(gameWidth + screenWidth/2 - player.x, gameHeight + screenHeight/2 - player.y);
        graph.lineTo(screenWidth/2 - player.x, gameHeight + screenHeight/2 - player.y);
        graph.strokeStyle = "#000000";
        graph.stroke();
    }
}

function gameInput(mouse) {
    target.x = mouse.clientX - screenWidth / 2;
    target.y = mouse.clientY - screenHeight / 2;
}

window.requestAnimFrame = (function(){
    return  window.requestAnimationFrame       ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame    ||
            function( callback ){
                window.setTimeout(callback, 1000 / 60);
            };
})();

function animloop(){
    requestAnimFrame(animloop);
    gameLoop();
}

function gameLoop() {
    if (!disconnected) {
        if (gameStart) {
            graph.fillStyle = backgroundColor;
            graph.fillRect(0, 0, screenWidth, screenHeight);
            drawgrid();

            foods.forEach(function(f){ drawFood(f); });

            if(borderDraw){ drawborder(); }

            for (var i = 0; i < enemies.length; i++) {
                if (enemies[i].id != player.id) {
                    drawEnemy(enemies[i]);
                }
            }

            drawPlayer();

            socket.emit('0', target); // playerSendTarget Heartbeat

        } else {
            graph.fillStyle = '#333333';
            graph.fillRect(0, 0, screenWidth, screenHeight);

            graph.textAlign = 'center';
            graph.fillStyle = '#FFFFFF';
            graph.font = 'bold 30px sans-serif';
            graph.fillText('Game Over!', screenWidth / 2, screenHeight / 2);
        }
    } else {
        graph.fillStyle = '#333333';
        graph.fillRect(0, 0, screenWidth, screenHeight);

        graph.textAlign = 'center';
        graph.fillStyle = '#FFFFFF';
        graph.font = 'bold 30px sans-serif';

        if (died) {
            graph.fillText('You died!', screenWidth / 2, screenHeight / 2);
        } else {
            if(kicked){
                  if(reason !== ""){
                       graph.fillText('You were kicked for reason ' + reason, screenWidth / 2, screenHeight / 2);
                 }
                 else{
                      graph.fillText('You were kicked!', screenWidth / 2, screenHeight / 2);
                 }
            }
            else{
                  graph.fillText('Disconnected!', screenWidth / 2, screenHeight / 2);
            }

        }
    }
}

window.addEventListener('resize', function() {
    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;
    player.screenWidth = c.width = screenWidth;
    player.screenHeight = c.height = screenHeight;
}, true);
