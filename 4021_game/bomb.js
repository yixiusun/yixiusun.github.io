// Manages bomb hazards that explode on contact with players.
(function(global) {
const BombManager = function(ctx, svgElement, config) {
    const options = config || {};
    const moveCircle = options.moveCircle;
    const stepTime = options.stepTime || 5;
    const svgWidth = options.svgWidth || 3000;
    const svgHeight = options.svgHeight || 1500;
    const playerRadius = options.playerRadius || 30;
    const bombRadius = options.bombRadius || 45;
    const normalFrameDuration = options.normalFrameDuration || 200;
    const explosionFrameDuration = options.explosionFrameDuration || 80;
    const idleRenderScale = (typeof options.renderScale === "number") ? options.renderScale : 1;
    const svgns = "http://www.w3.org/2000/svg";
    const $svg = $(svgElement);

    const spriteSheet = {
        src: "./others.png",
        image: new Image(),
        ready: false
    };

    const idleFrames = [
        { sx: 105, sy: 29, sw: 257 - 105, sh: 214 - 29 },
        { sx: 465, sy: 29, sw: 605 - 465, sh: 214 - 29 }
    ];

    const explosionFrames = [];
    const explosionFrameCount = 6;
    const totalWidth = 1000;
    const frameHeight = 434 - 284;
    for (let i = 0; i < explosionFrameCount; i += 1) {
        const start = Math.round((totalWidth / explosionFrameCount) * i);
        const end = (i === explosionFrameCount - 1)
            ? totalWidth
            : Math.round((totalWidth / explosionFrameCount) * (i + 1));
        explosionFrames.push({
            sx: start,
            sy: 284,
            sw: Math.max(1, end - start),
            sh: frameHeight
        });
    }

    spriteSheet.image.onload = function() {
        spriteSheet.ready = true;
    };
    spriteSheet.image.src = spriteSheet.src;

    const bombs = [];
    let bombCounter = 0;

    function destroyBomb(bomb) {
        if (!bomb.state.exist) return;
        bomb.state.exist = 0;
        if (bomb.circle) {
            bomb.circle.remove();
            bomb.circle = null;
        }
    }

    function triggerExplosion(bomb) {
        if (!bomb || bomb.state.exploding) return;
        bomb.state.exploding = true;
        bomb.state.sprite.type = "explosion";
        bomb.state.sprite.frameIndex = 0;
        bomb.state.sprite.frameTimer = 0;
        bomb.velocity.sx = 0;
        bomb.velocity.sy = 0;
        if (bomb.circle) {
            bomb.circle.remove();
            bomb.circle = null;
        }
    }

    function createBomb(spawnX, spawnY, velocity) {
        const circle = $(document.createElementNS(svgns, "circle"));
        circle.attr({
            cx: spawnX,
            cy: spawnY,
            r: bombRadius,
            fill: "rgba(255, 220, 120, 0.4)",
            stroke: "#bb6e1a",
            "stroke-width": 2
        }).appendTo($svg);

        const bomb = {
            id: bombCounter,
            circle: circle,
            velocity: velocity,
            state: {
                id: bombCounter,
                position: { x: spawnX, y: spawnY },
                radius: bombRadius,
                exist: 1,
                exploding: false,
                sprite: {
                    type: "idle",
                    frameIndex: 0,
                    frameTimer: 0
                }
            }
        };

        bomb.destroy = function() {
            destroyBomb(bomb);
        };

        bombs.push(bomb);
        bombCounter += 1;
        return bomb;
    }

    function spawnRandom() {
        const fromTop = Math.random() > 0.5 ? 1 : -1;
        const spawnX = Math.random() * 1000 + 1000;
        const spawnY = 750 - fromTop * 850;
        const velocity = {
            sx: (Math.random() * 200) - 100,
            sy: (Math.random() * Math.pow(100, 2)) ** 0.5 + 200
        };
        velocity.sy *= fromTop;
        return createBomb(spawnX, spawnY, velocity);
    }

    function updateSpriteState(sprite, frameCount, frameDuration) {
        sprite.frameTimer += stepTime;
        if (sprite.frameTimer >= frameDuration) {
            sprite.frameTimer = 0;
            sprite.frameIndex = (sprite.frameIndex + 1) % frameCount;
        }
    }

    function update() {
        if (!moveCircle) return;
        const offscreenMargin = bombRadius * 3;
        for (let i = 0; i < bombs.length; i += 1) {
            const bomb = bombs[i];
            if (!bomb || bomb.state.exist === 0) continue;

            if (!bomb.state.exploding) {
                moveCircle(bomb.circle, bomb.velocity, 0);
                bomb.state.position.x = parseFloat(bomb.circle.attr("cx"));
                bomb.state.position.y = parseFloat(bomb.circle.attr("cy"));
                updateSpriteState(bomb.state.sprite, idleFrames.length, normalFrameDuration);

                if (bomb.state.position.x < -offscreenMargin || bomb.state.position.x > svgWidth + offscreenMargin ||
                    bomb.state.position.y < -offscreenMargin || bomb.state.position.y > svgHeight + offscreenMargin) {
                    bomb.destroy();
                }
            } else {
                const sprite = bomb.state.sprite;
                sprite.frameTimer += stepTime;
                if (sprite.frameTimer >= explosionFrameDuration) {
                    sprite.frameTimer = 0;
                    sprite.frameIndex += 1;
                    if (sprite.frameIndex >= explosionFrames.length) {
                        bomb.destroy();
                        continue;
                    }
                }
            }
        }
    }

    function draw(externalCtx) {
        const drawCtx = externalCtx || ctx;
        for (let i = 0; i < bombs.length; i += 1) {
            const bomb = bombs[i];
            if (!bomb || bomb.state.exist === 0) continue;

            const isExploding = bomb.state.exploding;

            if (!spriteSheet.ready) {
                drawCtx.beginPath();
                drawCtx.fillStyle = "#ffcc66";
                drawCtx.strokeStyle = "#bb6e1a";
                drawCtx.lineWidth = 2;
                const radius = isExploding ? bombRadius : bombRadius * idleRenderScale;
                drawCtx.arc(bomb.state.position.x, bomb.state.position.y, radius, 0, Math.PI * 2);
                drawCtx.fill();
                drawCtx.stroke();
                continue;
            }

            let frame;
            if (isExploding) {
                const idx = Math.min(bomb.state.sprite.frameIndex, explosionFrames.length - 1);
                frame = explosionFrames[idx];
            } else {
                frame = idleFrames[bomb.state.sprite.frameIndex % idleFrames.length];
            }

            const scale = isExploding ? 1.2 : idleRenderScale;
            const off_x = isExploding ? 30 : 0;
            const off_y = isExploding ? 0 : -19;
            const destWidth = frame.sw * scale;
            const destHeight = frame.sh * scale;
            drawCtx.drawImage(
                spriteSheet.image,
                frame.sx,
                frame.sy,
                frame.sw,
                frame.sh,
                bomb.state.position.x - destWidth / 2 + off_x,
                bomb.state.position.y - destHeight / 2 + off_y,
                destWidth,
                destHeight
            );
        }
    }

    function handlePlayerCollisions(players, playerRadiusOverride) {
        const victims = [];
        const seen = {};
        const collideRadius = bombRadius + (playerRadiusOverride || playerRadius);
        const collideRadiusSq = collideRadius * collideRadius;
        for (let i = 0; i < bombs.length; i += 1) {
            const bomb = bombs[i];
            if (!bomb || bomb.state.exist === 0 || bomb.state.exploding) continue;
            const bx = bomb.state.position.x;
            const by = bomb.state.position.y;
            for (let p = 0; p < players.length; p += 1) {
                const ply = players[p];
                if (!ply) continue;
                if (ply.state && ply.state.alive === 0) continue;
                const dx = ply.state.position.x - bx;
                const dy = ply.state.position.y - by;
                if (dx * dx + dy * dy <= collideRadiusSq) {
                    if (!seen[p]) {
                        victims.push(p);
                        seen[p] = true;
                    }
                    triggerExplosion(bomb);
                        break;
                }
            }
        }
        return victims;
    }

    function getStates() {
        const active = [];
        for (let i = 0; i < bombs.length; i += 1) {
            const bomb = bombs[i];
            if (!bomb || bomb.state.exist === 0) continue;
            active.push({
                id: bomb.state.id,
                position: { x: bomb.state.position.x, y: bomb.state.position.y },
                exploding: bomb.state.exploding
            });
        }
        return active;
    }

    return {
        spawnRandom: spawnRandom,
        update: update,
        draw: draw,
        handlePlayerCollisions: handlePlayerCollisions,
        getStates: getStates
    };
};

global.BombManager = BombManager;
})(window);
