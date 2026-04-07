import pc from 'picocolors'
import { verifyTools, checkEbpfSandboxSupport } from '../lib/doctor.js'
import { info, error, warn } from '../lib/utils.js'

export const options = { command: 'doctor', strict: true }

export default async function cli () {
  info('Checking required tools...\n')

  const { output, allInstalled } = await verifyTools()
  info(output)

  info('\nChecking kernel support...\n')
  const ebpf = await checkEbpfSandboxSupport()
  if (ebpf.supported) {
    info(`${pc.green('\u2713')} ${ebpf.name}`)
  } else {
    warn(`${pc.yellow('!')} ${ebpf.name} ${pc.dim(`- ${ebpf.reason}`)}`)
  }

  if (allInstalled) {
    info('\nAll required tools are installed.')
  } else {
    error('\nSome required tools are missing. Please install them to use desk.')
    process.exit(1)
  }
}
