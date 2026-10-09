import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

export function createKart(color = 0x25b8ff, isPlayer = false) {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: .12 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x20242d, roughness: .8 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9be7f4, roughness: .28, metalness: .05 });
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff1bd, emissive: 0xffaa33, emissiveIntensity: .45 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.35, .65, 3.6), bodyMat);
  body.position.y = .85;
  root.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.75, .32, 1.1), bodyMat);
  nose.position.set(0, .72, -1.85);
  root.add(nose);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.1, .8, 1.05), darkMat);
  seat.position.set(0, 1.35, .2);
  root.add(seat);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.35, .52, .12), glassMat);
  windshield.position.set(0, 1.48, -.63);
  windshield.rotation.x = -.2;
  root.add(windshield);
  // Piloto estilizado, sem modelo externo.
  const head = new THREE.Mesh(new THREE.SphereGeometry(.42, 14, 12), new THREE.MeshStandardMaterial({ color: isPlayer ? 0xffd0a5 : 0xe8bb92 }));
  head.position.set(0, 1.85, -.05);
  root.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(.47, 14, 10, 0, Math.PI * 2, 0, Math.PI * .58), new THREE.MeshStandardMaterial({ color: isPlayer ? 0xffc845 : color }));
  helmet.position.set(0, 2.02, -.05);
  root.add(helmet);
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(.48, .48, .34, 12);
  for (const x of [-1.2, 1.2]) {
    for (const z of [-1.15, 1.2]) {
      const wheel = new THREE.Mesh(wheelGeo, darkMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, .53, z);
      root.add(wheel);
      wheels.push(wheel);
    }
  }
  for (const x of [-.68, .68]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(.35, .17, .08), lightMat);
    light.position.set(x, .92, -2.42);
    root.add(light);
  }
  // Spoiler.
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, .16, .3), darkMat);
  spoiler.position.set(0, 1.45, 1.55);
  root.add(spoiler);
  return { root, wheels, body, color };
}
