#!/usr/bin/env node
/**
 * Test All Robot Types - Comprehensive robot simulation demo
 *
 * Demonstrates all robot types:
 * - WheeledRobot: Differential drive navigation
 * - HumanoidRobot: Bipedal walking and manipulation
 * - DroneRobot: Autonomous flight
 * - RoboticArm: Pick and place operations
 */

import {
  WheeledRobot,
  HumanoidRobot,
  DroneRobot,
  RoboticArm,
  RobotType,
  createRobot,
  getAvailableRobotTypes,
  getRobotDescription,
} from '../../src/robots/index.js';

async function testWheeledRobot(): Promise<void> {
  console.log('\n=== Testing Wheeled Robot ===');

  const robot = new WheeledRobot({
    name: 'rover-1',
    dbPath: './examples/data/rover-1.db',
    wheelRadius: 0.1,
    wheelBase: 0.5,
  });

  await robot.start();

  // Drive in a square pattern
  console.log('Driving in a square pattern...');

  for (let i = 0; i < 4; i++) {
    // Drive forward
    await robot.processControl({ linearVelocity: 0.5, angularVelocity: 0 });
    await sleep(2000);

    // Turn 90 degrees
    await robot.processControl({ linearVelocity: 0, angularVelocity: Math.PI / 4 });
    await sleep(2000);
  }

  // Stop
  await robot.processControl({ linearVelocity: 0, angularVelocity: 0 });

  const state = robot.getState();
  const odometry = robot.getOdometry();
  console.log(`Final position: (${state.pose.x.toFixed(2)}, ${state.pose.y.toFixed(2)})`);
  console.log(`Odometry: (${odometry.x.toFixed(2)}, ${odometry.y.toFixed(2)}, θ=${odometry.theta.toFixed(2)})`);

  await robot.stop();
}

async function testHumanoidRobot(): Promise<void> {
  console.log('\n=== Testing Humanoid Robot ===');

  const robot = new HumanoidRobot({
    name: 'humanoid-1',
    dbPath: './examples/data/humanoid-1.db',
  });

  await robot.start();

  // Test walking
  console.log('Walking forward...');
  await robot.processControl({ type: 'walk', speed: 0.8 });
  await sleep(3000);

  // Test arm reaching
  console.log('Reaching with right hand...');
  await robot.processControl({ type: 'reach', x: 0.3, y: -0.4, z: 1.2, hand: 'right' });
  await sleep(2000);

  // Test joint control
  console.log('Moving head joint...');
  await robot.processControl({ type: 'set_joint', joint: 'neck', position: 0.3 });
  await sleep(1000);

  const jointStates = robot.getJointStates();
  const com = robot.getCenterOfMass();
  const balanceError = robot.getBalanceError();

  console.log(`Center of Mass: (${com.x.toFixed(2)}, ${com.y.toFixed(2)}, ${com.z.toFixed(2)})`);
  console.log(`Balance Error: ${balanceError.toFixed(3)}m`);
  console.log(`Active Joints: ${Object.keys(jointStates).length}`);

  await robot.stop();
}

async function testDroneRobot(): Promise<void> {
  console.log('\n=== Testing Drone Robot ===');

  const robot = new DroneRobot({
    name: 'quadcopter-1',
    dbPath: './examples/data/quadcopter-1.db',
    mass: 1.5,
    maxThrust: 20.0,
  });

  await robot.start();

  // Test takeoff
  console.log('Taking off to 2m...');
  for (let i = 0; i < 20; i++) {
    await robot.takeoff(2.0);
    await sleep(100);
  }

  // Hover
  console.log('Hovering...');
  for (let i = 0; i < 20; i++) {
    await robot.hover();
    await sleep(100);
  }

  // Add wind
  console.log('Adding wind disturbance...');
  robot.setWind(2.0, 1.0, 0.5);

  for (let i = 0; i < 20; i++) {
    await robot.hover();
    await sleep(100);
  }

  // Land
  console.log('Landing...');
  for (let i = 0; i < 30; i++) {
    await robot.land();
    await sleep(100);
    const state = robot.getState();
    if (state.pose.z <= 0.01) break;
  }

  const state = robot.getState();
  const imu = robot.getIMU();
  const rotors = robot.getRotorStates();

  console.log(`Final altitude: ${state.pose.z.toFixed(2)}m`);
  console.log(`Battery: ${state.batteryLevel.toFixed(1)}%`);
  console.log(`Rotor states: ${rotors.map(r => r.rpm.toFixed(0)).join(', ')} RPM`);

  await robot.stop();
}

async function testRoboticArm(): Promise<void> {
  console.log('\n=== Testing Robotic Arm ===');

  const robot = new RoboticArm({
    name: 'manipulator-1',
    dbPath: './examples/data/manipulator-1.db',
    numJoints: 6,
  });

  await robot.start();

  // Test reachability
  const targetPos = { x: 0.5, y: 0.3, z: 0.4 };
  const reachable = robot.isReachable(targetPos.x, targetPos.y, targetPos.z);
  console.log(`Target (${targetPos.x}, ${targetPos.y}, ${targetPos.z}) is ${reachable ? 'reachable' : 'unreachable'}`);

  if (reachable) {
    // Move to target
    console.log('Moving to target position...');
    await robot.moveTo(targetPos.x, targetPos.y, targetPos.z);

    // Simulate movement
    for (let i = 0; i < 50; i++) {
      await sleep(100);
      const pos = robot.getEndEffectorPosition();
      const dx = targetPos.x - pos.x;
      const dy = targetPos.y - pos.y;
      const dz = targetPos.z - pos.z;
      const error = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (error < 0.01) break;
    }
  }

  // Test gripper
  console.log('Testing gripper...');
  await robot.closeGripper();
  await sleep(1000);

  const gripperState = robot.getGripperState();
  console.log(`Gripper: ${gripperState.hasObject ? 'holding object' : 'empty'}, force: ${gripperState.force.toFixed(2)}N`);

  await robot.openGripper();
  await sleep(500);

  const endEffectorPos = robot.getEndEffectorPosition();
  const jointAngles = robot.getJointAngles();

  console.log(`End-effector: (${endEffectorPos.x.toFixed(3)}, ${endEffectorPos.y.toFixed(3)}, ${endEffectorPos.z.toFixed(3)})`);
  console.log(`Joint angles: ${jointAngles.map(a => (a * 180 / Math.PI).toFixed(1)).join('°, ')}°`);

  await robot.stop();
}

async function demonstrateRobotFactory(): Promise<void> {
  console.log('\n=== Robot Factory Demo ===');

  const types = getAvailableRobotTypes();
  console.log(`Available robot types: ${types.length}`);

  types.forEach(type => {
    console.log(`  - ${type}: ${getRobotDescription(type)}`);
  });

  // Create robots using factory
  console.log('\nCreating robots using factory...');

  const wheeled = createRobot(RobotType.WHEELED, { name: 'factory-wheeled' });
  console.log(`Created: ${wheeled.getInfo().name}`);

  const humanoid = createRobot(RobotType.HUMANOID, { name: 'factory-humanoid' });
  console.log(`Created: ${humanoid.getInfo().name}`);

  const drone = createRobot(RobotType.DRONE, { name: 'factory-drone' });
  console.log(`Created: ${drone.getInfo().name}`);

  const arm = createRobot(RobotType.ARM, { name: 'factory-arm' });
  console.log(`Created: ${arm.getInfo().name}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  ROS3 Agentic Robotics - Robot Simulation Test Suite  ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  try {
    await demonstrateRobotFactory();
    await testWheeledRobot();
    await testHumanoidRobot();
    await testDroneRobot();
    await testRoboticArm();

    console.log('\n✅ All robot simulations completed successfully!');
  } catch (error) {
    console.error('\n❌ Error during robot simulation:', error);
    process.exit(1);
  }
}

main().catch(console.error);
