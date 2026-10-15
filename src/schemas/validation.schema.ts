import { z } from 'zod';

export const JobUploadSchema = z.object({
  rawDescription: z.string().min(20, 'Job description must be at least 20 characters long.'),
  title: z.string().min(2, 'Job title must be at least 2 characters long.').optional(),
  company: z.string().optional(),
  department: z.string().optional(),
});

export const RankingWeightsSchema = z.object({
  semantic: z.number().min(0).max(1).optional(),
  skills: z.number().min(0).max(1).optional(),
  experience: z.number().min(0).max(1).optional(),
  education: z.number().min(0).max(1).optional(),
  career_progression: z.number().min(0).max(1).optional(),
  availability: z.number().min(0).max(1).optional(),
}).refine((data) => {
  // If weights are provided, their sum should be approximately 1.0 (if all are defined)
  const values = Object.values(data).filter((v) => v !== undefined) as number[];
  if (values.length === 6) {
    const sum = values.reduce((acc, val) => acc + val, 0);
    return Math.abs(sum - 1.0) < 0.01;
  }
  return true;
}, {
  message: 'If custom weights are specified, the sum of all weights must equal 1.0',
});

export const MatchStatusSchema = z.object({
  status: z.enum(['PENDING', 'SHORTLISTED', 'REJECTED']),
  notes: z.string().optional(),
});
