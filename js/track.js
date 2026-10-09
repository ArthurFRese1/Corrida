import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
import { CONFIG } from './config.js';

export function createTrack(scene) {
  const { radiusX: rx, radiusZ: rz, roadWidth: width, segments } = CONFIG.track;
  const group = new THREE.Group();
  scene.add(group);

  const grass = new THREE.Mesh(
    new THREE.CircleGeometry(260, 96),
    new THREE.MeshStandardMaterial({ color: 0x4d873d, roughness: 1 })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.15;
  group.add(grass);

  const infield = new THREE.Mesh(
    new THREE.CircleGeometry(1, 96),
    new THREE.MeshStandardMaterial({ color: 0x579447, roughness: 1 })
  );
  infield.rotation.x = -Math.PI / 2;
  infield.scale.set(rx - width * .66, rz - width * .66, 1);
  infield.position.y = -0.08;
  group.add(infield);

  // A faixa da pista é construída como uma malha entre duas elipses.
  const positions = [];
  const uvs = [];
  const indices = [];
  const innerX = rx - width / 2;
  const outerX = rx + width / 2;
  const innerZ = rz - width / 2;
  const outerZ = rz + width / 2;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    positions.push(innerX * c, 0.02, innerZ * s);
    positions.push(outerX * c, 0.02, outerZ * s);
    uvs.push(i / segments * 16, 0, i / segments * 16, 1);
    if (i < segments) {
      const n = i * 2;
      indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
    }
  }
  const roadGeometry = new THREE.BufferGeometry();
  roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  roadGeometry.setIndex(indices);
  roadGeometry.computeVertexNormals();
  const road = new THREE.Mesh(roadGeometry, new THREE.MeshStandardMaterial({
    color: 0x343943, roughness: .95, side: THREE.DoubleSide
  }));
  group.add(road);

  // Faixas externas e internas em blocos alternados, para dar leitura de pista.
  const curbMaterialA = new THREE.MeshStandardMaterial({ color: 0xf5f2e8, roughness: .8 });
  const curbMaterialB = new THREE.MeshStandardMaterial({ color: 0xe64b43, roughness: .8 });
  for (let i = 0; i < segments; i += 2) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 2) / segments) * Math.PI * 2;
    for (const side of [-1, 1]) {
      const rX = rx + side * (width / 2 + .65);
      const rZ = rz + side * (width / 2 + .65);
      const points = [
        new THREE.Vector3(rX * Math.cos(a0), .08, rZ * Math.sin(a0)),
        new THREE.Vector3(rX * Math.cos(a1), .08, rZ * Math.sin(a1)),
        new THREE.Vector3((rX + (side > 0 ? 1.3 : -1.3)) * Math.cos(a1), .08, (rZ + (side > 0 ? 1.3 : -1.3)) * Math.sin(a1)),
        new THREE.Vector3((rX + (side > 0 ? 1.3 : -1.3)) * Math.cos(a0), .08, (rZ + (side > 0 ? 1.3 : -1.3)) * Math.sin(a0))
      ];
      const g = new THREE.BufferGeometry().setFromPoints(points);
      const v = [points[0], points[1], points[2], points[0], points[2], points[3]].flatMap(p => [p.x,p.y,p.z]);
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      g.computeVertexNormals();
      group.add(new THREE.Mesh(g, (i / 2) % 2 ? curbMaterialA : curbMaterialB));
    }
  }

  // Tracejado central.
  const dashMaterial = new THREE.MeshStandardMaterial({ color: 0xf3f0d8, roughness: .8 });
  for (let i = 0; i < segments; i += 5) {
    const a = (i / segments) * Math.PI * 2;
    const dash = new THREE.Mesh(new THREE.BoxGeometry(2.1, .035, .22), dashMaterial);
    dash.position.set(rx * Math.cos(a), .055, rz * Math.sin(a));
    dash.rotation.y = -Math.atan2(rz * Math.cos(a), -rx * Math.sin(a));
    group.add(dash);
  }

  // Linha de largada no lado sul da pista.
  const start = new THREE.Mesh(
    new THREE.BoxGeometry(width, .08, 2.5),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .8 })
  );
  start.position.set(0, .09, rz + .5);
  start.rotation.y = Math.PI / 2;
  group.add(start);
  const darkSquares = new THREE.Mesh(new THREE.BoxGeometry(width, .085, 1.2), new THREE.MeshStandardMaterial({ color: 0x20232b }));
  darkSquares.position.set(0, .095, rz + .5);
  darkSquares.rotation.y = Math.PI / 2;
  group.add(darkSquares);

  // Decoração simples gerada por código ao redor da pista.
  const treeTrunk = new THREE.CylinderGeometry(.45, .65, 3.5, 7);
  const treeTop = new THREE.ConeGeometry(2.4, 5.5, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6c4930 });
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x256d43 }),
    new THREE.MeshStandardMaterial({ color: 0x34804a }),
    new THREE.MeshStandardMaterial({ color: 0x477f37 })
  ];
  for (let i = 0; i < 100; i++) {
    const a = (i / 100) * Math.PI * 2;
    const distance = i % 3 === 0 ? 15 : 22;
    const x = (rx + distance) * Math.cos(a);
    const z = (rz + distance) * Math.sin(a);
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(treeTrunk, trunkMat);
    trunk.position.y = 1.5;
    const leaves = new THREE.Mesh(treeTop, leafMats[i % leafMats.length]);
    leaves.position.y = 5.2;
    tree.add(trunk, leaves);
    tree.position.set(x, 0, z);
    const scale = .7 + (i % 5) * .12;
    tree.scale.setScalar(scale);
    group.add(tree);
  }

  // Alguns blocos de arquibancada simples para preencher o horizonte.
  const standMaterial = new THREE.MeshStandardMaterial({ color: 0x667080, roughness: .9 });
  const standAccent = new THREE.MeshStandardMaterial({ color: 0xffc548, roughness: .8 });
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + .15;
    const x = (rx + 34) * Math.cos(angle);
    const z = (rz + 34) * Math.sin(angle);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(16, 3.8, 5), standMaterial);
    stand.position.set(x, 1.7, z);
    stand.rotation.y = -angle;
    group.add(stand);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(16.1, .45, 5.1), standAccent);
    stripe.position.set(x, 3.2, z);
    stripe.rotation.y = -angle;
    group.add(stripe);
  }

  return {
    group,
    rx, rz, roadWidth: width,
    pointAt(t, laneOffset = 0) {
      const a = t * Math.PI * 2;
      // Direção tangencial à elipse; laneOffset move lateralmente na pista.
      const x = rx * Math.cos(a);
      const z = rz * Math.sin(a);
      const tangent = new THREE.Vector3(-rx * Math.sin(a), 0, rz * Math.cos(a)).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
      return {
        position: new THREE.Vector3(x, 0, z).addScaledVector(normal, laneOffset),
        yaw: Math.atan2(-tangent.x, -tangent.z),
        tangent,
        angle: a
      };
    },
    progressAt(position) {
      let t = Math.atan2(position.z / rz, position.x / rx) / (Math.PI * 2);
      if (t < 0) t += 1;
      return t;
    }
  };
}
