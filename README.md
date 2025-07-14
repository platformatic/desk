# desk

A local tool for deploying local Kubernetes clusters that are
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
desk status --profile <name>
```

### Profile

Create a new profile using the wizard:

```sh
desk profile wizard
```

Cache a profile for offline use:

```sh
desk profile cache <profile-name>
```

### Deploy

Deploy an application into Kubernetes:

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
