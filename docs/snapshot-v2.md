# Public cloud status snapshot v2

POST `/api/snapshot`; GET `/latest.json` and `/metrics`. The existing service-backend
`node-contract-observer.yml` main workflow and `cluster-observation` environment
publish using GitHub OIDC, audience `https://flux-status.re8ch.com/api/snapshot`.
Repository IDs, exact workflow/ref/environment, SHA and `run_id-run_attempt` remain
bound at ingestion. R2 conditional writes reject stale or concurrent publication.

```json
{"schema":2,"repository":"re8ch/service-backend","sha":"<40 lowercase hex>","batch":"<run_id>-<run_attempt>","observedAt":"<UTC ISO timestamp>","complete":true,"domains":[{"id":"main","sync":{"synced":0,"drifted":0,"failed":0,"unknown":0},"health":{"healthy":0,"unhealthy":0,"unknown":0},"observation":{"status":"current","observedAt":"<UTC ISO timestamp>"},"operations":{"status":"unknown","observedAt":null}}]}
```

A complete batch contains each of `main`, `networking`, `identity-access`,
`agent-runtime`, `observability-metering`, `delivery-products` exactly once.
`main` includes original main subdomains and Ceph. Order is immaterial.
Counts are nonnegative integers at most 1,000,000. No resource identifiers,
namespaces, private topology, arbitrary messages or links are permitted in the
public projection. Unknown input fields are stripped by the Worker.

- `sync`: release counts. A preexisting unhealthy workload must not count as a
  synchronization failure. A recent failed operation without a corresponding
  release result is unknown synchronization, not an old accepted success.
- `health`: independently observed workload counts, including existing unhealthy
  services. A failed operation does not itself change observed workload health.
- `observation`: per-domain collection status. `unavailable`, a future timestamp
  or age >= 15 minutes makes that domain's sync/health/observation Unknown.
- `operations`: latest observed domain workflow result, not a per-release result.
  Status is `succeeded`, `failed`, `running`, or `unknown`; timestamp is UTC ISO,
  or null only for unknown. Show its event timestamp independently of collection
  time. A stale/unavailable domain also hides this evidence as Unknown.

For a failed whole batch publish `complete:false` and `domains:[]`, retaining
publisher SHA/run binding and the actual observation timestamp. Missing domains
in a purportedly complete batch are rejected. Page refresh never extends TTL.
Old schema 1 Flux resource snapshots are neither served nor accepted. Reads do
not call Kubernetes or GitHub. The cloud publisher is responsible for collecting
real state; successful ingestion does not prove runtime health.

`/metrics` is Prometheus text. Fixed-label one-hot `re8ch_gitops_sync_status` and
`re8ch_gitops_health_status` explicitly select Unknown on absent/stale data.
Aggregate `*_releases` / `*_workloads` counts become NaN when unobserved, never a
fabricated zero. Labels are limited to domain and sync/health state;
`re8ch_gitops_observation_current{domain}` exposes freshness. No object labels.
