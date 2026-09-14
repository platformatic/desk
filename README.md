# desk

A tool for deploying local Kubernetes clusters that are
Platformatic-ready.

Contents:

* [Prerequisites](#prerequisites)
* [Setup](#setup)
* [Profiles](#profiles)
* [CLI](#cli)
    * [`cluster`](#cluster)
    * [`doctor`](#doctor)
    * [`profile`](#profile)
    * [`deploy`](#deploy)
    * [`get-plan`](#get-plan)
* [Troubleshooting](#troubleshooting)
* [Examples](#examples)


## Prerequisites

The following tools must be installed on your system:

- [Docker](https://docs.docker.com/get-docker/) - Container runtime
- [k3d](https://k3d.io/#installation) - k3s cluster management
- [kubectl](https://kubernetes.io/docs/tasks/tools/) - Kubernetes CLI
- [Helm](https://helm.sh/docs/intro/install/) - Kubernetes package manager

Run `desk doctor` to verify all tools are installed correctly.

## Setup

1. Clone repository
    ```sh
    git clone git@github.com:platformatic/desk.git
    ```
2. Install dependencies
    ```sh
    npm install
    ```
    * The `preinstall` script checks for system dependencies and will fail if
      any are missing. The output will be on screen.
3. Add Github PAT to _.env_
    ```sh
    cp .env.sample .env
    ```
4. Add the following entries to `/etc/hosts`:
    ```
    127.0.0.1 icc.plt
    127.0.0.1 machinist.plt
    127.0.0.1 svcs.gw.plt
    127.0.0.1 svcs-preview.gw.plt
    127.0.0.1 prometheus.plt
    127.0.0.1 k3d-plt-registry
    ```

## Profiles

Profiles are a simpler way to share a particular cluster configuration. Full
documentation is available in [profiles/README.md](profiles/README.md).

### Specifying Profiles

Profiles can be specified in multiple ways:

1. **By name** (default behavior): Uses profiles from the `profiles/` directory
   ```sh
   desk cluster up --profile lite
   ```

2. **By relative path**: Specify a profile relative to your current directory
   ```sh
   desk cluster up --profile ./my-custom-profile.yaml
   desk cluster up --profile ../configs/production.yaml
   ```

3. **By absolute path**: Specify a full path to a profile file
   ```sh
   desk cluster up --profile /home/user/desk-profiles/custom.yaml
   ```

This allows you to maintain custom profiles outside the desk repository and share them across teams or projects.

## CLI

### `cluster`

Start up a cluster:

```sh
desk cluster up --profile <name>
```

Shut down a cluster: 

```sh
desk cluster down --profile <name>
```

Get status:

```sh
desk cluster status --profile <name>
```

### `doctor`

Verify that all required tools are installed:

```sh
desk doctor
```

### `profile`

View all available profiles:

```sh
desk profile list
```

Create a new profile using the wizard:

> [!WARNING]
> Not implemented yet

```sh
desk profile wizard
```

Cache a profile for offline use:

> [!WARNING]
> Not implemented yet

```sh
desk profile cache <profile-name>
```

### `deploy`

Simplify deployment of wattpro applications into local cluster.

Deploy a directory into Kubernetes:

```sh
desk deploy --profile <name> --dir ./my-watt-project
```

Deploy an existing image into Kubernetes:

```sh
desk deploy --profile <name> --image some-prebuilt-app:latest
```

Deploy a versioned application for skew protection testing:

```sh
desk deploy --profile skew-protection --dir ./my-watt-project --version v1
```

Deploy a second version alongside the first:

```sh
desk deploy --profile skew-protection --dir ./my-watt-project --version v2
```

`desk` deploys in one of two shapes. By default the profile decides: if it
enables ICC skew protection (`services.icc.features.skew_protection.enable`),
every deploy is versioned. The bundled `development`, `oss` and
`skew-protection` profiles enable it. Otherwise each deploy replaces the
previous one. `--skew` and `--no-skew` override the profile, and `--version`
always implies `--skew`. Use `--skew` or `--version` only with a profile where
ICC skew protection is enabled: these flags do not enable ICC's routing feature.

**Versioned** (skew protection on, `--skew`, or `--version`): each deploy gets
its own Deployment and Service, so versions coexist while the old one drains.
ICC manages the HTTPRoute and expires idle versions.

- With `--version v1`, the workload is named `{app}-v1` and labelled
  `plt.dev/version: v1`.
- With `--dir` and no `--version`, `desk` generates a `plt_...` version and
  bakes it into the image as `PLT_DEPLOYMENT_ID`, which makes it pinnable by
  `?dpl=`. That id is not a valid resource name, so the workload is named after
  the image tag, for example `{app}-1757853000000`.
- With `--image` and no `--version`, `desk` sets no version. The workload is
  named `{app}-{image tag}`. ICC uses the image's baked `PLT_DEPLOYMENT_ID` if
  present; otherwise it derives a version from the image digest. An image
  without a baked ID cannot be pinned by `?dpl=`. Use a new image tag for each
  deploy that should create a separate version; reusing a mutable tag rolls the
  same workload in place and ICC keeps its existing version.

For a prebuilt image deployed with `--version`, that version must match the
image's baked `PLT_DEPLOYMENT_ID` for query-string pinning to work.

**In place** (skew protection off, or `--no-skew`): the workload keeps the name
`{app}` and each deploy replaces its pods. `desk` writes the HTTPRoute itself.
Use this shape without skew protection, because nothing would ever remove old
versioned workloads.

> [!WARNING]
> Avoid `--no-skew` on a profile that enables skew protection. An in-place
> rollout replaces the pods of the existing workload, so old and new versions
> cannot coexist for skew routing. `desk` prints a warning for this combination.

Deploy with a dedicated hostname:

```sh
desk deploy --profile skew-protection --dir ./my-app --version v1 --hostname my-app.plt
```

When `--hostname` is provided, the HTTPRoute matches `hostnames: ["my-app.plt"]`
with a `/` path prefix. Without it, the route matches the `/<app-name>` path
prefix, and a route written by `desk` also matches the `svcs.gw.plt` hostname.
With skew protection enabled, ICC writes the route for versioned deploys;
`desk` writes it for in-place deploys when skew protection is disabled.

A hostname is required for frameworks like Next.js that make root-relative fetch calls
(e.g., `fetch('/api/generate')`) which break under a sub-path. Add the hostname to
`/etc/hosts` to resolve it locally:

```sh
echo "127.0.0.1 my-app.plt" | sudo tee -a /etc/hosts
```

Deploy as a headless service (direct pod IPs via DNS, no gateway route):

```sh
desk deploy --profile <name> --dir ./my-app --headless
```

Deploy with a fixed number of replicas:

```sh
desk deploy --profile <name> --dir ./my-app --replicas 3
```

Deploy with autoscaling (ICC scaler manages replicas within the range):

```sh
desk deploy --profile <name> --dir ./my-app --min-replicas 2 --max-replicas 5
```

When `--replicas` is provided, both `icc.platformatic.dev/scaler-min` and
`icc.platformatic.dev/scaler-max` pod labels are set to the same value.
`--min-replicas` and `--max-replicas` allow setting them independently.
The Deployment's `spec.replicas` is set to the min value for immediate scaling
on the initial deploy.

Deploy with a custom `.npmrc` for private npm packages:

```sh
desk deploy --profile <name> --dir ./my-app --npmrc ./project/.npmrc
```

By default, `~/.npmrc` is used if it exists. The Dockerfile must mount the
secret during install:

```dockerfile
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm install
```

Deploy with an environment file:

> [!WARNING]
> Not implemented yet

```sh
desk deploy --profile <name> --dir ./my-watt-project --envfile ./my-watt-project/.env
```

#### Deploy through ICC's deploy API (`--via-icc`)

By default `desk` templates the Deployment + Service and applies them directly.
Use `--via-icc` to instead drive the deploy through ICC's deploy API: ICC creates
the Deployment + Service itself and the pod registers back (the CI path a customer
uses -- the pipeline holds only a deploy token):

```sh
desk deploy --profile skew-protection --via-icc \
  --deploy-token plt_deploy_... \
  --image <pre-existing image> --version v1 --min-replicas 1
```

`--via-icc` requires an explicit `--version`, including when deploying a
prebuilt image. For query-string pinning, it must match the ID baked into that
image.

The deploy token is app-bound, so ICC resolves the application from the token --
a CI needs only the token, image, and version, never the application UUID. Pass
`--app-id <id>` to force the app-scoped route instead (e.g. when driving it with
an admin cookie).

The deploy API always creates the workload; it does not gate on the app's
actuation mode (the mode now only governs version routing). For a strictly
read-only workflow -- fetch the manifests, inspect them, and apply them yourself
-- use [`get-plan`](#get-plan) instead.

Flags:

* `--deploy-token` — a scoped deploy token (`plt_deploy_…`), or set
  `PLT_DEPLOY_TOKEN`. Mint one in the app's Settings → Deploy Tokens. Required.
* `--app-id` — the ICC application UUID (from the app URL `…/watts/<id>`).
  Optional: the token already identifies the app; pass it only to force the
  app-scoped route.
* `--icc-url` — ICC base URL (default `https://icc.plt`). TLS verification is
  disabled for this call (local self-signed cert); for local testing only.

`--via-icc` still builds/pushes the image when `--dir` is used; the image must
exist before ICC can reference it (`--image <ref>` for a prebuilt one). ICC needs
the deployer RBAC to create Deployments/Services/pull Secrets -- gated behind
`services.icc.features.deployer.enable` in the helm chart (run `helm upgrade`).
See `skew-protection/TESTING.md` for the full manual test walkthrough.

### `get-plan`

Fetch a skew-protection actuation plan from ICC and print how to apply it with
`kubectl`. Read-only: ICC computes the plan and mutates nothing; you apply it
yourself. This is the `advise`-mode workflow, where an external actor owns the
`kubectl apply` and ICC only observes the result.

Plan a new version's deploy (Deployment + Service + HTTPRoute):

```sh
desk get-plan --profile skew-protection \
  --deploy-token plt_deploy_... \
  --image <pre-existing image> --version v9
```

Plan an existing version's next actuation -- the intent follows the version's
state: a `pending-apply` version yields an *activate* plan (the HTTPRoute that
makes it the gateway default), a `draining` version yields an *expire* plan
(rebuild the route without it, scale its workload to zero):

```sh
desk get-plan --profile skew-protection \
  --deploy-token plt_deploy_... \
  --version v8
```

`desk` writes each manifest to the run dir and prints the `kubectl` commands to
apply the plan, for example:

```
ICC returned a 2-step plan (intent: expire). ICC applied nothing.
  1. HTTPRoute/apply    leads-demo      route default traffic to v9
  2. Deployment/scale   leads-demo-v8   scale down v8

Apply it yourself with kubectl:
  kubectl --namespace=platformatic apply --filename=.desk/run/icc-HTTPRoute-leads-demo.json
  kubectl -n platformatic scale deployment/leads-demo-v8 --replicas=0
```

Once you apply it, ICC observes the change and moves the version on its own
(`pending-apply -> active`, or `draining -> expired`).

Flags are the same `--deploy-token` / `--icc-url` (and optional `--app-id`) as
`deploy --via-icc`: the token is app-bound, so ICC resolves the application from
it and `--app-id` is optional (the deploy token is route-allowlisted to the
read-only plan endpoints). With `--image` the plan is a new deploy; without it,
the plan comes from the existing version's current state.

## Troubleshooting

Use `DEBUG=plt-desk*` to view debug statements. The output can be narrowed down
to:

* cluster specific: `DEBUG=plt-desk:cluster`

## Examples

### Building local repositories (hot reload)

The hot-reload profiles (`development` and `skew-protection`) mount your local
ICC / Machinist / Workflow repositories into the cluster and run them with
`pnpm run dev`. Clone the ones the profile uses and point the matching `.env`
variable at each checkout (all repos are public):

| Variable | Clone URL |
|----------|-----------|
| `ICC_REPO` | `https://github.com/platformatic/intelligent-command-center.git` |
| `MACHINIST_REPO` | `https://github.com/platformatic/machinist.git` |
| `WORKFLOW_REPO` | `https://github.com/platformatic/platformatic-world.git` |

`WORKFLOW_REPO` must point to the **`platformatic-world` monorepo root**, not
`packages/workflow`: desk mounts the repo at `/app` and runs the workflow service
from `/app/packages/workflow`.

Some ICC services (e.g. `cluster-manager`) `require()` compiled `.js` files that
only exist as TypeScript in a fresh checkout, so before starting a hot-reload
profile, build the ICC repo once:

```sh
cd "$ICC_REPO"
npm run build:dev
```

Machinist and Workflow do not need a build step — they run from source under
Node's type stripping.

### Development Profile

The `development` profile enables hot reloading for ICC and Machinist services using local repositories.

First uncomment/set the `ICC_REPO` and `MACHINIST_REPO` variables on `.env`, and
[build the local repos](#building-local-repositories-hot-reload), then:

```sh
desk cluster up --profile development
```

This profile:
- Mounts your local ICC and Machinist repositories into the Kubernetes cluster
- Runs services with `pnpm run dev` for hot reloading
- Sets `DEV_K8S=true` to enable Platformatic DB service file watching
- Uses the same base image (`node:22.20.0-alpine`) as production for native module compatibility
- Enables ICC skew protection, so `desk deploy` creates a separate versioned workload for every deploy (see [`deploy`](#deploy))

When code changes are made in the local repositories, the services will automatically reload.

### Skew Protection Profile

The `skew-protection` profile sets up a cluster with Envoy Gateway as a
Gateway API controller, enabling ICC to manage HTTPRoute resources for
version-aware request routing.

First set the required environment variables in `.env`:

```sh
ICC_REPO=/path/to/intelligent-command-center
MACHINIST_REPO=/path/to/machinist
WORKFLOW_REPO=/path/to/platformatic-world  # monorepo root, NOT packages/workflow
```

This profile is an extension of `development` — it also runs ICC, Machinist, and
Workflow with hot reload, so [build the local repos](#building-local-repositories-hot-reload)
first (`cd "$ICC_REPO" && npm run build:dev`). Then start the cluster:

```sh
desk cluster up --profile skew-protection
```

This profile installs:
- All base dependencies (Prometheus, Postgres, Valkey)
- **Envoy Gateway** — provides the `eg` GatewayClass and runs the data plane
- **Gateway resource** — a `platformatic` Gateway in the `platformatic` namespace
- **Workflow service** — durable workflow execution engine
- ICC and Machinist with hot reload from local repositories

After the cluster is up, deploy versioned applications:

```sh
desk deploy --profile skew-protection --dir ./my-app --version v1
desk deploy --profile skew-protection --dir ./my-app --version v2
```

ICC will detect the new versions via pod labels and create HTTPRoute rules to
route pinned requests using `?dpl=<version>`; this profile defaults to query
routing rather than cookie routing.

Workflow apps declare `PLT_WORKFLOW=true` with a Dockerfile `ENV` instruction or
in the file passed to `--envfile`. Set it explicitly to `false` to disable workflow
classification. ICC then registers queue handlers with the workflow service and
uses workflow-aware draining, keeping old versions alive until active workflows
complete. `WORKFLOW_TARGET_WORLD=@platformatic/world` in the Dockerfile remains a
compatibility fallback.

### Testing ICC Installation Script

Test out the installation script from ICC:

```sh
desk cluster up --profile lite
```

After this command completes, the install script command will be output. The
path is relative to the ICC directory so copy and paste the command and run from
the ICC directory.
