const cds = require('@sap/cds');
const { createWorkflowEngine } = require('./workflow-engine');

module.exports = class ApprovalService extends cds.ApplicationService {
  async init() {
    const engine = createWorkflowEngine();

    // Unbound: submit a task for approval
    this.on('submitForApproval', async (req) => {
      const taskId = req.data.task;
      if (!taskId) return req.reject(400, 'Task UUID is required');

      const tx = cds.transaction(req);
      const [task] = await tx.run(SELECT.from('my.first.Tasks').where({ ID: taskId }));
      if (!task) return req.reject(404, `Task ${taskId} not found`);
      if (task.status !== 'Done') return req.reject(400, 'Task must be Done to submit for approval');

      const existing = await tx.run(
        SELECT.from('my.first.ApprovalRequests').where({ taskID_ID: taskId, status: 'Pending' })
      );
      if (existing.length > 0) return req.reject(409, 'Task already has a pending approval request');

      const [ar] = await tx.run(INSERT.into('my.first.ApprovalRequests').entries({
        taskID_ID: taskId,
        status: 'Pending',
        requestedBy: req.user?.id || 'anonymous'
      }));

      await tx.run(UPDATE('my.first.Tasks').where({ ID: taskId }).set({ status: 'PendingApproval' }));
      await engine.submit(taskId, req.user?.id || 'anonymous');

      return SELECT.from('my.first.ApprovalRequests').where({ ID: ar.ID });
    });

    // Action: approve an approval request (bound to entity)
    this.on('approve', 'ApprovalRequests', async (req) => {
      const id = req.params[0].ID || req.params[0];
      const { comment } = req.data;
      if (!id) return req.reject(400, 'ApprovalRequest ID is required');

      const tx = cds.transaction(req);
      const [request] = await tx.run(SELECT.from('my.first.ApprovalRequests').where({ ID: id }));
      if (!request) return req.reject(404, `ApprovalRequest ${id} not found`);

      if (request.status === 'Approved') return SELECT.from('my.first.ApprovalRequests').where({ ID: id });
      if (request.status === 'Rejected') return req.reject(400, 'Request was already rejected');
      if (request.status !== 'Pending') return req.reject(400, 'Request is not Pending');

      await tx.run(UPDATE('my.first.ApprovalRequests').where({ ID: id }).set({
        status: 'Approved', approvedBy: req.user?.id || 'anonymous',
        comment: comment || null, decidedAt: new Date().toISOString()
      }));
      await tx.run(UPDATE('my.first.Tasks').where({ ID: request.taskID_ID }).set({ status: 'Done' }));

      await engine.onApproved(request);
      return SELECT.from('my.first.ApprovalRequests').where({ ID: id });
    });

    // Action: reject an approval request (bound to entity)
    this.on('reject', 'ApprovalRequests', async (req) => {
      const id = req.params[0].ID || req.params[0];
      const { comment } = req.data;
      if (!id) return req.reject(400, 'ApprovalRequest ID is required');
      if (!comment?.trim()) return req.reject(400, 'Comment is required for rejection');

      const tx = cds.transaction(req);
      const [request] = await tx.run(SELECT.from('my.first.ApprovalRequests').where({ ID: id }));
      if (!request) return req.reject(404, `ApprovalRequest ${id} not found`);

      if (request.status === 'Rejected') return SELECT.from('my.first.ApprovalRequests').where({ ID: id });
      if (request.status === 'Approved') return req.reject(400, 'Request was already approved');
      if (request.status !== 'Pending') return req.reject(400, 'Request is not Pending');

      await tx.run(UPDATE('my.first.ApprovalRequests').where({ ID: id }).set({
        status: 'Rejected', approvedBy: req.user?.id || 'anonymous',
        comment, decidedAt: new Date().toISOString()
      }));
      await tx.run(UPDATE('my.first.Tasks').where({ ID: request.taskID_ID }).set({ status: 'Rejected', rejectionComment: comment }));

      await engine.onRejected(request, comment);
      return SELECT.from('my.first.ApprovalRequests').where({ ID: id });
    });

    return super.init();
  }
};
