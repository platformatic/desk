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
  configPath: Type.String(),
  name: Type.String()
})

const GatewaySchema = Type.Object({
  name: Type.String(),
  enable: Type.Boolean({ default: true })
})

const K3dConfig = Type.Object({
  ports: Type.Optional(Type.Array(Type.Number(), { default: [443] })),
  args: Type.Optional(Type.Array(Type.String(), { default: [] })),
  registry: Type.Optional(K3dRegistry),
  nodes: Type.Optional(Type.Number({ default: 1 })),
  gateway: Type.Optional(GatewaySchema)
})

const ClusterConfig = Type.Object({
  k3d: K3dConfig,
})

const App = Type.Object({
  name: Type.String(),
  url: Type.String(),
  defaultBranch: Type.String()
})

export const ConfigSchemaV3 = Type.Object({
  cluster: ClusterConfig,
  dependencies: Type.Record(Type.String(), Type.Intersect([Chart, ChartSource])),
  apps: Type.Array(App)
})

export const SCHEMA_VERSION = 3
