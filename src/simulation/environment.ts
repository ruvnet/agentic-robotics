/**
 * Environment Management - Obstacles, terrain, lighting, and environmental conditions
 */

import { Vector3D, CollisionShape, RigidBody, RigidBodyConfig } from './physics-engine';

export interface Color {
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
  a?: number; // 0-1 (alpha/opacity)
}

export interface Material {
  color: Color;
  metallic?: number; // 0-1
  roughness?: number; // 0-1
  emissive?: Color;
  texture?: string; // Texture file path or URL
}

export interface ObstacleConfig {
  id: string;
  type: 'static' | 'dynamic';
  shape: CollisionShape;
  pose: {
    position: Vector3D;
    orientation: Vector3D; // Euler angles (roll, pitch, yaw)
  };
  material?: Material;
  mass?: number; // For dynamic obstacles
  friction?: number;
  restitution?: number;
}

export class Obstacle {
  public id: string;
  public type: 'static' | 'dynamic';
  public shape: CollisionShape;
  public rigidBody?: RigidBody;
  public material: Material;

  constructor(config: ObstacleConfig) {
    this.id = config.id;
    this.type = config.type;
    this.shape = config.shape;
    this.material = config.material || {
      color: { r: 0.5, g: 0.5, b: 0.5, a: 1 }
    };

    // Create rigid body for physics simulation
    const rigidBodyConfig: RigidBodyConfig = {
      id: config.id,
      mass: config.mass || (config.type === 'dynamic' ? 1.0 : 0),
      inertia: this.calculateInertia(config.shape, config.mass || 1.0),
      collisionShape: config.shape,
      restitution: config.restitution || 0.5,
      friction: config.friction || 0.7,
      linearDamping: 0.1,
      angularDamping: 0.1,
      isStatic: config.type === 'static'
    };

    this.rigidBody = new RigidBody(rigidBodyConfig);

    // Set initial pose
    this.rigidBody.pose.position = { ...config.pose.position };
    this.rigidBody.pose.orientation = this.eulerToQuaternion(config.pose.orientation);
  }

  private calculateInertia(shape: CollisionShape, mass: number): Vector3D {
    // Simplified inertia calculations
    switch (shape.type) {
      case 'sphere':
        const r = shape.radius || 1;
        const i = 0.4 * mass * r * r;
        return { x: i, y: i, z: i };

      case 'box':
        const dims = shape.dimensions || { x: 1, y: 1, z: 1 };
        return {
          x: (mass / 12) * (dims.y * dims.y + dims.z * dims.z),
          y: (mass / 12) * (dims.x * dims.x + dims.z * dims.z),
          z: (mass / 12) * (dims.x * dims.x + dims.y * dims.y)
        };

      case 'cylinder':
        const radius = shape.radius || 0.5;
        const height = shape.height || 1;
        return {
          x: (mass / 12) * (3 * radius * radius + height * height),
          y: (mass / 12) * (3 * radius * radius + height * height),
          z: 0.5 * mass * radius * radius
        };

      default:
        return { x: 1, y: 1, z: 1 };
    }
  }

  private eulerToQuaternion(euler: Vector3D): { x: number; y: number; z: number; w: number } {
    const cy = Math.cos(euler.z * 0.5);
    const sy = Math.sin(euler.z * 0.5);
    const cp = Math.cos(euler.y * 0.5);
    const sp = Math.sin(euler.y * 0.5);
    const cr = Math.cos(euler.x * 0.5);
    const sr = Math.sin(euler.x * 0.5);

    return {
      w: cr * cp * cy + sr * sp * sy,
      x: sr * cp * cy - cr * sp * sy,
      y: cr * sp * cy + sr * cp * sy,
      z: cr * cp * sy - sr * sp * cy
    };
  }
}

export interface TerrainConfig {
  type: 'flat' | 'heightmap' | 'procedural';
  size: { width: number; depth: number };
  resolution?: number; // Grid resolution for heightmap
  heightScale?: number; // Height multiplier
  heightData?: number[][]; // For heightmap terrain
  proceduralSeed?: number; // For procedural generation
  material?: Material;
}

export class Terrain {
  public type: 'flat' | 'heightmap' | 'procedural';
  public size: { width: number; depth: number };
  public resolution: number;
  public heightScale: number;
  public heightData: number[][];
  public material: Material;

  constructor(config: TerrainConfig) {
    this.type = config.type;
    this.size = config.size;
    this.resolution = config.resolution || 100;
    this.heightScale = config.heightScale || 1.0;
    this.material = config.material || {
      color: { r: 0.3, g: 0.6, b: 0.3, a: 1 }
    };

    // Initialize height data
    if (config.heightData) {
      this.heightData = config.heightData;
    } else {
      this.heightData = this.generateHeightData(config);
    }
  }

  private generateHeightData(config: TerrainConfig): number[][] {
    const data: number[][] = [];

    for (let i = 0; i <= this.resolution; i++) {
      data[i] = [];
      for (let j = 0; j <= this.resolution; j++) {
        if (config.type === 'flat') {
          data[i][j] = 0;
        } else if (config.type === 'procedural') {
          // Simple Perlin-like noise (simplified)
          const x = i / this.resolution;
          const z = j / this.resolution;
          data[i][j] = this.noise(x * 10, z * 10) * this.heightScale;
        } else {
          data[i][j] = 0;
        }
      }
    }

    return data;
  }

  private noise(x: number, y: number): number {
    // Simplified noise function (replace with proper Perlin/Simplex noise)
    return Math.sin(x) * Math.cos(y) * 0.5 + 0.5;
  }

  public getHeightAt(x: number, z: number): number {
    // Convert world coordinates to grid coordinates
    const gridX = ((x / this.size.width) + 0.5) * this.resolution;
    const gridZ = ((z / this.size.depth) + 0.5) * this.resolution;

    // Bounds check
    if (gridX < 0 || gridX > this.resolution || gridZ < 0 || gridZ > this.resolution) {
      return 0;
    }

    // Bilinear interpolation
    const x0 = Math.floor(gridX);
    const x1 = Math.ceil(gridX);
    const z0 = Math.floor(gridZ);
    const z1 = Math.ceil(gridZ);

    const fx = gridX - x0;
    const fz = gridZ - z0;

    const h00 = this.heightData[x0]?.[z0] || 0;
    const h10 = this.heightData[x1]?.[z0] || 0;
    const h01 = this.heightData[x0]?.[z1] || 0;
    const h11 = this.heightData[x1]?.[z1] || 0;

    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;

    return h0 * (1 - fz) + h1 * fz;
  }
}

export interface LightConfig {
  id: string;
  type: 'directional' | 'point' | 'spot' | 'ambient';
  color: Color;
  intensity: number;
  position?: Vector3D; // For point and spot lights
  direction?: Vector3D; // For directional and spot lights
  range?: number; // For point and spot lights
  spotAngle?: number; // For spot lights (in radians)
  castShadows?: boolean;
}

export class Light {
  public id: string;
  public type: 'directional' | 'point' | 'spot' | 'ambient';
  public color: Color;
  public intensity: number;
  public position?: Vector3D;
  public direction?: Vector3D;
  public range?: number;
  public spotAngle?: number;
  public castShadows: boolean;
  public enabled: boolean;

  constructor(config: LightConfig) {
    this.id = config.id;
    this.type = config.type;
    this.color = config.color;
    this.intensity = config.intensity;
    this.position = config.position;
    this.direction = config.direction;
    this.range = config.range;
    this.spotAngle = config.spotAngle;
    this.castShadows = config.castShadows || false;
    this.enabled = true;
  }
}

export interface EnvironmentConfig {
  name: string;
  terrain?: TerrainConfig;
  obstacles?: ObstacleConfig[];
  lights?: LightConfig[];
  ambientLight?: Color;
  fog?: {
    color: Color;
    density: number;
    start?: number;
    end?: number;
  };
  skybox?: {
    type: 'color' | 'gradient' | 'cubemap';
    colors: Color | Color[];
    texture?: string;
  };
}

export class Environment {
  public name: string;
  public terrain?: Terrain;
  public obstacles: Map<string, Obstacle>;
  public lights: Map<string, Light>;
  public ambientLight: Color;
  public fog?: {
    color: Color;
    density: number;
    start?: number;
    end?: number;
  };
  public skybox?: {
    type: 'color' | 'gradient' | 'cubemap';
    colors: Color | Color[];
    texture?: string;
  };

  constructor(config: EnvironmentConfig) {
    this.name = config.name;
    this.obstacles = new Map();
    this.lights = new Map();
    this.ambientLight = config.ambientLight || { r: 0.2, g: 0.2, b: 0.2, a: 1 };
    this.fog = config.fog;
    this.skybox = config.skybox;

    // Initialize terrain
    if (config.terrain) {
      this.terrain = new Terrain(config.terrain);
    }

    // Initialize obstacles
    if (config.obstacles) {
      for (const obstacleConfig of config.obstacles) {
        const obstacle = new Obstacle(obstacleConfig);
        this.obstacles.set(obstacle.id, obstacle);
      }
    }

    // Initialize lights
    if (config.lights) {
      for (const lightConfig of config.lights) {
        const light = new Light(lightConfig);
        this.lights.set(light.id, light);
      }
    }

    // Add default directional light if no lights specified
    if (this.lights.size === 0) {
      this.addLight({
        id: 'default-sun',
        type: 'directional',
        color: { r: 1, g: 1, b: 0.9 },
        intensity: 1.0,
        direction: { x: -0.5, y: -1, z: -0.5 },
        castShadows: true
      });
    }
  }

  public addObstacle(config: ObstacleConfig): Obstacle {
    const obstacle = new Obstacle(config);
    this.obstacles.set(obstacle.id, obstacle);
    return obstacle;
  }

  public removeObstacle(id: string): boolean {
    return this.obstacles.delete(id);
  }

  public getObstacle(id: string): Obstacle | undefined {
    return this.obstacles.get(id);
  }

  public addLight(config: LightConfig): Light {
    const light = new Light(config);
    this.lights.set(light.id, light);
    return light;
  }

  public removeLight(id: string): boolean {
    return this.lights.delete(id);
  }

  public getLight(id: string): Light | undefined {
    return this.lights.get(id);
  }

  public getAllObstacles(): Obstacle[] {
    return Array.from(this.obstacles.values());
  }

  public getAllLights(): Light[] {
    return Array.from(this.lights.values());
  }

  public getTerrainHeight(x: number, z: number): number {
    return this.terrain?.getHeightAt(x, z) || 0;
  }

  public reset(): void {
    // Reset all dynamic obstacles to initial state
    for (const obstacle of this.obstacles.values()) {
      if (obstacle.type === 'dynamic' && obstacle.rigidBody) {
        obstacle.rigidBody.velocity.linear = { x: 0, y: 0, z: 0 };
        obstacle.rigidBody.velocity.angular = { x: 0, y: 0, z: 0 };
        obstacle.rigidBody.clearForces();
      }
    }
  }
}

// Environment Presets
export class EnvironmentPresets {
  static emptyWorld(): EnvironmentConfig {
    return {
      name: 'Empty World',
      terrain: {
        type: 'flat',
        size: { width: 100, depth: 100 },
        material: { color: { r: 0.8, g: 0.8, b: 0.8 } }
      },
      lights: [
        {
          id: 'sun',
          type: 'directional',
          color: { r: 1, g: 1, b: 0.95 },
          intensity: 1.0,
          direction: { x: -0.3, y: -1, z: -0.5 },
          castShadows: true
        }
      ],
      ambientLight: { r: 0.3, g: 0.3, b: 0.4 },
      skybox: {
        type: 'gradient',
        colors: [
          { r: 0.5, g: 0.7, b: 1.0 },
          { r: 0.8, g: 0.9, b: 1.0 }
        ]
      }
    };
  }

  static obstacleCourseName(): EnvironmentConfig {
    return {
      name: 'Obstacle Course',
      terrain: {
        type: 'flat',
        size: { width: 50, depth: 50 },
        material: { color: { r: 0.4, g: 0.6, b: 0.4 } }
      },
      obstacles: [
        // Walls
        {
          id: 'wall-1',
          type: 'static',
          shape: { type: 'box', dimensions: { x: 10, y: 0.2, z: 2 } },
          pose: { position: { x: 5, y: 0, z: 1 }, orientation: { x: 0, y: 0, z: 0 } },
          material: { color: { r: 0.7, g: 0.3, b: 0.3 } }
        },
        {
          id: 'wall-2',
          type: 'static',
          shape: { type: 'box', dimensions: { x: 10, y: 0.2, z: 2 } },
          pose: { position: { x: -5, y: 0, z: 1 }, orientation: { x: 0, y: 0, z: 0 } },
          material: { color: { r: 0.7, g: 0.3, b: 0.3 } }
        },
        // Pillars
        {
          id: 'pillar-1',
          type: 'static',
          shape: { type: 'cylinder', radius: 0.5, height: 3 },
          pose: { position: { x: -10, y: 10, z: 1.5 }, orientation: { x: 0, y: 0, z: 0 } },
          material: { color: { r: 0.3, g: 0.3, b: 0.7 } }
        },
        {
          id: 'pillar-2',
          type: 'static',
          shape: { type: 'cylinder', radius: 0.5, height: 3 },
          pose: { position: { x: 10, y: 10, z: 1.5 }, orientation: { x: 0, y: 0, z: 0 } },
          material: { color: { r: 0.3, g: 0.3, b: 0.7 } }
        },
        // Dynamic boxes
        {
          id: 'box-1',
          type: 'dynamic',
          shape: { type: 'box', dimensions: { x: 1, y: 1, z: 1 } },
          pose: { position: { x: 0, y: 5, z: 2 }, orientation: { x: 0, y: 0, z: 0 } },
          mass: 10,
          material: { color: { r: 0.8, g: 0.6, b: 0.2 } }
        }
      ],
      lights: [
        {
          id: 'sun',
          type: 'directional',
          color: { r: 1, g: 1, b: 0.95 },
          intensity: 1.2,
          direction: { x: -0.5, y: -1, z: -0.3 },
          castShadows: true
        },
        {
          id: 'spotlight-1',
          type: 'spot',
          color: { r: 1, g: 1, b: 1 },
          intensity: 2.0,
          position: { x: 0, y: 0, z: 10 },
          direction: { x: 0, y: 0, z: -1 },
          range: 20,
          spotAngle: Math.PI / 4,
          castShadows: true
        }
      ],
      ambientLight: { r: 0.2, g: 0.2, b: 0.3 }
    };
  }

  static indoorLab(): EnvironmentConfig {
    return {
      name: 'Indoor Lab',
      terrain: {
        type: 'flat',
        size: { width: 20, depth: 20 },
        material: { color: { r: 0.9, g: 0.9, b: 0.9 } }
      },
      obstacles: [
        // Room walls
        {
          id: 'wall-north',
          type: 'static',
          shape: { type: 'box', dimensions: { x: 20, y: 0.2, z: 3 } },
          pose: { position: { x: 0, y: 10, z: 1.5 }, orientation: { x: 0, y: 0, z: 0 } },
          material: { color: { r: 0.95, g: 0.95, b: 0.95 } }
        },
        {
          id: 'wall-south',
          type: 'static',
          shape: { type: 'box', dimensions: { x: 20, y: 0.2, z: 3 } },
          pose: { position: { x: 0, y: -10, z: 1.5 }, orientation: { x: 0, y: 0, z: 0 } },
          material: { color: { r: 0.95, g: 0.95, b: 0.95 } }
        },
        {
          id: 'wall-east',
          type: 'static',
          shape: { type: 'box', dimensions: { x: 0.2, y: 20, z: 3 } },
          pose: { position: { x: 10, y: 0, z: 1.5 }, orientation: { x: 0, y: 0, z: 0 } },
          material: { color: { r: 0.95, g: 0.95, b: 0.95 } }
        },
        {
          id: 'wall-west',
          type: 'static',
          shape: { type: 'box', dimensions: { x: 0.2, y: 20, z: 3 } },
          pose: { position: { x: -10, y: 0, z: 1.5 }, orientation: { x: 0, y: 0, z: 0 } },
          material: { color: { r: 0.95, g: 0.95, b: 0.95 } }
        },
        // Tables
        {
          id: 'table-1',
          type: 'static',
          shape: { type: 'box', dimensions: { x: 2, y: 4, z: 0.8 } },
          pose: { position: { x: -5, y: 0, z: 0.4 }, orientation: { x: 0, y: 0, z: 0 } },
          material: { color: { r: 0.6, g: 0.4, b: 0.2 } }
        }
      ],
      lights: [
        {
          id: 'ceiling-light-1',
          type: 'point',
          color: { r: 1, g: 1, b: 1 },
          intensity: 1.5,
          position: { x: 0, y: 0, z: 2.8 },
          range: 15,
          castShadows: true
        }
      ],
      ambientLight: { r: 0.4, g: 0.4, b: 0.4 }
    };
  }
}
