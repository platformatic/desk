import { Value } from '@sinclair/typebox/value'
import { ProfileSchemaV4, SCHEMA_VERSION as V4_VERSION } from './v4/profile.js'

const SCHEMAS = new Map([
  [V4_VERSION, { schema: ProfileSchemaV4, version: V4_VERSION }]
])

export const LATEST_VERSION = V4_VERSION
export const SUPPORTED_VERSIONS = [V4_VERSION]

export function getSchema (version) {
  const schemaInfo = SCHEMAS.get(version)
  if (!schemaInfo) {
    throw new Error(`Unsupported schema version: ${version}. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}`)
  }
  return schemaInfo.schema
}

export function parseProfile (data) {
  // First, validate that version field exists and is supported
  if (!data.version) {
    throw new Error('Profile must include a `version` field')
  }

  if (!SUPPORTED_VERSIONS.includes(data.version)) {
    throw new Error(`Unsupported version: ${data.version}. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}`)
  }

  const schema = getSchema(data.version)

  const isValid = Value.Check(schema, data)

  if (!isValid) {
    const errors = [...Value.Errors(schema, data)]
    throw new Error(`Validation failed for version ${data.version}: ${JSON.stringify(errors, null, 2)}`)
  }

  return Value.Parse(schema, data)
}
