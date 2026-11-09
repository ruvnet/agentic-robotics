use agentic_robotics_rt::executor::{Deadline, Priority, ROS3Executor};
use agentic_robotics_rt::scheduler::PriorityScheduler;
use agentic_robotics_rt::RTPriority;
use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use std::time::Duration;

// `Priority` is a `u8` newtype; these mirror `RTPriority` (Low = 1, Normal = 2, High = 3).
const LOW: Priority = Priority(1);
const MEDIUM: Priority = Priority(2);
const HIGH: Priority = Priority(3);

fn benchmark_executor_creation(c: &mut Criterion) {
    let mut group = c.benchmark_group("Executor Creation");

    group.bench_function("create_executor", |b| {
        b.iter(|| {
            let executor = ROS3Executor::new().unwrap();
            black_box(executor)
        })
    });

    group.finish();
}

fn benchmark_task_spawning(c: &mut Criterion) {
    let mut group = c.benchmark_group("Task Spawning");

    let executor = ROS3Executor::new().unwrap();

    group.bench_function("spawn_high_priority", |b| {
        b.iter(|| {
            executor.spawn_rt(HIGH, Deadline(Duration::from_micros(100)), async {
                black_box(42);
            });
        })
    });

    group.bench_function("spawn_low_priority", |b| {
        b.iter(|| {
            executor.spawn_rt(LOW, Deadline(Duration::from_millis(100)), async {
                black_box(42);
            });
        })
    });

    group.finish();
}

fn benchmark_scheduler_overhead(c: &mut Criterion) {
    let mut group = c.benchmark_group("Scheduler Overhead");

    // The scheduler is a priority queue: measure a schedule + pop round trip.
    let mut scheduler = PriorityScheduler::new();

    group.bench_function("schedule_and_pop_low", |b| {
        b.iter(|| {
            scheduler.schedule(black_box(RTPriority::Low), black_box(Duration::from_millis(100)));
            black_box(scheduler.next_task())
        })
    });

    group.bench_function("schedule_and_pop_critical", |b| {
        b.iter(|| {
            scheduler.schedule(
                black_box(RTPriority::Critical),
                black_box(Duration::from_micros(100)),
            );
            black_box(scheduler.next_task())
        })
    });

    group.bench_function("schedule_100_then_drain", |b| {
        b.iter(|| {
            for i in 0..100u8 {
                scheduler.schedule(RTPriority::from(i % 5), Duration::from_micros(i as u64));
            }
            while let Some(task) = scheduler.next_task() {
                black_box(task);
            }
        })
    });

    group.finish();
}

fn benchmark_task_distribution(c: &mut Criterion) {
    let mut group = c.benchmark_group("Task Distribution");

    for num_tasks in [10, 100, 1000].iter() {
        group.bench_with_input(
            BenchmarkId::new("spawn_tasks", num_tasks),
            num_tasks,
            |b, &count| {
                b.iter(|| {
                    let executor = ROS3Executor::new().unwrap();

                    for i in 0..count {
                        let priority = match i % 3 {
                            0 => HIGH,
                            1 => MEDIUM,
                            _ => LOW,
                        };

                        let deadline = if priority == HIGH {
                            Deadline(Duration::from_micros(100))
                        } else {
                            Deadline(Duration::from_millis(10))
                        };

                        executor.spawn_rt(priority, deadline, async move {
                            black_box(i);
                        });
                    }

                    black_box(executor)
                })
            },
        );
    }

    group.finish();
}

fn benchmark_async_task_execution(c: &mut Criterion) {
    let mut group = c.benchmark_group("Async Task Execution");
    group.sample_size(50);

    let executor = ROS3Executor::new().unwrap();

    group.bench_function("execute_sync_task", |b| {
        b.iter(|| {
            executor.spawn_rt(HIGH, Deadline(Duration::from_micros(100)), async {
                let mut sum = 0;
                for i in 0..100 {
                    sum += i;
                }
                black_box(sum);
            });
        })
    });

    group.bench_function("execute_with_yield", |b| {
        b.iter(|| {
            executor.spawn_rt(MEDIUM, Deadline(Duration::from_millis(1)), async {
                tokio::task::yield_now().await;
                black_box(42);
            });
        })
    });

    group.finish();
}

fn benchmark_priority_handling(c: &mut Criterion) {
    let mut group = c.benchmark_group("Priority Handling");

    let executor = ROS3Executor::new().unwrap();

    group.bench_function("mixed_priorities", |b| {
        b.iter(|| {
            executor.spawn_rt(HIGH, Deadline(Duration::from_micros(50)), async {
                black_box(1);
            });
            executor.spawn_rt(MEDIUM, Deadline(Duration::from_millis(1)), async {
                black_box(2);
            });
            executor.spawn_rt(LOW, Deadline(Duration::from_millis(100)), async {
                black_box(3);
            });
        })
    });

    group.finish();
}

fn benchmark_deadline_distribution(c: &mut Criterion) {
    let mut group = c.benchmark_group("Deadline Distribution");

    let executor = ROS3Executor::new().unwrap();

    // Tight deadlines (< 1 ms) go to the high-priority runtime.
    group.bench_function("tight_deadlines", |b| {
        b.iter(|| {
            for _ in 0..10 {
                executor.spawn_rt(HIGH, Deadline(Duration::from_micros(100)), async {
                    black_box(42);
                });
            }
        })
    });

    // Loose deadlines go to the low-priority runtime.
    group.bench_function("loose_deadlines", |b| {
        b.iter(|| {
            for _ in 0..10 {
                executor.spawn_rt(LOW, Deadline(Duration::from_millis(100)), async {
                    black_box(42);
                });
            }
        })
    });

    group.finish();
}

criterion_group!(
    benches,
    benchmark_executor_creation,
    benchmark_task_spawning,
    benchmark_scheduler_overhead,
    benchmark_task_distribution,
    benchmark_async_task_execution,
    benchmark_priority_handling,
    benchmark_deadline_distribution
);
criterion_main!(benches);
