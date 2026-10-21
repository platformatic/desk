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
  workingDir: Type.Optional(Type.String()),
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

const K3dSchema = Type.Object({
  ports: Type.Optional(Type.Array(Type.Number())),
  args: Type.Optional(Type.Array(Type.String())),
  registry: Type.Optional(K3dRegistry),
  nodes: Type.Optional(Type.Number())
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
  notifications: Type.Optional(Type.Object({
    enable: Type.Boolean(),
    providers: Type.Optional(Type.Array(Type.Union([Type.Literal('email'), Type.Literal('slack')]))),
    minimum_level: Type.Optional(Type.Union([Type.Literal('info'), Type.Literal('warn'), Type.Literal('critical')])),
    excluded_services: Type.Optional(Type.Array(Type.String())),
    email: Type.Optional(Type.Object({
      from: Type.Optional(Type.String()),
      recipients: Type.Optional(Type.Array(Type.String())),
      smtp: Type.Optional(Type.Object({
        host: Type.Optional(Type.String()),
        port: Type.Optional(Type.Integer({ minimum: 1, maximum: 65535 })),
        secure: Type.Optional(Type.Boolean()),
        require_tls: Type.Optional(Type.Boolean()),
        user: Type.Optional(Type.String()),
        password: Type.Optional(Type.String())
      }))
    })),
    slack: Type.Optional(Type.Object({
      token: Type.Optional(Type.String()),
      channel: Type.Optional(Type.String())
    }))
  })),
  login_methods: Type.Optional(Type.Record(Type.String(), Type.Object({
    enable: Type.Boolean(),
    client_id: Type.Optional(Type.String()),
    client_secret: Type.Optional(Type.String()),
    valid_emails: Type.Optional(Type.String())
  }))),
  secrets: Type.Optional(Type.Record(Type.String(), Type.String())),
  // Extra environment variables for the ICC container, appended by the
  // chart after its own. Declared here because parsing drops unknown keys.
  env: Type.Optional(Type.Array(Type.Object({
    name: Type.String(),
    value: Type.String()
  })))
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
    ]),

    workflow: Type.Optional(Type.Intersect([
      LogLevelSchema,
      PlatformaticServiceSchema
    ])),

    ebpfSandbox: Type.Optional(Type.Intersect([
      LogLevelSchema,
      PlatformaticServiceSchema,
      Type.Object({
        disableEBPFPolicies: Type.Optional(Type.Boolean({ default: false }))
      })
    ]))
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
