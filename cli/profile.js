import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import minimist from 'minimist'
import { loadYamlFile, error, info, spawn, clusterName } from '../lib/utils.js'

export const options = { command: 'profile', strict: true }

async function getRunningClusters () {
  try {
    const result = await spawn('k3d', ['cluster', 'ls', '--output', 'json'])
    const clusters = JSON.parse(result.stdout)
    return clusters
      .filter(cluster => cluster.serversRunning > 0 || cluster.agentsRunning > 0)
      .map(cluster => cluster.name)
  } catch (err) {
    return []
  }
}

export default async function cli (argv) {
  const args = minimist(argv)
  const [cmd] = args._

  if (cmd === 'list') {
    try {
      const profilesDir = join(import.meta.dirname, '..', 'profiles')
      const files = await readdir(profilesDir)
      const yamlFiles = files.filter(file => file.endsWith('.yaml'))

      if (yamlFiles.length === 0) {
        info('No profiles found.')
        return
      }

      const runningClusters = await getRunningClusters()

      info('Available profiles:\n')

      const output = []
      for (const file of yamlFiles) {
        const profilePath = join(profilesDir, file)
        const profileData = await loadYamlFile(profilePath)

        const profileName = file.replace('.yaml', '')
        const expectedClusterName = clusterName(profileName)
        const isRunning = runningClusters.includes(expectedClusterName)
        const version = profileData.version || 'unknown'
        const description = (profileData.description || 'No description available').trim()

        const statusIndicator = isRunning ? ' [RUNNING]' : ''
        output.push(`>> ${profileName} (v${version})${statusIndicator}\n${description}`)
      }

      info(output.join('\n---\n'))
    } catch (err) {
      error(`Failed to list profiles: ${err.message}`)
    }
  } else {
    error(`Unknown command: ${cmd}`)
  }
}
