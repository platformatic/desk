import { Type } from '@sinclair/typebox'

// Schema for infrastructure components (dynamic keys with plt_defaults)
// TODO support .overrides, .version
const InfraComponentSchema = Type.Object({
  plt_defaults: Type.Boolean()
})

// Schema for image configuration
const ImageSchema = Type.Object({
  tag: Type.String(),
  repository: Type.String()
}, {
  additionalProperties: false
})

// Schema for local configuration
const LocalSchema = Type.Object({
  path: Type.String()
}, {
  additionalProperties: false
})

// Schema for platformatic service configuration with image
const PlatformaticServiceWithImageSchema = Type.Object({
  image: ImageSchema
}, {
  additionalProperties: false
})

// Schema for platformatic service configuration with local
const PlatformaticServiceWithLocalSchema = Type.Object({
  hotReload: Type.Optional(Type.Boolean()),
  local: LocalSchema
}, {
  additionalProperties: false
})

const PlatformaticSkipSchema = Type.Object({
  skip: Type.Boolean()
}, {
  additionalProperties: false
})

const PlatformaticServiceSchema = Type.Union([
  PlatformaticServiceWithImageSchema,
  PlatformaticServiceWithLocalSchema
])

const K3dRegistry = Type.Object({
  address: Type.String(),
  configPath: Type.String()
})

const K3dConfig = Type.Object({
  ports: Type.Optional(Type.Array(Type.Number())),
  args: Type.Optional(Type.Array(Type.String())),
  registry: Type.Optional(K3dRegistry),
  nodes: Type.Optional(Type.Number())
})

const FeatureConfig = Type.Object({
  features: Type.Record(Type.String(). Type.Object())
})

const LogLevelConfig = Type.Object({
  log_level: Type.Union([
    Type.Literal('debug'),
    Type.Literal('info'),
    Type.Literal('warn'),
    Type.Literal('error')
  ])
})

const IccBaseConfig = Type.Object({
  login_methods: Type.Record(Type.String(), Type.Object()),
  sercrets: Type.Record(Type.String(), Type.String())
})

export const ProfileSchemaV4 = Type.Object({
  version: Type.Literal(4),
  cluster: Type.Optional(Type.Object({
    k3d: K3dConfig
  })),
  dependencies: Type.Record(Type.String(), InfraComponentSchema),
  platformatic: Type.Union([
    PlatformaticSkipSchema,
    Type.Record(Type.String(), PlatformaticServiceSchema)
  ])
}, {
  additionalProperties: false
})

export const SCHEMA_VERSION = 4
