/**
 * Sensor Simulator - Simulates various robot sensors (LiDAR, Camera, IMU, Proximity)
 */

import { Vector3D, Pose, VectorMath, QuaternionMath } from './physics-engine';
import { Environment, Obstacle } from './environment';

export interface SensorConfig {
  id: string;
  type: 'lidar' | 'camera' | 'imu' | 'proximity' | 'gps' | 'ultrasonic';
  mountPose: Pose; // Pose relative to robot
  updateRate: number; // Hz
  enabled: boolean;
}

export interface LidarConfig extends SensorConfig {
  type: 'lidar';
  range: number; // Maximum range in meters
  fov: number; // Field of view in radians
  resolution: number; // Angular resolution (number of rays)
  minRange?: number; // Minimum detectable range
  noise?: number; // Gaussian noise standard deviation
}

export interface LidarScan {
  timestamp: number;
  ranges: number[]; // Distance measurements
  intensities?: number[]; // Reflection intensities
  angles: number[]; // Angle for each measurement
  minAngle: number;
  maxAngle: number;
  minRange: number;
  maxRange: number;
}

export class LidarSimulator {
  private config: LidarConfig;
  private lastUpdateTime: number;

  constructor(config: LidarConfig) {
    this.config = config;
    this.lastUpdateTime = 0;
  }

  public scan(robotPose: Pose, environment: Environment, currentTime: number): LidarScan | null {
    const updateInterval = 1000 / this.config.updateRate; // ms

    if (currentTime - this.lastUpdateTime < updateInterval) {
      return null;
    }

    this.lastUpdateTime = currentTime;

    const ranges: number[] = [];
    const intensities: number[] = [];
    const angles: number[] = [];

    const minAngle = -this.config.fov / 2;
    const maxAngle = this.config.fov / 2;
    const angleStep = this.config.fov / this.config.resolution;

    // Transform sensor pose to world frame
    const sensorWorldPose = this.transformToWorld(robotPose, this.config.mountPose);

    for (let i = 0; i < this.config.resolution; i++) {
      const angle = minAngle + i * angleStep;
      angles.push(angle);

      // Create ray direction in sensor frame
      const rayDirection = {
        x: Math.cos(angle),
        y: Math.sin(angle),
        z: 0
      };

      // Transform ray to world frame
      const worldRayDirection = this.rotateVector(rayDirection, sensorWorldPose.orientation);

      // Cast ray and find closest intersection
      const hitDistance = this.castRay(
        sensorWorldPose.position,
        worldRayDirection,
        this.config.range,
        environment
      );

      // Add noise if configured
      const noisyDistance = this.config.noise
        ? hitDistance + this.gaussianRandom() * this.config.noise
        : hitDistance;

      ranges.push(Math.max(this.config.minRange || 0, Math.min(noisyDistance, this.config.range)));

      // Simulate intensity based on distance (closer = stronger signal)
      const intensity = hitDistance < this.config.range ? 1.0 - (hitDistance / this.config.range) : 0;
      intensities.push(intensity);
    }

    return {
      timestamp: currentTime,
      ranges,
      intensities,
      angles,
      minAngle,
      maxAngle,
      minRange: this.config.minRange || 0,
      maxRange: this.config.range
    };
  }

  private castRay(origin: Vector3D, direction: Vector3D, maxRange: number, environment: Environment): number {
    let closestHit = maxRange;

    // Check terrain intersection
    if (environment.terrain) {
      const terrainHit = this.rayTerrainIntersection(origin, direction, maxRange, environment);
      if (terrainHit < closestHit) {
        closestHit = terrainHit;
      }
    }

    // Check obstacle intersections
    for (const obstacle of environment.getAllObstacles()) {
      if (!obstacle.rigidBody) continue;

      const hit = this.rayObstacleIntersection(origin, direction, maxRange, obstacle);
      if (hit < closestHit) {
        closestHit = hit;
      }
    }

    return closestHit;
  }

  private rayObstacleIntersection(origin: Vector3D, direction: Vector3D, maxRange: number, obstacle: Obstacle): number {
    if (!obstacle.rigidBody) return maxRange;

    const shape = obstacle.shape;
    const obstaclePose = obstacle.rigidBody.pose;

    switch (shape.type) {
      case 'sphere':
        return this.raySphereIntersection(origin, direction, obstaclePose.position, shape.radius || 1);

      case 'box':
        return this.rayBoxIntersection(origin, direction, obstaclePose, shape.dimensions || { x: 1, y: 1, z: 1 });

      default:
        return maxRange;
    }
  }

  private raySphereIntersection(origin: Vector3D, direction: Vector3D, sphereCenter: Vector3D, radius: number): number {
    const oc = VectorMath.subtract(origin, sphereCenter);
    const a = VectorMath.dot(direction, direction);
    const b = 2.0 * VectorMath.dot(oc, direction);
    const c = VectorMath.dot(oc, oc) - radius * radius;
    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) {
      return Infinity;
    }

    const t = (-b - Math.sqrt(discriminant)) / (2.0 * a);
    return t > 0 ? t : Infinity;
  }

  private rayBoxIntersection(origin: Vector3D, direction: Vector3D, boxPose: Pose, dimensions: Vector3D): number {
    // Simplified AABB intersection (assumes axis-aligned)
    const min = {
      x: boxPose.position.x - dimensions.x / 2,
      y: boxPose.position.y - dimensions.y / 2,
      z: boxPose.position.z - dimensions.z / 2
    };
    const max = {
      x: boxPose.position.x + dimensions.x / 2,
      y: boxPose.position.y + dimensions.y / 2,
      z: boxPose.position.z + dimensions.z / 2
    };

    const invDir = {
      x: 1.0 / direction.x,
      y: 1.0 / direction.y,
      z: 1.0 / direction.z
    };

    const t1 = (min.x - origin.x) * invDir.x;
    const t2 = (max.x - origin.x) * invDir.x;
    const t3 = (min.y - origin.y) * invDir.y;
    const t4 = (max.y - origin.y) * invDir.y;
    const t5 = (min.z - origin.z) * invDir.z;
    const t6 = (max.z - origin.z) * invDir.z;

    const tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
    const tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));

    if (tmax < 0 || tmin > tmax) {
      return Infinity;
    }

    return tmin > 0 ? tmin : tmax;
  }

  private rayTerrainIntersection(origin: Vector3D, direction: Vector3D, maxRange: number, environment: Environment): number {
    // Simple terrain intersection (assumes flat or heightmap)
    if (!environment.terrain || direction.z === 0) return maxRange;

    // Calculate intersection with z=0 plane (or terrain surface)
    const t = -origin.z / direction.z;

    if (t > 0 && t < maxRange) {
      const hitPoint = {
        x: origin.x + direction.x * t,
        y: origin.y + direction.y * t,
        z: 0
      };

      const terrainHeight = environment.getTerrainHeight(hitPoint.x, hitPoint.y);
      if (Math.abs(hitPoint.z - terrainHeight) < 0.1) {
        return t;
      }
    }

    return maxRange;
  }

  private transformToWorld(robotPose: Pose, sensorPose: Pose): Pose {
    // Transform sensor pose from robot frame to world frame
    const rotatedPosition = this.rotateVector(sensorPose.position, robotPose.orientation);
    const worldPosition = VectorMath.add(robotPose.position, rotatedPosition);
    const worldOrientation = QuaternionMath.multiply(robotPose.orientation, sensorPose.orientation);

    return {
      position: worldPosition,
      orientation: worldOrientation
    };
  }

  private rotateVector(v: Vector3D, q: { x: number; y: number; z: number; w: number }): Vector3D {
    // Rotate vector by quaternion
    const qv = { x: v.x, y: v.y, z: v.z, w: 0 };
    const qConj = { x: -q.x, y: -q.y, z: -q.z, w: q.w };
    const qTemp = QuaternionMath.multiply(q, qv);
    const result = QuaternionMath.multiply(qTemp, qConj);
    return { x: result.x, y: result.y, z: result.z };
  }

  private gaussianRandom(): number {
    // Box-Muller transform for Gaussian random numbers
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }
}

export interface CameraConfig extends SensorConfig {
  type: 'camera';
  resolution: { width: number; height: number };
  fov: number; // Vertical field of view in radians
  nearClip: number;
  farClip: number;
  depthEnabled?: boolean;
}

export interface CameraImage {
  timestamp: number;
  width: number;
  height: number;
  data: Uint8Array; // RGBA pixel data
  depthData?: Float32Array; // Depth buffer
}

export class CameraSimulator {
  private config: CameraConfig;
  private lastUpdateTime: number;

  constructor(config: CameraConfig) {
    this.config = config;
    this.lastUpdateTime = 0;
  }

  public capture(robotPose: Pose, environment: Environment, currentTime: number): CameraImage | null {
    const updateInterval = 1000 / this.config.updateRate;

    if (currentTime - this.lastUpdateTime < updateInterval) {
      return null;
    }

    this.lastUpdateTime = currentTime;

    // Simple rasterization (in real implementation, use WebGL or ray tracing)
    const width = this.config.resolution.width;
    const height = this.config.resolution.height;
    const data = new Uint8Array(width * height * 4);
    const depthData = this.config.depthEnabled ? new Float32Array(width * height) : undefined;

    // Fill with sky color (simplified)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128; // R
      data[i + 1] = 178; // G
      data[i + 2] = 255; // B
      data[i + 3] = 255; // A
    }

    return {
      timestamp: currentTime,
      width,
      height,
      data,
      depthData
    };
  }
}

export interface IMUConfig extends SensorConfig {
  type: 'imu';
  accelerometerNoise?: number;
  gyroscopeNoise?: number;
  magnetometerNoise?: number;
}

export interface IMUData {
  timestamp: number;
  linearAcceleration: Vector3D; // m/s^2
  angularVelocity: Vector3D; // rad/s
  orientation?: { x: number; y: number; z: number; w: number }; // Quaternion
  magneticField?: Vector3D; // Tesla (if magnetometer present)
}

export class IMUSimulator {
  private config: IMUConfig;
  private lastUpdateTime: number;
  private lastVelocity: Vector3D;

  constructor(config: IMUConfig) {
    this.config = config;
    this.lastUpdateTime = 0;
    this.lastVelocity = { x: 0, y: 0, z: 0 };
  }

  public measure(
    robotPose: Pose,
    linearVelocity: Vector3D,
    angularVelocity: Vector3D,
    currentTime: number,
    gravity: Vector3D = { x: 0, y: 0, z: -9.81 }
  ): IMUData | null {
    const updateInterval = 1000 / this.config.updateRate;

    if (currentTime - this.lastUpdateTime < updateInterval) {
      return null;
    }

    const dt = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds
    this.lastUpdateTime = currentTime;

    // Calculate linear acceleration
    const acceleration = {
      x: (linearVelocity.x - this.lastVelocity.x) / dt,
      y: (linearVelocity.y - this.lastVelocity.y) / dt,
      z: (linearVelocity.z - this.lastVelocity.z) / dt
    };

    this.lastVelocity = { ...linearVelocity };

    // Add gravity (IMU measures proper acceleration, not coordinate acceleration)
    const properAcceleration = VectorMath.subtract(acceleration, gravity);

    // Add noise
    const noisyAcceleration = this.addNoise(properAcceleration, this.config.accelerometerNoise || 0);
    const noisyGyroscope = this.addNoise(angularVelocity, this.config.gyroscopeNoise || 0);

    // Simplified magnetometer (points north in world frame)
    const magneticField = this.config.magnetometerNoise !== undefined
      ? this.addNoise({ x: 1, y: 0, z: 0 }, this.config.magnetometerNoise)
      : undefined;

    return {
      timestamp: currentTime,
      linearAcceleration: noisyAcceleration,
      angularVelocity: noisyGyroscope,
      orientation: robotPose.orientation,
      magneticField
    };
  }

  private addNoise(vector: Vector3D, noise: number): Vector3D {
    if (noise === 0) return vector;

    return {
      x: vector.x + this.gaussianRandom() * noise,
      y: vector.y + this.gaussianRandom() * noise,
      z: vector.z + this.gaussianRandom() * noise
    };
  }

  private gaussianRandom(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }
}

export interface ProximityConfig extends SensorConfig {
  type: 'proximity' | 'ultrasonic';
  range: number;
  fov?: number; // Cone angle in radians
  minRange?: number;
  noise?: number;
}

export interface ProximityData {
  timestamp: number;
  distance: number;
  detected: boolean;
}

export class ProximitySensor {
  private config: ProximityConfig;
  private lastUpdateTime: number;

  constructor(config: ProximityConfig) {
    this.config = config;
    this.lastUpdateTime = 0;
  }

  public measure(robotPose: Pose, environment: Environment, currentTime: number): ProximityData | null {
    const updateInterval = 1000 / this.config.updateRate;

    if (currentTime - this.lastUpdateTime < updateInterval) {
      return null;
    }

    this.lastUpdateTime = currentTime;

    // Transform sensor to world frame
    const sensorWorldPose = this.transformToWorld(robotPose, this.config.mountPose);

    // Cast ray forward
    const rayDirection = this.rotateVector({ x: 1, y: 0, z: 0 }, sensorWorldPose.orientation);

    // Simple ray cast (similar to LiDAR but single ray)
    let closestHit = this.config.range;

    for (const obstacle of environment.getAllObstacles()) {
      if (!obstacle.rigidBody) continue;

      const shape = obstacle.shape;
      if (shape.type === 'sphere') {
        const hit = this.raySphereIntersection(
          sensorWorldPose.position,
          rayDirection,
          obstacle.rigidBody.pose.position,
          shape.radius || 1
        );
        if (hit < closestHit) {
          closestHit = hit;
        }
      }
    }

    // Add noise
    const noisyDistance = this.config.noise
      ? closestHit + this.gaussianRandom() * this.config.noise
      : closestHit;

    const distance = Math.max(
      this.config.minRange || 0,
      Math.min(noisyDistance, this.config.range)
    );

    return {
      timestamp: currentTime,
      distance,
      detected: distance < this.config.range
    };
  }

  private transformToWorld(robotPose: Pose, sensorPose: Pose): Pose {
    const rotatedPosition = this.rotateVector(sensorPose.position, robotPose.orientation);
    const worldPosition = VectorMath.add(robotPose.position, rotatedPosition);
    const worldOrientation = QuaternionMath.multiply(robotPose.orientation, sensorPose.orientation);

    return {
      position: worldPosition,
      orientation: worldOrientation
    };
  }

  private rotateVector(v: Vector3D, q: { x: number; y: number; z: number; w: number }): Vector3D {
    const qv = { x: v.x, y: v.y, z: v.z, w: 0 };
    const qConj = { x: -q.x, y: -q.y, z: -q.z, w: q.w };
    const qTemp = QuaternionMath.multiply(q, qv);
    const result = QuaternionMath.multiply(qTemp, qConj);
    return { x: result.x, y: result.y, z: result.z };
  }

  private raySphereIntersection(origin: Vector3D, direction: Vector3D, sphereCenter: Vector3D, radius: number): number {
    const oc = VectorMath.subtract(origin, sphereCenter);
    const a = VectorMath.dot(direction, direction);
    const b = 2.0 * VectorMath.dot(oc, direction);
    const c = VectorMath.dot(oc, oc) - radius * radius;
    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) {
      return Infinity;
    }

    const t = (-b - Math.sqrt(discriminant)) / (2.0 * a);
    return t > 0 ? t : Infinity;
  }

  private gaussianRandom(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }
}

// Sensor Manager
export class SensorSimulator {
  private lidars: Map<string, LidarSimulator>;
  private cameras: Map<string, CameraSimulator>;
  private imus: Map<string, IMUSimulator>;
  private proximitySensors: Map<string, ProximitySensor>;

  constructor() {
    this.lidars = new Map();
    this.cameras = new Map();
    this.imus = new Map();
    this.proximitySensors = new Map();
  }

  public addSensor(config: SensorConfig): void {
    switch (config.type) {
      case 'lidar':
        this.lidars.set(config.id, new LidarSimulator(config as LidarConfig));
        break;
      case 'camera':
        this.cameras.set(config.id, new CameraSimulator(config as CameraConfig));
        break;
      case 'imu':
        this.imus.set(config.id, new IMUSimulator(config as IMUConfig));
        break;
      case 'proximity':
      case 'ultrasonic':
        this.proximitySensors.set(config.id, new ProximitySensor(config as ProximityConfig));
        break;
    }
  }

  public removeSensor(id: string): void {
    this.lidars.delete(id);
    this.cameras.delete(id);
    this.imus.delete(id);
    this.proximitySensors.delete(id);
  }

  public getLidar(id: string): LidarSimulator | undefined {
    return this.lidars.get(id);
  }

  public getCamera(id: string): CameraSimulator | undefined {
    return this.cameras.get(id);
  }

  public getIMU(id: string): IMUSimulator | undefined {
    return this.imus.get(id);
  }

  public getProximity(id: string): ProximitySensor | undefined {
    return this.proximitySensors.get(id);
  }
}
