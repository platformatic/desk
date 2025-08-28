import { Value } from '@sinclair/typebox/value'
import { ConfigSchemaV4, SCHEMA_VERSION as V4_VERSION } from './v4/config.js'
import { ConfigSchemaV3, SCHEMA_VERSION as V3_VERSION } from './v3/config.js'

const SCHEMAS = new Map([
  [V4_VERSION, { schema: ConfigSchemaV4, version: V4_VERSION }],
  [V3_VERSION, { schema: ConfigSchemaV3, version: V3_VERSION }]
])

export const LATEST_VERSION = V4_VERSION
export const SUPPORTED_VERSIONS = [V4_VERSION, V3_VERSION]

export function getSchema (version) {
  const schemaInfo = SCHEMAS.get(version)
  if (!schemaInfo) {
    throw new Error(`Unsupported schema version: ${version}. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}`)
  }
  return schemaInfo.schema
}

export function parseConfig (data, version) {
  if (!SUPPORTED_VERSIONS.includes(version)) {
    throw new Error(`Unsupported version: ${version}. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}`)
  }

  const schema = getSchema(version)

  const isValid = Value.Check(schema, data)

  if (!isValid) {
    const errors = [...Value.Errors(schema, data)]
    throw new Error(`Validation failed for version ${version}: ${JSON.stringify(errors, null, 2)}`)
  }

  return Value.Parse(schema, data)
}
