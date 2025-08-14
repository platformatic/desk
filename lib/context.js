import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import yaml from 'yaml'
import Deepmerge from '@fastify/deepmerge'
import { warn } from './utils.js'
import { createRunDir } from './run-directory.js'
import { clusterName } from './cluster.js'
import { parseProfile } from '../schemas/profile.js'
import { parseConfig } from '../schemas/config.js'

const deepmerge = Deepmerge()

export async function loadContext (profileName) {
  const profileDir = process.env.DESK_PROFILE_DIR_PATH || join(import.meta.dirname, '..', '.profiles')
  const profileRaw = await loadYamlFile(join(profileDir, `${profileName}.yaml`))
  const profile = await parseProfile(profileRaw)

  const configDir = process.env.DESK_CHART_DIR_PATH || join(import.meta.dirname, '..', 'charts', `v${profile.version}`)
  const configRaw = await loadYamlFile(join(configDir, 'config.yaml'))
  const config = await parseConfig(configRaw, profile.version)

  const context = {
    name: profileName,
    version: profile.version,
    chartDir: configDir,
    runDir: await createRunDir(),
    cluster: getClusterCtx(profile.cluster, config.cluster),
    dependencies: getDependencyCtx(profile.dependencies, config.dependencies),
    platformatic: profile.platformatic,
    kube: {
      contextName: `k3d-${clusterName(profileName)}`
    }
  }

  return context
}

async function loadYamlFile (filePath) {
  const fileContents = await readFile(filePath, 'utf8')
  return yaml.parse(fileContents)
}

function getClusterCtx (profileCluster, configCluster) {
  const provider = Object.keys(profileCluster)[0]

  const cluster = {
    provider: {
      name: provider,
      config: deepmerge(configCluster[provider], profileCluster[provider])
    }
  }

  return cluster
}

function getDependencyCtx (profileDependencies, configDependencies) {
  const requestedDependencies = Object.keys(profileDependencies)

  return requestedDependencies.reduce((acc, chart) => {
    const defaults = configDependencies[chart]
    if (!defaults) {
      warn(`${chart} not configured in config.yaml. Skipping setup`)
      return acc
    }

    acc[chart] = deepmerge(defaults, profileDependencies[chart])
    return acc
  }, {})
}
