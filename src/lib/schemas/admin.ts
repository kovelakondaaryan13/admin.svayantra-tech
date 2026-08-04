import { z } from "zod";

export const RoleCreateSchema = z.object({
  key: z.string().min(2).max(60).regex(/^[a-z0-9_]+$/, "lowercase, digits, underscore only"),
  label: z.string().min(1).max(80),
  permissions: z.array(z.string().max(60)).max(64),
});

export const RoleUpdateSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  permissions: z.array(z.string().max(60)).max(64).optional(),
});

export const EmployeeUpdateSchema = z.object({
  roleKey: z.string().min(2).max(60).optional(),
  departmentId: z.string().max(64).optional(),
  teamId: z.string().max(64).optional(),
  managerUserId: z.string().max(64).optional(),
  phone: z.string().max(40).optional(),
  status: z.enum(["active", "invited", "suspended"]).optional(),
  name: z.string().max(200).optional(),
  title: z.string().max(120).optional(),
  capacity: z.number().int().min(0).max(100).optional(),
  skills: z.array(z.string().max(60)).max(30).optional(),
  availability: z.enum(["available", "busy", "away"]).optional(),
  defaultExecutionModel: z.enum(["individual", "conveyor"]).optional(),
});

/** Create a new employee (provisions a Better Auth account, then the directory record). */
export const EmployeeCreateSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  roleKey: z.string().min(2).max(60),
  title: z.string().max(120).optional(),
  departmentId: z.string().max(64).optional(),
  managerUserId: z.string().max(64).optional(),
  capacity: z.number().int().min(0).max(100).optional(),
  skills: z.array(z.string().max(60)).max(30).optional(),
  defaultExecutionModel: z.enum(["individual", "conveyor"]).optional(),
});

/** Self-service profile edit (any authenticated employee, on their own record only). */
export const SelfProfileUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  personalEmail: z.string().email().max(200).or(z.literal("")).optional(),
  phone: z.string().max(40).or(z.literal("")).optional(),
});

export const OverridesSchema = z.object({
  grants: z.array(z.string().max(60)).max(64).default([]),
  denies: z.array(z.string().max(60)).max(64).default([]),
});
