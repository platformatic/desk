import { Type } from '@sinclair/typebox'

// Schema for infrastructure components (dynamic keys with plt_defaults)
// TODO support .overrides, .version
const InfraComponentSchema = Type.Object({
  plt_defaults: Type.Boolean()
})

// Schema for Kubernetes resource limits/requests
const ResourceQuantitySchema = Type.Object({
  memory: Type.Optional(Type.String()),
  cpu: Type.Optional(Type.String())
})

const ResourcesSchema = Type.Object({
  limits: Type.Optional(ResourceQuantitySchema),
  requests: Type.Optional(ResourceQuantitySchema)
})

// Schema for platformatic service configuration
const PlatformaticServiceSchema = Type.Object({
  hotReload: Type.Optional(Type.Boolean()),
  localRepo: Type.Optional(Type.String()),
  image: Type.Optional(Type.Object({
    tag: Type.String(),
    repository: Type.String()
  })),
  resources: Type.Optional(ResourcesSchema)
})

const PlatformaticSkipSchema = Type.Object({
  skip: Type.Boolean()
}, {
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

const K3dSchema = Type.Object({
  ports: Type.Optional(Type.Array(Type.Number())),
  args: Type.Optional(Type.Array(Type.String())),
  registry: Type.Optional(K3dRegistry),
  nodes: Type.Optional(Type.Number()),
  gateway: Type.Optional(GatewaySchema)
})

const FeatureSchema = Type.Object({
  features: Type.Optional(Type.Record(Type.String(), Type.Intersect([
    Type.Object({ enable: Type.Boolean() }),
    Type.Record(Type.String(), Type.Unknown())
  ])))
})

const LogLevelSchema = Type.Object({
  log_level: Type.Union([
    Type.Literal('debug'),
    Type.Literal('info'),
    Type.Literal('warn'),
    Type.Literal('error')
  ])
})

const ScalerSchema = Type.Object({
  scaler: Type.Optional(Type.Object({
    algorithm_version: Type.String()
  }))
})

const IccSpecificSchema = Type.Object({
  login_methods: Type.Optional(Type.Record(Type.String(), Type.Object({
    enable: Type.Boolean(),
    client_id: Type.Optional(Type.String()),
    client_secret: Type.Optional(Type.String()),
    valid_emails: Type.Optional(Type.String())
  }))),
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
      ScalerSchema,
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
