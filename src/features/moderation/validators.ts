import { z } from 'zod';

export const REPORT_REASONS = [
  { value: 'SPAM', label: 'Spam or scam' },
  { value: 'HARASSMENT', label: 'Harassment or bullying' },
  { value: 'HATE', label: 'Hate speech' },
  { value: 'VIOLENCE', label: 'Violence or threats' },
  { value: 'SEXUAL', label: 'Sexual content' },
  { value: 'SELF_HARM', label: 'Self-harm' },
  { value: 'OTHER', label: 'Something else' },
] as const;

export const reportMessageSchema = z.object({
  reason: z.enum(['SPAM', 'HARASSMENT', 'HATE', 'VIOLENCE', 'SEXUAL', 'SELF_HARM', 'OTHER']),
  note: z.string().max(500).nullable().optional(),
});

export const reviewReportSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
});

export type ReportMessageInput = z.infer<typeof reportMessageSchema>;
