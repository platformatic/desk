# Profiles

Profiles are YAML files that describe a complete local Kubernetes cluster
configuration: which infrastructure charts to install, how the k3d cluster is
shaped, and which Platformatic services to deploy.

Use a profile with any `desk` command that accepts `--profile` / `-p`:

```sh
desk cluster up --profile development
desk cluster status --profile development
desk cluster down --profile development
desk deploy --profile skew-protection --dir ./my-app
```

List built-in profiles and see which clusters are currently running:

```sh
desk profile list
```

## How profiles work

When you pass a profile to `desk`, it:

1. **Loads the profile YAML** — from the built-in `profiles/` directory, or from
   a custom path (see [Specifying a profile](#specifying-a-profile)).
2. **Validates it** against the profile schema for the declared `version`.
3. **Merges it with the chart config** — each profile version maps to a directory
   under `charts/v{N}/config.yaml`, which defines default cluster settings,
   available Helm charts, and their versions.
4. **Builds a runtime context** used to create the k3d cluster, install
   infrastructure, and deploy Platformatic.

The resulting k3d cluster is always named `plt-<profile-name>`. For example,
`--profile development` creates cluster `plt-development` and sets the kubectl
context to `k3d-plt-development`.

### Profile version and chart version

Every profile must declare a `version` field. This number is the **major version
of the Platformatic Helm chart** the profile targets, and it selects which chart
bundle desk uses (`charts/v4/` today).

When the Helm chart has a breaking change, desk adds a new `charts/v{N}/` tree
and a matching profile schema. Profiles with `version: 4` are validated against
the v4 schema and use `charts/v4/config.yaml` for defaults.

You can override the chart directory with the `DESK_CHART_DIR_PATH` environment
variable (useful when developing chart customizations locally).

## Specifying a profile

Profiles can be referenced in three ways:

| Form | Example | Resolves to |
|------|---------|-------------|
| Name | `--profile development` | `profiles/development.yaml` |
| Relative path | `--profile ./my-profile.yaml` | Path relative to cwd |
| Absolute path | `--profile /path/to/profile.yaml` | Exact file |

Override the built-in profiles directory with `DESK_PROFILE_DIR_PATH`.

## Profile structure

A minimal profile looks like this:

```yaml
version: 4

description: |
  A short description shown by `desk profile list`.

cluster:
  namespaces:
    - platformatic
  k3d:
    nodes: 1

dependencies:
  cloudpirates/postgres:
    plt_defaults: true

platformatic:
  skip: true
```

### Top-level fields

| Field | Required | Description |
|-------|----------|-------------|
| `version` | yes | Schema / chart major version (currently `4`) |
| `description` | no | Human-readable summary for `desk profile list` |
| `cluster` | no | Cluster provider and namespace overrides |
| `dependencies` | yes | Infrastructure Helm charts to install |
| `platformatic` | yes | Platformatic deployment config, or `skip: true` |

### `cluster`

The `cluster` section configures the local Kubernetes provider. Today desk
supports **k3d** as the provider key.

Profile values are **deep-merged** on top of defaults from
`charts/v4/config.yaml`. For example, the default config already sets k3d ports,
registry, and kubelet eviction args — a profile typically only overrides what it
needs (such as `nodes`).

```yaml
cluster:
  namespaces:
    - platformatic        # merged with config defaults
  k3d:
    nodes: 1
```

### `dependencies`

Each key is a chart identifier (matching an entry in `charts/v4/config.yaml`).
The profile selects which charts to install and how to configure them.

```yaml
dependencies:
  cloudpirates/postgres:
    plt_defaults: true
  local/kafka:
    plt_defaults: true
```

**`plt_defaults`** — when `true`, desk applies the curated `overrides.yaml` from
`charts/v4/<chart>/overrides.yaml` during `helm install`. Set to `false` to
install the upstream chart without desk's opinionated defaults.

Charts marked `default: true` in `config.yaml` (such as Envoy Gateway and the
local gateway) are installed automatically even if not listed in the profile.

Unknown chart keys are skipped with a warning.

### `platformatic`

Either skip Platformatic entirely, or configure the services to deploy.

#### Skip Platformatic

Useful for testing ICC install scripts or deploying Platformatic manually:

```yaml
platformatic:
  skip: true
```

After `desk cluster up`, run `desk cluster status` to see the generated install
command.

#### Deploy services

Configure ICC, Machinist, and optionally Workflow and ebpfSandbox. Values map
directly to the Platformatic Helm chart (`platformatic/helm`).

```yaml
platformatic:
  chartVersion: "4.0.3-alpha1"   # optional override
  imagePullSecret:              # optional, for private images
    registry: docker.io
    user: "{{ PULL_SECRET_USER }}"
    token: "{{ PULL_SECRET_TOKEN }}"

  services:
    icc:
      image:
        repository: platformatic/intelligent-command-center
        tag: "v3.6.0"
      log_level: info
      features:
        icc_jobs:
          enable: true
      login_methods:
        github:
          enable: true
          client_id: "{{ GITHUB_OAUTH_CLIENT_ID }}"
          client_secret: "{{ GITHUB_OAUTH_CLIENT_SECRET }}"
          valid_emails: "{{ GITHUB_OAUTH_VALID_EMAILS }}"
      secrets:
        icc_session: "..."

    machinist:
      image:
        repository: platformatic/machinist
        tag: "v2.1.1"
      log_level: info

    workflow:            # optional
      image:
        repository: platformatic/workflow
        tag: "0.7.1"

    ebpfSandbox:         # optional
      image:
        repository: platformatic/ebpf-sandbox
        tag: "v1.0.0"
```

Per-service options include:

| Field | Description |
|-------|-------------|
| `image.repository` / `image.tag` | Container image (remote deployments) |
| `hotReload` + `localRepo` | Mount a local git checkout and run `pnpm run dev` |
| `workingDir` | Working directory inside the container (e.g. workflow monorepo path) |
| `resources` | Kubernetes CPU/memory limits and requests |
| `features` | Feature flags passed to the Helm chart |
| `log_level` | `debug`, `info`, `warn`, or `error` |
| `login_methods` | OAuth providers for ICC |
| `secrets` | ICC session and signing keys |
| `scaler` | ICC scaler algorithm version |
| `disableEBPFPolicies` | ebpfSandbox only — disable eBPF policy enforcement |

## Template variables

Profile YAML supports `{{ VARIABLE }}` placeholders. They are replaced with
values from your environment and `.env` file before the profile is parsed.

Common variables:

| Variable | Used by |
|----------|---------|
| `ICC_REPO` | Hot-reload profiles — path to intelligent-command-center checkout |
| `MACHINIST_REPO` | Hot-reload profiles — path to machinist checkout |
| `WORKFLOW_REPO` | skew-protection — path to platformatic-world monorepo root |
| `EBPF_SANDBOX_REPO` | regina — path to ebpf-sandbox monorepo root |
| `GITHUB_OAUTH_CLIENT_ID` | ICC GitHub login |
| `GITHUB_OAUTH_CLIENT_SECRET` | ICC GitHub login |
| `GITHUB_OAUTH_VALID_EMAILS` | ICC GitHub login allowlist |
| `PULL_SECRET_USER` / `PULL_SECRET_TOKEN` | Private container registry auth |
| `PLT_HELM_CHART_PATH` | Override the Platformatic Helm chart with a local path |

Copy `.env.sample` to `.env` and fill in the values your profile needs.

## Hot reload (development profiles)

Profiles with `hotReload: true` build special dev images that volume-mount your
local repositories into the cluster and run `pnpm run dev`. This is equivalent to
running `cib dev` but inside Kubernetes.

Before starting a hot-reload profile:

1. Set the required `*_REPO` variables in `.env`.
2. Build ICC once (some services require compiled output):
   ```sh
   cd "$ICC_REPO" && npm run build:dev
   ```
3. On Apple Silicon, desk automatically runs a cross-platform `pnpm install` in
   the ICC repo so native modules match the Linux containers.

```sh
desk cluster up --profile development
```

Code changes in the mounted repositories are picked up automatically.

## Built-in profiles

| Profile | Platformatic | Summary |
|---------|-------------|---------|
| `lite` | skipped | Infrastructure only (Postgres, Valkey, Prometheus). Use to test ICC install scripts. |
| `oss` | remote images | ICC, Machinist, and Workflow from published Docker images with skew protection enabled. |
| `development` | hot reload | ICC and Machinist from local repos. General day-to-day development. |
| `kafka` | hot reload | Same as development, plus a local Kafka chart. |
| `skew-protection` | hot reload | ICC, Machinist, and Workflow with skew protection and Envoy Gateway routing. Use with `desk deploy --version`. |
| `regina` | hot reload | development + a second Valkey instance (`valkey-regina`) and ebpfSandbox service. |

See the main [README](../README.md) for worked examples (development, skew
protection, and lite).

## Creating a custom profile

1. Start from the profile closest to your needs (e.g. `development.yaml` or
   `oss.yaml`).
2. Save it as a new `.yaml` file — either in `profiles/` or anywhere on disk.
3. Adjust `dependencies`, `cluster`, and `platformatic` sections.
4. Set `version: 4` and run `desk cluster up --profile <your-file>`.

Only list charts that exist in `charts/v4/config.yaml`. To add a new chart, you
need a corresponding directory under `charts/v4/` with `overrides.yaml` (and
optionally `offline.yaml`).

For chart development, set `PLT_HELM_CHART_PATH` in `.env` to point at a local
Platformatic Helm chart checkout instead of the OCI release.

## Validation

Profiles are validated at load time. If a field is missing or has the wrong
type, desk prints a JSON error from the schema validator. Run the schema tests
locally:

```sh
npm test -- tests/profile-schema.test.js
```
