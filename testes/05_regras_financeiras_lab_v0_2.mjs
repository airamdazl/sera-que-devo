/**
 * Sera Que Devo? BI 2.0 — especificacao executavel (laboratorio isolado)
 * SEM Supabase, SEM rede, SEM operacoes em dados reais.
 * Valores inteiros em centavos para nao depender de ponto flutuante monetario.
 * NAO usar em producao sem completar autorizacoes, transacoes SQL e revisao de seguranca.
 */

export function cents(value) {
  if (typeof value !== 'string') throw Error('Informe um valor monetario em texto.');
  const raw = value.trim().replace(/^R\$\s*/, '');
  let normalized;
  if (/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(raw)) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+(?:[,.]\d{1,2})?$/.test(raw)) {
    normalized = raw.replace(',', '.');
  } else throw Error('Valor monetario invalido.');
  const [integer, fraction = ''] = normalized.split('.');
  const n = BigInt(integer) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('Valor monetario excede o limite.');
  return Number(n);
}

export function distributeInstallments(totalCents, count) {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) throw Error('Total invalido.');
  if (!Number.isInteger(count) || count < 1 || count > 60) throw Error('Quantidade de parcelas invalida.');
  const base = Math.floor(totalCents / count);
  const extra = totalCents % count;
  return Array.from({length:count}, (_, i) => base + (i < extra ? 1 : 0));
}

function isoParts(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw Error('Data invalida.');
  const [y,m,d] = iso.split('-').map(Number);
  const maxDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > maxDay) throw Error('Data invalida.');
  return [y,m,d];
}

export function dueDateInMonth(originalISO, monthOffset) {
  const [year,month,day] = isoParts(originalISO);
  if (!Number.isInteger(monthOffset) || monthOffset < 0 || monthOffset > 600) throw Error('Mes invalido.');
  const date = new Date(Date.UTC(year, month - 1 + monthOffset, 1));
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const actualDay = Math.min(day, last);
  return `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(actualDay).padStart(2,'0')}`;
}

export function monthlyOccurrences({ruleId, firstDue, count, amountCents}) {
  if (!ruleId || typeof ruleId !== 'string') throw Error('Regra obrigatoria.');
  if (!Number.isInteger(count) || count < 1 || count > 120) throw Error('Quantidade invalida.');
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw Error('Valor invalido.');
  return Array.from({length: count}, (_,i) => {
    const dueOn = dueDateInMonth(firstDue, i);
    return {key:`${ruleId}:${dueOn.slice(0,7)}`, dueOn, amountCents, status:'pending'};
  });
}

export function payObligation(state, payment) {
  // Contrato de laboratorio: no banco, cada operacao precisara de validacao de auth,
  // posse, transacao atomica, constraint de idempotencia e trilha de auditoria.
  const {obligation, payments} = state;
  if (!obligation?.userId || !obligation?.id) throw Error('Obrigacao invalida.');
  if (!['expense','income','card_invoice','legacy_debt'].includes(obligation.kind)) throw Error('Tipo invalido.');
  if (!Number.isSafeInteger(obligation.amountCents) || obligation.amountCents <= 0) throw Error('Total invalido.');
  if (payment.userId !== obligation.userId) throw Error('Usuario sem permissao.');
  if (!payment.accountId || !payment.requestId) throw Error('Conta e identificador obrigatorios.');
  if (!Number.isSafeInteger(payment.amountCents) || payment.amountCents <= 0) throw Error('Pagamento invalido.');
  isoParts(payment.paidOn);
  const old = payments.find(p => p.requestId === payment.requestId);
  if (old) {
    if (old.userId !== payment.userId || old.accountId !== payment.accountId ||
        old.amountCents !== payment.amountCents || old.paidOn !== payment.paidOn)
      throw Error('Identificador de pagamento reutilizado com dados diferentes.');
    return {...state, duplicate: true};
  }
  const totalPaid = payments.reduce((s,p) => s+p.amountCents, 0);
  if (totalPaid + payment.amountCents > obligation.amountCents) throw Error('Pagamento superior ao saldo da obrigacao.');
  const newPayments = [...payments, {...payment, obligationId:obligation.id}];
  const paidCents = totalPaid + payment.amountCents;
  const status = paidCents === obligation.amountCents ? 'paid' : 'partially_paid';
  const delta = obligation.kind === 'income' ? payment.amountCents : -payment.amountCents;
  const entry = {userId: payment.userId, accountId:payment.accountId, requestId:payment.requestId,
    obligationId: obligation.id, deltaCents:delta, postedOn:payment.paidOn};
  return {obligation: {...obligation,status}, payments:newPayments,
    entries:[...(state.entries||[]), entry], duplicate:false};
}

export function realizedBalance(openingCents, entries, accountId) {
  if (!Number.isSafeInteger(openingCents)) throw Error('Saldo inicial invalido.');
  return entries.filter(e=>e.accountId===accountId).reduce((sum,e)=>sum+e.deltaCents,openingCents);
}

export function economicImpactOfPayment(obligationKind) {
  // Uma baixa financeira nao significa nova despesa economica.
  if (!['expense','income','card_invoice','legacy_debt'].includes(obligationKind)) throw Error('Tipo invalido.');
  return 0; // Despesa/receita reconhecida no fato gerador, nao novamente na baixa.
}
