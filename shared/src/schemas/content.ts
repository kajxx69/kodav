import { z } from 'zod';
import { CLIENT_PROFILES } from '../enums.js';

export const faqSchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  category: z.string(),
  order: z.number(),
});
export type Faq = z.infer<typeof faqSchema>;

export const testimonialSchema = z.object({
  id: z.string(),
  authorName: z.string(),
  role: z.string(),
  company: z.string(),
  profile: z.enum(CLIENT_PROFILES).optional(),
  content: z.string(),
  rating: z.number().min(1).max(5),
});
export type Testimonial = z.infer<typeof testimonialSchema>;

export const projectImageSchema = z.object({ url: z.string(), alt: z.string() });

export const projectSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  category: z.string(),
  client: z.string(),
  summary: z.string(),
  content: z.string(),
  images: z.array(projectImageSchema),
  tags: z.array(z.string()),
  publishedAt: z.string().nullable(),
});
export type Project = z.infer<typeof projectSchema>;
