// @ts-nocheck
// Debug overlay: paste into console or put inside DOMContentLoaded.
// It depends on #cameraContainer and gameContainer variables existing in scope.
(function () {
    if (window.__debugCollisionInstalled) return;
    window.__debugCollisionInstalled = true;

    function removeDebugOverlays() {
        document.querySelectorAll('.debug-coll-box').forEach(el => el.remove());
    }

    function drawBox(left, top, width, height, color, label) {
        const div = document.createElement('div');
        div.className = 'debug-coll-box';
        div.style.position = 'absolute';
        div.style.left = `${left}px`;
        div.style.top = `${top}px`;
        div.style.width = `${width}px`;
        div.style.height = `${height}px`;
        div.style.background = color;
        div.style.opacity = '0.22';
        div.style.zIndex = 99999;
        div.style.pointerEvents = 'none';
        if (label) div.title = label;
        const cameraContainer = document.querySelector('#cameraContainer') || document.body;
        cameraContainer.appendChild(div);
        return div;
    }

    let debugOn = false;
    let debugInterval = null;

    window.debugCollisionToggle = function (on) {
        debugOn = typeof on === 'boolean' ? on : !debugOn;
        removeDebugOverlays();
        if (debugInterval) {
            clearInterval(debugInterval);
            debugInterval = null;
        }
        if (debugOn) {
            debugInterval = setInterval(() => {
                removeDebugOverlays();
                const player = document.querySelector('#player');
                const gameContainer = document.querySelector('#gameContainer');
                const cameraContainer = document.querySelector('#cameraContainer') || document.body;
                if (!player || !gameContainer) return;
                const pRect = player.getBoundingClientRect();
                const contRect = gameContainer.getBoundingClientRect();
                const relP = {
                    left: pRect.left - contRect.left,
                    top: pRect.top - contRect.top,
                    width: pRect.width,
                    height: pRect.height
                };

                // Cyan: boundingRect snapped to integer pixels (floor)
                drawBox(Math.floor(relP.left), Math.floor(relP.top), Math.floor(relP.width), Math.floor(relP.height), 'cyan', 'player-boundingRect (floored)');

                // Magenta: player's style-based box (for comparison)
                const styleLeft = parseFloat(player.style.left) || 0;
                const styleBottom = parseFloat(player.style.bottom) || 0;
                const containerHeight = gameContainer.getBoundingClientRect().height;
                const styleTop = containerHeight - styleBottom - (pRect.height || 30);
                drawBox(Math.round(styleLeft), Math.round(styleTop), Math.round(pRect.width || 30), Math.round(pRect.height || 30), 'magenta', 'player-style-box');

                // Draw obstacles
                document.querySelectorAll('.obstacle, .block, .spike, .platform').forEach((obs) => {
                    const oRect = obs.getBoundingClientRect();
                    const relO = {
                        left: oRect.left - contRect.left,
                        top: oRect.top - contRect.top,
                        width: oRect.width,
                        height: oRect.height
                    };
                    // Yellow: boundingRect snapped to integer pixels (floor)
                    drawBox(Math.floor(relO.left), Math.floor(relO.top), Math.floor(relO.width), Math.floor(relO.height), 'yellow', 'obstacle-boundingRect (floored)');

                    // Orange: style-based box for obstacle (if style.bottom exists)
                    const oLeftStyle = parseFloat(obs.style.left) || relO.left;
                    const oBottomStyle = parseFloat(obs.style.bottom);
                    let oStyleTop;
                    if (Number.isFinite(oBottomStyle)) {
                        oStyleTop = containerHeight - oBottomStyle - oRect.height;
                    } else {
                        oStyleTop = relO.top;
                    }
                    drawBox(Math.round(oLeftStyle), Math.round(oStyleTop), Math.round(relO.width), Math.round(relO.height), 'orange', 'obstacle-style-box');
                });

            }, 150);
        }
    };

    window.addEventListener('keydown', (e) => {
        if (e.key === 'd' || e.key === 'D') {
            window.debugCollisionToggle();
        }
    });

    console.log('Debug collision overlay installed. Press D to toggle or call debugCollisionToggle(true).');
})();