using my.first as mf from '../db/schema';

service ApprovalService {
  @readonly entity Statuses as select from mf.Statuses;
  @readonly entity ApprovalStatuses as select from mf.ApprovalStatuses;
  entity ApprovalRequests as projection on mf.ApprovalRequests actions {
    action approve(comment: String) returns ApprovalRequests;
    action reject(comment: String) returns ApprovalRequests;
  };
  @readonly entity Tasks as projection on mf.Tasks;

  action submitForApproval(task: UUID) returns many ApprovalRequests;
}
