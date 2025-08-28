import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { parseConfig } from '../schemas/config.js'

test('parse a v4 config', async t => {
  const config = {
    cluster: {
      k3d: {}
    },
    dependencies: {
      'prometheus-community/prometheus-adapter': {
        releaseName: 'prometheus-adapter',
        version: '666',
        repo: 'https://repo.com/repo'
      }
    },
    apps: [
      {
        name: 'machinist',
        url: 'https://github.com/platformatic/machinist',
        defaultBranch: 'main'
      }
    ]
  }

  const result = parseConfig(config, 4)
  const output = { ...result }
  output.cluster.k3d = {
    ports: [443],
    args: [],
    nodes: 1
  }
  assert.deepEqual(result, output)
})

test('parse a v3 config', async t => {
  const config = {
    cluster: {
      k3d: {}
    },
    dependencies: {
      'prometheus-community/prometheus-adapter': {
        releaseName: 'prometheus-adapter',
        version: '666',
        repo: 'https://repo.com/repo'
      }
    },
    apps: [
      {
        name: 'machinist',
        url: 'https://github.com/platformatic/machinist',
        defaultBranch: 'main'
      }
    ]
  }

  const result = parseConfig(config, 3)
  const output = { ...result }
  output.cluster.k3d = {
    ports: [443],
    args: [],
    nodes: 1
  }
  assert.deepEqual(result, output)
})
