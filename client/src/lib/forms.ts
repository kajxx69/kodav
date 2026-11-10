import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiRequestError } from './api';

/**
 * Reporte les erreurs de validation renvoyées par l'API sur les champs du formulaire.
 * Renvoie le message général à afficher quand l'erreur ne concerne aucun champ.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
): string | null {
  if (error instanceof ApiRequestError && error.details?.length) {
    const fieldErrors = error.details.filter((d) => fields.includes(d.path));
    for (const d of fieldErrors) setError(d.path as Path<T>, { message: d.message });
    if (fieldErrors.length) return null;
  }
  return error instanceof Error ? error.message : 'Une erreur est survenue';
}
