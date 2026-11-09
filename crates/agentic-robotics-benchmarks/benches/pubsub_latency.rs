use agentic_robotics_core::message::RobotState;
use agentic_robotics_core::publisher::Publisher;
use agentic_robotics_core::serialization::Format;
use agentic_robotics_core::subscriber::Subscriber;
use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use std::time::Instant;
use tokio::runtime::Runtime;

fn runtime() -> Runtime {
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap()
}

fn message() -> RobotState {
    RobotState {
        position: [1.0, 2.0, 3.0],
        velocity: [0.1, 0.2, 0.3],
        timestamp: 123456789,
    }
}

fn benchmark_publisher_creation(c: &mut Criterion) {
    let mut group = c.benchmark_group("Publisher Creation");

    group.bench_function("create_publisher", |b| {
        b.iter(|| {
            let publisher =
                Publisher::<RobotState>::with_format(black_box("test_topic"), Format::Cdr);
            black_box(publisher)
        })
    });

    group.finish();
}

fn benchmark_subscriber_creation(c: &mut Criterion) {
    let mut group = c.benchmark_group("Subscriber Creation");

    group.bench_function("create_subscriber", |b| {
        b.iter(|| {
            let subscriber = Subscriber::<RobotState>::new(black_box("test_topic"));
            black_box(subscriber)
        })
    });

    group.finish();
}

fn benchmark_publish_latency(c: &mut Criterion) {
    let mut group = c.benchmark_group("Publish Latency");

    let rt = runtime();
    let publisher = Publisher::<RobotState>::with_format("bench_topic", Format::Cdr);
    let message = message();

    group.bench_function("single_publish", |b| {
        b.iter(|| {
            let result = rt.block_on(publisher.publish(black_box(&message)));
            black_box(result)
        })
    });

    group.finish();
}

fn benchmark_publish_throughput(c: &mut Criterion) {
    let mut group = c.benchmark_group("Publish Throughput");

    let rt = runtime();
    let publisher = Publisher::<RobotState>::with_format("bench_topic", Format::Cdr);
    let message = message();

    for batch_size in [10, 100, 1000].iter() {
        group.bench_with_input(
            BenchmarkId::new("batch_publish", batch_size),
            batch_size,
            |b, &size| {
                b.iter(|| {
                    for _ in 0..size {
                        rt.block_on(publisher.publish(black_box(&message))).ok();
                    }
                })
            },
        );
    }

    group.finish();
}

fn benchmark_end_to_end_latency(c: &mut Criterion) {
    let mut group = c.benchmark_group("End-to-End Latency");
    group.sample_size(100);

    let rt = runtime();

    group.bench_function("pubsub_roundtrip", |b| {
        b.iter_custom(|iters| {
            let publisher = Publisher::<RobotState>::with_format("latency_topic", Format::Cdr);
            let _subscriber = Subscriber::<RobotState>::new("latency_topic");

            let start = Instant::now();

            for i in 0..iters {
                let message = RobotState {
                    position: [i as f64, i as f64, i as f64],
                    velocity: [0.1, 0.2, 0.3],
                    timestamp: i as i64,
                };

                rt.block_on(publisher.publish(&message)).ok();
            }

            start.elapsed()
        })
    });

    group.finish();
}

fn benchmark_serializer_comparison(c: &mut Criterion) {
    let mut group = c.benchmark_group("Serializer Comparison");

    let rt = runtime();
    let message = message();

    let cdr_publisher = Publisher::<RobotState>::with_format("cdr_topic", Format::Cdr);
    group.bench_function("CDR_publish", |b| {
        b.iter(|| {
            rt.block_on(cdr_publisher.publish(black_box(&message))).ok();
        })
    });

    let json_publisher = Publisher::<RobotState>::with_format("json_topic", Format::Json);
    group.bench_function("JSON_publish", |b| {
        b.iter(|| {
            rt.block_on(json_publisher.publish(black_box(&message))).ok();
        })
    });

    group.finish();
}

fn benchmark_concurrent_publishers(c: &mut Criterion) {
    let mut group = c.benchmark_group("Concurrent Publishers");
    group.sample_size(50);

    let rt = runtime();

    for num_publishers in [1, 2, 4, 8].iter() {
        group.bench_with_input(
            BenchmarkId::new("concurrent", num_publishers),
            num_publishers,
            |b, &count| {
                b.iter(|| {
                    let publishers: Vec<_> = (0..count)
                        .map(|i| {
                            Publisher::<RobotState>::with_format(format!("topic_{}", i), Format::Cdr)
                        })
                        .collect();

                    let message = message();

                    for publisher in &publishers {
                        rt.block_on(publisher.publish(&message)).ok();
                    }
                })
            },
        );
    }

    group.finish();
}

criterion_group!(
    benches,
    benchmark_publisher_creation,
    benchmark_subscriber_creation,
    benchmark_publish_latency,
    benchmark_publish_throughput,
    benchmark_end_to_end_latency,
    benchmark_serializer_comparison,
    benchmark_concurrent_publishers
);
criterion_main!(benches);
