import { z } from "zod";

const DOC_TYPES = [
  "proposal",
  "quotation",
  "meeting_transcript",
  "contract",
  "email",
  "note",
  "sop",
  "upload",
] as const;

export const DocumentUploadSchema = z.object({
  title: z.string().min(1).max(300),
  documentType: z.enum(DOC_TYPES),
  text: z.string().min(1),
  mimeType: z.string().max(120).optional(),
  source: z.string().max(120).optional(),
  companyId: z.string().max(64).optional(),
  clientId: z.string().max(64).optional(),
  dealId: z.string().max(64).optional(),
  permissions: z.array(z.string().max(40)).max(20).optional(),
});

export const AskSchema = z.object({
  question: z.string().min(1).max(2000),
  documentType: z.enum(DOC_TYPES).optional(),
  companyId: z.string().max(64).optional(),
  dealId: z.string().max(64).optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

export const CalendarEventSchema = z.object({
  title: z.string().min(1).max(300),
  start: z.string().datetime(),
  end: z.string().datetime(),
  description: z.string().max(5000).optional(),
  location: z.string().max(300).optional(),
  attendees: z.array(z.string().email()).max(50).optional(),
});

export const CalendarEventUpdateSchema = CalendarEventSchema.partial();
