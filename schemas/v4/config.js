import { Type } from '@sinclair/typebox'

const ChartDirect = Type.Object({
  location: Type.String()
})

const ChartRepo = Type.Object({
  repo: Type.String()
})

const ChartSource = Type.Union([ChartRepo, ChartDirect])

const Chart = Type.Object({
  releaseName: Type.String(),
  version: Type.Optional(Type.String()),
  namespace: Type.Optional(Type.String())
})

const K3dRegistry = Type.Object({
  address: Type.String(),
  configPath: Type.String()
})

const K3dConfig = Type.Object({
  ports: Type.Array(Type.Number(), { default: [443] }),
  args: Type.Array(Type.String(), { default: [] }),
  registry: Type.Optional(K3dRegistry),
  nodes: Type.Number({ default: 1 })
})

const ClusterConfig = Type.Object({
  k3d: K3dConfig,
})

const ValkeyDatabase = Type.Object({
  name: Type.String(),
  address: Type.String()
})

const App = Type.Object({
  name: Type.String(),
  url: Type.String(),
  defaultBranch: Type.String()
})

export const ConfigSchemaV4 = Type.Object({
  cluster: ClusterConfig,
  dependencies: Type.Record(Type.String(), Type.Intersect([Chart, ChartSource])),
  databaseServer: Type.Any(),
  valkey: Type.Array(ValkeyDatabase),
  apps: Type.Array(App)
})

export const SCHEMA_VERSION = 4
