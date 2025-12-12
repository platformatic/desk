import { verifyTools } from '../lib/doctor.js'
import { info, error } from '../lib/utils.js'

export const options = { command: 'doctor', strict: true }

export default async function cli () {
  info('Checking required tools...\n')

  const { output, allInstalled } = await verifyTools()
  info(output)

  if (allInstalled) {
    info('\nAll required tools are installed.')
  } else {
    error('\nSome required tools are missing. Please install them to use desk.')
    process.exit(1)
  }
}
