/**
 * Sensor Simulation Test Suite
 *
 * Comprehensive tests for robot sensors including:
 * - Distance sensors (LIDAR, ultrasonic)
 * - Camera/vision sensors
 * - IMU (accelerometer, gyroscope)
 * - GPS/positioning
 * - Sensor noise and accuracy
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock sensor interfaces
interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface SensorReading<T> {
  value: T;
  timestamp: number;
  accuracy: number;
  status: 'valid' | 'invalid' | 'degraded';
}

interface LidarPoint {
  distance: number;
  angle: number;
  intensity: number;
}

interface IMUData {
  acceleration: Vector3;
  angularVelocity: Vector3;
  orientation: Vector3;
}

interface GPSData {
  latitude: number;
  longitude: number;
  altitude: number;
  accuracy: number;
}

interface ObstacleDetection {
  detected: boolean;
  distance: number;
  direction: Vector3;
}

// Mock sensor implementations
class DistanceSensor {
  private range: number;
  private noiseLevel: number;
  private position: Vector3;

  constructor(range: number, noiseLevel: number = 0.01) {
    this.range = range;
    this.noiseLevel = noiseLevel;
    this.position = { x: 0, y: 0, z: 0 };
  }

  setPosition(position: Vector3): void {
    this.position = { ...position };
  }

  measure(targetPosition: Vector3): SensorReading<number> {
    const dx = targetPosition.x - this.position.x;
    const dy = targetPosition.y - this.position.y;
    const dz = targetPosition.z - this.position.z;
    const actualDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Add noise
    const noise = (Math.random() - 0.5) * 2 * this.noiseLevel * actualDistance;
    const measuredDistance = actualDistance + noise;

    // Check if in range
    const status = actualDistance > this.range ? 'invalid' : 'valid';

    return {
      value: Math.max(0, measuredDistance),
      timestamp: Date.now(),
      accuracy: this.noiseLevel,
      status,
    };
  }

  getRange(): number {
    return this.range;
  }
}

class LidarSensor {
  private range: number;
  private resolution: number; // angular resolution in degrees
  private noiseLevel: number;
  private position: Vector3;

  constructor(range: number, resolution: number = 1.0, noiseLevel: number = 0.02) {
    this.range = range;
    this.resolution = resolution;
    this.noiseLevel = noiseLevel;
    this.position = { x: 0, y: 0, z: 0 };
  }

  setPosition(position: Vector3): void {
    this.position = { ...position };
  }

  scan(obstacles: Vector3[]): SensorReading<LidarPoint[]> {
    const points: LidarPoint[] = [];
    const numRays = Math.floor(360 / this.resolution);

    for (let i = 0; i < numRays; i++) {
      const angle = (i * this.resolution * Math.PI) / 180;

      // Find closest obstacle in this direction
      let minDistance = this.range;
      let intensity = 0;

      for (const obstacle of obstacles) {
        const dx = obstacle.x - this.position.x;
        const dy = obstacle.y - this.position.y;
        const obstacleAngle = Math.atan2(dy, dx);
        const angleDiff = Math.abs(obstacleAngle - angle);

        // Check if obstacle is in this ray's direction (within tolerance)
        if (angleDiff < (this.resolution * Math.PI) / 360) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < minDistance) {
            minDistance = distance;
            intensity = 1.0 / (1.0 + distance); // Intensity decreases with distance
          }
        }
      }

      // Add noise
      const noise = (Math.random() - 0.5) * 2 * this.noiseLevel * minDistance;
      const measuredDistance = minDistance + noise;

      points.push({
        distance: Math.max(0, measuredDistance),
        angle: angle,
        intensity: intensity,
      });
    }

    return {
      value: points,
      timestamp: Date.now(),
      accuracy: this.noiseLevel,
      status: 'valid',
    };
  }

  getResolution(): number {
    return this.resolution;
  }
}

class IMUSensor {
  private noiseLevel: number;
  private bias: Vector3;
  private actualAcceleration: Vector3 = { x: 0, y: 0, z: 0 };
  private actualAngularVelocity: Vector3 = { x: 0, y: 0, z: 0 };

  constructor(noiseLevel: number = 0.01) {
    this.noiseLevel = noiseLevel;
    this.bias = {
      x: (Math.random() - 0.5) * 0.1,
      y: (Math.random() - 0.5) * 0.1,
      z: (Math.random() - 0.5) * 0.1,
    };
  }

  setAcceleration(acceleration: Vector3): void {
    this.actualAcceleration = { ...acceleration };
  }

  setAngularVelocity(angularVelocity: Vector3): void {
    this.actualAngularVelocity = { ...angularVelocity };
  }

  read(): SensorReading<IMUData> {
    // Add noise and bias
    const addNoise = (value: number) => {
      return value + (Math.random() - 0.5) * 2 * this.noiseLevel;
    };

    return {
      value: {
        acceleration: {
          x: addNoise(this.actualAcceleration.x + this.bias.x),
          y: addNoise(this.actualAcceleration.y + this.bias.y),
          z: addNoise(this.actualAcceleration.z + this.bias.z + 9.81), // Include gravity
        },
        angularVelocity: {
          x: addNoise(this.actualAngularVelocity.x),
          y: addNoise(this.actualAngularVelocity.y),
          z: addNoise(this.actualAngularVelocity.z),
        },
        orientation: { x: 0, y: 0, z: 0 }, // Simplified
      },
      timestamp: Date.now(),
      accuracy: this.noiseLevel,
      status: 'valid',
    };
  }

  calibrate(): void {
    // Reset bias
    this.bias = { x: 0, y: 0, z: 0 };
  }
}

class GPSSensor {
  private position: Vector3 = { x: 0, y: 0, z: 0 };
  private accuracy: number;
  private updateRate: number; // Hz

  constructor(accuracy: number = 2.0, updateRate: number = 1.0) {
    this.accuracy = accuracy;
    this.updateRate = updateRate;
  }

  setActualPosition(position: Vector3): void {
    this.position = { ...position };
  }

  getPosition(): SensorReading<GPSData> {
    // Add noise based on accuracy
    const addNoise = (value: number) => {
      return value + (Math.random() - 0.5) * 2 * this.accuracy;
    };

    return {
      value: {
        latitude: addNoise(this.position.x),
        longitude: addNoise(this.position.y),
        altitude: addNoise(this.position.z),
        accuracy: this.accuracy,
      },
      timestamp: Date.now(),
      accuracy: this.accuracy,
      status: 'valid',
    };
  }

  getUpdateRate(): number {
    return this.updateRate;
  }
}

describe('Sensor Simulation', () => {
  describe('Distance Sensor', () => {
    let sensor: DistanceSensor;

    beforeEach(() => {
      sensor = new DistanceSensor(10.0, 0.01);
    });

    it('should measure distance accurately', () => {
      sensor.setPosition({ x: 0, y: 0, z: 0 });
      const target = { x: 5, y: 0, z: 0 };

      const reading = sensor.measure(target);

      expect(reading.value).toBeCloseTo(5.0, 0);
      expect(reading.status).toBe('valid');
    });

    it('should add realistic noise to measurements', () => {
      sensor.setPosition({ x: 0, y: 0, z: 0 });
      const target = { x: 10, y: 0, z: 0 };

      const readings: number[] = [];
      for (let i = 0; i < 100; i++) {
        const reading = sensor.measure(target);
        readings.push(reading.value);
      }

      // Calculate statistics
      const mean = readings.reduce((a, b) => a + b, 0) / readings.length;
      const variance =
        readings.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
        readings.length;
      const stdDev = Math.sqrt(variance);

      expect(mean).toBeCloseTo(10.0, 0);
      expect(stdDev).toBeGreaterThan(0);
      expect(stdDev).toBeLessThan(0.2); // Reasonable noise level
    });

    it('should mark readings as invalid when out of range', () => {
      sensor.setPosition({ x: 0, y: 0, z: 0 });
      const target = { x: 15, y: 0, z: 0 }; // Beyond range

      const reading = sensor.measure(target);

      expect(reading.status).toBe('invalid');
    });

    it('should measure 3D distances correctly', () => {
      sensor.setPosition({ x: 0, y: 0, z: 0 });
      const target = { x: 3, y: 4, z: 0 };

      const reading = sensor.measure(target);

      expect(reading.value).toBeCloseTo(5.0, 0); // 3-4-5 triangle
    });

    it('should handle sensor repositioning', () => {
      const target = { x: 10, y: 0, z: 0 };

      sensor.setPosition({ x: 0, y: 0, z: 0 });
      const reading1 = sensor.measure(target);

      sensor.setPosition({ x: 5, y: 0, z: 0 });
      const reading2 = sensor.measure(target);

      expect(reading1.value).toBeCloseTo(10.0, 0);
      expect(reading2.value).toBeCloseTo(5.0, 0);
    });

    it('should include accuracy metadata', () => {
      sensor.setPosition({ x: 0, y: 0, z: 0 });
      const target = { x: 5, y: 0, z: 0 });

      const reading = sensor.measure(target);

      expect(reading.accuracy).toBe(0.01);
      expect(reading.timestamp).toBeDefined();
    });
  });

  describe('LIDAR Sensor', () => {
    let lidar: LidarSensor;

    beforeEach(() => {
      lidar = new LidarSensor(10.0, 1.0, 0.02);
    });

    it('should perform 360-degree scan', () => {
      lidar.setPosition({ x: 0, y: 0, z: 0 });
      const obstacles: Vector3[] = [];

      const scan = lidar.scan(obstacles);

      expect(scan.value.length).toBe(360); // One ray per degree
      expect(scan.status).toBe('valid');
    });

    it('should detect obstacles in scan', () => {
      lidar.setPosition({ x: 0, y: 0, z: 0 });
      const obstacles = [
        { x: 5, y: 0, z: 0 },
        { x: 0, y: 5, z: 0 },
      ];

      const scan = lidar.scan(obstacles);

      // Find rays that should have detected obstacles
      const eastRays = scan.value.filter(
        point => Math.abs(point.angle - 0) < 0.1
      );
      const northRays = scan.value.filter(
        point => Math.abs(point.angle - Math.PI / 2) < 0.1
      );

      expect(eastRays.some(ray => ray.distance < 6)).toBe(true);
      expect(northRays.some(ray => ray.distance < 6)).toBe(true);
    });

    it('should provide intensity information', () => {
      lidar.setPosition({ x: 0, y: 0, z: 0 });
      const obstacles = [{ x: 2, y: 0, z: 0 }];

      const scan = lidar.scan(obstacles);

      const eastRays = scan.value.filter(
        point => Math.abs(point.angle - 0) < 0.1
      );

      // Closer obstacles should have higher intensity
      expect(eastRays[0].intensity).toBeGreaterThan(0);
    });

    it('should respect angular resolution', () => {
      const highResLidar = new LidarSensor(10.0, 0.5); // Higher resolution
      const lowResLidar = new LidarSensor(10.0, 2.0); // Lower resolution

      const highResScan = highResLidar.scan([]);
      const lowResScan = lowResLidar.scan([]);

      expect(highResScan.value.length).toBeGreaterThan(lowResScan.value.length);
    });

    it('should handle multiple obstacles at different distances', () => {
      lidar.setPosition({ x: 0, y: 0, z: 0 });
      const obstacles = [
        { x: 3, y: 0, z: 0 },
        { x: 7, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
      ];

      const scan = lidar.scan(obstacles);

      const eastRays = scan.value.filter(
        point => Math.abs(point.angle - 0) < 0.1
      );

      // Should detect closest obstacle
      expect(eastRays[0].distance).toBeCloseTo(3, 0);
    });

    it('should return maximum range when no obstacles detected', () => {
      lidar.setPosition({ x: 0, y: 0, z: 0 });
      const obstacles: Vector3[] = [];

      const scan = lidar.scan(obstacles);

      // All rays should report maximum range
      scan.value.forEach(point => {
        expect(point.distance).toBeCloseTo(10.0, 0);
      });
    });
  });

  describe('IMU Sensor', () => {
    let imu: IMUSensor;

    beforeEach(() => {
      imu = new IMUSensor(0.01);
    });

    it('should read acceleration data', () => {
      imu.setAcceleration({ x: 1, y: 0, z: 0 });

      const reading = imu.read();

      expect(reading.value.acceleration.x).toBeCloseTo(1, 0);
      expect(reading.status).toBe('valid');
    });

    it('should include gravity in z-axis', () => {
      imu.setAcceleration({ x: 0, y: 0, z: 0 });

      const reading = imu.read();

      expect(reading.value.acceleration.z).toBeCloseTo(9.81, 0);
    });

    it('should read angular velocity data', () => {
      imu.setAngularVelocity({ x: 0, y: 0, z: 1.57 }); // Rotating around z-axis

      const reading = imu.read();

      expect(reading.value.angularVelocity.z).toBeCloseTo(1.57, 0);
    });

    it('should exhibit sensor bias', () => {
      imu.setAcceleration({ x: 0, y: 0, z: 0 });

      const readings: number[] = [];
      for (let i = 0; i < 100; i++) {
        const reading = imu.read();
        readings.push(reading.value.acceleration.x);
      }

      const mean = readings.reduce((a, b) => a + b, 0) / readings.length;

      // Mean should not be exactly zero due to bias
      expect(Math.abs(mean)).toBeGreaterThan(0);
    });

    it('should reduce bias after calibration', () => {
      imu.setAcceleration({ x: 0, y: 0, z: 0 });

      // Read before calibration
      const beforeReadings: number[] = [];
      for (let i = 0; i < 50; i++) {
        const reading = imu.read();
        beforeReadings.push(reading.value.acceleration.x);
      }

      imu.calibrate();

      // Read after calibration
      const afterReadings: number[] = [];
      for (let i = 0; i < 50; i++) {
        const reading = imu.read();
        afterReadings.push(reading.value.acceleration.x);
      }

      const beforeMean =
        beforeReadings.reduce((a, b) => a + b, 0) / beforeReadings.length;
      const afterMean =
        afterReadings.reduce((a, b) => a + b, 0) / afterReadings.length;

      expect(Math.abs(afterMean)).toBeLessThan(Math.abs(beforeMean));
    });

    it('should add noise to measurements', () => {
      imu.setAcceleration({ x: 1, y: 0, z: 0 });

      const readings: number[] = [];
      for (let i = 0; i < 100; i++) {
        const reading = imu.read();
        readings.push(reading.value.acceleration.x);
      }

      const variance =
        readings.reduce((acc, val) => {
          const mean = readings.reduce((a, b) => a + b, 0) / readings.length;
          return acc + Math.pow(val - mean, 2);
        }, 0) / readings.length;

      expect(variance).toBeGreaterThan(0);
    });
  });

  describe('GPS Sensor', () => {
    let gps: GPSSensor;

    beforeEach(() => {
      gps = new GPSSensor(2.0, 1.0);
    });

    it('should provide position data', () => {
      gps.setActualPosition({ x: 40.7128, y: -74.0060, z: 10 });

      const reading = gps.getPosition();

      expect(reading.value.latitude).toBeCloseTo(40.7128, 0);
      expect(reading.value.longitude).toBeCloseTo(-74.0060, 0);
      expect(reading.value.altitude).toBeCloseTo(10, 0);
    });

    it('should include accuracy information', () => {
      gps.setActualPosition({ x: 0, y: 0, z: 0 });

      const reading = gps.getPosition();

      expect(reading.value.accuracy).toBe(2.0);
      expect(reading.accuracy).toBe(2.0);
    });

    it('should add position noise based on accuracy', () => {
      gps.setActualPosition({ x: 0, y: 0, z: 0 });

      const readings: GPSData[] = [];
      for (let i = 0; i < 100; i++) {
        const reading = gps.getPosition();
        readings.push(reading.value);
      }

      // Calculate standard deviation
      const latitudes = readings.map(r => r.latitude);
      const meanLat = latitudes.reduce((a, b) => a + b, 0) / latitudes.length;
      const variance =
        latitudes.reduce((acc, val) => acc + Math.pow(val - meanLat, 2), 0) /
        latitudes.length;
      const stdDev = Math.sqrt(variance);

      expect(stdDev).toBeGreaterThan(0);
      expect(stdDev).toBeLessThan(3.0); // Should be related to accuracy
    });

    it('should have configurable accuracy', () => {
      const highAccuracyGPS = new GPSSensor(0.5);
      const lowAccuracyGPS = new GPSSensor(10.0);

      highAccuracyGPS.setActualPosition({ x: 0, y: 0, z: 0 });
      lowAccuracyGPS.setActualPosition({ x: 0, y: 0, z: 0 });

      const highAccReadings: number[] = [];
      const lowAccReadings: number[] = [];

      for (let i = 0; i < 100; i++) {
        highAccReadings.push(highAccuracyGPS.getPosition().value.latitude);
        lowAccReadings.push(lowAccuracyGPS.getPosition().value.latitude);
      }

      const highAccVariance =
        highAccReadings.reduce((acc, val) => acc + val * val, 0) /
        highAccReadings.length;
      const lowAccVariance =
        lowAccReadings.reduce((acc, val) => acc + val * val, 0) /
        lowAccReadings.length;

      expect(highAccVariance).toBeLessThan(lowAccVariance);
    });

    it('should provide timestamp information', () => {
      gps.setActualPosition({ x: 0, y: 0, z: 0 });

      const reading1 = gps.getPosition();

      // Wait a bit
      const start = Date.now();
      while (Date.now() - start < 10) {}

      const reading2 = gps.getPosition();

      expect(reading2.timestamp).toBeGreaterThanOrEqual(reading1.timestamp);
    });
  });

  describe('Sensor Fusion', () => {
    it('should combine multiple sensor readings for better accuracy', () => {
      const sensor1 = new DistanceSensor(10.0, 0.05);
      const sensor2 = new DistanceSensor(10.0, 0.05);

      sensor1.setPosition({ x: 0, y: 0, z: 0 });
      sensor2.setPosition({ x: 0, y: 0, z: 0 });

      const target = { x: 5, y: 0, z: 0 };

      const readings: number[] = [];
      for (let i = 0; i < 100; i++) {
        const reading1 = sensor1.measure(target);
        const reading2 = sensor2.measure(target);
        const fused = (reading1.value + reading2.value) / 2;
        readings.push(fused);
      }

      const mean = readings.reduce((a, b) => a + b, 0) / readings.length;
      const variance =
        readings.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
        readings.length;
      const stdDev = Math.sqrt(variance);

      // Fused readings should be more accurate
      expect(stdDev).toBeLessThan(0.3);
    });
  });

  describe('Sensor Performance', () => {
    it('should process LIDAR scans efficiently', () => {
      const lidar = new LidarSensor(50.0, 0.25); // High resolution
      const obstacles: Vector3[] = [];

      // Generate random obstacles
      for (let i = 0; i < 100; i++) {
        obstacles.push({
          x: (Math.random() - 0.5) * 100,
          y: (Math.random() - 0.5) * 100,
          z: 0,
        });
      }

      const startTime = performance.now();

      for (let i = 0; i < 10; i++) {
        lidar.scan(obstacles);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500); // Should complete in under 500ms
    });

    it('should handle high-frequency IMU readings', () => {
      const imu = new IMUSensor(0.01);
      imu.setAcceleration({ x: 1, y: 2, z: 3 });

      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        imu.read();
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });
  });
});
