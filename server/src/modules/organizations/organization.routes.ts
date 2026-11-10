import { updateOrganizationInputSchema, type Organization as OrganizationDto } from '@kodav/shared';
import { Router } from 'express';
import { AppError, sendOk } from '../../lib/http.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { Organization } from './organization.model.js';

export const organizationsRouter = Router();
organizationsRouter.use(authenticate, requireRole('client'));

function toDto(org: InstanceType<typeof Organization>): OrganizationDto {
  return {
    id: org.id as string,
    name: org.name,
    type: org.type,
    taxId: org.taxId,
    rccm: org.rccm,
    phone: org.phone,
    email: org.email,
    address: {
      street: org.address?.street ?? '',
      commune: org.address?.commune ?? '',
      city: org.address?.city ?? '',
    },
  };
}

/** L'organisation est toujours celle de l'utilisateur connecté : aucun identifiant fourni. */
async function findMyOrganization(organizationId: unknown) {
  if (!organizationId) throw AppError.notFound('Aucune organisation rattachée à ce compte');
  const org = await Organization.findById(organizationId);
  if (!org) throw AppError.notFound('Organisation introuvable');
  return org;
}

organizationsRouter.get('/me', async (req, res) => {
  sendOk(res, toDto(await findMyOrganization(req.user!.organization)));
});

organizationsRouter.patch('/me', async (req, res) => {
  const org = await findMyOrganization(req.user!.organization);
  if (req.user!.orgRole !== 'owner') {
    throw AppError.forbidden('Seul le responsable du compte peut modifier ces informations');
  }
  org.set(updateOrganizationInputSchema.parse(req.body));
  await org.save();
  sendOk(res, toDto(org));
});
