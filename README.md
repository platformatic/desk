# desk

A tool for deploying local Kubernetes clusters that are
Platformatic-ready.

Contents:

* [Setup](#setup)
* [Profiles](#profiles)
* [CLI](#cli)
    * [`cluster`](#cluster)
    * [`profile`](#profile)
    * [`deploy`](#deploy)
* [Troubleshooting](#troubleshooting)
* [Examples](#examples)


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

## Profiles

Profiles are a simpler way to share a particular cluster configuration. Full
documentation is available in [profiles/README.md](profiles/README.md).

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

Test out the installation script from ICC:

```sh
desk cluster up --profile lite
```

After this command completes, the install script command will be output. The
path is relative to the ICC directory so copy and paste the command and run from
the ICC directory.
