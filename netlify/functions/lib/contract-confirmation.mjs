import { createHash, randomUUID } from 'node:crypto';
const launchPrice = 'price_1UO13LEnc0W23lgnnIpKJi4k';
const standardPrice = 'price_1UO13LEnc0W23lgnTxtNXNW6';
const sha = text => createHash('sha256').update(text).digest('hex');
const id = object => typeof object === 'string' ? object : object?.id;
const iso = value => {
  if (!Number.isFinite(value) || value <= 0) throw new Error('CONTRACT_DATE_MISSING');
  return new Date(value * 1000).toISOString();
};
const date = value => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(value));
const money = value => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value / 100);
const safeEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s<>\r\n@]+@[^\s<>\r\n@]+\.[^\s<>\r\n@]+$/.test(value);
export function confirmationMailConfig() {
  const key = globalThis.Netlify?.env?.get('RESEND_API_KEY');
  const from = globalThis.Netlify?.env?.get('POSTIBOU_EMAIL_FROM');
  return key && safeEmail(from) ? { key, from } : null;
}
export const isConfirmationMailReady = () => Boolean(confirmationMailConfig());

export async function ensureContractConfirmation(sql, stripe, session, subscription) {
  const existing = await sql`SELECT * FROM public.postibou_contract_confirmations WHERE subscription_id = ${subscription.id}`;
  if (existing[0]) {
    if (existing[0].user_id !== session.client_reference_id || existing[0].checkout_session_id !== session.id) throw new Error('CONTRACT_OWNER_MISMATCH');
    return existing[0];
  }
  const attemptId = session.metadata?.postibou_attempt_id;
  if (!session.id || !/^[0-9a-f-]{36}$/i.test(attemptId || '') || !id(session.invoice)
      || session.mode !== 'subscription' || session.payment_status !== 'paid'
      || id(session.subscription) !== subscription.id || id(session.customer) !== id(subscription.customer)) throw new Error('CONTRACT_PAYMENT_MISMATCH');
  const proofs = await sql`
    SELECT a.*, u.email FROM public.postibou_legal_acceptances a
    JOIN neon_auth."user" u ON u.id = a.user_id
    WHERE a.attempt_id = ${attemptId}::uuid AND a.user_id = ${session.client_reference_id}::uuid
      AND u."emailVerified" = true
  `;
  const proof = proofs[0];
  if (!proof || !safeEmail(proof.email) || sha(proof.terms_document) !== proof.terms_sha256
      || ![launchPrice, standardPrice].includes(proof.price_id)) throw new Error('CONTRACT_PROOF_MISSING');
  // The original invoice supplies immutable payment/period dates, even if
  // this webhook is retried after another monthly renewal or price change.
  const invoice = await stripe.invoices.retrieve(id(session.invoice));
  const invoiceSub = id(invoice.subscription || invoice.parent?.subscription_details?.subscription);
  const line = invoice.lines?.data?.find(item => id(item.price || item.pricing?.price_details?.price) === proof.price_id && item.quantity === 1);
  if (invoice.id !== id(session.invoice) || invoiceSub !== subscription.id || id(invoice.customer) !== id(subscription.customer)
      || invoice.status !== 'paid' || invoice.billing_reason !== 'subscription_create'
      || invoice.currency !== 'eur' || !Number.isSafeInteger(invoice.amount_paid) || invoice.amount_paid < 0 || !line) throw new Error('CONTRACT_INVOICE_MISMATCH');
  const paidAt = iso(invoice.status_transitions?.paid_at);
  const periodStart = iso(line.period?.start), periodEnd = iso(line.period?.end);
  if (periodEnd <= periodStart) throw new Error('CONTRACT_PERIOD_MISMATCH');
  const receiptId = randomUUID();
  const document = `Postibou — Confirmation de votre abonnement\nRéférence : ${receiptId}\n\nÉditeur : Thibaut MARIE, entrepreneur individuel, Localia, SIREN 892 882 796.\n92 rue des quatre rues, 50710 Créances, France.\nContact : gestion.localia@gmail.com — 06 85 22 47 20.\n\nCompte : ${proof.email}\nAbonnement Stripe : ${subscription.id}\nCommande Stripe : ${session.id}\nFacture de référence : ${invoice.id}\nPaiement confirmé le : ${date(paidAt)} (heure de Paris)\nMontant payé : ${money(invoice.amount_paid)}\nPériode initiale : du ${date(periodStart)} au ${date(periodEnd)} (heure de Paris).\nPremière échéance suivante prévue : ${date(periodEnd)} (heure de Paris).\n\nVotre offre : 30 adaptations par période mensuelle. Une adaptation fournit les deux versions Facebook et Instagram ; « Sublimer mon texte » coûte aussi une adaptation. Aucun report des crédits inutilisés.\n${proof.price_id === launchPrice ? 'Tarif mensuel : 7,90 € aux échéances de 2026, puis 9,90 € dès le premier renouvellement en 2027, sans prélèvement intermédiaire au 1er janvier.' : 'Tarif mensuel : 9,90 € par mois.'}\nTVA non applicable, article 293 B du CGI, selon le régime déclaré par l’éditeur.\n\nDurée indéterminée, sans engagement minimal. Résiliation à tout moment depuis « Mon compte » ; accès jusqu’à la fin de la période payée. Pour de l’aide, contactez l’éditeur.\nRétractation : vous pouvez notifier votre décision dans les 14 jours de la conclusion du contrat. Aucun renoncement n’est demandé. Selon les CGV, le premier paiement est intégralement remboursé dans ce délai, même si des adaptations ont été utilisées. Déclaration : https://postibou.netlify.app/retractation.html, e-mail ou courrier à l’éditeur. Le formulaire type figure dans les conditions jointes.\n\nConditions acceptées : ${proof.terms_version}\nAcceptation enregistrée le : ${date(proof.accepted_at)} (heure de Paris).\nEmpreinte SHA-256 des conditions : ${proof.terms_sha256}\nLes conditions ci-dessous sont la copie exacte de la version acceptée, y compris les garanties et le formulaire de rétractation.\nCe document confirme le contrat et ne remplace pas une facture comptable. Les dates et montants ci-dessus sont ceux de la commande initiale ; le compte affiche ensuite l’état courant de l’abonnement.\n\n----- CONDITIONS ACCEPTÉES -----\n\n${proof.terms_document}`;
  await sql`
    INSERT INTO public.postibou_contract_confirmations
      (receipt_id, user_id, attempt_id, subscription_id, checkout_session_id, invoice_id, recipient_email,
       terms_version, terms_sha256, terms_document, confirmation_document, confirmation_sha256,
       paid_at, amount_paid, currency, period_start, period_end)
    VALUES (${receiptId}::uuid, ${proof.user_id}::uuid, ${attemptId}::uuid, ${subscription.id}, ${session.id}, ${invoice.id}, ${proof.email},
      ${proof.terms_version}, ${proof.terms_sha256}, ${proof.terms_document}, ${document}, ${sha(document)},
      ${paidAt}::timestamptz, ${invoice.amount_paid}, 'eur', ${periodStart}::timestamptz, ${periodEnd}::timestamptz)
    ON CONFLICT (subscription_id) DO NOTHING
  `;
  const rows = await sql`SELECT * FROM public.postibou_contract_confirmations WHERE subscription_id = ${subscription.id}`;
  if (rows[0]?.user_id !== proof.user_id || rows[0]?.checkout_session_id !== session.id) throw new Error('CONTRACT_OWNER_MISMATCH');
  return rows[0];
}

export function contractEmailPayload(receipt, from) {
  if (!safeEmail(from)) throw new Error('CONFIRMATION_EMAIL_NOT_CONFIGURED');
  return {
    from: `Postibou <${from}>`, to: [receipt.recipient_email], reply_to: 'gestion.localia@gmail.com',
    subject: 'Postibou — Confirmation de votre abonnement',
    text: `Bonjour,\n\nVoici la confirmation de votre abonnement Postibou. Votre récapitulatif et la copie exacte des conditions acceptées, avec le formulaire de rétractation, sont joints à ce message. Conservez ces fichiers. Vous pouvez aussi retrouver la confirmation dans « Mon compte ».\n\n${receipt.confirmation_document.split('----- CONDITIONS ACCEPTÉES -----')[0]}\nVotre espace : https://postibou.netlify.app/#compte\n\nPour toute question : gestion.localia@gmail.com\nL’équipe Postibou`,
    attachments: [
      { filename: 'postibou-confirmation.txt', content: Buffer.from(receipt.confirmation_document).toString('base64') },
      { filename: 'postibou-conditions-acceptees.txt', content: Buffer.from(receipt.terms_document).toString('base64') }
    ]
  };
}

export async function deliverContractConfirmation(sql, receipt, { getConfig = confirmationMailConfig, fetchEmail = fetch } = {}) {
  if (receipt.email_status === 'sent') return;
  const config = getConfig();
  if (!config) throw new Error('CONFIRMATION_EMAIL_NOT_CONFIGURED');
  // Freeze the complete payload before the first attempt. Deploys, new terms,
  // email-address changes or a changed sender must never alter an API retry.
  const payload = receipt.email_payload || contractEmailPayload(receipt, config.from);
  const claimed = await sql`
    UPDATE public.postibou_contract_confirmations
    SET email_status = 'sending', email_payload = COALESCE(email_payload, ${JSON.stringify(payload)}::jsonb),
        email_first_attempt_at = COALESCE(email_first_attempt_at, now()), email_lease_until = now() + interval '2 minutes'
    WHERE receipt_id = ${receipt.receipt_id}::uuid
      AND email_status IN ('pending','sending')
      AND (email_lease_until IS NULL OR email_lease_until < now())
      AND (email_first_attempt_at IS NULL OR email_first_attempt_at > now() - interval '23 hours')
    RETURNING *
  `;
  if (!claimed[0]) {
    const current = (await sql`SELECT * FROM public.postibou_contract_confirmations WHERE receipt_id = ${receipt.receipt_id}::uuid`)[0];
    if (current?.email_status === 'sent') return;
    await sql`UPDATE public.postibou_contract_confirmations SET email_status = 'needs_review', email_lease_until = NULL
      WHERE receipt_id = ${receipt.receipt_id}::uuid AND email_status IN ('pending','sending')
        AND email_first_attempt_at <= now() - interval '23 hours'`;
    throw new Error('CONFIRMATION_DELIVERY_PENDING');
  }
  let response;
  try {
    response = await fetchEmail('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json',
        'Idempotency-Key': 'postibou-contract/' + receipt.receipt_id },
      body: JSON.stringify(claimed[0].email_payload), signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('CONFIRMATION_DELIVERY_FAILED');
    const result = await response.json();
    if (!result?.id || typeof result.id !== 'string' || result.id.length > 150) throw new Error('CONFIRMATION_DELIVERY_FAILED');
    const saved = await sql`UPDATE public.postibou_contract_confirmations
      SET email_status = 'sent', email_provider_id = ${result.id}, email_sent_at = now(), email_lease_until = NULL
      WHERE receipt_id = ${receipt.receipt_id}::uuid AND email_status = 'sending' RETURNING receipt_id`;
    if (!saved.length) throw new Error('CONFIRMATION_DELIVERY_PENDING');
  } catch {
    // Keep the lease on uncertain delivery, including a lost DB response.
    // Stripe retries later; the persisted key/payload makes that retry safe.
    throw new Error('CONFIRMATION_DELIVERY_PENDING');
  }
}

export async function confirmContractPurchase(sql, stripe, session, subscription) {
  const receipt = await ensureContractConfirmation(sql, stripe, session, subscription);
  await deliverContractConfirmation(sql, receipt);
}
