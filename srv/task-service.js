const cds = require('@sap/cds');

module.exports = class TaskService extends cds.ApplicationService {
  async init() {
    // After a task is updated (via draft activation or direct PATCH with bypass_draft),
    // auto-submit for approval if status = Done — runs in the same transaction as the
    // request so the response (and the Object Page) reflects PendingApproval right away.
    this.after('UPDATE', 'Tasks', async (results, req) => {
      if (!results || results.length === 0) return;

      const task = Array.isArray(results) ? results[0] : results;
      if (task.status !== 'Done') return;

      const tx = cds.transaction(req);

      const existing = await tx.run(
        SELECT.from('my.first.ApprovalRequests')
          .where({ taskID_ID: task.ID, status: 'Pending' })
      );
      if (existing.length > 0) return;

      await tx.run(
        INSERT.into('my.first.ApprovalRequests').entries({
          taskID_ID: task.ID,
          status: 'Pending',
          requestedBy: req.user?.id || 'anonymous'
        })
      );

      await tx.run(
        UPDATE('my.first.Tasks').where({ ID: task.ID }).set({ status: 'PendingApproval' })
      );

      task.status = 'PendingApproval';
    });

    return super.init();
  }
};
