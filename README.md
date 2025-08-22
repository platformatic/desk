# desk

A tool for deploying local Kubernetes clusters that are
Platformatic-ready.

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

## CLI

### Cluster

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

### Profile

> [!WARNING]
> Not implemented yet

Create a new profile using the wizard:

```sh
desk profile wizard
```

Cache a profile for offline use:

```sh
desk profile cache <profile-name>
```

### Deploy

> [!WARNING]
> Not implemented yet

Simplify deployment of wattpro applications into local cluster

Deploy an existing image into Kubernetes:

```sh
desk deploy --profile <name> --image some-prebuilt-app:latest
```

Deploy a directory into Kubernetes:

```sh
desk deploy --profile <name> --dir ./my-watt-project
```

Deploy with an environment file:

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
desk cluster up --profile light
```

After this command completes, the install script command will be output. The
path is relative to the ICC directory so copy and paste the command and run from
the ICC directory.
