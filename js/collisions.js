import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

const HALF_WIDTH = 1.2;
const HALF_LENGTH = 1.8;
const POSITION_SLOP = 0.015;
const MAX_POSITION_CORRECTION = 0.45;
const RESTITUTION = 0.12;

function axisFromYaw(yaw) {
  return [
    new THREE.Vector2(Math.cos(yaw), -Math.sin(yaw)),
    new THREE.Vector2(Math.sin(yaw), Math.cos(yaw))
  ];
}

function projectRadius(axis, axes) {
  return HALF_WIDTH * Math.abs(axis.dot(axes[0])) +
    HALF_LENGTH * Math.abs(axis.dot(axes[1]));
}

function getObb(kart) {
  return {
    center: new THREE.Vector2(kart.root.position.x, kart.root.position.z),
    axes: axisFromYaw(kart.root.rotation.y)
  };
}

export function detectKartCollision(first, second) {
  const a = getObb(first);
  const b = getObb(second);
  const delta = a.center.clone().sub(b.center);
  const axes = [...a.axes, ...b.axes];
  let smallestOverlap = Infinity;
  let collisionNormal = null;

  for (const axis of axes) {
    const distance = Math.abs(delta.dot(axis));
    const overlap = projectRadius(axis, a.axes) +
      projectRadius(axis, b.axes) - distance;

    if (overlap <= POSITION_SLOP) return null;

    if (overlap < smallestOverlap) {
      smallestOverlap = overlap;
      collisionNormal = axis.clone();
    }
  }

  if (delta.dot(collisionNormal) < 0) {
    collisionNormal.negate();
  }

  return {
    normal: collisionNormal,
    penetration: smallestOverlap
  };
}

function forwardVector(kart) {
  return new THREE.Vector2(
    -Math.sin(kart.root.rotation.y),
    -Math.cos(kart.root.rotation.y)
  );
}

function speedOf(kart) {
  return Number.isFinite(kart.speed) ? kart.speed : 0;
}

function impactVelocityOf(kart) {
  if (!(kart.impactVelocity instanceof THREE.Vector2)) {
    kart.impactVelocity = new THREE.Vector2();
  }

  return kart.impactVelocity;
}

function velocityOf(kart) {
  return forwardVector(kart).multiplyScalar(speedOf(kart))
    .add(impactVelocityOf(kart));
}

function applyVelocity(kart, velocity) {
  const forward = forwardVector(kart);
  const longitudinalSpeed = velocity.dot(forward);
  const lateralVelocity = velocity.clone()
    .addScaledVector(forward, -longitudinalSpeed);

  if (Number.isFinite(kart.speed)) {
    kart.speed = longitudinalSpeed;
  }

  impactVelocityOf(kart).copy(lateralVelocity);
}

export function resolveKartCollision(first, second) {
  const collision = detectKartCollision(first, second);
  if (!collision) return null;

  const firstMass = first.isPlayer ? 1.15 : 1;
  const secondMass = second.isPlayer ? 1.15 : 1;
  const inverseMassTotal = 1 / firstMass + 1 / secondMass;
  const correction = Math.min(
    MAX_POSITION_CORRECTION,
    Math.max(0, collision.penetration + POSITION_SLOP)
  ) / inverseMassTotal;

  first.root.position.x += collision.normal.x * correction / firstMass;
  first.root.position.z += collision.normal.y * correction / firstMass;
  second.root.position.x -= collision.normal.x * correction / secondMass;
  second.root.position.z -= collision.normal.y * correction / secondMass;

  const relativeVelocity = velocityOf(first).sub(velocityOf(second));
  const closingSpeed = Math.max(0, -relativeVelocity.dot(collision.normal));
  const impact = Math.min(1, closingSpeed / 34);

  if (closingSpeed > 0.05) {
    const impulse = closingSpeed * (1 + RESTITUTION) /
      inverseMassTotal;
    const firstVelocity = velocityOf(first)
      .addScaledVector(collision.normal, impulse / firstMass);
    const secondVelocity = velocityOf(second)
      .addScaledVector(collision.normal, -impulse / secondMass);

    applyVelocity(first, firstVelocity);
    applyVelocity(second, secondVelocity);
  }

  return {
    ...collision,
    impact,
    closingSpeed
  };
}
