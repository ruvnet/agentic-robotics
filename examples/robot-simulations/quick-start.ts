#!/usr/bin/env node
/**
 * Quick Start - Simple robot simulation examples
 *
 * Minimal examples for each robot type to get started quickly.
 */

import {
  WheeledRobot,
  HumanoidRobot,
  DroneRobot,
  RoboticArm,
} from '../../src/robots/index.js';

// Example 1: Wheeled Robot - Simple navigation
async function quickWheeledExample() {
  console.log('\n=== Wheeled Robot Quick Start ===');

  const robot = new WheeledRobot({ name: 'rover', dbPath: './examples/data/rover.db' });
  await robot.start();

  // Drive forward
  await robot.processControl({ linearVelocity: 0.5, angularVelocity: 0 });
  console.log('Driving forward...');

  await sleep(2000);

  // Stop
  await robot.processControl({ linearVelocity: 0, angularVelocity: 0 });
  console.log(`Position: (${robot.getState().pose.x.toFixed(2)}, ${robot.getState().pose.y.toFixed(2)})`);

  await robot.stop();
}

// Example 2: Humanoid Robot - Simple walking
async function quickHumanoidExample() {
  console.log('\n=== Humanoid Robot Quick Start ===');

  const robot = new HumanoidRobot({ name: 'humanoid', dbPath: './examples/data/humanoid.db' });
  await robot.start();

  // Walk
  await robot.processControl({ type: 'walk', speed: 0.5 });
  console.log('Walking...');

  await sleep(2000);

  console.log(`Center of Mass: (${robot.getCenterOfMass().x.toFixed(2)}, ${robot.getCenterOfMass().y.toFixed(2)}, ${robot.getCenterOfMass().z.toFixed(2)})`);

  await robot.stop();
}

// Example 3: Drone Robot - Simple flight
async function quickDroneExample() {
  console.log('\n=== Drone Robot Quick Start ===');

  const robot = new DroneRobot({ name: 'drone', dbPath: './examples/data/drone.db' });
  await robot.start();

  // Takeoff
  console.log('Taking off...');
  for (let i = 0; i < 20; i++) {
    await robot.takeoff(2.0);
    await sleep(100);
  }

  console.log(`Altitude: ${robot.getState().pose.z.toFixed(2)}m`);

  // Land
  console.log('Landing...');
  for (let i = 0; i < 30; i++) {
    await robot.land();
    await sleep(100);
    if (robot.getState().pose.z <= 0.01) break;
  }

  await robot.stop();
}

// Example 4: Robotic Arm - Simple pick and place
async function quickArmExample() {
  console.log('\n=== Robotic Arm Quick Start ===');

  const robot = new RoboticArm({ name: 'arm', dbPath: './examples/data/arm.db' });
  await robot.start();

  // Move to position
  console.log('Moving to target...');
  await robot.moveTo(0.4, 0.3, 0.3);

  await sleep(2000);

  // Close gripper
  await robot.closeGripper();
  console.log('Gripper closed');

  await sleep(1000);

  // Open gripper
  await robot.openGripper();
  console.log('Gripper opened');

  const pos = robot.getEndEffectorPosition();
  console.log(`End-effector at: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);

  await robot.stop();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 ROS3 Robot Simulations - Quick Start Examples');

  try {
    await quickWheeledExample();
    await quickHumanoidExample();
    await quickDroneExample();
    await quickArmExample();

    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main().catch(console.error);
