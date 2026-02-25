export type AvaCommandName = 'invalidate' | 'subscribe' | 'unsubscribe'
export type AvaStreamName = 'artifacts' | 'deltas' | 'status'

export interface AvaCommandPayloadRules {
  readonly requiredKeys: readonly string[]
  readonly optionalKeys: readonly string[]
}

export interface AvaCommandContract {
  readonly subjectTemplate: string
  readonly payloadRules: AvaCommandPayloadRules
}

export interface AvaStreamContract {
  readonly singleTemplate: string
  readonly wildcardTemplate: string
}

export interface AvaCasingContract {
  readonly commandKey: 'view_id'
  readonly forbiddenAliases: readonly string[]
}

export interface AvaContractArtifact {
  readonly version: '1.0.0'
  readonly namespacePrefix: 'tmnl.ava'
  readonly commands: Readonly<Record<AvaCommandName, AvaCommandContract>>
  readonly streams: Readonly<Record<AvaStreamName, AvaStreamContract>>
  readonly casingContract: AvaCasingContract
}

/**
 * Static mirror of ./ava_contract_v1.json.
 *
 * Keep this object byte-for-byte semantically aligned with the JSON artifact.
 */
export const AVA_CONTRACT_V1: AvaContractArtifact = {
  version: '1.0.0',
  namespacePrefix: 'tmnl.ava',
  commands: {
    invalidate: {
      subjectTemplate: 'tmnl.ava.invalidate.{view_id}',
      payloadRules: {
        requiredKeys: ['view_id'],
        optionalKeys: ['reason', 'force'],
      },
    },
    subscribe: {
      subjectTemplate: 'tmnl.ava.subscribe.{view_id}',
      payloadRules: {
        requiredKeys: ['view_id'],
        optionalKeys: [],
      },
    },
    unsubscribe: {
      subjectTemplate: 'tmnl.ava.unsubscribe.{view_id}',
      payloadRules: {
        requiredKeys: ['view_id'],
        optionalKeys: [],
      },
    },
  },
  streams: {
    artifacts: {
      singleTemplate: 'tmnl.ava.artifacts.{view_id}',
      wildcardTemplate: 'tmnl.ava.artifacts.*',
    },
    deltas: {
      singleTemplate: 'tmnl.ava.deltas.{view_id}',
      wildcardTemplate: 'tmnl.ava.deltas.*',
    },
    status: {
      singleTemplate: 'tmnl.ava.status.{view_id}',
      wildcardTemplate: 'tmnl.ava.status.*',
    },
  },
  casingContract: {
    commandKey: 'view_id',
    forbiddenAliases: ['viewId'],
  },
}

export const AVA_CONTRACT_VERSION = AVA_CONTRACT_V1.version
export const AVA_NAMESPACE_PREFIX = AVA_CONTRACT_V1.namespacePrefix
export const AVA_COMMAND_KEY = AVA_CONTRACT_V1.casingContract.commandKey
export const AVA_FORBIDDEN_ALIASES = AVA_CONTRACT_V1.casingContract.forbiddenAliases

export const AVA_COMMANDS = AVA_CONTRACT_V1.commands
export const AVA_STREAMS = AVA_CONTRACT_V1.streams

export const getAvaCommandPayloadRules = (
  command: AvaCommandName
): AvaCommandPayloadRules => AVA_CONTRACT_V1.commands[command].payloadRules

export const getAvaCommandSubject = (
  command: AvaCommandName,
  viewId: string
): string =>
  AVA_CONTRACT_V1.commands[command].subjectTemplate.replace('{view_id}', viewId)

export const getAvaStreamSubject = (
  stream: AvaStreamName,
  viewId: string
): string => AVA_CONTRACT_V1.streams[stream].singleTemplate.replace('{view_id}', viewId)

export const getAvaStreamWildcardSubject = (stream: AvaStreamName): string =>
  AVA_CONTRACT_V1.streams[stream].wildcardTemplate
