import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import minimist from 'minimist'
import { loadYamlFile, error, info } from '../lib/utils.js'

export const options = { command: 'profile', strict: true }

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

      info('Available profiles:\n')

      let output = []
      for (const file of yamlFiles) {
        const profilePath = join(profilesDir, file)
        const profileData = await loadYamlFile(profilePath)
        
        const profileName = file.replace('.yaml', '')
        const version = profileData.version || 'unknown'
        const description = (profileData.description || 'No description available').trim()

        output.push(`>> ${profileName} (v${version})\n${description}`)
      }

      info(output.join('\n---\n'))
    } catch (err) {
      error(`Failed to list profiles: ${err.message}`)
    }
  } else {
    error(`Unknown command: ${cmd}`)
  }
}
