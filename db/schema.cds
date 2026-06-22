using { cuid, managed } from '@sap/cds/common';

namespace my.first;

entity Tasks : cuid, managed {
  key ID               : UUID;
      title            : String(100);
      description      : String(500);
      status           : TaskStatus default 'Open';
      rejectionComment : String(500) @readonly;
}

entity Statuses {
  key value : TaskStatus
}

type TaskStatus : String(20) enum {
  Open = 'Open';
  InProgress = 'InProgress';
  Done = 'Done';
  PendingApproval = 'PendingApproval';
  Rejected = 'Rejected';
}

type ApprovalStatus : String(20) enum {
  Pending = 'Pending';
  Approved = 'Approved';
  Rejected = 'Rejected';
}

entity ApprovalStatuses {
  key value : ApprovalStatus
}

entity ApprovalRequests : cuid, managed {
  taskID       : Association to Tasks;
  status       : ApprovalStatus default 'Pending';
  comment      : String(500);
  requestedBy  : String;
  approvedBy   : String;
  decidedAt    : Timestamp;
}