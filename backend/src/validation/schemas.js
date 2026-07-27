const { z } = require('zod');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectId = () => z.string().regex(objectIdRegex, 'Invalid ID format');

const workspaceSchemas = {
  create: z.object({
    name: z.string().trim().min(1, 'Workspace name is required').max(100),
  }),
  invite: z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    name: z.string().trim().max(100).optional(),
    title: z.string().trim().max(50).optional(),
    role: z.enum(['admin', 'member']).optional(),
  }),
  updateRole: z.object({
    role: z.enum(['admin', 'member']),
  }),
};

const meetingSchemas = {
  create: z.object({
    title: z.string().trim().min(1, 'Meeting title is required').max(200),
    rawTranscript: z.string().trim().min(1, 'Transcript is required').max(50000, 'Transcript is too long (max 50,000 characters)'),
    attendees: z.array(z.object({
      name: z.string().trim().min(1).max(100),
      email: z.union([z.string().trim().toLowerCase().email(), z.literal('')]).optional().nullable(),
      userId: z.string().optional().nullable(),
    })).optional().default([]),
    duration: z.coerce.number().int().min(1).max(1440).optional().nullable(),
    workspaceId: objectId().optional().nullable(),
  }),
};

const actionItemSchemas = {
  update: z.object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    assignee: z.object({
      name: z.string().optional().nullable(),
      email: z.union([z.string().trim().toLowerCase().email(), z.literal('')]).optional().nullable(),
      userId: z.string().optional().nullable(),
    }).optional().nullable(),
    deadline: z.coerce.date().optional().nullable(),
    priority: z.enum(['high', 'medium', 'low']).optional().nullable(),
  }),
  updateStatus: z.object({
    status: z.enum(['pending', 'in_progress', 'done', 'overdue']),
  }),
};

const commitmentSchemas = {
  updateStatus: z.object({
    status: z.enum(['pending', 'fulfilled', 'broken', 'overdue']),
  }),
};

module.exports = { workspaceSchemas, meetingSchemas, actionItemSchemas, commitmentSchemas, objectId };
