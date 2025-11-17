# Agentic Robotics - Production-Ready Simulations

Complete simulations for industrial, automotive, and aerial robotics with AI integration.

## 🎯 Available Simulations

### 1. 🏭 Industrial Robotics - Assembly Line Robot
**File:** `industrial-robotics/assembly-line-robot.ts`

High-precision manufacturing with AI vision inspection, predictive maintenance, and multi-robot coordination.

**Features:**
- Component pick-and-place (±0.1mm accuracy)
- AI-powered quality inspection  
- Experience-based learning
- 10Hz real-time monitoring

**Run:** `npx ts-node examples/industrial-robotics/assembly-line-robot.ts`

### 2. 🚗 Autonomous Vehicles - Self-Driving Car
**File:** `autonomous-vehicles/self-driving-car.ts`

Level 4/5 autonomous vehicle with sensor fusion, path planning, and V2V communication.

**Features:**
- LIDAR + camera + radar fusion
- 50Hz control loop (20ms response)
- Emergency braking & collision avoidance
- Multi-vehicle coordination

**Run:** `npx ts-node examples/autonomous-vehicles/self-driving-car.ts`

### 3. 🚁 Drones - Autonomous Drone
**File:** `drones/autonomous-drone.ts`

Multi-purpose aerial robot for delivery, inspection, and surveying with swarm support.

**Features:**
- 100Hz flight control
- 3D obstacle avoidance
- Mission planning & execution
- Emergency landing & fail-safes

**Run:** `npx ts-node examples/drones/autonomous-drone.ts`

## 📊 Common Features

All simulations include:
- **AgentDB Memory** - Learn from past experiences
- **Real-Time Pub/Sub** - Communicate with other robots
- **AI Decision Making** - Retrieve and apply learned patterns
- **Safety Systems** - Emergency stops and fail-safes
- **Telemetry** - Comprehensive monitoring

## 🚀 Quick Start

```bash
# Install dependencies
npm install agentic-robotics

# Run any simulation
npx ts-node examples/industrial-robotics/assembly-line-robot.ts
```

## 📚 Topics Reference

**Industrial Robots:**
- `/robots/{id}/state` - Robot state (10Hz)
- `/factory/tasks` - Task assignments
- `/factory/quality` - Quality results

**Autonomous Vehicles:**
- `/vehicles/{id}/state` - Vehicle state (50Hz)  
- `/v2v/broadcast` - V2V communication
- `/traffic/updates` - Traffic info

**Drones:**
- `/drones/{id}/state` - Flight state (100Hz)
- `/drones/{id}/mission` - Missions
- `/swarm/coordination` - Multi-drone

## 📄 License

MIT - Free for commercial and open-source use.
