# Headlamp Plugin for Flux Static GitHub-Ops

An Apache-2.0 Headlamp plugin and standalone Flux-style overview. Browsers read a
public cloud snapshot only; they never call Kubernetes or the GitHub API. Includes
Kustomizations, Helm Releases, all Flux Sources, notification resources and Controllers,
with domain filters, revisions, replica counts and separate GitHub release evidence.

- Refresh automatically every 15 seconds; expire health 15 minutes after observation.
- Fetch failures, future dates, incomplete batches and expired data are Unknown.
- Retrying Ready=False failures remain failures. Suspended resources are not Ready.
- No reconciliation controller, database, image build or promotion stage.

## Install

Download the plugin archive from GitHub Releases and install using Headlamp's
plugin manager. Artifact Hub metadata is included; catalog registration is a separate
publisher operation. The plugin URL can be changed in its settings form. The default
public demonstration is https://flux-status.re8ch.com/ .

## Build and validate

`npm ci && npm run build && npm run package`

`npm ci --prefix worker && npm test`

The plugin uses Headlamp's official packaging tool. A version builds once and its
archive/checksum are reused for installation. `web/` is the standalone static viewer;
copy only index.html, style.css, app.mjs, model.mjs, evidence.mjs and snapshot.mjs to
`web-public/` before deploying the Worker. Tests and collector code are not web assets.

## Public cloud adapter

`worker/` uses an R2 bucket binding for latest.json, exposed read-only with no-store.
POST /api/snapshot accepts GitHub Actions OIDC signed by GitHub, bound to exact repo
IDs, protected main, environment, workflow, audience, SHA and run batch. Conditional
writes reject stale or concurrent overwrites. No long-lived upload credential is
created. Existing Executor App Checks remain the publication evidence.

Deployment is owned by re8ch/re8ch's reviewed workflow using its existing Cloudflare
credential. The viewer schema preserves existing App provenance. Other installations
must configure their own trusted App ID and publisher identity; do not grant broad
GitHub permissions or expose tokens in a browser.

This is a public projection of runtime observations. Collection still occurs at the
cluster and its freshness is bounded by the collector. GitHub schedules do not provide
a real-time SLA. Static delivery does not turn Flux reconciliation into a static process.

## Attribution

Extracted from re8ch/service-backend's cloud release view. Presentation follows the
Headlamp Flux plugin overview; this is an independent RE8CH plugin, not an official
Headlamp or Flux project. Resource specs, Secret values and raw condition messages
are excluded from publication.
