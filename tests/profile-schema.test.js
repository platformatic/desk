import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { parseProfile } from '../schemas/profile.js'

test('parse a minimum v4 profile', async t => {
  const minimumProfile = {
    version: 4,
    dependencies: {
      'prometheus-community/prometheus-adapter': {
        plt_defaults: true
      }
    },
    platformatic: {
      skip: true
    }
  }

  const result = parseProfile(minimumProfile)
  assert.deepEqual(result, minimumProfile)
})

test('parse a full v4 profile', async t => {
  const profile = {
    version: 4,

    cluster: {
      namespaces: [],
      k3d: {
        nodes: 1,
        ports: [443],
        args: ['--volume=/dev/mapper:/dev/mapper'],
        registry: {
          address: 'http://some-where:5000',
          configPath: 'registry.yaml',
          name: 'some-where'
        }
      }
    },

    dependencies: {
      'prometheus-community/prometheus-adapter': {
        plt_defaults: true
      }
    },

    platformatic: {
      imagePullSecret: {
        user: 'MzUgM',
        token: 'ghp_lollers'
      },

      services: {
        icc: {
          image: {
            tag: 'latest',
            repository: 'platformatic/intelligent-command-center'
          },
          features: {
            ffc: {
              enable: false
            }
          },
          log_level: 'debug',
          login_methods: {
            demo: {
              enable: true
            }
          },
          secrets: {
            icc_session: 'aaaaaaaaaaaaaaaaaaaaaaaa'
          }
        },

        machinist: {
          image: {
            tag: 'latest',
            repository: 'platformatic/machinist'
          },
          features: {
            dev_mode: {
              enable: false
            }
          },
          log_level: 'debug',
        }
      }
    }
  }

  const result = parseProfile(profile)
  assert.deepEqual(result, profile)
})
