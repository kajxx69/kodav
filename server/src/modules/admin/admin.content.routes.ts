import {
  adminFaqSchema,
  adminProjectSchema,
  adminTestimonialSchema,
  testimonialSubmitSchema,
  type AdminTestimonialDto,
} from '@kodav/shared';
import { Router } from 'express';
import { audit } from '../../lib/audit.js';
import { AppError, sendOk } from '../../lib/http.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { publicFormLimiter } from '../../middlewares/rateLimit.js';
import { notify } from '../notifications/notification.service.js';
import { Organization } from '../organizations/organization.model.js';
import { Faq, Project, Testimonial } from '../content/content.model.js';
import { User } from '../users/user.model.js';

const ID = /^[a-f\d]{24}$/i;
const checkId = (id: unknown, what: string) => {
  if (typeof id !== 'string' || !ID.test(id)) throw AppError.notFound(`${what} introuvable`);
  return id;
};

// --- Avis déposé par un client (publié seulement après validation) -----------------------

export const clientTestimonialsRouter = Router();
clientTestimonialsRouter.post(
  '/',
  authenticate,
  requireRole('client'),
  publicFormLimiter,
  async (req, res) => {
    const input = testimonialSubmitSchema.parse(req.body);
    const user = await User.findById(req.user!._id).lean();
    const org = user?.organization
      ? await Organization.findById(user.organization, { name: 1 }).lean()
      : null;
    const t = await Testimonial.create({
      authorName: `${user!.firstName} ${user!.lastName.charAt(0)}.`,
      role: input.role,
      company: org?.name ?? '',
      profile: user!.profile ?? undefined,
      content: input.content,
      rating: input.rating,
      status: 'en_attente',
      consentAt: new Date(),
      client: user!._id,
    });
    const admins = await User.find({ role: 'admin', isActive: true }, { _id: 1 }).lean();
    await notify(
      admins.map((a) => a._id),
      {
        type: 'ticket_new',
        title: 'Nouvel avis client à valider',
        body: input.content.slice(0, 120),
        link: '/admin/contenu',
      },
    );
    sendOk(res, { id: String(t._id) }, 201);
  },
);

// --- Admin ---------------------------------------------------------------------------------

export const adminContentRouter = Router();
adminContentRouter.use(authenticate, requireRole('admin'));

adminContentRouter.get('/testimonials', async (_req, res) => {
  const items = await Testimonial.find().sort({ status: 1, order: 1, createdAt: -1 }).lean();
  sendOk(
    res,
    items.map((t): AdminTestimonialDto => ({
      id: String(t._id),
      authorName: t.authorName,
      role: t.role,
      company: t.company,
      profile: t.profile,
      content: t.content,
      rating: t.rating,
      status: t.status,
      order: t.order,
      fromClient: Boolean(t.client),
      createdAt: (t as unknown as { createdAt: Date }).createdAt.toISOString(),
    })),
  );
});

adminContentRouter.post('/testimonials', async (req, res) => {
  const t = await Testimonial.create(adminTestimonialSchema.parse(req.body));
  await audit(req, 'testimonial.create', 'Testimonial', t._id, t.authorName);
  sendOk(res, { id: String(t._id) }, 201);
});

adminContentRouter.put('/testimonials/:id', async (req, res) => {
  const id = checkId(req.params.id, 'Avis');
  const input = adminTestimonialSchema.parse(req.body);
  const t = await Testimonial.findByIdAndUpdate(id, input, { new: true });
  if (!t) throw AppError.notFound('Avis introuvable');
  await audit(req, 'testimonial.update', 'Testimonial', t._id, `${t.authorName} : ${t.status}`);
  sendOk(res, { id });
});

adminContentRouter.delete('/testimonials/:id', async (req, res) => {
  const id = checkId(req.params.id, 'Avis');
  await Testimonial.deleteOne({ _id: id });
  await audit(req, 'testimonial.delete', 'Testimonial', id);
  sendOk(res, { deleted: true });
});

adminContentRouter.get('/projects', async (_req, res) => {
  const items = await Project.find().sort({ createdAt: -1 }).lean();
  sendOk(
    res,
    items.map(({ _id, ...p }) => ({
      id: String(_id),
      ...p,
      publishedAt: p.publishedAt?.toISOString() ?? null,
    })),
  );
});

async function saveProject(id: string | null, body: unknown) {
  const input = adminProjectSchema.parse(body);
  const clash = await Project.findOne({ slug: input.slug }, { _id: 1 }).lean();
  if (clash && String(clash._id) !== id) {
    throw AppError.conflict('Cette adresse est déjà utilisée', [
      { path: 'slug', message: 'Déjà utilisée' },
    ]);
  }
  const previous = id ? await Project.findById(id).lean() : null;
  if (id && !previous) throw AppError.notFound('Réalisation introuvable');
  const fields = {
    ...input,
    publishedAt: input.status === 'publie' ? (previous?.publishedAt ?? new Date()) : undefined,
  };
  return id ? Project.findByIdAndUpdate(id, fields, { new: true }) : Project.create(fields);
}

adminContentRouter.post('/projects', async (req, res) => {
  const p = await saveProject(null, req.body);
  await audit(req, 'project.create', 'Project', p!._id, p!.title);
  sendOk(res, { id: String(p!._id) }, 201);
});

adminContentRouter.put('/projects/:id', async (req, res) => {
  const p = await saveProject(checkId(req.params.id, 'Réalisation'), req.body);
  await audit(req, 'project.update', 'Project', p!._id, `${p!.title} : ${p!.status}`);
  sendOk(res, { id: String(p!._id) });
});

adminContentRouter.delete('/projects/:id', async (req, res) => {
  const id = checkId(req.params.id, 'Réalisation');
  await Project.deleteOne({ _id: id });
  await audit(req, 'project.delete', 'Project', id);
  sendOk(res, { deleted: true });
});

adminContentRouter.get('/faqs', async (_req, res) => {
  const items = await Faq.find().sort({ order: 1, createdAt: 1 }).lean();
  sendOk(
    res,
    items.map(({ _id, ...f }) => ({ id: String(_id), ...f })),
  );
});

adminContentRouter.post('/faqs', async (req, res) => {
  const f = await Faq.create(adminFaqSchema.parse(req.body));
  await audit(req, 'faq.create', 'Faq', f._id, f.question);
  sendOk(res, { id: String(f._id) }, 201);
});

adminContentRouter.put('/faqs/:id', async (req, res) => {
  const id = checkId(req.params.id, 'Question');
  const f = await Faq.findByIdAndUpdate(id, adminFaqSchema.parse(req.body), { new: true });
  if (!f) throw AppError.notFound('Question introuvable');
  await audit(req, 'faq.update', 'Faq', f._id, f.question);
  sendOk(res, { id });
});

adminContentRouter.delete('/faqs/:id', async (req, res) => {
  const id = checkId(req.params.id, 'Question');
  await Faq.deleteOne({ _id: id });
  await audit(req, 'faq.delete', 'Faq', id);
  sendOk(res, { deleted: true });
});
