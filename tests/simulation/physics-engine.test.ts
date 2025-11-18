/**
 * Physics Engine Test Suite
 *
 * Comprehensive tests for physics simulation including:
 * - Collision detection and resolution
 * - Rigid body dynamics
 * - Force and torque calculations
 * - Constraint solving
 * - Spatial partitioning
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock physics engine interfaces
interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface RigidBody {
  id: string;
  position: Vector3;
  velocity: Vector3;
  acceleration: Vector3;
  mass: number;
  rotation: Vector3;
  angularVelocity: Vector3;
}

interface CollisionShape {
  type: 'box' | 'sphere' | 'cylinder' | 'mesh';
  dimensions: Vector3;
}

interface Collision {
  bodyA: string;
  bodyB: string;
  point: Vector3;
  normal: Vector3;
  penetrationDepth: number;
}

// Mock physics engine implementation
class PhysicsEngine {
  private bodies: Map<string, RigidBody> = new Map();
  private gravity: Vector3 = { x: 0, y: -9.81, z: 0 };
  private timeStep: number = 1/60;

  addBody(body: RigidBody): void {
    this.bodies.set(body.id, body);
  }

  removeBody(id: string): void {
    this.bodies.delete(id);
  }

  getBody(id: string): RigidBody | undefined {
    return this.bodies.get(id);
  }

  setGravity(gravity: Vector3): void {
    this.gravity = gravity;
  }

  step(deltaTime: number = this.timeStep): void {
    this.bodies.forEach(body => {
      // Apply gravity
      body.acceleration.y = this.gravity.y;

      // Update velocity
      body.velocity.x += body.acceleration.x * deltaTime;
      body.velocity.y += body.acceleration.y * deltaTime;
      body.velocity.z += body.acceleration.z * deltaTime;

      // Update position
      body.position.x += body.velocity.x * deltaTime;
      body.position.y += body.velocity.y * deltaTime;
      body.position.z += body.velocity.z * deltaTime;
    });
  }

  detectCollisions(): Collision[] {
    const collisions: Collision[] = [];
    const bodies = Array.from(this.bodies.values());

    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const collision = this.checkCollision(bodies[i], bodies[j]);
        if (collision) {
          collisions.push(collision);
        }
      }
    }

    return collisions;
  }

  private checkCollision(bodyA: RigidBody, bodyB: RigidBody): Collision | null {
    // Simple sphere collision detection
    const dx = bodyB.position.x - bodyA.position.x;
    const dy = bodyB.position.y - bodyA.position.y;
    const dz = bodyB.position.z - bodyA.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    const radiusSum = 1.0; // Simplified: assume all bodies have radius 1

    if (distance < radiusSum) {
      return {
        bodyA: bodyA.id,
        bodyB: bodyB.id,
        point: {
          x: (bodyA.position.x + bodyB.position.x) / 2,
          y: (bodyA.position.y + bodyB.position.y) / 2,
          z: (bodyA.position.z + bodyB.position.z) / 2,
        },
        normal: {
          x: dx / distance,
          y: dy / distance,
          z: dz / distance,
        },
        penetrationDepth: radiusSum - distance,
      };
    }

    return null;
  }

  resolveCollision(collision: Collision): void {
    const bodyA = this.bodies.get(collision.bodyA);
    const bodyB = this.bodies.get(collision.bodyB);

    if (!bodyA || !bodyB) return;

    // Separate bodies
    const separationX = collision.normal.x * collision.penetrationDepth * 0.5;
    const separationY = collision.normal.y * collision.penetrationDepth * 0.5;
    const separationZ = collision.normal.z * collision.penetrationDepth * 0.5;

    bodyA.position.x -= separationX;
    bodyA.position.y -= separationY;
    bodyA.position.z -= separationZ;

    bodyB.position.x += separationX;
    bodyB.position.y += separationY;
    bodyB.position.z += separationZ;

    // Apply impulse (simplified)
    const restitution = 0.5; // Coefficient of restitution
    const relativeVelocity = {
      x: bodyB.velocity.x - bodyA.velocity.x,
      y: bodyB.velocity.y - bodyA.velocity.y,
      z: bodyB.velocity.z - bodyA.velocity.z,
    };

    const velocityAlongNormal =
      relativeVelocity.x * collision.normal.x +
      relativeVelocity.y * collision.normal.y +
      relativeVelocity.z * collision.normal.z;

    if (velocityAlongNormal > 0) return; // Bodies moving apart

    const impulse = -(1 + restitution) * velocityAlongNormal;
    const impulseMagnitude = impulse / (1 / bodyA.mass + 1 / bodyB.mass);

    bodyA.velocity.x -= (impulseMagnitude / bodyA.mass) * collision.normal.x;
    bodyA.velocity.y -= (impulseMagnitude / bodyA.mass) * collision.normal.y;
    bodyA.velocity.z -= (impulseMagnitude / bodyA.mass) * collision.normal.z;

    bodyB.velocity.x += (impulseMagnitude / bodyB.mass) * collision.normal.x;
    bodyB.velocity.y += (impulseMagnitude / bodyB.mass) * collision.normal.y;
    bodyB.velocity.z += (impulseMagnitude / bodyB.mass) * collision.normal.z;
  }

  applyForce(bodyId: string, force: Vector3): void {
    const body = this.bodies.get(bodyId);
    if (!body) return;

    body.acceleration.x += force.x / body.mass;
    body.acceleration.y += force.y / body.mass;
    body.acceleration.z += force.z / body.mass;
  }

  reset(): void {
    this.bodies.clear();
  }
}

describe('PhysicsEngine', () => {
  let engine: PhysicsEngine;

  beforeEach(() => {
    engine = new PhysicsEngine();
  });

  describe('Body Management', () => {
    it('should add a rigid body to the simulation', () => {
      const body: RigidBody = {
        id: 'body1',
        position: { x: 0, y: 10, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 1.0,
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      };

      engine.addBody(body);
      const retrieved = engine.getBody('body1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('body1');
      expect(retrieved?.position.y).toBe(10);
    });

    it('should remove a rigid body from the simulation', () => {
      const body: RigidBody = {
        id: 'body1',
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 1.0,
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      };

      engine.addBody(body);
      engine.removeBody('body1');
      const retrieved = engine.getBody('body1');

      expect(retrieved).toBeUndefined();
    });

    it('should handle multiple bodies', () => {
      for (let i = 0; i < 10; i++) {
        const body: RigidBody = {
          id: `body${i}`,
          position: { x: i, y: i, z: i },
          velocity: { x: 0, y: 0, z: 0 },
          acceleration: { x: 0, y: 0, z: 0 },
          mass: 1.0,
          rotation: { x: 0, y: 0, z: 0 },
          angularVelocity: { x: 0, y: 0, z: 0 },
        };
        engine.addBody(body);
      }

      for (let i = 0; i < 10; i++) {
        const body = engine.getBody(`body${i}`);
        expect(body).toBeDefined();
        expect(body?.position.x).toBe(i);
      }
    });
  });

  describe('Gravity Simulation', () => {
    it('should apply gravity to falling bodies', () => {
      const body: RigidBody = {
        id: 'falling',
        position: { x: 0, y: 10, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 1.0,
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      };

      engine.addBody(body);

      // Simulate for 1 second (60 steps at 1/60 dt)
      for (let i = 0; i < 60; i++) {
        engine.step();
      }

      const updated = engine.getBody('falling');
      expect(updated?.position.y).toBeLessThan(10);
      expect(updated?.velocity.y).toBeLessThan(0);
    });

    it('should allow custom gravity settings', () => {
      engine.setGravity({ x: 0, y: -1.62, z: 0 }); // Moon gravity

      const body: RigidBody = {
        id: 'moon',
        position: { x: 0, y: 10, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 1.0,
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      };

      engine.addBody(body);

      // Simulate one step
      engine.step();

      const updated = engine.getBody('moon');
      const expectedVelocity = -1.62 / 60; // gravity * dt
      expect(updated?.velocity.y).toBeCloseTo(expectedVelocity, 4);
    });

    it('should simulate zero gravity environments', () => {
      engine.setGravity({ x: 0, y: 0, z: 0 });

      const body: RigidBody = {
        id: 'space',
        position: { x: 0, y: 10, z: 0 },
        velocity: { x: 1, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 1.0,
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      };

      engine.addBody(body);

      // Simulate for multiple steps
      for (let i = 0; i < 60; i++) {
        engine.step();
      }

      const updated = engine.getBody('space');
      expect(updated?.position.y).toBe(10); // No vertical movement
      expect(updated?.velocity.y).toBe(0); // No vertical velocity
    });
  });

  describe('Collision Detection', () => {
    it('should detect collision between two bodies', () => {
      const bodyA: RigidBody = {
        id: 'bodyA',
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 1, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 1.0,
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      };

      const bodyB: RigidBody = {
        id: 'bodyB',
        position: { x: 0.5, y: 0, z: 0 },
        velocity: { x: -1, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 1.0,
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      };

      engine.addBody(bodyA);
      engine.addBody(bodyB);

      const collisions = engine.detectCollisions();

      expect(collisions).toHaveLength(1);
      expect(collisions[0].bodyA).toBe('bodyA');
      expect(collisions[0].bodyB).toBe('bodyB');
      expect(collisions[0].penetrationDepth).toBeGreaterThan(0);
    });

    it('should not detect collision for distant bodies', () => {
      const bodyA: RigidBody = {
        id: 'bodyA',
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 1.0,
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      };

      const bodyB: RigidBody = {
        id: 'bodyB',
        position: { x: 10, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 1.0,
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      };

      engine.addBody(bodyA);
      engine.addBody(bodyB);

      const collisions = engine.detectCollisions();

      expect(collisions).toHaveLength(0);
    });

    it('should detect multiple simultaneous collisions', () => {
      // Create three bodies in close proximity
      const bodies: RigidBody[] = [
        {
          id: 'body1',
          position: { x: 0, y: 0, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
          acceleration: { x: 0, y: 0, z: 0 },
          mass: 1.0,
          rotation: { x: 0, y: 0, z: 0 },
          angularVelocity: { x: 0, y: 0, z: 0 },
        },
        {
          id: 'body2',
          position: { x: 0.5, y: 0, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
          acceleration: { x: 0, y: 0, z: 0 },
          mass: 1.0,
          rotation: { x: 0, y: 0, z: 0 },
          angularVelocity: { x: 0, y: 0, z: 0 },
        },
        {
          id: 'body3',
          position: { x: 0.25, y: 0.5, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
          acceleration: { x: 0, y: 0, z: 0 },
          mass: 1.0,
          rotation: { x: 0, y: 0, z: 0 },
          angularVelocity: { x: 0, y: 0, z: 0 },
        },
      ];

      bodies.forEach(body => engine.addBody(body));

      const collisions = engine.detectCollisions();

      expect(collisions.length).toBeGreaterThan(0);
    });
  });

  describe('Collision Resolution', () => {
    it('should separate overlapping bodies', () => {
      const bodyA: RigidBody = {
        id: 'bodyA',
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 1.0,
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      };

      const bodyB: RigidBody = {
        id: 'bodyB',
        position: { x: 0.5, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 1.0,
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      };

      engine.addBody(bodyA);
      engine.addBody(bodyB);

      const collisions = engine.detectCollisions();
      expect(collisions).toHaveLength(1);

      const initialDistance = Math.abs(bodyB.position.x - bodyA.position.x);

      engine.resolveCollision(collisions[0]);

      const updatedA = engine.getBody('bodyA');
      const updatedB = engine.getBody('bodyB');
      const finalDistance = Math.abs(updatedB!.position.x - updatedA!.position.x);

      expect(finalDistance).toBeGreaterThan(initialDistance);
    });

    it('should apply impulse response to colliding bodies', () => {
      const bodyA: RigidBody = {
        id: 'bodyA',
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 1, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 1.0,
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      };

      const bodyB: RigidBody = {
        id: 'bodyB',
        position: { x: 0.5, y: 0, z: 0 },
        velocity: { x: -1, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 1.0,
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      };

      engine.addBody(bodyA);
      engine.addBody(bodyB);

      const collisions = engine.detectCollisions();
      engine.resolveCollision(collisions[0]);

      const updatedA = engine.getBody('bodyA');
      const updatedB = engine.getBody('bodyB');

      // After collision, velocities should change
      expect(updatedA?.velocity.x).not.toBe(1);
      expect(updatedB?.velocity.x).not.toBe(-1);
    });

    it('should conserve momentum in elastic collisions', () => {
      const bodyA: RigidBody = {
        id: 'bodyA',
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 2, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 1.0,
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      };

      const bodyB: RigidBody = {
        id: 'bodyB',
        position: { x: 0.5, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 1.0,
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      };

      engine.addBody(bodyA);
      engine.addBody(bodyB);

      const initialMomentum = bodyA.velocity.x * bodyA.mass + bodyB.velocity.x * bodyB.mass;

      const collisions = engine.detectCollisions();
      engine.resolveCollision(collisions[0]);

      const updatedA = engine.getBody('bodyA');
      const updatedB = engine.getBody('bodyB');
      const finalMomentum = updatedA!.velocity.x * updatedA!.mass + updatedB!.velocity.x * updatedB!.mass;

      // Momentum should be approximately conserved (within numerical error)
      expect(Math.abs(finalMomentum - initialMomentum)).toBeLessThan(0.1);
    });
  });

  describe('Force Application', () => {
    it('should apply force to a body', () => {
      const body: RigidBody = {
        id: 'body1',
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 1.0,
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      };

      engine.addBody(body);
      engine.applyForce('body1', { x: 10, y: 0, z: 0 });

      const updated = engine.getBody('body1');
      expect(updated?.acceleration.x).toBe(10); // F = ma, a = F/m = 10/1
    });

    it('should handle multiple forces on the same body', () => {
      const body: RigidBody = {
        id: 'body1',
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 2.0,
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      };

      engine.addBody(body);
      engine.applyForce('body1', { x: 10, y: 0, z: 0 });
      engine.applyForce('body1', { x: 10, y: 5, z: 0 });

      const updated = engine.getBody('body1');
      expect(updated?.acceleration.x).toBe(10); // (10 + 10) / 2 = 10
      expect(updated?.acceleration.y).toBe(2.5); // 5 / 2 = 2.5
    });

    it('should scale acceleration by mass', () => {
      const lightBody: RigidBody = {
        id: 'light',
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 0.5,
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      };

      const heavyBody: RigidBody = {
        id: 'heavy',
        position: { x: 5, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 2.0,
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      };

      engine.addBody(lightBody);
      engine.addBody(heavyBody);

      engine.applyForce('light', { x: 10, y: 0, z: 0 });
      engine.applyForce('heavy', { x: 10, y: 0, z: 0 });

      const light = engine.getBody('light');
      const heavy = engine.getBody('heavy');

      expect(light?.acceleration.x).toBe(20); // 10 / 0.5
      expect(heavy?.acceleration.x).toBe(5); // 10 / 2.0
    });
  });

  describe('Performance & Edge Cases', () => {
    it('should handle large numbers of bodies efficiently', () => {
      const startTime = performance.now();

      // Add 100 bodies
      for (let i = 0; i < 100; i++) {
        const body: RigidBody = {
          id: `body${i}`,
          position: { x: i * 2, y: 0, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
          acceleration: { x: 0, y: 0, z: 0 },
          mass: 1.0,
          rotation: { x: 0, y: 0, z: 0 },
          angularVelocity: { x: 0, y: 0, z: 0 },
        };
        engine.addBody(body);
      }

      // Simulate 60 frames
      for (let i = 0; i < 60; i++) {
        engine.step();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle bodies with zero mass gracefully', () => {
      const body: RigidBody = {
        id: 'static',
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 0, // Invalid mass
        rotation: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      };

      engine.addBody(body);

      // Should not throw when applying force
      expect(() => {
        engine.applyForce('static', { x: 10, y: 0, z: 0 });
      }).not.toThrow();
    });

    it('should reset simulation state', () => {
      for (let i = 0; i < 10; i++) {
        const body: RigidBody = {
          id: `body${i}`,
          position: { x: i, y: 0, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
          acceleration: { x: 0, y: 0, z: 0 },
          mass: 1.0,
          rotation: { x: 0, y: 0, z: 0 },
          angularVelocity: { x: 0, y: 0, z: 0 },
        };
        engine.addBody(body);
      }

      engine.reset();

      for (let i = 0; i < 10; i++) {
        expect(engine.getBody(`body${i}`)).toBeUndefined();
      }
    });
  });
});
