
import { createKart } from './kart.js';
import { CONFIG } from './config.js';

const COLORS = [
  0xff5252,
  0x9d7bff,
  0x48d597,
  0xff8b3d,
  0xff70c8,
  0x4e7dff
];

// Progresso da linha de chegada.
const FINISH_LINE_PROGRESS = 0.25;
const LANE_LIMIT = 4.3;
const OVERTAKE_LOOK_AHEAD = 0.085;
const SAFE_LANE_GAP = 0.055;
const NITRO_DURATION = 1.25;
const NITRO_COOLDOWN = 4.5;
const NITRO_SPEED_BONUS = 14;
const OUTWARD_RECOVERY_SPEED = 1.6;

const PERSONALITIES = [
  { speedFactor: 0.98, aggression: 0.25, preferredLane: -3.4 },
  { speedFactor: 1.02, aggression: 0.55, preferredLane: 3.4 },
  { speedFactor: 1.06, aggression: 0.8, preferredLane: -3.4 },
  { speedFactor: 1.0, aggression: 0.45, preferredLane: 3.4 },
  { speedFactor: 1.04, aggression: 0.65, preferredLane: -3.4 },
  { speedFactor: 1.08, aggression: 0.9, preferredLane: 3.4 }
];

function forwardDistance(from, to) {
  return (to - from + 1) % 1;
}

function laneIsOccupied(opponents, self, lane, playerProgress) {
  return opponents.some(other => {
    if (other === self || other.finished) return false;

    const distance = forwardDistance(self.progress, other.progress);
    return Math.abs(other.lane - lane) < 2.2 &&
      (distance < SAFE_LANE_GAP || distance > 1 - SAFE_LANE_GAP);
  }) || (
    forwardDistance(self.progress, playerProgress) < SAFE_LANE_GAP &&
    Math.abs(lane) < 2.2
  );
}

export function createOpponents(scene, track, count) {
  const opponents = [];
  let finishSequence = 0;

  // Posições iniciais dos NPCs.
  const gridProgress = [
    0.265,
    0.265,
    0.285,
    0.285,
    0.305,
    0.305
  ];

  for (let i = 0; i < count; i++) {
    const kart = createKart(COLORS[i % COLORS.length], false);

    scene.add(kart.root);

    const progress = gridProgress[i % gridProgress.length];
    const lane = i % 2 === 0 ? -3.4 : 3.4;
    const baseSpeed = CONFIG.opponent.baseSpeed +
      (i % 3) * CONFIG.opponent.speedStep;
    const personality = PERSONALITIES[i % PERSONALITIES.length];

    opponents.push({
      ...kart,
      progress,
      previousProgress: progress,
      lane,
      targetLane: lane,
      speed: baseSpeed,
      baseSpeed,
      personality,

      // Número de linhas de chegada cruzadas após a largada.
      lap: 0,

      finished: false,
      finishPosition: 0,
      bumpTimer: 0,
      nitro: 35,
      nitroActive: false,
      nitroTimer: 0,
      nitroCooldown: 0,
      outwardOffset: 0,
      rank: i + 2,
      wobble: Math.random() * Math.PI * 2
    });
  }

  return {
    list: opponents,

    update(dt, playerProgress, playerSpeed, raceStarted = true) {
      for (const op of opponents) {
        op.bumpTimer = Math.max(0, op.bumpTimer - dt);
        op.nitroCooldown = Math.max(0, op.nitroCooldown - dt);
        op.outwardOffset = Math.max(
          0,
          op.outwardOffset - OUTWARD_RECOVERY_SPEED * dt
        );

        if (!op.finished && raceStarted) {
          const oldProgress = op.progress;

          op.previousProgress = oldProgress;

          let obstacleAhead = null;
          let closestDistance = OVERTAKE_LOOK_AHEAD;

          for (const other of opponents) {
            if (other === op || other.finished) continue;

            const distance = forwardDistance(op.progress, other.progress);
            if (
              distance > 0 &&
              distance < closestDistance &&
              Math.abs(other.lane - op.lane) < 3.2
            ) {
              obstacleAhead = other;
              closestDistance = distance;
            }
          }

          const playerDistance = forwardDistance(op.progress, playerProgress);
          if (
            playerSpeed > 0 &&
            playerDistance > 0 &&
            playerDistance < closestDistance &&
            Math.abs(op.lane) < 3.2
          ) {
            obstacleAhead = { lane: 0 };
            closestDistance = playerDistance;
          }

          if (obstacleAhead && op.personality.aggression > 0.35) {
            const candidates = [
              -LANE_LIMIT,
              LANE_LIMIT,
              op.personality.preferredLane
            ];

            const freeLane = candidates.find(candidate =>
              !laneIsOccupied(opponents, op, candidate, playerProgress)
            );

            if (freeLane !== undefined) {
              op.targetLane = freeLane;
            }
          } else if (!obstacleAhead) {
            op.targetLane +=
              (op.personality.preferredLane - op.targetLane) *
              Math.min(1, dt * 0.8);
          }

          const laneDelta = op.targetLane - op.lane;
          op.lane += Math.sign(laneDelta) * Math.min(
            Math.abs(laneDelta),
            CONFIG.opponent.laneChangeSpeed * dt
          );

          if (
            !op.nitroActive &&
            op.nitro > 0 &&
            op.nitroCooldown <= 0 &&
            (!obstacleAhead || op.personality.aggression > 0.55)
          ) {
            op.nitroActive = true;
            op.nitroTimer = NITRO_DURATION;
            op.nitroCooldown = NITRO_COOLDOWN;
          }

          if (op.nitroActive) {
            op.nitroTimer -= dt;
            op.nitro = Math.max(0, op.nitro - 31 * dt);

            if (op.nitroTimer <= 0 || op.nitro <= 0) {
              op.nitroActive = false;
            }
          }

          const progressStep =
            ((op.speed + (op.nitroActive ? NITRO_SPEED_BONUS : 0)) /
              (Math.PI * 2 * 70)) * dt;

          // Progresso sem limitar ao intervalo de 0 a 1.
          const rawProgress = oldProgress + progressStep;

          // Normaliza o progresso para a volta atual da pista.
          const newProgress = rawProgress % 1;

          // Detecta a linha de chegada mesmo na passagem de 1 para 0.
          const crossedFinish =
            rawProgress >= FINISH_LINE_PROGRESS &&
            Math.floor(
              (rawProgress - FINISH_LINE_PROGRESS)
            ) >
            Math.floor(
              (oldProgress - FINISH_LINE_PROGRESS)
            );

          if (crossedFinish) {
            op.lap += 1;

            if (op.lap >= CONFIG.lapsToWin) {
              op.finished = true;
              op.finishPosition = ++finishSequence;
              op.speed = 0;
              op.nitroActive = false;
            }
          }

          op.progress = newProgress;

          // Variação leve de velocidade e redução natural atrás de um rival.
          if (!op.finished) {
            const blocked = obstacleAhead &&
              closestDistance < 0.035 &&
              Math.abs(op.targetLane - op.lane) < 1.2;
            const targetSpeed = op.baseSpeed * op.personality.speedFactor +
              Math.sin(performance.now() * 0.0007 + op.wobble) *
              CONFIG.opponent.speedVariation -
              (blocked ? 5 : 0) -
              (op.bumpTimer > 0 ? 6 : 0);

            op.speed += (targetSpeed - op.speed) * Math.min(1, dt * 3.5);
          }
        }

        const p = track.pointAt(
          op.progress,
          op.lane - op.outwardOffset
        );

        op.root.position.copy(p.position);
        op.root.position.y = 0.03;
        op.root.rotation.y = p.yaw;

        op.wheels.forEach(wheel => {
          wheel.rotation.x += dt * (
            op.speed + (op.nitroActive ? NITRO_SPEED_BONUS : 0)
          ) * 0.5;
        });
      }

      // Se dois NPCs chegam muito perto, eles abrem as faixas gradualmente
      // em vez de permanecerem sobrepostos ou presos um no outro.
      for (let i = 0; i < opponents.length; i++) {
        for (let j = i + 1; j < opponents.length; j++) {
          const first = opponents[i];
          const second = opponents[j];
          const dx = first.root.position.x - second.root.position.x;
          const dz = first.root.position.z - second.root.position.z;

          if (dx * dx + dz * dz >= 9) continue;

          if (first.lane <= second.lane) {
            first.targetLane = -LANE_LIMIT;
            second.targetLane = LANE_LIMIT;
          } else {
            first.targetLane = LANE_LIMIT;
            second.targetLane = -LANE_LIMIT;
          }

          first.speed *= CONFIG.opponent.collisionSlowdown;
          second.speed *= CONFIG.opponent.collisionSlowdown;
          first.outwardOffset += 2.4;
          second.outwardOffset += 2.4;
          first.bumpTimer = 0.35;
          second.bumpTimer = 0.35;
        }
      }
    },

    dispose() {
      for (const op of opponents) {
        scene.remove(op.root);
      }
    }
  };
}
