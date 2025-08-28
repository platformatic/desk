import { join } from 'node:path'
import Deepmerge from '@fastify/deepmerge'
import dotenv from 'dotenv'
import { clusterName, debug, loadYamlFile, warn } from './utils.js'
import { createRunDir } from './run-directory.js'
import { parseProfile } from '../schemas/profile.js'
import { parseConfig } from '../schemas/config.js'

const deepmerge = Deepmerge()
const userSecrets = {}
dotenv.config({ quiet: true, processEnv: userSecrets })

export async function loadContext (profileName) {
  const profileDir = process.env.DESK_PROFILE_DIR_PATH || join(import.meta.dirname, '..', 'profiles')
  debug({ profileDir, profileName })
  const profileYaml = await loadYamlFile(join(profileDir, `${profileName}.yaml`), userSecrets)
  const profile = await parseProfile(profileYaml)

  const { configDir, config } = await loadAndParseConfig(profile.version)

  const context = {
    name: profileName,
    version: profile.version,
    chartDir: configDir,
    runDir: await createRunDir(),
    cluster: getClusterCtx(profile.cluster, config.cluster),
    dependencies: getDependencyCtx(profile.dependencies, config.dependencies),
    platformatic: profile.platformatic,
    secrets: { ...userSecrets },
    kube: {
      contextName: `k3d-${clusterName(profileName)}`
    },
    loadConfig: () => config
  }

  return context
}


export async function loadAndParseConfig (version) {
  const configDir = process.env.DESK_CHART_DIR_PATH || join(import.meta.dirname, '..', 'charts', `v${version}`)
  const configYaml = await loadYamlFile(join(configDir, 'config.yaml'))
  return { configDir, config: await parseConfig(configYaml, version) }
}

function getClusterCtx (profileCluster, configCluster) {
  const provider = Object.keys(profileCluster)[0]

  const cluster = {
    provider: {
      name: provider,
      config: deepmerge(configCluster[provider], profileCluster[provider]),
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
