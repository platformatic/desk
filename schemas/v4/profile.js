import { Type } from '@sinclair/typebox'

// Schema for infrastructure components (dynamic keys with plt_defaults)
// TODO support .overrides, .version
const InfraComponentSchema = Type.Object({
  plt_defaults: Type.Boolean()
})

// Schema for platformatic service configuration with image
const PlatformaticServiceWithImageSchema = Type.Object({
  image: Type.Object({
    tag: Type.String(),
    repository: Type.String()
  })
}, {
})

// Schema for platformatic service configuration with local
const PlatformaticServiceWithLocalSchema = Type.Object({
  hotReload: Type.Optional(Type.Boolean()),
  local: Type.Object({
    path: Type.String()
  })
}, {
})

const PlatformaticSkipSchema = Type.Object({
  skip: Type.Boolean()
}, {
})

const PlatformaticServiceSchema = Type.Union([
  PlatformaticServiceWithImageSchema,
  PlatformaticServiceWithLocalSchema
])

const K3dRegistry = Type.Object({
  address: Type.String(),
  configPath: Type.String(),
  name: Type.String()
})

const GatewaySchema = Type.Object({
  name: Type.String(),
  enable: Type.Boolean({ default: true })
})

const K3dSchema = Type.Object({
  ports: Type.Optional(Type.Array(Type.Number())),
  args: Type.Optional(Type.Array(Type.String())),
  registry: Type.Optional(K3dRegistry),
  nodes: Type.Optional(Type.Number()),
  gateway: Type.Optional(GatewaySchema)
})

const FeatureSchema = Type.Object({
  features: Type.Optional(Type.Record(Type.String(), Type.Object({
    enable: Type.Boolean()
  })))
})

const LogLevelSchema = Type.Object({
  log_level: Type.Union([
    Type.Literal('debug'),
    Type.Literal('info'),
    Type.Literal('warn'),
    Type.Literal('error')
  ])
})

const IccSpecificSchema = Type.Object({
  login_methods: Type.Optional(Type.Record(Type.String(), Type.Object({ enable: Type.Boolean() }))),
  secrets: Type.Optional(Type.Record(Type.String(), Type.String()))
})

const ImagePullSecretSchema = Type.Object({
  registry: Type.Optional(Type.String()),
  user: Type.String(),
  token: Type.String()
})

const PlatformaticHelmSchema = Type.Object({
  chartVersion: Type.Optional(Type.String()),
  imagePullSecret: Type.Optional(ImagePullSecretSchema),

  services: Type.Object({
    icc: Type.Intersect([
      FeatureSchema,
      LogLevelSchema,
      IccSpecificSchema,
      PlatformaticServiceSchema
    ]),

    machinist: Type.Intersect([
      FeatureSchema,
      LogLevelSchema,
      PlatformaticServiceSchema
    ])
  })
})

export const ProfileSchemaV4 = Type.Object({
  version: Type.Literal(4),
  description: Type.Optional(Type.String()),
  cluster: Type.Optional(Type.Object({
    namespaces: Type.Optional(Type.Array(Type.String(), { default: [] })),
    k3d: K3dSchema
  })),
  dependencies: Type.Record(Type.String(), InfraComponentSchema),
  platformatic: Type.Union([
    PlatformaticSkipSchema,
    PlatformaticHelmSchema
  ])
}, {
  additionalProperties: false
})

export const SCHEMA_VERSION = 4
