# desk

A tool for deploying local Kubernetes clusters that are
Platformatic-ready.

## Usage

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
