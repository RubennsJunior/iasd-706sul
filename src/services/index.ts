export { assetsService } from './assets'
export { setActor, logActivity } from './activity'
export type { CrudService } from './crud'
export {
  completeRoles,
  departmentsService,
  ensureMemberForUser,
  leadersService,
  membersService,
  memberUsage,
  resolveMember,
  positionsService,
  purgeDemoUsers,
  rolesService,
  syncDirectory,
  teamsService,
  usersService,
  validateUser,
} from './people'
export {
  eventPhase,
  eventsService,
  findRosterConflicts,
  matchesEventFilter,
  rosterProgress,
  rostersService,
  searchRostersByName,
  upcomingRostersFor,
  weekAhead,
  worshipService,
} from './agenda'
export type { EventFilter, EventPhase } from './agenda'
export {
  hymnsService,
  materialsService,
  messagesService,
  prayersService,
  readingFor,
  readingsService,
} from './liturgy'
export {
  authenticate,
  churchService,
  contactsService,
  notificationsService,
  notify,
  settingsService,
} from './system'
export { pendingRequests, requestsService } from './requests'
export {
  ALL_SCOPE,
  KIND_OF_MODULE,
  REACH_OPTIONS,
  SCOPED_MODULES,
  assertScope,
  getScope,
  reachLabel,
  resolveScope,
  scopeAllows,
  scopeChecker,
  scopeAllowsNew,
  setScope,
} from './scope'
export type { Scope, ScopeKind, Structure } from './scope'
export type { MemberRequestInput } from './requests'
export { PRIMARY_POSITION } from './leadership'
