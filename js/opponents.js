
import { createKart } from './kart.js';
import { CONFIG } from './config.js';
import { resolveKartCollision } from './collisions.js';

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
  {
    name: 'agressivo',
    aggression: 0.86,
    riskTolerance: 0.82,
    defense: 0.55,
    preferredLane: -3.4
  },
  {
    name: 'tecnico',
    aggression: 0.64,
    riskTolerance: 0.58,
    defense: 0.72,
    preferredLane: 3.4
  },
  {
    name: 'oportunista',
    aggression: 0.7,
    riskTolerance: 0.68,
    defense: 0.42,
    preferredLane: -3.4
  },
  {
    name: 'defensivo',
    aggression: 0.48,
    riskTolerance: 0.4,
    defense: 0.86,
    preferredLane: 3.4
  }
];

const PILOT_PROFILES = [
  { cornerSkill: 0.62, brakingSkill: 0.58, trajectorySkill: 0.66, overtakingSkill: 0.72, defenseSkill: 0.5, recoverySkill: 0.56 },
  { cornerSkill: 0.86, brakingSkill: 0.84, trajectorySkill: 0.88, overtakingSkill: 0.7, defenseSkill: 0.78, recoverySkill: 0.82 },
  { cornerSkill: 0.68, brakingSkill: 0.64, trajectorySkill: 0.61, overtakingSkill: 0.86, defenseSkill: 0.43, recoverySkill: 0.6 },
  { cornerSkill: 0.58, brakingSkill: 0.72, trajectorySkill: 0.74, overtakingSkill: 0.52, defenseSkill: 0.88, recoverySkill: 0.66 },
  { cornerSkill: 0.76, brakingSkill: 0.68, trajectorySkill: 0.71, overtakingSkill: 0.78, defenseSkill: 0.62, recoverySkill: 0.72 },
  { cornerSkill: 0.7, brakingSkill: 0.6, trajectorySkill: 0.64, overtakingSkill: 0.8, defenseSkill: 0.5, recoverySkill: 0.58 }
];

function forwardDistance(from, to) {
  return (to - from + 1) % 1;
}

function laneAtPosition(track, progress, position) {
  if (!position) return 0;

  const center = track.pointAt(progress, 0).position;
  const lanePoint = track.pointAt(progress, 1).position;
  const laneVector = {
    x: lanePoint.x - center.x,
    z: lanePoint.z - center.z
  };
  const lengthSquared = laneVector.x * laneVector.x +
    laneVector.z * laneVector.z;

  if (lengthSquared <= 0.0001) return 0;

  return (
    (position.x - center.x) * laneVector.x +
    (position.z - center.z) * laneVector.z
  ) / lengthSquared;
}

function laneIsOccupied(
  opponents,
  self,
  lane,
  playerProgress,
  playerLane = 0
) {
  return opponents.some(other => {
    if (other === self || other.finished) return false;

    const distance = forwardDistance(self.progress, other.progress);
    return Math.abs(other.lane - lane) < 2.2 &&
      (distance < SAFE_LANE_GAP || distance > 1 - SAFE_LANE_GAP);
  }) || (
    (forwardDistance(self.progress, playerProgress) < SAFE_LANE_GAP ||
      forwardDistance(playerProgress, self.progress) < SAFE_LANE_GAP) &&
    Math.abs(playerLane - lane) < 2.2
  );
}

export function createOpponents(scene, track, count) {
  const opponents = [];
  const finishedOpponents = [];
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
    const pilot = PILOT_PROFILES[i % PILOT_PROFILES.length];
    const startPoint = track.pointAt(progress, lane);

    kart.root.position.copy(startPoint.position);
    kart.root.position.y = 0.03;
    kart.root.rotation.y = startPoint.yaw;

    opponents.push({
      ...kart,
      progress,
      previousProgress: progress,
      lane,
      targetLane: lane,
      speed: baseSpeed,
      baseSpeed,
      personality,
      pilot,

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
      wobble: Math.random() * Math.PI * 2,
      intent: 'cruise',
      intentTimer: 0,
      overtakeTarget: null,
      decisionCooldown: 0,
      noProgressTime: 0,
      recoveryTimer: 0,
      recoverySide: i % 2 === 0 ? -1 : 1,
      offRoad: false,
      collisionRecovery: 0
    });
  }

  return {
    list: opponents,
    finished: finishedOpponents,

    update(
      dt,
      playerProgress,
      playerSpeed,
      raceStarted = true,
      playerPosition = null
    ) {
      for (const op of opponents) {
        op.bumpTimer = Math.max(0, op.bumpTimer - dt);
        op.nitroCooldown = Math.max(0, op.nitroCooldown - dt);
        op.decisionCooldown = Math.max(0, op.decisionCooldown - dt);
        op.intentTimer = Math.max(0, op.intentTimer - dt);
        op.collisionRecovery = Math.max(0, op.collisionRecovery - dt);
        op.outwardOffset = Math.max(
          0,
          op.outwardOffset - OUTWARD_RECOVERY_SPEED * dt
        );

        if (!op.finished && raceStarted) {
          const oldProgress = op.progress;
          const playerLane = laneAtPosition(
            track,
            playerProgress,
            playerPosition
          );

          op.offRoad = Math.abs(op.lane - op.outwardOffset) >
            track.roadWidth * 0.5;
          op.noProgressTime = Math.abs(op.speed) < 6
            ? op.noProgressTime + dt
            : Math.max(0, op.noProgressTime - dt * 0.5);

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
          const playerClosing = playerSpeed <= op.speed + 4;
          if (
            playerDistance > 0 &&
            playerDistance < closestDistance &&
            playerClosing &&
            Math.abs(playerLane - op.lane) < 3.2
          ) {
            obstacleAhead = {
              id: 'player',
              root: playerPosition ? { position: playerPosition } : null,
              progress: playerProgress,
              lane: playerLane,
              speed: playerSpeed,
              finished: false
            };
            closestDistance = playerDistance;
          }

          const challenger = opponents.find(other => {
            if (other === op || other.finished) return false;

            const behindDistance = forwardDistance(
              other.progress,
              op.progress
            );

            return behindDistance > 0 &&
              behindDistance < 0.045 &&
              other.speed > op.speed + 2;
          });

          const activeOvertake = op.intent === 'overtake' &&
            op.overtakeTarget &&
            !op.overtakeTarget.finished;
          const overtakeCompleted = activeOvertake &&
            forwardDistance(op.overtakeTarget.progress, op.progress) < 0.028 &&
            Math.abs(op.lane - op.overtakeTarget.lane) > 1.2;
          const overtakeBlocked = activeOvertake && laneIsOccupied(
            opponents,
            op,
            op.targetLane,
            playerProgress,
            playerLane
          );

          if (op.noProgressTime > 1.6) {
            op.intent = 'recover';
            op.overtakeTarget = null;
            op.intentTimer = 0.35;
            op.recoveryTimer -= dt;

            if (op.recoveryTimer <= 0) {
              op.recoverySide *= -1;
              op.targetLane = op.recoverySide * LANE_LIMIT;
              op.recoveryTimer = 2.2 +
                (1 - op.pilot.recoverySkill) * 0.8;
            }
          } else if (op.offRoad) {
            op.intent = 'recover';
            op.overtakeTarget = null;
            op.intentTimer = 0.4;
            op.targetLane +=
              (op.outwardOffset - op.targetLane) *
              Math.min(1, dt * (0.75 + op.pilot.recoverySkill));
          } else if (activeOvertake && !overtakeCompleted && !overtakeBlocked) {
            // Mantém a faixa escolhida até a ultrapassagem realmente
            // colocar o alvo para trás, evitando troca nervosa de intenção.
            op.intentTimer = Math.max(op.intentTimer, 0.25);
          } else if (activeOvertake) {
            op.intent = 'cruise';
            op.overtakeTarget = null;
            op.intentTimer = 0;
          } else if (op.intentTimer <= 0 && op.decisionCooldown <= 0) {
            const attackQuality =
              op.personality.aggression * 0.35 +
              op.personality.riskTolerance * 0.2 +
              op.pilot.overtakingSkill * 0.45;

            if (obstacleAhead && attackQuality > 0.32) {
              const preferred = op.personality.preferredLane;
              const candidates = op.personality.name === 'tecnico'
                ? [preferred, -preferred, -LANE_LIMIT, LANE_LIMIT]
                : [
                  preferred,
                  -preferred,
                  op.lane < 0 ? LANE_LIMIT : -LANE_LIMIT
                ];

              const freeLane = candidates.find(candidate =>
                !laneIsOccupied(
                  opponents,
                  op,
                  candidate,
                  playerProgress,
                  playerLane
                )
              );

              if (freeLane !== undefined) {
                op.targetLane = freeLane;
                op.intent = 'overtake';
                op.overtakeTarget = obstacleAhead.root
                  ? obstacleAhead
                  : null;
                op.intentTimer = 0.7 +
                  op.pilot.overtakingSkill * 0.7;
              } else {
                op.intent = 'follow';
                op.overtakeTarget = null;
                op.intentTimer = 0.55;
              }
            } else if (challenger && op.personality.defense > 0.45) {
              const blockLane = Math.max(
                -LANE_LIMIT,
                Math.min(
                  LANE_LIMIT,
                  op.lane + Math.sign(op.lane - challenger.lane) * 1.15
                )
              );

              if (!laneIsOccupied(
                opponents,
                op,
                blockLane,
                playerProgress,
                playerLane
              )) {
                op.targetLane = blockLane;
                op.intent = 'defend';
                op.overtakeTarget = null;
                op.intentTimer = 0.65 +
                  op.pilot.defenseSkill * 0.45;
              }
            } else {
              op.targetLane = op.personality.preferredLane;
              op.intent = 'cruise';
              op.overtakeTarget = null;
              op.intentTimer = 0.45 +
                op.pilot.trajectorySkill * 0.6;
            }

            op.decisionCooldown = 0.18 +
              (1 - op.pilot.trajectorySkill) * 0.35;
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
            (!obstacleAhead ||
              op.personality.aggression > 0.55 ||
              op.intent === 'overtake')
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
              finishedOpponents.push(op);
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
            const curveDemand = Math.abs(
              Math.sin(op.progress * Math.PI * 2)
            );
            const curvePenalty = curveDemand *
              (1 - op.pilot.cornerSkill) * 7;
            const brakingPenalty = curveDemand *
              (1 - op.pilot.brakingSkill) * 2.5;
            const trajectoryPenalty =
              (1 - op.pilot.trajectorySkill) * 1.5;
            const terrainFactor = op.offRoad
              ? 0.42 + op.pilot.recoverySkill * 0.16
              : 1;
            const targetSpeed = Math.max(0, (
              op.baseSpeed +
              Math.sin(performance.now() * 0.0007 + op.wobble) *
              CONFIG.opponent.speedVariation -
              curvePenalty -
              brakingPenalty -
              trajectoryPenalty -
              (blocked ? 5 : 0) -
              (op.bumpTimer > 0 ? 6 : 0)
            ) * terrainFactor);

            const controlRate = op.collisionRecovery > 0 ? 0.9 : 3.5;
            op.speed += (targetSpeed - op.speed) *
              Math.min(1, dt * controlRate);
          }
        }

        const p = track.pointAt(
          op.progress,
          op.lane - op.outwardOffset
        );

        const pathCorrectionRate = op.collisionRecovery > 0 ? 1.1 : 4.5;
        const pathCorrection = Math.min(1, dt * pathCorrectionRate);
        op.root.position.x += (p.position.x - op.root.position.x) * pathCorrection;
        op.root.position.z += (p.position.z - op.root.position.z) * pathCorrection;
        op.root.position.y = 0.03;
        op.root.rotation.y = p.yaw;

        if (op.impactVelocity) {
          op.root.position.x += op.impactVelocity.x * dt;
          op.root.position.z += op.impactVelocity.y * dt;
          op.impactVelocity.multiplyScalar(Math.exp(-dt * 4.2));
        }

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
          if (first.finished || second.finished) continue;

          const collision = resolveKartCollision(first, second);
          if (!collision) continue;

          if (first.lane <= second.lane) {
            first.targetLane = -LANE_LIMIT;
            second.targetLane = LANE_LIMIT;
          } else {
            first.targetLane = LANE_LIMIT;
            second.targetLane = -LANE_LIMIT;
          }

          first.outwardOffset += 0.8 + collision.impact * 1.1;
          second.outwardOffset += 0.8 + collision.impact * 1.1;
          first.collisionRecovery = 0.45;
          second.collisionRecovery = 0.45;
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
