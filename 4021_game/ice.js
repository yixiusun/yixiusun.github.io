// Handles ice obstacles that freeze weapons when touched.
(function(global) {
const IceManager = function(ctx, svgElement, config) {
    const options = config || {};
    const moveCircle = options.moveCircle;
    const stepTime = options.stepTime || 5;
    const svgWidth = options.svgWidth || 3000;
    const svgHeight = options.svgHeight || 1500;
    const baseBallRadius = options.ballRadius || 20;
    const defaultWeaponRadius = options.weaponRadius || 70;
    const freezeDuration = options.freezeDuration || 2000;
    const iceRadius = typeof options.iceRadius === "number" ? options.iceRadius : baseBallRadius * 2;
    const renderScale = (typeof options.renderScale === "number") ? options.renderScale : 1;
    const svgns = "http://www.w3.org/2000/svg";
    const $svg = $(svgElement);

    const iceSpriteSheet = {
        src: "./ice.png",
        image: new Image(),
        ready: false,
        frameSize: 256,
        frameDuration: 120,
        frames: [
            { sx: 0, sy: 128 },
            { sx: 256, sy: 128 },
            { sx: 512, sy: 128 },
            { sx: 768, sy: 128 }
        ]
    };

    iceSpriteSheet.image.onload = function() {
        iceSpriteSheet.ready = true;
    };
    iceSpriteSheet.image.src = iceSpriteSheet.src;

    const ices = [];
    let iceCounter = 0;

    function destroyIce(ice) {
        if (!ice.state.exist) return;
        ice.state.exist = 0;
        ice.circle.remove();
    }

    function createIce(spawnX, spawnY, velocity) {
        const circle = $(document.createElementNS(svgns, "circle"));
        circle.attr({
            cx: spawnX,
            cy: spawnY,
            r: iceRadius,
            fill: "rgba(173, 219, 255, 0.6)",
            stroke: "#387aa5",
            "stroke-width": 2
        }).appendTo($svg);

        const ice = {
            id: iceCounter,
            circle: circle,
            velocity: velocity,
            state: {
                id: iceCounter,
                position: { x: spawnX, y: spawnY },
                exist: 1,
                sprite: {
                    frameIndex: 0,
                    frameTimer: 0
                }
            }
        };

        ice.destroy = function() {
            destroyIce(ice);
        };

        ices.push(ice);
        iceCounter += 1;
        return ice;
    }

    function spawnRandom() {
        const fromTop = Math.random() > 0.5 ? 1 : -1;
        const spawnX = Math.random() * 1000 + 1000;
        const spawnY = 750 - fromTop * 850;
        const velocity = {
            sx: (Math.random() * 200) - 100,
            sy: (Math.random() * Math.pow(100, 2)) ** 0.5 + 150
        };
        velocity.sy *= fromTop;
        return createIce(spawnX, spawnY, velocity);
    }

    function update() {
        if (!moveCircle) return;
        for (let i = 0; i < ices.length; i += 1) {
            const ice = ices[i];
            if (!ice || ice.state.exist === 0) continue;
            moveCircle(ice.circle, ice.velocity, 0);
            ice.state.position.x = parseFloat(ice.circle.attr("cx"));
            ice.state.position.y = parseFloat(ice.circle.attr("cy"));

            if (iceSpriteSheet.ready) {
                ice.state.sprite.frameTimer += stepTime;
                if (ice.state.sprite.frameTimer >= iceSpriteSheet.frameDuration) {
                    ice.state.sprite.frameTimer = 0;
                    ice.state.sprite.frameIndex = (ice.state.sprite.frameIndex + 1) % iceSpriteSheet.frames.length;
                }
            }

            const offscreenMargin = Math.max(iceRadius * 3, 150);
            if (ice.state.position.x < -offscreenMargin || ice.state.position.x > svgWidth + offscreenMargin ||
                ice.state.position.y < -offscreenMargin || ice.state.position.y > svgHeight + offscreenMargin) {
                ice.destroy();
            }
        }
    }

    function draw(externalCtx) {
        const drawCtx = externalCtx || ctx;
        const destSize = iceRadius * 2 * renderScale;
        for (let i = 0; i < ices.length; i += 1) {
            const ice = ices[i];
            if (!ice || ice.state.exist === 0) continue;
            if (iceSpriteSheet.ready) {
                const frame = iceSpriteSheet.frames[ice.state.sprite.frameIndex % iceSpriteSheet.frames.length];
                drawCtx.drawImage(
                    iceSpriteSheet.image,
                    frame.sx,
                    frame.sy,
                    iceSpriteSheet.frameSize,
                    iceSpriteSheet.frameSize,
                    ice.state.position.x - destSize / 2,
                    ice.state.position.y - destSize / 2,
                    destSize,
                    destSize
                );
            } else {
                drawCtx.beginPath();
                drawCtx.fillStyle = "#88d8f7";
                drawCtx.strokeStyle = "#3a90b1";
                drawCtx.lineWidth = 2;
                drawCtx.arc(ice.state.position.x, ice.state.position.y, iceRadius * renderScale, 0, Math.PI * 2);
                drawCtx.fill();
                drawCtx.stroke();
            }
        }
    }

    function handleWeaponCollision(weaponState, weaponVelocity, weaponRadiusOverride) {
        if (!weaponState) return 0;
        const weaponX = weaponState.position ? weaponState.position.x : weaponState.x;
        const weaponY = weaponState.position ? weaponState.position.y : weaponState.y;
        if (typeof weaponX !== "number" || typeof weaponY !== "number") return 0;

        const weaponRadius = (typeof weaponRadiusOverride === "number") ? weaponRadiusOverride : (weaponState.radius || defaultWeaponRadius);
        const collideRadius = iceRadius + weaponRadius;
        const collideRadiusSq = collideRadius * collideRadius;
        for (let i = 0; i < ices.length; i += 1) {
            const ice = ices[i];
            if (!ice || ice.state.exist === 0) continue;
            const dx = ice.state.position.x - weaponX;
            const dy = ice.state.position.y - weaponY;
            const distSq = dx * dx + dy * dy;
            if (distSq <= collideRadiusSq) {
                ice.destroy();
                if (weaponVelocity) {
                    weaponVelocity.sx = 0;
                    weaponVelocity.sy = 0;
                }
                return freezeDuration;
            }
        }
        return 0;
    }

    function getStates() {
        const active = [];
        for (let i = 0; i < ices.length; i += 1) {
            const ice = ices[i];
            if (!ice || ice.state.exist === 0) continue;
            active.push({
                id: ice.state.id,
                position: { x: ice.state.position.x, y: ice.state.position.y }
            });
        }
        return active;
    }

    return {
        spawnRandom: spawnRandom,
        update: update,
        draw: draw,
        handleWeaponCollision: handleWeaponCollision,
        getStates: getStates
    };
};

global.IceManager = IceManager;
})(window);
