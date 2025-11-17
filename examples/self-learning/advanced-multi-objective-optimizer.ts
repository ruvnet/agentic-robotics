#!/usr/bin/env node
/**
 * Advanced Multi-Objective Optimizer
 * Uses NSGA-II (Non-dominated Sorting Genetic Algorithm) for Pareto-optimal solutions
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface Individual {
  id: string;
  genes: Record<string, number>;
  objectives: {
    performance: number;
    efficiency: number;
    reliability: number;
    cost: number;
  };
  rank: number;
  crowdingDistance: number;
  dominationCount: number;
  dominatedSolutions: Set<string>;
}

interface ParetoFront {
  rank: number;
  individuals: Individual[];
  hypervolume: number;
}

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(color: string, prefix: string, message: string): void {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

class MultiObjectiveOptimizer {
  private population: Individual[] = [];
  private paretoFronts: ParetoFront[] = [];
  private populationSize: number;
  private generations: number;
  private crossoverRate: number = 0.9;
  private mutationRate: number = 0.1;
  private generation: number = 0;

  constructor(populationSize: number = 100, generations: number = 50) {
    this.populationSize = populationSize;
    this.generations = generations;
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const dir = './examples/data/multi-objective';
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private initializePopulation(): void {
    log(colors.cyan, '[NSGA-II]', `Initializing population of ${this.populationSize}...`);

    for (let i = 0; i < this.populationSize; i++) {
      const individual: Individual = {
        id: `ind-${i}`,
        genes: {
          speed: Math.random() * 2,
          accuracy: Math.random(),
          robustness: Math.random(),
          complexity: Math.random()
        },
        objectives: {
          performance: 0,
          efficiency: 0,
          reliability: 0,
          cost: 0
        },
        rank: 0,
        crowdingDistance: 0,
        dominationCount: 0,
        dominatedSolutions: new Set()
      };

      this.evaluateObjectives(individual);
      this.population.push(individual);
    }

    log(colors.green, '[NSGA-II]', '✓ Population initialized');
  }

  private evaluateObjectives(individual: Individual): void {
    const { speed, accuracy, robustness, complexity } = individual.genes;

    // Objective 1: Maximize Performance
    individual.objectives.performance =
      speed * 0.4 + accuracy * 0.4 + robustness * 0.2;

    // Objective 2: Maximize Efficiency (minimize resource usage)
    individual.objectives.efficiency =
      1 - (speed * 0.3 + complexity * 0.7);

    // Objective 3: Maximize Reliability
    individual.objectives.reliability =
      robustness * 0.6 + (1 - complexity) * 0.4;

    // Objective 4: Minimize Cost
    individual.objectives.cost =
      -(speed * 0.5 + accuracy * 0.3 + robustness * 0.2);
  }

  private dominates(ind1: Individual, ind2: Individual): boolean {
    // Check if ind1 dominates ind2 (better in at least one objective, not worse in any)
    let betterInAtLeastOne = false;
    const objectives = ['performance', 'efficiency', 'reliability', 'cost'];

    for (const obj of objectives) {
      if ((ind1.objectives as any)[obj] < (ind2.objectives as any)[obj]) {
        return false; // ind1 is worse in this objective
      }
      if ((ind1.objectives as any)[obj] > (ind2.objectives as any)[obj]) {
        betterInAtLeastOne = true;
      }
    }

    return betterInAtLeastOne;
  }

  private fastNonDominatedSort(): void {
    // Reset domination info
    for (const ind of this.population) {
      ind.dominationCount = 0;
      ind.dominatedSolutions.clear();
    }

    // Calculate domination
    for (let i = 0; i < this.population.length; i++) {
      for (let j = i + 1; j < this.population.length; j++) {
        const p = this.population[i];
        const q = this.population[j];

        if (this.dominates(p, q)) {
          p.dominatedSolutions.add(q.id);
          q.dominationCount++;
        } else if (this.dominates(q, p)) {
          q.dominatedSolutions.add(p.id);
          p.dominationCount++;
        }
      }
    }

    // Create fronts
    this.paretoFronts = [];
    let currentFront: Individual[] = [];

    for (const ind of this.population) {
      if (ind.dominationCount === 0) {
        ind.rank = 0;
        currentFront.push(ind);
      }
    }

    let rank = 0;
    while (currentFront.length > 0) {
      this.paretoFronts.push({
        rank,
        individuals: [...currentFront],
        hypervolume: this.calculateHypervolume(currentFront)
      });

      const nextFront: Individual[] = [];

      for (const p of currentFront) {
        for (const qId of p.dominatedSolutions) {
          const q = this.population.find(ind => ind.id === qId);
          if (q) {
            q.dominationCount--;
            if (q.dominationCount === 0) {
              q.rank = rank + 1;
              nextFront.push(q);
            }
          }
        }
      }

      currentFront = nextFront;
      rank++;
    }
  }

  private calculateCrowdingDistance(front: Individual[]): void {
    const numObjectives = 4;
    const objectives: (keyof Individual['objectives'])[] = ['performance', 'efficiency', 'reliability', 'cost'];

    // Initialize distances
    for (const ind of front) {
      ind.crowdingDistance = 0;
    }

    // Calculate for each objective
    for (const obj of objectives) {
      // Sort by objective value
      front.sort((a, b) => b.objectives[obj] - a.objectives[obj]);

      // Boundary individuals get infinite distance
      front[0].crowdingDistance = Infinity;
      front[front.length - 1].crowdingDistance = Infinity;

      const range = front[0].objectives[obj] - front[front.length - 1].objectives[obj];

      if (range === 0) continue;

      // Calculate distances for middle individuals
      for (let i = 1; i < front.length - 1; i++) {
        front[i].crowdingDistance +=
          (front[i - 1].objectives[obj] - front[i + 1].objectives[obj]) / range;
      }
    }
  }

  private calculateHypervolume(front: Individual[]): number {
    // Simplified hypervolume calculation
    // In practice, use more sophisticated algorithms
    let volume = 0;

    for (const ind of front) {
      volume += ind.objectives.performance * ind.objectives.efficiency *
                ind.objectives.reliability * Math.abs(ind.objectives.cost);
    }

    return volume / front.length;
  }

  private tournamentSelection(): Individual {
    const tournamentSize = 2;
    const tournament: Individual[] = [];

    for (let i = 0; i < tournamentSize; i++) {
      const idx = Math.floor(Math.random() * this.population.length);
      tournament.push(this.population[idx]);
    }

    // Select based on rank and crowding distance
    tournament.sort((a, b) => {
      if (a.rank !== b.rank) {
        return a.rank - b.rank;
      }
      return b.crowdingDistance - a.crowdingDistance;
    });

    return tournament[0];
  }

  private crossover(parent1: Individual, parent2: Individual): Individual {
    const child: Individual = {
      id: `ind-gen${this.generation}-${Date.now()}-${Math.random()}`,
      genes: {},
      objectives: { performance: 0, efficiency: 0, reliability: 0, cost: 0 },
      rank: 0,
      crowdingDistance: 0,
      dominationCount: 0,
      dominatedSolutions: new Set()
    };

    // Simulated Binary Crossover (SBX)
    for (const gene in parent1.genes) {
      if (Math.random() < 0.5) {
        child.genes[gene] = parent1.genes[gene];
      } else {
        child.genes[gene] = parent2.genes[gene];
      }
    }

    return child;
  }

  private mutate(individual: Individual): void {
    // Polynomial mutation
    for (const gene in individual.genes) {
      if (Math.random() < this.mutationRate) {
        const delta = (Math.random() - 0.5) * 0.2;
        individual.genes[gene] = Math.max(0, Math.min(2, individual.genes[gene] + delta));
      }
    }
  }

  private createNewPopulation(): void {
    const offspring: Individual[] = [];

    while (offspring.length < this.populationSize) {
      const parent1 = this.tournamentSelection();
      const parent2 = this.tournamentSelection();

      if (Math.random() < this.crossoverRate) {
        const child = this.crossover(parent1, parent2);
        this.mutate(child);
        this.evaluateObjectives(child);
        offspring.push(child);
      }
    }

    // Combine parent and offspring populations
    this.population = [...this.population, ...offspring];

    // Select next generation
    this.fastNonDominatedSort();

    const newPopulation: Individual[] = [];
    let frontIndex = 0;

    while (newPopulation.length + this.paretoFronts[frontIndex].individuals.length <= this.populationSize) {
      const front = this.paretoFronts[frontIndex].individuals;
      newPopulation.push(...front);
      frontIndex++;

      if (frontIndex >= this.paretoFronts.length) break;
    }

    // Fill remaining slots from next front using crowding distance
    if (newPopulation.length < this.populationSize && frontIndex < this.paretoFronts.length) {
      const front = this.paretoFronts[frontIndex].individuals;
      this.calculateCrowdingDistance(front);
      front.sort((a, b) => b.crowdingDistance - a.crowdingDistance);

      const remaining = this.populationSize - newPopulation.length;
      newPopulation.push(...front.slice(0, remaining));
    }

    this.population = newPopulation;
  }

  private printProgress(): void {
    const front0 = this.paretoFronts[0];

    log(colors.cyan, '[NSGA-II]', `Generation ${this.generation + 1}/${this.generations}`);
    log(colors.cyan, '[NSGA-II]', `  Pareto Front Size: ${front0.individuals.length}`);
    log(colors.cyan, '[NSGA-II]', `  Hypervolume: ${front0.hypervolume.toFixed(4)}`);

    // Show best individual for each objective
    const best = {
      performance: front0.individuals.reduce((a, b) =>
        a.objectives.performance > b.objectives.performance ? a : b),
      efficiency: front0.individuals.reduce((a, b) =>
        a.objectives.efficiency > b.objectives.efficiency ? a : b),
      reliability: front0.individuals.reduce((a, b) =>
        a.objectives.reliability > b.objectives.reliability ? a : b),
    };

    log(colors.green, '[NSGA-II]', `  Best Performance: ${best.performance.objectives.performance.toFixed(3)}`);
    log(colors.green, '[NSGA-II]', `  Best Efficiency: ${best.efficiency.objectives.efficiency.toFixed(3)}`);
    log(colors.green, '[NSGA-II]', `  Best Reliability: ${best.reliability.objectives.reliability.toFixed(3)}`);
  }

  private saveResults(): void {
    const timestamp = Date.now();
    const resultsPath = join('./examples/data/multi-objective', `nsga2-${timestamp}.json`);

    const results = {
      timestamp: new Date().toISOString(),
      generations: this.generations,
      populationSize: this.populationSize,
      paretoFronts: this.paretoFronts.map(front => ({
        rank: front.rank,
        size: front.individuals.length,
        hypervolume: front.hypervolume,
        individuals: front.individuals.map(ind => ({
          genes: ind.genes,
          objectives: ind.objectives,
          crowdingDistance: ind.crowdingDistance
        }))
      }))
    };

    writeFileSync(resultsPath, JSON.stringify(results, null, 2));

    log(colors.green, '[NSGA-II]', `✓ Results saved: ${resultsPath}`);
  }

  async optimize(): Promise<void> {
    log(colors.bright + colors.magenta, '[NSGA-II]', '═══════════════════════════════════════════');
    log(colors.bright + colors.magenta, '[NSGA-II]', 'Multi-Objective Optimization (NSGA-II)');
    log(colors.bright + colors.magenta, '[NSGA-II]', '═══════════════════════════════════════════');
    console.log('');

    this.initializePopulation();
    this.fastNonDominatedSort();

    for (this.generation = 0; this.generation < this.generations; this.generation++) {
      this.calculateCrowdingDistance(this.paretoFronts[0].individuals);
      this.createNewPopulation();
      this.printProgress();

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.saveResults();

    console.log('');
    log(colors.bright + colors.magenta, '[NSGA-II]', '═══════════════════════════════════════════');
    log(colors.bright + colors.magenta, '[NSGA-II]', '✓ Optimization Complete');
    log(colors.bright + colors.magenta, '[NSGA-II]', '═══════════════════════════════════════════');
    console.log('');

    log(colors.bright + colors.green, '[NSGA-II]', 'Pareto Front Summary:');
    log(colors.green, '[NSGA-II]', `  Solutions: ${this.paretoFronts[0].individuals.length}`);
    log(colors.green, '[NSGA-II]', `  Hypervolume: ${this.paretoFronts[0].hypervolume.toFixed(4)}`);
    console.log('');
  }
}

// Main execution
async function main() {
  const populationSize = parseInt(process.argv[2]) || 100;
  const generations = parseInt(process.argv[3]) || 50;

  const optimizer = new MultiObjectiveOptimizer(populationSize, generations);
  await optimizer.optimize();

  process.exit(0);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { MultiObjectiveOptimizer };
