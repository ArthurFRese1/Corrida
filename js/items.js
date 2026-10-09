import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import { CONFIG } from './config.js';

export function createItems(scene, track) {
  const items = [];
  const geometry = new THREE.BoxGeometry(2.1, 2.1, 2.1);
  const material = new THREE.MeshStandardMaterial({
    color: 0x52e8ff, emissive: 0x147eaa, emissiveIntensity: .65, metalness: .15, roughness: .25
  });
  const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x7defff, emissiveIntensity: .5 });
  for (let i = 0; i < CONFIG.itemCount; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(2.18, 2.18, 2.18), new THREE.EdgesGeometry(geometry), edgeMaterial);
    mesh.add(edge);
    const progress = (i + .5) / CONFIG.itemCount;
    const lane = i % 2 === 0 ? -4.3 : 4.3;
    const p = track.pointAt(progress, lane);
    mesh.position.copy(p.position);
    mesh.position.y = 2.3;
    scene.add(mesh);
    items.push({ mesh, progress, lane, active: true, respawn: 0 });
  }
  return {
    list: items,
    update(dt, playerProgress, playerPosition, onCollect, collectors = []) {
      for (const item of items) {
        item.mesh.rotation.y += dt * 1.2;
        item.mesh.rotation.x += dt * .35;
        if (!item.active) {
          item.respawn -= dt;
          if (item.respawn <= 0) {
            item.active = true;
            item.mesh.visible = true;
          }
          continue;
        }
        const possibleCollectors = [
          { entity: null, position: playerPosition },
          ...collectors.filter(entity => !entity.finished).map(entity => ({
            entity,
            position: entity.root.position
          }))
        ];

        const collector = possibleCollectors.find(candidate => {
          const dx = item.mesh.position.x - candidate.position.x;
          const dz = item.mesh.position.z - candidate.position.z;
          return dx * dx + dz * dz < 20;
        });

        if (collector) {
          item.active = false;
          item.respawn = 7;
          item.mesh.visible = false;
          onCollect(collector.entity, item);
        }
      }
    },
    dispose() { for (const item of items) scene.remove(item.mesh); }
  };
}
