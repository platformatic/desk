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

> [!WARNING]
> Not implemented yet

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

When `--version` / `-v` is provided, the Deployment and Service are named
`{app}-{version}` (e.g., `my-watt-project-v1`) and labelled with
`app.kubernetes.io/name: my-watt-project` and `plt.dev/version: v1`. No Traefik
IngressRoute is created — traffic routes through Gateway API HTTPRoutes managed
by ICC.

Deploy with an environment file:

> [!WARNING]
> Not implemented yet

```sh
desk deploy --profile <name> --dir ./my-watt-project --envfile ./my-watt-project/.env
```

## Troubleshooting

Use `DEBUG=plt-desk*` to view debug statements. The output can be narrowed down
to:

* cluster specific: `DEBUG=plt-desk:cluster`

## Examples

### Development Profile

The `development` profile enables hot reloading for ICC and Machinist services using local repositories.

First uncomment/set the `ICC_REPO` and `MACHINIST_REPO` variables on `.env`, then:

```sh
desk cluster up --profile development
```

This profile:
- Mounts your local ICC and Machinist repositories into the Kubernetes cluster
- Runs services with `pnpm run dev` for hot reloading
- Sets `DEV_K8S=true` to enable Platformatic DB service file watching
- Uses the same base image (`node:22.20.0-alpine`) as production for native module compatibility

When code changes are made in the local repositories, the services will automatically reload.

### Skew Protection Profile

The `skew-protection` profile sets up a cluster with Envoy Gateway as a
Gateway API controller, enabling ICC to manage HTTPRoute resources for
version-aware request routing.

```sh
desk cluster up --profile skew-protection
```

This profile installs:
- All base dependencies (Prometheus, Postgres, Valkey)
- **Envoy Gateway** — provides the `eg` GatewayClass and runs the data plane
- **Gateway resource** — a `platformatic` Gateway in the `platformatic` namespace
- **Traefik** — for non-skew-protection routes (ICC dashboard, etc.)
- ICC and Machinist with hot reload from local repositories

After the cluster is up, deploy versioned applications:

```sh
desk deploy --profile skew-protection --dir ./my-app --version v1
desk deploy --profile skew-protection --dir ./my-app --version v2
```

ICC will detect the new versions via pod labels and create HTTPRoute rules to
route traffic to the correct version based on the `__plt_dpl` cookie.

### Testing ICC Installation Script

Test out the installation script from ICC:

```sh
desk cluster up --profile lite
```

After this command completes, the install script command will be output. The
path is relative to the ICC directory so copy and paste the command and run from
the ICC directory.
