use agentic_robotics_core::{Publisher, RobotState};
use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn benchmark_publish(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    c.bench_function("ros3_publish", |b| {
        let publisher = Publisher::<RobotState>::new("benchmark/topic");
        let msg = RobotState::default();

        b.iter(|| {
            rt.block_on(async { black_box(publisher.publish(&msg).await).unwrap() });
        });
    });
}

fn benchmark_serialization(c: &mut Criterion) {
    use agentic_robotics_core::serialization::{serialize_cdr, serialize_rkyv};

    let msg = RobotState::default();

    c.bench_function("cdr_serialize", |b| {
        b.iter(|| {
            black_box(serialize_cdr(&msg)).unwrap();
        });
    });

    // `serialize_rkyv` is a stub that always returns Err, so this measures the
    // call overhead only; do not unwrap it.
    c.bench_function("rkyv_serialize", |b| {
        b.iter(|| {
            let _ = black_box(serialize_rkyv(&msg));
        });
    });
}

criterion_group!(benches, benchmark_publish, benchmark_serialization);
criterion_main!(benches);
