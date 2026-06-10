using my.first as mf from '../db/schema';

@requires: 'Tasks.Read'
service TaskService {
  @odata.draft.enabled
  entity Tasks as projection on mf.Tasks;
  @readonly entity Statuses as select from mf.Statuses;
}