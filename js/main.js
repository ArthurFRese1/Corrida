
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import { CONFIG } from './config.js';
import { createTrack } from './track.js';
import { createKart } from './kart.js';
import { createOpponents } from './opponents.js';
import { createItems } from './items.js';

const canvas = document.querySelector('#game-canvas');
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
let nitro = 100;
let nitroActive = false;

let currentLap = 1;
let previousProgress = 0;
let lapStage = 0;

let raceTime = 0;
let countdown = 3.3;
let raceStarted = false;
let finishTime = 0;

let collectedItem = false;
let itemType = '—';

let lastFrame = performance.now();
let steerVisual = 0;
let invulnerable = 0;
let offRoadTime = 0;

const keys = new Set();

const mobile = {
  left: false,
  right: false,
  accelerate: false,
  brake: false,
  nitro: false
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

function resetRace() {
  speed = 0;
  nitro = 100;
  nitroActive = false;

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
  const playerProgressFromFinish =
    (playerProgress - 0.25 + 1) % 1;

  const playerScore =
    (currentLap - 1) + playerProgressFromFinish;

  let rank = 1;

  if (opponents) {
    for (const op of opponents.list) {
      const opponentProgressFromFinish =
        (op.progress - 0.25 + 1) % 1;

      const opponentScore =
        op.lap + opponentProgressFromFinish;

      if (opponentScore > playerScore) {
        rank++;
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

  nitroActive = isDown('nitro', ' ');

  // Aceleração e desaceleração:
  // soltar o acelerador faz o kart perder velocidade até ZERO,
  // mas nunca provoca marcha à ré automaticamente.
  if (accelerate) {
    speed += CONFIG.player.acceleration * dt;
  } else if (speed > 0) {
    speed = Math.max(0, speed - 5.2 * dt);
  } else if (speed < 0) {
    speed = Math.min(0, speed + 5.2 * dt);
  }

  // O controle de freio pode colocar o kart em marcha à ré
  // quando ele já está parado ou andando para trás.
  if (brake) {
    if (speed > 0) {
      speed = Math.max(0, speed - CONFIG.player.braking * dt);
    } else {
      speed -= CONFIG.player.acceleration * 0.65 * dt;
    }
  }

  if (nitroActive && nitro > 0 && speed > 4) {
    speed += 27 * dt;
    nitro = Math.max(0, nitro - 34 * dt);
  } else {
    nitro = Math.min(100, nitro + 5.2 * dt);
  }

  speed = THREE.MathUtils.clamp(
    speed,
    -CONFIG.player.reverseSpeed,
    CONFIG.player.maxSpeed + (nitroActive ? 14 : 0)
  );

  const steer = (left ? 1 : 0) - (right ? 1 : 0);

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
        updateHud();
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
  if (opponents) {
    for (const op of opponents.list) {
      const dx = player.root.position.x - op.root.position.x;
      const dz = player.root.position.z - op.root.position.z;

      if (
        dx * dx + dz * dz < 10 &&
        invulnerable <= 0
      ) {
        speed *= 0.62;
        nitro = Math.max(0, nitro - 8);
        invulnerable = 0.8;

        player.root.position.addScaledVector(forward, -1.5);
      }
    }
  }

  updateHud();
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
    }

    if (items) {
      items.update(
        dt,
        track.progressAt(player.root.position),
        player.root.position,
        () => {
          collectedItem = true;
          itemType = 'IMPULSO';

          itemIndicator.textContent = 'ITEM: IMPULSO (ESPAÇO)';
          nitro = Math.min(100, nitro + 24);
        }
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
