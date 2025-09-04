import { Type } from '@sinclair/typebox'

// Schema for infrastructure components (dynamic keys with plt_defaults)
// TODO support .overrides, .version
const InfraComponentSchema = Type.Object({
  plt_defaults: Type.Boolean()
})

// Schema for platformatic service configuration with image
const PlatformaticFromBranch = Type.Object({
  image: Type.Object({
    tag: Type.String(),
    repository: Type.String()
  })
})

// Schema for platformatic service configuration with local
const PlatformaticLocalRepo = Type.Object({
  path: Type.String()
})

const PlatformaticSkipSchema = Type.Object({
  skip: Type.Boolean()
})

const PlatformaticServiceSchema = Type.Intersect([
  PlatformaticFromBranch,
  PlatformaticLocalRepo
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

const OverridesSchema = Type.Object({
  overrides: Type.Object({
    env: Type.Optional(Type.Record(Type.String(), Type.String())),
    secrets: Type.Optional(Type.Record(Type.String(), Type.String()))
  })
})

const GithubSchema = Type.Object({
  registry: Type.Optional(Type.String()),
  imagePullSecret: Type.String(),
  username: Type.String()
})

const PlatformaticHelmSchema = Type.Object({
  chartVersion: Type.Optional(Type.String()),

  github: GithubSchema,

  projects: Type.Object({
    icc: Type.Intersect([
      OverridesSchema,
      PlatformaticServiceSchema
    ]),

    machinist: Type.Intersect([
      OverridesSchema,
      PlatformaticServiceSchema
    ])
  })
})

export const ProfileSchemaV3 = Type.Object({
  version: Type.Union([Type.Literal(3), Type.String()]),
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

export const SCHEMA_VERSION = 3
