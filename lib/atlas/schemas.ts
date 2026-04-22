import { z } from 'zod';

export const CreateRunInputSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  personalEmail: z.string().email(),
  position: z.string().min(1),
  department: z.string().optional(),
  startDate: z.string().min(1),
  managerName: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.string().optional(),
  phone: z.string().optional(),
  entitlements: z.record(z.string(), z.boolean()).optional(),
  presetCode: z.string().optional(),
  compensation: z.string().optional(),
  compensationVisible: z.string().optional(),
});

export const AddEquipmentSchema = z.object({
  type: z.string().min(1),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  assetTag: z.string().optional(),
  condition: z.enum(['new', 'good', 'fair', 'poor']).default('good'),
  notes: z.string().optional(),
});

export const AddCardSchema = z.object({
  cardholderName: z.string().min(1),
  last4: z.string().length(4).optional(),
  issuer: z.string().optional(),
  creditLimitDollars: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  supplementaryTo: z.string().uuid().optional(),
  primaryOwnerName: z.string().optional(),
  notes: z.string().optional(),
});

export const SaveNoteSchema = z.object({
  employeeId: z.string().uuid(),
  body: z.string().min(1),
  runId: z.string().uuid().optional(),
});

export const RoleTemplateSchema = z.object({
  label: z.string().min(1),
  entitlements: z.record(z.string(), z.boolean()),
});
