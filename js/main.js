
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import { CONFIG } from './config.js';
import { createTrack } from './track.js';
import { createKart } from './kart.js';
import { createOpponents } from './opponents.js';
import { createItems } from './items.js';
import { resolveKartCollision } from './collisions.js';

const canvas = document.querySelector('#game-canvas');
const joystickIndicator = document.querySelector('#virtual-joystick');
const joystickKnob = document.querySelector('#joystick-knob');
const loadingNote = document.querySelector('#loading-note');
const menuScreen = document.querySelector('#menu-screen');
const pauseScreen = document.querySelector('#pause-screen');
const finishScreen = document.querySelector('#finish-screen');
const hud = document.querySelector('#hud');
const startButton = document.querySelector('#start-button');
const controlsButton = document.querySelector('#controls-button');
const controlsHelp = document.querySelector('#controls-help');
const resumeButton = document.querySelector('#resume-button');
const restartButton = document.querySelector('#restart-button');
const menuButton = document.querySelector('#menu-button');
const raceAgainButton = document.querySelector('#race-again-button');
const finishMenuButton = document.querySelector('#finish-menu-button');
const lapValue = document.querySelector('#lap-value');
const positionValue = document.querySelector('#position-value');
const speedValue = document.querySelector('#speed-value');
const nitroFill = document.querySelector('#nitro-fill');
const itemIndicator = document.querySelector('#item-indicator');
const raceMessage = document.querySelector('#race-message');
const finishTitle = document.querySelector('#finish-title');
const finishDescription = document.querySelector('#finish-description');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9dd5ed);
scene.fog = new THREE.Fog(0x9dd5ed, 170, 430);

const camera = new THREE.PerspectiveCamera(
  66,
  window.innerWidth / window.innerHeight,
  0.1,
  900
);

camera.position.set(0, 14, 30);

scene.add(new THREE.HemisphereLight(0xeaf7ff, 0x56724a, 2.0));

const sun = new THREE.DirectionalLight(0xfff0d2, 2.7);
sun.position.set(-70, 120, 50);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -180;
sun.shadow.camera.right = 180;
sun.shadow.camera.top = 180;
sun.shadow.camera.bottom = -180;
scene.add(sun);

const track = createTrack(scene);

let player;
let opponents;
let items;

let gameState = 'menu';

let speed = 0;
const playerImpactVelocity = new THREE.Vector2();
let nitro = 100;
let nitroActive = false;
let nitroNeedsRelease = false;

let currentLap = 1;
let previousProgress = 0;
let lapStage = 0;

let raceTime = 0;
let countdown = 3.3;
let raceStarted = false;
let finishTime = 0;
const raceFinishOrder = [];
let nextFinishPosition = 1;
let playerFinishPosition = 0;

let collectedItem = false;
let itemType = '—';

let lastFrame = performance.now();
let steerVisual = 0;
let invulnerable = 0;
let offRoadTime = 0;

const keys = new Set();

const mobile = {
  nitro: false
};

const mobileInput = {
  steer: 0,
  throttle: 0,
  brake: 0
};

const joystick = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  maxDistance: 96,
  deadZone: 9
};

function setupPlayer() {
  player = createKart(0x16a9e8, true);
  scene.add(player.root);

  const p = track.pointAt(0.27, 0);

  player.root.position.copy(p.position);
  player.root.position.y = 0.03;
  player.root.rotation.y = p.yaw;

  previousProgress = track.progressAt(player.root.position);
}

setupPlayer();

function clearRaceObjects() {
  if (opponents) opponents.dispose();
  if (items) items.dispose();

  opponents = createOpponents(scene, track, CONFIG.opponentCount);
  items = createItems(scene, track);
}

function progressFromFinish(progress) {
  return (progress - 0.25 + 1) % 1;
}

function raceScore(lap, progress) {
  return lap + progressFromFinish(progress);
}

function resetRaceResults() {
  raceFinishOrder.length = 0;
  nextFinishPosition = 1;
  playerFinishPosition = 0;
}

function registerFinishedOpponents() {
  if (!opponents) return;

  const finishedOpponents = opponents.finished ||
    opponents.list.filter(op => op.finished);

  const newResults = finishedOpponents
    .filter(op => !raceFinishOrder.some(result => result.opponent === op))
    .sort((a, b) => a.finishPosition - b.finishPosition);

  for (const opponent of newResults) {
    raceFinishOrder.push({
      opponent,
      position: nextFinishPosition++
    });
  }
}

function registerPlayerFinish() {
  if (playerFinishPosition > 0) return;

  playerFinishPosition = nextFinishPosition++;
  raceFinishOrder.push({
    player: true,
    position: playerFinishPosition
  });
}

function resetRace() {
  resetJoystick();
  resetRaceResults();
  speed = 0;
  playerImpactVelocity.set(0, 0);
  nitro = 100;
  nitroActive = false;
  nitroNeedsRelease = false;

  currentLap = 1;
  lapStage = 0;

  raceTime = 0;
  countdown = 3.3;
  raceStarted = false;
  finishTime = 0;

  collectedItem = false;
  itemType = '—';

  invulnerable = 0;
  offRoadTime = 0;
  steerVisual = 0;

  const p = track.pointAt(0.27, 0);

  player.root.position.copy(p.position);
  player.root.position.y = 0.03;
  player.root.rotation.y = p.yaw;

  previousProgress = track.progressAt(player.root.position);

  clearRaceObjects();
  updateHud();

  raceMessage.textContent = '3';
  raceMessage.classList.remove('hidden');
}

function updateHud() {
  registerFinishedOpponents();

  lapValue.textContent =
    `${Math.min(currentLap, CONFIG.lapsToWin)} / ${CONFIG.lapsToWin}`;

  speedValue.textContent = String(
    Math.round(Math.abs(speed) * 3.6)
  ).padStart(3, '0');

  nitroFill.style.width = `${Math.max(0, nitro)}%`;

  itemIndicator.textContent = collectedItem
    ? `ITEM: ${itemType} (ESPAÇO)`
    : 'ITEM: —';

  const playerProgress = track.progressAt(player.root.position);
  const playerScore = raceScore(currentLap - 1, playerProgress);

  let rank = 1;

  if (playerFinishPosition > 0) {
    rank = playerFinishPosition;
  } else {
    rank += raceFinishOrder.filter(result => !result.player).length;

    if (opponents) {
      for (const op of opponents.list) {
        if (op.finished) continue;

        const opponentScore = raceScore(op.lap, op.progress);

        if (opponentScore > playerScore) {
          rank++;
        }
      }
    }
  }

  positionValue.textContent = `${rank}º`;
}

function startRace() {
  resetRace();

  gameState = 'racing';

  menuScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  finishScreen.classList.add('hidden');
  hud.classList.remove('hidden');

  loadingNote.textContent =
    'WASD / setas • Espaço: nitro • Esc: pausa';
}

function showMenu() {
  resetJoystick();
  gameState = 'menu';

  menuScreen.classList.remove('hidden');
  pauseScreen.classList.add('hidden');
  finishScreen.classList.add('hidden');
  hud.classList.add('hidden');

  speed = 0;

  loadingNote.textContent =
    'Protótipo 0.1 — pista e veículos gerados por código';
}

function pauseGame() {
  if (gameState !== 'racing') return;

  gameState = 'paused';
  pauseScreen.classList.remove('hidden');
  raceMessage.classList.add('hidden');
}

function resumeGame() {
  if (gameState !== 'paused') return;

  gameState = 'racing';
  pauseScreen.classList.add('hidden');
  lastFrame = performance.now();
}

function finishRace() {
  registerPlayerFinish();
  updateHud();
  gameState = 'finished';
  finishTime = raceTime;

  finishScreen.classList.remove('hidden');
  hud.classList.add('hidden');

  const rank = parseInt(positionValue.textContent, 10) || 1;

  finishTitle.textContent =
    rank === 1 ? 'Vitória!' : 'Corrida concluída!';

  finishDescription.textContent =
    `Posição final estimada: ${rank}º • Tempo: ${formatTime(finishTime)}`;

  raceMessage.classList.add('hidden');
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2).padStart(5, '0');

  return `${String(mins).padStart(2, '0')}:${secs}`;
}

function refreshFinishPosition() {
  const finalRank = parseInt(positionValue.textContent, 10) || 1;
  finishDescription.textContent =
    `Posicao final: ${finalRank} - Tempo: ${formatTime(finishTime)}`;
}

startButton.addEventListener('click', startRace);

controlsButton.addEventListener('click', () => {
  controlsHelp.classList.toggle('hidden');
});

resumeButton.addEventListener('click', resumeGame);
restartButton.addEventListener('click', startRace);
menuButton.addEventListener('click', showMenu);
raceAgainButton.addEventListener('click', startRace);
finishMenuButton.addEventListener('click', showMenu);

window.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();

  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
    event.preventDefault();
  }

  keys.add(key);

  if (key === 'escape') {
    if (gameState === 'racing') {
      pauseGame();
    } else if (gameState === 'paused') {
      resumeGame();
    }
  }

  if (key === 'r' && gameState === 'racing') {
    const p = track.pointAt(
      track.progressAt(player.root.position),
      0
    );

    player.root.position.copy(p.position);
    player.root.rotation.y = p.yaw;
    speed = 0;
  }
});

window.addEventListener('keyup', event => {
  keys.delete(event.key.toLowerCase());
});

document.querySelectorAll('[data-control]').forEach(button => {
  const control = button.dataset.control;

  const set = value => {
    mobile[control] = value;
  };

  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    set(true);
  });

  const release = () => set(false);

  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
});

function pressed(...names) {
  return names.some(name => keys.has(name));
}

function isDown(control, ...keyNames) {
  return mobile[control] || pressed(...keyNames);
}

function setJoystickVisual(x, y) {
  joystickIndicator.style.left = `${x}px`;
  joystickIndicator.style.top = `${y}px`;
  joystickKnob.style.setProperty('--joystick-x', '0px');
  joystickKnob.style.setProperty('--joystick-y', '0px');
}

function resetJoystick() {
  joystick.active = false;
  joystick.pointerId = null;
  mobileInput.steer = 0;
  mobileInput.throttle = 0;
  mobileInput.brake = 0;
  joystickIndicator.classList.add('hidden');
  joystickKnob.style.setProperty('--joystick-x', '0px');
  joystickKnob.style.setProperty('--joystick-y', '0px');
}

function endJoystick(event) {
  if (
    event &&
    joystick.pointerId !== null &&
    event.pointerId !== joystick.pointerId
  ) {
    return;
  }

  resetJoystick();
}

function updateJoystick(event) {
  if (!joystick.active || event.pointerId !== joystick.pointerId) {
    return;
  }

  const dx = event.clientX - joystick.startX;
  const dy = event.clientY - joystick.startY;
  const distance = Math.hypot(dx, dy);
  const limitedDistance = Math.min(distance, joystick.maxDistance);
  const scale = distance > 0 ? limitedDistance / distance : 0;
  const offsetX = dx * scale;
  const offsetY = dy * scale;

  joystickKnob.style.setProperty('--joystick-x', `${offsetX}px`);
  joystickKnob.style.setProperty('--joystick-y', `${offsetY}px`);

  if (distance <= joystick.deadZone) {
    mobileInput.steer = 0;
    mobileInput.throttle = 0;
    mobileInput.brake = 0;
    return;
  }

  const normalizedX = offsetX / joystick.maxDistance;
  const normalizedY = offsetY / joystick.maxDistance;

  // O vetor já foi limitado pelo comprimento total: diagonais não passam
  // de 1 e conservam aceleração e direção ao mesmo tempo.
  // No telefone, o eixo horizontal do gesto precisa corresponder ao lado
  // visual esperado pelo kart: dedo à esquerda vira para a esquerda.
  mobileInput.steer = THREE.MathUtils.clamp(-normalizedX, -1, 1);
  mobileInput.throttle = THREE.MathUtils.clamp(-normalizedY, 0, 1);
  mobileInput.brake = THREE.MathUtils.clamp(normalizedY, 0, 1);
}

function startJoystick(event) {
  if (
    gameState !== 'racing' ||
    event.pointerType === 'mouse' ||
    joystick.active
  ) {
    return;
  }

  event.preventDefault();
  joystick.active = true;
  joystick.pointerId = event.pointerId;
  joystick.startX = event.clientX;
  joystick.startY = event.clientY;
  joystick.maxDistance = Math.max(
    72,
    Math.min(112, Math.min(window.innerWidth, window.innerHeight) * 0.18)
  );

  joystickIndicator.style.width = `${joystick.maxDistance * 2}px`;
  joystickIndicator.style.height = `${joystick.maxDistance * 2}px`;
  setJoystickVisual(event.clientX, event.clientY);
  joystickIndicator.classList.remove('hidden');
  try {
    canvas.setPointerCapture?.(event.pointerId);
  } catch {
    // Alguns ambientes sintéticos não possuem captura nativa ativa.
  }
  updateJoystick(event);
}

canvas.addEventListener('pointerdown', startJoystick, { passive: false });
canvas.addEventListener('pointermove', updateJoystick, { passive: false });
canvas.addEventListener('pointerup', endJoystick);
canvas.addEventListener('pointercancel', endJoystick);
canvas.addEventListener('lostpointercapture', endJoystick);

window.addEventListener('blur', () => {
  keys.clear();
  mobile.nitro = false;
  nitroNeedsRelease = false;
  resetJoystick();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    mobile.nitro = false;
    nitroNeedsRelease = false;
    resetJoystick();
  }
});

function updatePlayer(dt) {
  if (invulnerable > 0) {
    invulnerable -= dt;
  }

  if (!raceStarted) {
    countdown -= dt;

    const number = Math.ceil(countdown);

    raceMessage.textContent =
      countdown > 0.3
        ? String(Math.max(1, number))
        : 'VAI!';

    if (countdown <= 0) {
      raceStarted = true;
      raceMessage.classList.add('hidden');
    }

    return;
  }

  raceTime += dt;

  const accelerate = isDown('accelerate', 'w', 'arrowup');
  const brake = isDown('brake', 's', 'arrowdown');
  const left = isDown('left', 'a', 'arrowleft');
  const right = isDown('right', 'd', 'arrowright');
  const throttleInput = Math.max(
    mobileInput.throttle,
    accelerate ? 1 : 0
  );
  const brakeInput = Math.max(
    mobileInput.brake,
    brake ? 1 : 0
  );

  // Aceleração e desaceleração:
  // soltar o acelerador faz o kart perder velocidade até ZERO,
  // mas nunca provoca marcha à ré automaticamente.
  if (throttleInput > 0) {
    speed += CONFIG.player.acceleration * throttleInput * dt;
  } else if (speed > 0) {
    speed = Math.max(0, speed - 4.4 * dt);
  } else if (speed < 0) {
    speed = Math.min(0, speed + 5.2 * dt);
  }

  // O controle de freio pode colocar o kart em marcha à ré
  // quando ele já está parado ou andando para trás.
  if (brakeInput > 0) {
    if (speed > 0) {
      speed = Math.max(
        0,
        speed - CONFIG.player.braking * brakeInput * dt
      );
    } else {
      speed -= CONFIG.player.acceleration * 0.65 * brakeInput * dt;
    }
  }

  const nitroRequested = isDown('nitro', ' ');
  if (!nitroRequested) {
    nitroNeedsRelease = false;
  } else if (nitro <= 0) {
    nitroNeedsRelease = true;
  }

  nitroActive =
    nitroRequested &&
    !nitroNeedsRelease &&
    nitro > 0 &&
    speed > 4;

  if (nitroActive) {
    const nitroTime = Math.min(dt, nitro / 34);
    speed += 27 * nitroTime;
    nitro = Math.max(0, nitro - 34 * nitroTime);

    if (nitro <= 0) {
      nitroActive = false;
      nitroNeedsRelease = true;
    }
  } else {
    nitro = Math.min(100, nitro + 5.2 * dt);
  }

  speed = THREE.MathUtils.clamp(
    speed,
    -CONFIG.player.reverseSpeed,
    CONFIG.player.maxSpeed + (nitroActive ? 14 : 0)
  );

  const keyboardSteer = (left ? 1 : 0) - (right ? 1 : 0);
  const steer = THREE.MathUtils.clamp(
    keyboardSteer + mobileInput.steer,
    -1,
    1
  );

  const steerStrength =
    0.4 + Math.min(Math.abs(speed) / CONFIG.player.maxSpeed, 1);

  const directionFactor = speed < -1 ? -1 : 1;

  player.root.rotation.y +=
    steer *
    CONFIG.player.steering *
    steerStrength *
    directionFactor *
    dt *
    (Math.abs(speed) > 0.4 ? 1 : 0.25);

  steerVisual +=
    (steer * 0.28 - steerVisual) * Math.min(1, dt * 7);

  player.root.rotation.z =
    -steerVisual * Math.min(Math.abs(speed) / 28, 0.6);

  const forward = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(player.root.quaternion);

  player.root.position.addScaledVector(forward, speed * dt);
  player.root.position.x += playerImpactVelocity.x * dt;
  player.root.position.z += playerImpactVelocity.y * dt;
  playerImpactVelocity.multiplyScalar(Math.exp(-dt * 4.5));

  // Pequena perda de aderência em alta velocidade para deixar as curvas
  // mais agressivas sem mover o kart artificialmente de faixa.
  if (steer !== 0 && Math.abs(speed) > 24) {
    speed = Math.max(0, speed - Math.abs(steer) * 0.7 * dt);
  }

  player.wheels.forEach(wheel => {
    wheel.rotation.x += speed * dt * 0.65;
  });

  const progress = track.progressAt(player.root.position);
  const nearest = track.pointAt(progress, 0).position;

  const dist = Math.hypot(
    player.root.position.x - nearest.x,
    player.root.position.z - nearest.z
  );

  if (dist > CONFIG.track.roadWidth * 0.62) {
    offRoadTime += dt;
    speed *= Math.max(0.88, 1 - dt * 1.7);

    if (offRoadTime > 2.8) {
      player.root.position.lerp(nearest, 0.12);
      speed *= 0.97;
    }
  } else {
    offRoadTime = 0;
  }

  // Validação da volta do jogador por pontos de controle.
  if (raceStarted && speed > 0) {
    if (
      lapStage === 0 &&
      previousProgress < 0.40 &&
      progress >= 0.40
    ) {
      lapStage = 1;
    } else if (
      lapStage === 1 &&
      previousProgress < 0.60 &&
      progress >= 0.60
    ) {
      lapStage = 2;
    } else if (
      lapStage === 2 &&
      previousProgress < 0.80 &&
      progress >= 0.80
    ) {
      lapStage = 3;
    } else if (
      lapStage === 3 &&
      previousProgress < 0.95 &&
      progress >= 0.95
    ) {
      lapStage = 4;
    } else if (
      lapStage === 4 &&
      previousProgress > 0.95 &&
      progress < 0.05
    ) {
      lapStage = 5;
    } else if (
      lapStage === 5 &&
      previousProgress < 0.12 &&
      progress >= 0.12
    ) {
      lapStage = 6;
    } else if (
      lapStage === 6 &&
      previousProgress < 0.25 &&
      progress >= 0.25
    ) {
      currentLap++;
      lapStage = 0;

      if (currentLap > CONFIG.lapsToWin) {
        finishRace();
      } else {
        raceMessage.textContent = `VOLTA ${currentLap}`;
        raceMessage.classList.remove('hidden');

        setTimeout(() => {
          if (gameState === 'racing' && raceStarted) {
            raceMessage.classList.add('hidden');
          }
        }, 1000);
      }
    }
  }

  previousProgress = progress;

  // Colisão simples com os karts rivais.
}

function resolvePlayerCollisions() {
  if (!opponents || gameState !== 'racing') return;

  const playerBody = {
    root: player.root,
    speed,
    isPlayer: true,
    impactVelocity: playerImpactVelocity
  };

  for (const op of opponents.list) {
    if (op.finished) continue;

    const collision = resolveKartCollision(playerBody, op);

    if (collision && invulnerable <= 0) {
      nitro = Math.max(0, nitro - 8 * collision.impact);
      invulnerable = 0.45;
      op.bumpTimer = 0.35;
      op.collisionRecovery = 0.45;
      op.outwardOffset += 0.8 + collision.impact * 1.1;
    }
  }

  speed = playerBody.speed;
}

function finishIfAllOpponentsFinished() {
  if (
    gameState !== 'racing' ||
    playerFinishPosition > 0 ||
    !opponents ||
    opponents.list.length === 0
  ) {
    return;
  }

  if (opponents.list.every(op => op.finished)) {
    finishRace();
  }
}

function updateCamera(dt) {
  const forward = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(player.root.quaternion);

  const desired = player.root.position.clone()
    .addScaledVector(forward, -13.5)
    .add(new THREE.Vector3(0, 7.2, 0));

  camera.position.lerp(
    desired,
    1 - Math.exp(-dt * 4.3)
  );

  const look = player.root.position.clone()
    .addScaledVector(forward, 5)
    .add(new THREE.Vector3(0, 1.4, 0));

  camera.lookAt(look);

  camera.fov = THREE.MathUtils.lerp(
    camera.fov,
    nitroActive && nitro > 0 ? 72 : 66,
    1 - Math.exp(-dt * 4)
  );

  camera.updateProjectionMatrix();
}

function updateMenuCamera(time) {
  if (gameState !== 'menu') return;

  const t = time * 0.00006;
  const p = track.pointAt(0.72 + Math.sin(t) * 0.03, 0);

  camera.position.lerp(
    new THREE.Vector3(
      p.position.x + 28,
      19,
      p.position.z + 36
    ),
    0.012
  );

  camera.lookAt(p.position);
}

function animate(now) {
  requestAnimationFrame(animate);

  const dt = Math.min((now - lastFrame) / 1000, 0.04);
  lastFrame = now;

  if (gameState === 'racing') {
    updatePlayer(dt);

    if (opponents) {
      opponents.update(
        dt,
        track.progressAt(player.root.position),
        speed,
        raceStarted
      );
      finishIfAllOpponentsFinished();
      resolvePlayerCollisions();
      updateHud();

      if (gameState === 'finished') {
        refreshFinishPosition();
      }
    }

    if (items) {
      items.update(
        dt,
        track.progressAt(player.root.position),
        player.root.position,
        collector => {
          if (collector) {
            collector.nitro = Math.min(100, collector.nitro + 32);
            return;
          }

          collectedItem = true;
          itemType = 'IMPULSO';

          itemIndicator.textContent = 'ITEM: IMPULSO (ESPAÇO)';
          nitro = Math.min(100, nitro + 24);
        },
        opponents ? opponents.list : []
      );
    }

    updateCamera(dt);
  } else {
    if (opponents) {
      opponents.update(dt, 0, 0, false);
    }

    updateMenuCamera(now);
  }

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 1.75)
  );
});

loadingNote.textContent =
  'Protótipo 0.1 — pista e veículos gerados por código';
