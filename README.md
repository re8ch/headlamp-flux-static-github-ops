# Cloud GitOps status

An Apache-2.0 Headlamp plugin and standalone cloud status page. It displays release
synchronization, workload health, observation freshness, and the latest domain
cloud operation independently. Public responses contain only six-domain aggregates.
Browsers never call Kubernetes or GitHub and do not consume Flux CRs or a local
metrics projection.

- Refresh every 15 seconds; observations expire after 15 minutes from collection.
- Missing, failed, incomplete, future or expired observations are Unknown.
- Existing unhealthy services remain visible without becoming sync failures.
- `/metrics` supplies aggregate Prometheus gauges with explicit Unknown states.
- No local controller, new credential store, image build or database.

The public URL remains https://flux-status.re8ch.com/ for compatibility. The
Headlamp route remains `/flux-static-github-ops`, labeled Cloud GitOps. Install
using the Headlamp plugin manager and the packaged GitHub build artifact.

## Validate

`npm ci && npm ci --prefix worker && npm test && npm run build && npm run package`

Only `web/index.html`, `style.css`, `app.mjs`, and `snapshot.mjs` belong in
`web-public/`. Legacy model/evidence utilities and tests are not deployed assets.

## Publish and deploy

[Snapshot v2](docs/snapshot-v2.md) specifies the collector interface. The Worker
uses the existing R2 bucket and exact service-backend GitHub OIDC publisher
identity, with conditional writes for ordering/concurrency. The deployment
workflow in `re8ch/re8ch` uses its existing Cloudflare credential and a reviewed
fixed source commit; credentials are not copied into this public repository.

Schema 1 resource-detail snapshots fail closed after deployment, including old
R2 data. The page becomes available when the approved collector publishes schema
2. Deploying this viewer alone does not retire cluster components or establish
current runtime health. GitHub schedules provide no real-time SLA.

## Attribution

Extracted from re8ch/service-backend's cloud release view. Independently maintained
by RE8CH; not an official Headlamp or Flux project.
