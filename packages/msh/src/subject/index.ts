/**
 * @tmnl/msh Subject Architecture
 * @module @tmnl/msh/subject
 */

export {
  DomainId, EntityType, SubjectSpecId,
  StreamMappingStrategy, ConsumerHints,
  SubjectSpec, type SubjectQuery, type CatalogEntry,
  RegistryEvent, createSubjectSpec,
} from './schemas';

export { Subject } from './errors';

export { SubjectRegistry, SubjectRegistryLive, type SubjectRegistryShape } from './registry';
