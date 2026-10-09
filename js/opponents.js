import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import { createKart } from './kart.js';

const COLORS = [0xff5252, 0x9d7bff, 0x48d597, 0xff8b3d, 0xff70c8, 0x4e7dff];

export function createOpponents(scene, track, count) {
  const opponents = [];
  for (let i = 0; i < count; i++) {
    const kart = createKart(COLORS[i % COLORS.length], false);
    scene.add(kart.root);
    const progress = .88 - i * .025;
    const lane = (i % 2 === 0 ? -3.4 : 3.4);
    const speed = 25 + (i % 3) * 2.2;
    opponents.push({
      ...kart, progress: (progress + 1) % 1, lane, speed,
      baseSpeed: speed, lap: 0, finished: false, rank: i + 2,
      wobble: Math.random() * Math.PI * 2
    });
  }
  return {
    list: opponents,
    update(dt, playerProgress, playerSpeed, raceStarted = true) {
      for (const op of opponents) {
        if (!op.finished && raceStarted) {
          op.progress += (op.speed / (Math.PI * 2 * 70)) * dt;
          if (op.progress >= 1) { op.progress -= 1; op.lap++; }
          op.speed = op.baseSpeed + Math.sin(performance.now() * .0007 + op.wobble) * 1.6;
        }
        const p = track.pointAt(op.progress, op.lane);
        op.root.position.copy(p.position);
        op.root.position.y = .03;
        op.root.rotation.y = p.yaw;
        op.wheels.forEach(w => { w.rotation.x += dt * op.speed * .5; });
      }
    },
    dispose() {
      for (const op of opponents) scene.remove(op.root);
    }
  };
}
