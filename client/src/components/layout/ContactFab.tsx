import { MessageCircle, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { telLink, whatsappLink } from '~/lib/format';
import { useBrand } from '~/lib/useSettings';

/** Message WhatsApp pré-rempli selon la page visitée. */
function messageFor(pathname: string, brandName: string) {
  if (pathname.startsWith('/services/')) {
    return `Bonjour ${brandName}, je souhaite des informations sur ce service : ${pathname.split('/').pop()?.replace(/-/g, ' ')}.`;
  }
  if (pathname.startsWith('/contrats-maintenance')) {
    return `Bonjour ${brandName}, je souhaite en savoir plus sur vos contrats de maintenance.`;
  }
  if (pathname.startsWith('/solutions/')) {
    return `Bonjour ${brandName}, je souhaite échanger sur les besoins informatiques de ma structure.`;
  }
  return `Bonjour ${brandName}, j'ai une question.`;
}

/**
 * Contact immédiat : WhatsApp flottant, et appel direct sur mobile.
 * Masqués tant que les numéros réels ne sont pas renseignés dans l'admin.
 */
export function ContactFab() {
  const { t } = useTranslation();
  const brand = useBrand();
  const { pathname } = useLocation();
  if (!brand) return null;
  const wa = whatsappLink(brand.whatsapp, messageFor(pathname, brand.shortName));
  const tel = telLink(brand.phone);
  if (!wa && !tel) return null;

  return (
    <div className="fixed right-4 bottom-4 z-30 flex flex-col items-end gap-3 print:hidden">
      {tel && (
        <a
          href={tel}
          className="grid size-12 place-items-center rounded-full bg-secondary text-on-secondary shadow-lg md:hidden"
          aria-label={t('contactFab.call')}
        >
          <Phone className="size-5" aria-hidden />
        </a>
      )}
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          // Vert WhatsApp (repère universel), assez foncé pour un texte blanc AA.
          className="group flex h-14 items-center gap-2 rounded-full bg-[#1f7a4d] px-4 text-label text-white shadow-lg transition-transform hover:scale-105 motion-reduce:hover:scale-100"
          aria-label={t('contactFab.whatsapp')}
        >
          <MessageCircle className="size-6" aria-hidden />
          <span className="hidden sm:inline">WhatsApp</span>
        </a>
      )}
    </div>
  );
}
