import test from 'node:test';
import assert from 'node:assert/strict';
import {cents,distributeInstallments,dueDateInMonth,monthlyOccurrences,payObligation,realizedBalance,economicImpactOfPayment} from './05_regras_financeiras_lab_v0_2.mjs';
const initial = (kind='expense',amount=15000) => ({obligation:{id:'obrigacao-1',userId:'usuario-A',kind,amountCents:amount,status:'pending'},payments:[],entries:[]});
const payment = (amountCents=15000,requestId='op-1',userId='usuario-A') => ({userId,accountId:'conta-1',requestId,amountCents,paidOn:'2026-11-16'});

test('centavos e separadores pt-BR sem imprecisao monetaria',()=>{
  assert.equal(cents('1.234,56'),123456); assert.equal(cents('0,05'),5);
  assert.equal(cents('1200.00'),120000); assert.throws(()=>cents('1.2.3'));
});
test('parcelamento distribui centavos e preserva total',()=>{
  assert.deepEqual(distributeInstallments(10000,3),[3334,3333,3333]);
  assert.equal(distributeInstallments(10001,12).reduce((a,b)=>a+b,0),10001);
});
test('parcelamento rejeita quantidade/valor invalidos',()=>{
  assert.throws(()=>distributeInstallments(0,4)); assert.throws(()=>distributeInstallments(10,61));
});
test('recorrencia mensal respeita dia 31 e nao deriva de fevereiro',()=>{
  assert.equal(dueDateInMonth('2026-01-31',1),'2026-02-28');
  assert.equal(dueDateInMonth('2026-01-31',2),'2026-03-31');
});
test('recorrencia respeita ano bissexto',()=>assert.equal(dueDateInMonth('2024-01-31',1),'2024-02-29'));
test('recorrencia possui chave deterministica por competencia',()=>{
  const rows=monthlyOccurrences({ruleId:'regra-1',firstDue:'2026-01-31',count:3,amountCents:10000});
  assert.deepEqual(rows.map(x=>x.key),['regra-1:2026-01','regra-1:2026-02','regra-1:2026-03']);
  assert.equal(rows.every(x=>x.status==='pending'),true);
});
test('data invalida e quantidade enorme sao rejeitadas',()=>{
  assert.throws(()=>dueDateInMonth('2026-02-30',0));
  assert.throws(()=>monthlyOccurrences({ruleId:'a',firstDue:'2026-01-10',count:121,amountCents:100}));
});
test('pendencia nao altera saldo de conta sem baixa',()=>assert.equal(realizedBalance(100000,[],'conta-1'),100000));
test('baixa de despesa reduz saldo uma vez e marca paga',()=>{
  const next=payObligation(initial(),payment());
  assert.equal(next.obligation.status,'paid');
  assert.equal(realizedBalance(100000,next.entries,'conta-1'),85000);
});
test('baixa parcial registra somente valor efetivo',()=>{
  const next=payObligation(initial(),payment(5000));
  assert.equal(next.obligation.status,'partially_paid');
  assert.equal(realizedBalance(100000,next.entries,'conta-1'),95000);
});
test('finalizar pagamento parcial não duplica saldo',()=>{
  let state=payObligation(initial(),payment(5000,'op-1'));
  state=payObligation(state,payment(10000,'op-2'));
  assert.equal(state.obligation.status,'paid');
  assert.equal(realizedBalance(100000,state.entries,'conta-1'),85000);
});
test('reenvio igual e idempotente',()=>{
  const paid=payObligation(initial(),payment());
  const retried=payObligation(paid,payment());
  assert.equal(retried.duplicate,true);assert.equal(retried.entries.length,1);
});
test('reenvio com dados diferentes e rejeitado',()=>{
  const paid=payObligation(initial(),payment());
  assert.throws(()=>payObligation(paid,payment(1000)));
});
test('nao permite pagar mais que o valor devido',()=>assert.throws(()=>payObligation(initial(),payment(15001))));
test('nao aceita usuario de outra conta',()=>assert.throws(()=>payObligation(initial(),payment(15000,'op-1','usuario-B'))));
test('entrada confirmada aumenta saldo',()=>{
  const next=payObligation(initial('income'),payment());
  assert.equal(realizedBalance(100000,next.entries,'conta-1'),115000);
});
test('pagamento de fatura nao gera despesa economica duplicada',()=>{
  const next=payObligation(initial('card_invoice'),payment());
  assert.equal(realizedBalance(100000,next.entries,'conta-1'),85000);
  assert.equal(economicImpactOfPayment('card_invoice'),0);
});
test('pagamento do principal de divida antiga nao gera despesa economica nova',()=>{
  const next=payObligation(initial('legacy_debt'),payment());
  assert.equal(realizedBalance(100000,next.entries,'conta-1'),85000);
  assert.equal(economicImpactOfPayment('legacy_debt'),0);
});
