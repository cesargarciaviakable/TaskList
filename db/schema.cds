using { cuid, managed } from '@sap/cds/common';

namespace my.first;

entity Tasks : cuid, managed {
  key ID          : UUID;
      title       : String(100);
      description : String(500);
      status      : TaskStatus default 'Open';
}

entity Statuses {
  key value : TaskStatus
}

type TaskStatus : String(20) enum {
  Open = 'Open';
  InProgress = 'InProgress';
  Done = 'Done';
}