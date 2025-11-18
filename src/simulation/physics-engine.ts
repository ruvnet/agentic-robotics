/**
 * Physics Engine - Core physics simulation with collision detection
 * Handles rigid body dynamics, forces, and collision detection
 */

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Pose {
  position: Vector3D;
  orientation: Quaternion;
}

export interface Velocity {
  linear: Vector3D;
  angular: Vector3D;
}

export interface Force {
  linear: Vector3D;
  torque: Vector3D;
}

export interface CollisionShape {
  type: 'box' | 'sphere' | 'cylinder' | 'capsule' | 'mesh';
  dimensions?: Vector3D; // For box: width, height, depth
  radius?: number; // For sphere, cylinder, capsule
  height?: number; // For cylinder, capsule
  vertices?: Vector3D[]; // For mesh
  indices?: number[]; // For mesh
}

export interface RigidBodyConfig {
  id: string;
  mass: number;
  inertia: Vector3D;
  collisionShape: CollisionShape;
  restitution: number; // Bounciness (0-1)
  friction: number; // Surface friction (0-1)
  linearDamping: number; // Air resistance for linear motion
  angularDamping: number; // Air resistance for angular motion
  isStatic: boolean; // Static objects don't move
}

export class RigidBody {
  public id: string;
  public mass: number;
  public inertia: Vector3D;
  public collisionShape: CollisionShape;
  public restitution: number;
  public friction: number;
  public linearDamping: number;
  public angularDamping: number;
  public isStatic: boolean;

  public pose: Pose;
  public velocity: Velocity;
  public force: Force;
  public enabled: boolean;

  constructor(config: RigidBodyConfig) {
    this.id = config.id;
    this.mass = config.mass;
    this.inertia = config.inertia;
    this.collisionShape = config.collisionShape;
    this.restitution = config.restitution;
    this.friction = config.friction;
    this.linearDamping = config.linearDamping;
    this.angularDamping = config.angularDamping;
    this.isStatic = config.isStatic;

    // Initialize pose at origin
    this.pose = {
      position: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 }
    };

    // Initialize zero velocity
    this.velocity = {
      linear: { x: 0, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: 0 }
    };

    // Initialize zero force
    this.force = {
      linear: { x: 0, y: 0, z: 0 },
      torque: { x: 0, y: 0, z: 0 }
    };

    this.enabled = true;
  }

  public applyForce(force: Vector3D, point?: Vector3D): void {
    if (this.isStatic) return;

    this.force.linear.x += force.x;
    this.force.linear.y += force.y;
    this.force.linear.z += force.z;

    // If point is specified, calculate torque
    if (point) {
      const relativePoint = VectorMath.subtract(point, this.pose.position);
      const torque = VectorMath.cross(relativePoint, force);
      this.force.torque.x += torque.x;
      this.force.torque.y += torque.y;
      this.force.torque.z += torque.z;
    }
  }

  public applyTorque(torque: Vector3D): void {
    if (this.isStatic) return;

    this.force.torque.x += torque.x;
    this.force.torque.y += torque.y;
    this.force.torque.z += torque.z;
  }

  public clearForces(): void {
    this.force.linear = { x: 0, y: 0, z: 0 };
    this.force.torque = { x: 0, y: 0, z: 0 };
  }
}

export interface CollisionInfo {
  bodyA: RigidBody;
  bodyB: RigidBody;
  contactPoint: Vector3D;
  contactNormal: Vector3D;
  penetrationDepth: number;
  timestamp: number;
}

export class CollisionDetector {
  private bodies: Map<string, RigidBody>;

  constructor() {
    this.bodies = new Map();
  }

  public addBody(body: RigidBody): void {
    this.bodies.set(body.id, body);
  }

  public removeBody(bodyId: string): void {
    this.bodies.delete(bodyId);
  }

  public detectCollisions(): CollisionInfo[] {
    const collisions: CollisionInfo[] = [];
    const bodyList = Array.from(this.bodies.values()).filter(b => b.enabled);

    // Broad phase: Check all pairs
    for (let i = 0; i < bodyList.length; i++) {
      for (let j = i + 1; j < bodyList.length; j++) {
        const collision = this.checkCollision(bodyList[i], bodyList[j]);
        if (collision) {
          collisions.push(collision);
        }
      }
    }

    return collisions;
  }

  private checkCollision(bodyA: RigidBody, bodyB: RigidBody): CollisionInfo | null {
    const shapeA = bodyA.collisionShape;
    const shapeB = bodyB.collisionShape;

    // Sphere-Sphere collision
    if (shapeA.type === 'sphere' && shapeB.type === 'sphere') {
      return this.sphereSphereCollision(bodyA, bodyB);
    }

    // Box-Box collision
    if (shapeA.type === 'box' && shapeB.type === 'box') {
      return this.boxBoxCollision(bodyA, bodyB);
    }

    // Sphere-Box collision
    if (shapeA.type === 'sphere' && shapeB.type === 'box') {
      return this.sphereBoxCollision(bodyA, bodyB);
    }
    if (shapeA.type === 'box' && shapeB.type === 'sphere') {
      const collision = this.sphereBoxCollision(bodyB, bodyA);
      if (collision) {
        // Swap bodies and invert normal
        return {
          ...collision,
          bodyA: bodyA,
          bodyB: bodyB,
          contactNormal: VectorMath.negate(collision.contactNormal)
        };
      }
    }

    // TODO: Implement other collision types
    return null;
  }

  private sphereSphereCollision(bodyA: RigidBody, bodyB: RigidBody): CollisionInfo | null {
    const radiusA = bodyA.collisionShape.radius || 0;
    const radiusB = bodyB.collisionShape.radius || 0;
    const distance = VectorMath.distance(bodyA.pose.position, bodyB.pose.position);
    const minDistance = radiusA + radiusB;

    if (distance < minDistance) {
      const direction = VectorMath.normalize(
        VectorMath.subtract(bodyB.pose.position, bodyA.pose.position)
      );
      const penetrationDepth = minDistance - distance;
      const contactPoint = VectorMath.add(
        bodyA.pose.position,
        VectorMath.scale(direction, radiusA)
      );

      return {
        bodyA,
        bodyB,
        contactPoint,
        contactNormal: direction,
        penetrationDepth,
        timestamp: Date.now()
      };
    }

    return null;
  }

  private boxBoxCollision(bodyA: RigidBody, bodyB: RigidBody): CollisionInfo | null {
    // Simplified AABB collision detection
    const dimsA = bodyA.collisionShape.dimensions || { x: 1, y: 1, z: 1 };
    const dimsB = bodyB.collisionShape.dimensions || { x: 1, y: 1, z: 1 };

    const minA = {
      x: bodyA.pose.position.x - dimsA.x / 2,
      y: bodyA.pose.position.y - dimsA.y / 2,
      z: bodyA.pose.position.z - dimsA.z / 2
    };
    const maxA = {
      x: bodyA.pose.position.x + dimsA.x / 2,
      y: bodyA.pose.position.y + dimsA.y / 2,
      z: bodyA.pose.position.z + dimsA.z / 2
    };

    const minB = {
      x: bodyB.pose.position.x - dimsB.x / 2,
      y: bodyB.pose.position.y - dimsB.y / 2,
      z: bodyB.pose.position.z - dimsB.z / 2
    };
    const maxB = {
      x: bodyB.pose.position.x + dimsB.x / 2,
      y: bodyB.pose.position.y + dimsB.y / 2,
      z: bodyB.pose.position.z + dimsB.z / 2
    };

    const overlapX = Math.min(maxA.x, maxB.x) - Math.max(minA.x, minB.x);
    const overlapY = Math.min(maxA.y, maxB.y) - Math.max(minA.y, minB.y);
    const overlapZ = Math.min(maxA.z, maxB.z) - Math.max(minA.z, minB.z);

    if (overlapX > 0 && overlapY > 0 && overlapZ > 0) {
      // Find the axis with minimum overlap (separation axis)
      const minOverlap = Math.min(overlapX, overlapY, overlapZ);
      let normal: Vector3D;

      if (minOverlap === overlapX) {
        normal = { x: bodyA.pose.position.x < bodyB.pose.position.x ? -1 : 1, y: 0, z: 0 };
      } else if (minOverlap === overlapY) {
        normal = { x: 0, y: bodyA.pose.position.y < bodyB.pose.position.y ? -1 : 1, z: 0 };
      } else {
        normal = { x: 0, y: 0, z: bodyA.pose.position.z < bodyB.pose.position.z ? -1 : 1 };
      }

      const contactPoint = {
        x: (bodyA.pose.position.x + bodyB.pose.position.x) / 2,
        y: (bodyA.pose.position.y + bodyB.pose.position.y) / 2,
        z: (bodyA.pose.position.z + bodyB.pose.position.z) / 2
      };

      return {
        bodyA,
        bodyB,
        contactPoint,
        contactNormal: normal,
        penetrationDepth: minOverlap,
        timestamp: Date.now()
      };
    }

    return null;
  }

  private sphereBoxCollision(sphere: RigidBody, box: RigidBody): CollisionInfo | null {
    const radius = sphere.collisionShape.radius || 0;
    const dims = box.collisionShape.dimensions || { x: 1, y: 1, z: 1 };

    // Find closest point on box to sphere center
    const closestPoint = {
      x: Math.max(
        box.pose.position.x - dims.x / 2,
        Math.min(sphere.pose.position.x, box.pose.position.x + dims.x / 2)
      ),
      y: Math.max(
        box.pose.position.y - dims.y / 2,
        Math.min(sphere.pose.position.y, box.pose.position.y + dims.y / 2)
      ),
      z: Math.max(
        box.pose.position.z - dims.z / 2,
        Math.min(sphere.pose.position.z, box.pose.position.z + dims.z / 2)
      )
    };

    const distance = VectorMath.distance(closestPoint, sphere.pose.position);

    if (distance < radius) {
      const normal = VectorMath.normalize(
        VectorMath.subtract(sphere.pose.position, closestPoint)
      );

      return {
        bodyA: sphere,
        bodyB: box,
        contactPoint: closestPoint,
        contactNormal: normal,
        penetrationDepth: radius - distance,
        timestamp: Date.now()
      };
    }

    return null;
  }
}

export interface PhysicsConfig {
  gravity: Vector3D;
  timestep: number; // Fixed timestep in seconds
  maxSubsteps: number;
  solverIterations: number;
}

export class PhysicsEngine {
  private config: PhysicsConfig;
  private bodies: Map<string, RigidBody>;
  private collisionDetector: CollisionDetector;
  private accumulator: number;

  constructor(config: Partial<PhysicsConfig> = {}) {
    this.config = {
      gravity: config.gravity || { x: 0, y: 0, z: -9.81 },
      timestep: config.timestep || 0.01, // 100Hz
      maxSubsteps: config.maxSubsteps || 10,
      solverIterations: config.solverIterations || 5
    };

    this.bodies = new Map();
    this.collisionDetector = new CollisionDetector();
    this.accumulator = 0;
  }

  public addBody(body: RigidBody): void {
    this.bodies.set(body.id, body);
    this.collisionDetector.addBody(body);
  }

  public removeBody(bodyId: string): void {
    this.bodies.delete(bodyId);
    this.collisionDetector.removeBody(bodyId);
  }

  public getBody(bodyId: string): RigidBody | undefined {
    return this.bodies.get(bodyId);
  }

  public update(deltaTime: number): void {
    this.accumulator += deltaTime;
    let substeps = 0;

    // Fixed timestep simulation
    while (this.accumulator >= this.config.timestep && substeps < this.config.maxSubsteps) {
      this.step(this.config.timestep);
      this.accumulator -= this.config.timestep;
      substeps++;
    }
  }

  private step(dt: number): void {
    // 1. Apply gravity to all dynamic bodies
    for (const body of this.bodies.values()) {
      if (!body.isStatic && body.enabled) {
        body.applyForce({
          x: this.config.gravity.x * body.mass,
          y: this.config.gravity.y * body.mass,
          z: this.config.gravity.z * body.mass
        });
      }
    }

    // 2. Integrate forces -> velocities
    for (const body of this.bodies.values()) {
      if (!body.isStatic && body.enabled) {
        // Linear: v = v + (F/m) * dt
        body.velocity.linear.x += (body.force.linear.x / body.mass) * dt;
        body.velocity.linear.y += (body.force.linear.y / body.mass) * dt;
        body.velocity.linear.z += (body.force.linear.z / body.mass) * dt;

        // Angular: ω = ω + (τ/I) * dt
        body.velocity.angular.x += (body.force.torque.x / body.inertia.x) * dt;
        body.velocity.angular.y += (body.force.torque.y / body.inertia.y) * dt;
        body.velocity.angular.z += (body.force.torque.z / body.inertia.z) * dt;

        // Apply damping
        body.velocity.linear = VectorMath.scale(
          body.velocity.linear,
          Math.pow(1 - body.linearDamping, dt)
        );
        body.velocity.angular = VectorMath.scale(
          body.velocity.angular,
          Math.pow(1 - body.angularDamping, dt)
        );

        // Clear forces
        body.clearForces();
      }
    }

    // 3. Detect collisions
    const collisions = this.collisionDetector.detectCollisions();

    // 4. Resolve collisions
    for (let i = 0; i < this.config.solverIterations; i++) {
      for (const collision of collisions) {
        this.resolveCollision(collision);
      }
    }

    // 5. Integrate velocities -> positions
    for (const body of this.bodies.values()) {
      if (!body.isStatic && body.enabled) {
        // Linear: p = p + v * dt
        body.pose.position.x += body.velocity.linear.x * dt;
        body.pose.position.y += body.velocity.linear.y * dt;
        body.pose.position.z += body.velocity.linear.z * dt;

        // Angular: q = q + 0.5 * ω * q * dt (simplified)
        // For full implementation, use quaternion integration
        const angularMagnitude = VectorMath.magnitude(body.velocity.angular);
        if (angularMagnitude > 0.0001) {
          const axis = VectorMath.normalize(body.velocity.angular);
          const angle = angularMagnitude * dt;
          body.pose.orientation = QuaternionMath.multiply(
            body.pose.orientation,
            QuaternionMath.fromAxisAngle(axis, angle)
          );
          body.pose.orientation = QuaternionMath.normalize(body.pose.orientation);
        }
      }
    }
  }

  private resolveCollision(collision: CollisionInfo): void {
    const { bodyA, bodyB, contactNormal, penetrationDepth } = collision;

    if (bodyA.isStatic && bodyB.isStatic) return;

    // Calculate relative velocity
    const relativeVel = VectorMath.subtract(bodyB.velocity.linear, bodyA.velocity.linear);
    const velAlongNormal = VectorMath.dot(relativeVel, contactNormal);

    // Objects moving apart, no collision response needed
    if (velAlongNormal > 0) return;

    // Calculate restitution (bounciness)
    const restitution = Math.min(bodyA.restitution, bodyB.restitution);

    // Calculate impulse magnitude
    const invMassA = bodyA.isStatic ? 0 : 1 / bodyA.mass;
    const invMassB = bodyB.isStatic ? 0 : 1 / bodyB.mass;
    const j = -(1 + restitution) * velAlongNormal / (invMassA + invMassB);

    // Apply impulse
    const impulse = VectorMath.scale(contactNormal, j);

    if (!bodyA.isStatic) {
      bodyA.velocity.linear = VectorMath.subtract(
        bodyA.velocity.linear,
        VectorMath.scale(impulse, invMassA)
      );
    }

    if (!bodyB.isStatic) {
      bodyB.velocity.linear = VectorMath.add(
        bodyB.velocity.linear,
        VectorMath.scale(impulse, invMassB)
      );
    }

    // Position correction (prevent sinking)
    const percent = 0.8; // Penetration percentage to correct
    const slop = 0.01; // Penetration allowance
    const correctionMag = Math.max(penetrationDepth - slop, 0) / (invMassA + invMassB) * percent;
    const correction = VectorMath.scale(contactNormal, correctionMag);

    if (!bodyA.isStatic) {
      bodyA.pose.position = VectorMath.subtract(
        bodyA.pose.position,
        VectorMath.scale(correction, invMassA)
      );
    }

    if (!bodyB.isStatic) {
      bodyB.pose.position = VectorMath.add(
        bodyB.pose.position,
        VectorMath.scale(correction, invMassB)
      );
    }
  }

  public setGravity(gravity: Vector3D): void {
    this.config.gravity = gravity;
  }

  public getConfig(): PhysicsConfig {
    return { ...this.config };
  }
}

// Vector Math Utilities
export class VectorMath {
  static add(a: Vector3D, b: Vector3D): Vector3D {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  static subtract(a: Vector3D, b: Vector3D): Vector3D {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  static scale(v: Vector3D, s: number): Vector3D {
    return { x: v.x * s, y: v.y * s, z: v.z * s };
  }

  static dot(a: Vector3D, b: Vector3D): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  static cross(a: Vector3D, b: Vector3D): Vector3D {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  static magnitude(v: Vector3D): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  static distance(a: Vector3D, b: Vector3D): number {
    return this.magnitude(this.subtract(b, a));
  }

  static normalize(v: Vector3D): Vector3D {
    const mag = this.magnitude(v);
    return mag > 0 ? this.scale(v, 1 / mag) : { x: 0, y: 0, z: 0 };
  }

  static negate(v: Vector3D): Vector3D {
    return { x: -v.x, y: -v.y, z: -v.z };
  }
}

// Quaternion Math Utilities
export class QuaternionMath {
  static multiply(a: Quaternion, b: Quaternion): Quaternion {
    return {
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
    };
  }

  static fromAxisAngle(axis: Vector3D, angle: number): Quaternion {
    const halfAngle = angle / 2;
    const s = Math.sin(halfAngle);
    return {
      w: Math.cos(halfAngle),
      x: axis.x * s,
      y: axis.y * s,
      z: axis.z * s
    };
  }

  static normalize(q: Quaternion): Quaternion {
    const mag = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
    return mag > 0
      ? { w: q.w / mag, x: q.x / mag, y: q.y / mag, z: q.z / mag }
      : { w: 1, x: 0, y: 0, z: 0 };
  }

  static toEuler(q: Quaternion): Vector3D {
    // Roll (x-axis rotation)
    const sinr_cosp = 2 * (q.w * q.x + q.y * q.z);
    const cosr_cosp = 1 - 2 * (q.x * q.x + q.y * q.y);
    const roll = Math.atan2(sinr_cosp, cosr_cosp);

    // Pitch (y-axis rotation)
    const sinp = 2 * (q.w * q.y - q.z * q.x);
    const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);

    // Yaw (z-axis rotation)
    const siny_cosp = 2 * (q.w * q.z + q.x * q.y);
    const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
    const yaw = Math.atan2(siny_cosp, cosy_cosp);

    return { x: roll, y: pitch, z: yaw };
  }
}
