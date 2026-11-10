import { passwordSchema } from '@kodav/shared';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { hashPassword } from '../lib/crypto.js';
import { Organization } from '../modules/organizations/organization.model.js';
import { User } from '../modules/users/user.model.js';

type SeedAccount = {
  email: string;
  firstName: string;
  lastName: string;
  role: 'client' | 'technicien' | 'admin';
  profile?: 'particulier' | 'pme';
  organization?: { name: string; type: 'pme' };
};

/** Comptes de test clairement identifiés comme tels (domaine réservé .test, noms explicites). */
const TEST_ACCOUNTS: SeedAccount[] = [
  { email: 'technicien@kodav.test', firstName: 'Technicien', lastName: 'Test', role: 'technicien' },
  {
    email: 'client.particulier@kodav.test',
    firstName: 'Client',
    lastName: 'Particulier (test)',
    role: 'client',
    profile: 'particulier',
  },
  {
    email: 'client.pme@kodav.test',
    firstName: 'Client',
    lastName: 'PME (test)',
    role: 'client',
    profile: 'pme',
    organization: { name: 'PME de démonstration (test)', type: 'pme' },
  },
];

/** Crée le compte s'il n'existe pas ; ne modifie jamais un compte existant (mot de passe compris). */
async function ensureAccount(account: SeedAccount, password: string) {
  if (await User.exists({ email: account.email })) return 0;
  const { organization, ...fields } = account;
  const user = await User.create({
    ...fields,
    profile: fields.profile ?? null,
    passwordHash: await hashPassword(password),
    emailVerifiedAt: new Date(),
  });
  if (organization) {
    const org = await Organization.create({ ...organization, owner: user._id });
    await User.updateOne({ _id: user._id }, { organization: org._id, orgRole: 'owner' });
  }
  return 1;
}

function checkPassword(name: string, value: string | undefined) {
  if (!value) return null;
  const result = passwordSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`${name} trop faible : ${result.error.issues[0]?.message ?? ''}`);
  }
  return value;
}

export async function seedAccounts() {
  let created = 0;

  const adminPassword = checkPassword('SEED_ADMIN_PASSWORD', env.SEED_ADMIN_PASSWORD);
  if (env.SEED_ADMIN_EMAIL && adminPassword) {
    created += await ensureAccount(
      {
        email: env.SEED_ADMIN_EMAIL.toLowerCase(),
        firstName: 'Administrateur',
        lastName: 'KODAV',
        role: 'admin',
      },
      adminPassword,
    );
  } else {
    logger.warn('SEED_ADMIN_EMAIL ou SEED_ADMIN_PASSWORD absent : compte admin non créé');
  }

  const testPassword = checkPassword('SEED_TEST_PASSWORD', env.SEED_TEST_PASSWORD);
  if (testPassword) {
    for (const account of TEST_ACCOUNTS) created += await ensureAccount(account, testPassword);
  }
  return created;
}
