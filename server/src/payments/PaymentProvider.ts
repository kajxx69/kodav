/**
 * Point d'extension du paiement en ligne (Mobile Money : Orange Money, MTN MoMo, Wave…).
 * Non implémenté pour l'instant : les règlements sont saisis par l'admin.
 */
export interface PaymentProvider {
  /** Identifiant du fournisseur, ex. « wave ». */
  readonly id: string;
  /** Démarre un paiement et renvoie l'URL ou le code à présenter au client. */
  createPayment(input: {
    invoiceId: string;
    reference: string;
    amount: number;
    currency: 'XOF';
    customer: { name: string; phone: string; email: string };
  }): Promise<{ providerPaymentId: string; redirectUrl?: string; ussdCode?: string }>;
  /** Vérifie la signature d'une notification du fournisseur et en extrait le résultat. */
  parseWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<{
    providerPaymentId: string;
    status: 'succeeded' | 'failed' | 'pending';
    amount: number;
  }>;
}

/** Aucun fournisseur configuré : le paiement en ligne n'est pas proposé. */
export const paymentProvider: PaymentProvider | null = null;
