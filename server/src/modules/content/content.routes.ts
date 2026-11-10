import { Router } from 'express';
import type {
  Faq as FaqDto,
  Project as ProjectDto,
  Testimonial as TestimonialDto,
} from '@kodav/shared';
import type { Types } from 'mongoose';
import { z } from 'zod';
import { AppError, sendOk } from '../../lib/http.js';
import { SLUG_REGEX } from '../../lib/mongoose.js';
import { publicCache } from '../../middlewares/cache.js';
import { Faq, Project, Testimonial, type ProjectDoc } from './content.model.js';

export const contentRouter = Router();
contentRouter.use(publicCache);

contentRouter.get('/faqs', async (_req, res) => {
  const faqs = await Faq.find({ isPublished: true }).sort({ order: 1, createdAt: 1 }).lean();
  const data: FaqDto[] = faqs.map((f) => ({
    id: String(f._id),
    question: f.question,
    answer: f.answer,
    category: f.category,
    order: f.order,
  }));
  sendOk(res, data);
});

contentRouter.get('/testimonials', async (_req, res) => {
  const items = await Testimonial.find({ status: 'publie' })
    .sort({ order: 1, createdAt: -1 })
    .lean();
  const data: TestimonialDto[] = items.map((t) => ({
    id: String(t._id),
    authorName: t.authorName,
    role: t.role,
    company: t.company,
    profile: t.profile,
    content: t.content,
    rating: t.rating,
  }));
  sendOk(res, data);
});

function toProjectDto(p: ProjectDoc & { _id: Types.ObjectId }): ProjectDto {
  return {
    id: String(p._id),
    slug: p.slug,
    title: p.title,
    category: p.category,
    client: p.client,
    summary: p.summary,
    content: p.content,
    images: p.images.map(({ url, alt }) => ({ url, alt })),
    tags: p.tags,
    publishedAt: p.publishedAt?.toISOString() ?? null,
  };
}

contentRouter.get('/projects', async (_req, res) => {
  const projects = await Project.find({ status: 'publie' }).sort({ publishedAt: -1 }).lean();
  sendOk(res, projects.map(toProjectDto));
});

contentRouter.get('/projects/:slug', async (req, res) => {
  const slug = z.string().regex(SLUG_REGEX).max(120).parse(req.params.slug);
  const project = await Project.findOne({ slug, status: 'publie' }).lean();
  if (!project) throw AppError.notFound('Réalisation introuvable');
  sendOk(res, toProjectDto(project));
});
