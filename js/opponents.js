javascript
import { createKart } from './kart.js';

const COLORS = [
  0xff5252,
  0x9d7bff,
  0x48d597,
  0xff8b3d,
  0xff70c8,
  0x4e7dff
];

// Posição da linha de largada/chegada.
const FINISH_LINE_PROGRESS = 0.25;

export function createOpponents(scene, track, count) {
  const opponents = [];

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
    const baseSpeed = 25 + (i % 3) * 2.2;

    opponents.push({
      ...kart,

      progress,
      previousProgress: progress,

      lane,
      speed: baseSpeed,
      baseSpeed,

      // Voltas completas dos NPCs.
      lap: 0,

      finished: false,
      rank: i + 2,
      wobble: Math.random() * Math.PI * 2
    });
  }

  return {
    list: opponents,

    update(dt, playerProgress, playerSpeed, raceStarted = true) {
      for (const op of opponents) {
        if (!op.finished && raceStarted) {
          const oldProgress = op.progress;

          op.previousProgress = oldProgress;

          const progressStep =
            (op.speed / (Math.PI * 2 * 70)) * dt;

          // Distância até a linha de chegada.
          let distanceToFinish =
            (FINISH_LINE_PROGRESS - oldProgress + 1) % 1;

          // Se estiver exatamente na linha, considera a próxima volta.
          if (distanceToFinish < 0.000001) {
            distanceToFinish = 1;
          }

          // Conta a volta ao cruzar a linha.
          if (progressStep >= distanceToFinish) {
            op.lap += 1;
          }

          // Atualiza a posição na pista, incluindo a passagem por zero.
          op.progress = (oldProgress + progressStep) % 1;

          // Variação leve de velocidade.
          op.speed =
            op.baseSpeed +
            Math.sin(
              performance.now() * 0.0007 + op.wobble
            ) * 1.6;
        }

        const p = track.pointAt(op.progress, op.lane);

        op.root.position.copy(p.position);
        op.root.position.y = 0.03;
        op.root.rotation.y = p.yaw;

        op.wheels.forEach(wheel => {
          wheel.rotation.x += dt * op.speed * 0.5;
        });
      }
    },

    dispose() {
      for (const op of opponents) {
        scene.remove(op.root);
      }
    }
  };
}
