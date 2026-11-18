/* Será Que Devo? UX10 · OCR local da calculadora de mercado.
   Leitura opt-in no dispositivo: nenhuma imagem enviada ao Supabase/OCR.space.
   Tesseract carregado sob demanda; texto e itens exigem revisão humana.
 */
(()=>{
'use strict';
const $=q=>document.querySelector(q);
const $$=q=>[...document.querySelectorAll(q)];
const price=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
const clean=x=>String(x??'').replace(/[<>\x00-\x1f]/g,' ').trim();
const brNumber=s=>{
 const v=String(s??'').replace(/R\$|\s/g,'').replace(/\.(?=\d{3}(?:,|$))/g,'').replace(',','.');
 const n=Number(v);return Number.isFinite(n)?n:null;
};
const model={lines:[], owner:null,processing:false,saving:false};
function parseReceipt(text){
 const rows=[];
 for(const original of String(text||'').split(/\r?\n/)){
  let line=original.trim().replace(/\s{2,}/g,' ');
  if(line.length<5||line.length>170||/\b(total|subtotal|troco|desconto|pago|pagamento|cartão|cartao|pix|cnpj|cpf|tributos|valor aprox|icms|caixa|fiscal|emitido|consumidor|chave de acesso|qr code|www\.|https?:|endereço|endereco|nfce|nfc-e|cupom)\b/i.test(line))continue;
  // Valores com vírgula são mais confiáveis em cupons brasileiros.
  const amounts=[...line.matchAll(/(?:R\$\s*)?(\d{1,5}(?:\.\d{3})*,\d{2})(?!\d)/g)];
  if(!amounts.length)continue;
  let total=brNumber(amounts[amounts.length-1][1]);
  if(total===null||total<=0||total>999999)continue;
  const textBefore=line.slice(0,amounts[0].index).replace(/^(?:\d{1,3}\s+)?(?:\d{8,14}\s+)?/, '').trim();
  const units=/\b(\d+(?:[.,]\d{1,3})?)\s*(kg|g|ml|l|lt|un|und|unid|pc|pct|cx|x)\b/i.exec(line);
  let quantity=units?brNumber(units[1]):1,unit=units?.[2]?.toLowerCase()||'un';
  if(unit==='lt')unit='L';else if(unit==='l')unit='L';else if(['und','unid','pc','x'].includes(unit))unit='un';else if(unit==='pct')unit='pacote';else if(unit==='cx')unit='caixa';
  if(!Number.isFinite(quantity)||quantity<=0||quantity>10000)quantity=1;
  // Se o preço unitário estiver explícito, validar o subtotal estimado.
  const unitExplicit=amounts.length>1?brNumber(amounts[amounts.length-2][1]):null;
  let unitPrice=unitExplicit&&Math.abs(unitExplicit*quantity-total)<0.03?unitExplicit:total/quantity;
  unitPrice=Math.round(unitPrice*100)/100;
  const name=textBefore.replace(/\b\d+(?:[.,]\d{1,3})?\s*(kg|g|ml|l|lt|un|und|unid|pc|pct|cx|x)\b.*$/i,'').replace(/\b(?:R\$|x)\s*$/i,'').trim().replace(/[.;:_\-]+$/,'');
  if(name.length<2||!/[a-zá-ú]/i.test(name))continue;
  rows.push({name:name.slice(0,100),quantity:Math.round(quantity*1000)/1000,unit,unit_price:unitPrice,category:'Outros'});
  if(rows.length>=30)break;
 }
 return rows;
}
function status(message,isError=false){const el=$('#sqd-ocr-status');if(el){el.textContent=message;el.style.color=isError?'var(--bad)':'var(--muted)';}}
function updateReviewTotals(){
 const rows=$$('#sqd-ocr-rows .sqd-market-ocr-row');let checked=0,total=0;
 for(const row of rows){
  const quantity=Number(row.querySelector('[data-col="quantity"]')?.value||0);
  const unitPrice=Number(row.querySelector('[data-col="unit_price"]')?.value||0);
  const value=Number.isFinite(quantity)&&Number.isFinite(unitPrice)&&quantity>0&&unitPrice>=0?quantity*unitPrice:0;
  const valueEl=row.querySelector('.sqd-ocr-row-total');if(valueEl)valueEl.textContent=price(value);
  const include=row.querySelector('[data-col="include"]')?.checked;
  row.classList.toggle('sqd-ocr-not-selected',!include);
  if(include){checked++;total+=value;}
 }
 const summary=$('#sqd-ocr-summary');if(summary)summary.textContent=`${checked} produto(s) marcado(s) · Subtotal estimado: ${price(total)}`;
 const count=$('#sqd-ocr-rows-label');if(count)count.textContent=rows.length?`${rows.length} produto(s) encontrado(s). Confira cada linha antes de adicionar à lista.`:'Nenhum produto reconhecido. Use “+ Adicionar produto” para preencher manualmente.';
}
function renderRows(){
 const box=$('#sqd-ocr-rows');if(!box)return;
 const makeField=(title,control,extraClass='')=>{
  const label=document.createElement('label');label.className='sqd-ocr-field '+extraClass;
  const caption=document.createElement('span');caption.className='sqd-ocr-field-label';caption.textContent=title;
  label.append(caption,control);return label;
 };
 box.replaceChildren();for(const [i,r] of model.lines.entries()){
  const row=document.createElement('article');row.className='sqd-market-ocr-row';row.dataset.ix=String(i);
  const top=document.createElement('div');top.className='sqd-ocr-card-top';
  const toggle=document.createElement('label');toggle.className='sqd-ocr-include';
  const check=document.createElement('input');check.type='checkbox';check.checked=true;check.dataset.col='include';check.setAttribute('aria-label','Incluir produto '+(i+1));
  const labelText=document.createElement('span');labelText.textContent='Produto '+(i+1);toggle.append(check,labelText);
  const subtotal=document.createElement('div');subtotal.className='sqd-ocr-total';subtotal.append('Subtotal: ');
  const subtotalPrice=document.createElement('strong');subtotalPrice.className='sqd-ocr-row-total';subtotal.append(subtotalPrice);top.append(toggle,subtotal);
  const fields=document.createElement('div');fields.className='sqd-ocr-fields';
  const name=document.createElement('input');name.type='text';name.value=r.name;name.maxLength=100;name.dataset.col='name';name.placeholder='Nome do produto';name.setAttribute('aria-label','Descrição do produto '+(i+1));
  const qty=document.createElement('input');qty.type='number';qty.min='0.001';qty.step='0.001';qty.inputMode='decimal';qty.value=String(r.quantity);qty.dataset.col='quantity';qty.setAttribute('aria-label','Quantidade '+(i+1));
  const unit=document.createElement('select');unit.dataset.col='unit';unit.setAttribute('aria-label','Unidade '+(i+1));
  for(const option of ['un','kg','g','L','ml','pacote','caixa']){const el=document.createElement('option');el.value=option;el.textContent=option;unit.append(el)}unit.value=r.unit;
  const amount=document.createElement('input');amount.type='number';amount.min='0';amount.step='0.01';amount.inputMode='decimal';amount.value=String(r.unit_price);amount.dataset.col='unit_price';amount.setAttribute('aria-label','Preço por unidade '+(i+1));
  const category=document.createElement('select');category.dataset.col='category';category.setAttribute('aria-label','Categoria '+(i+1));for(const value of ['Outros','Alimentos','Hortifruti','Limpeza','Higiene']){const option=document.createElement('option');option.value=value;option.textContent=value;category.append(option)}category.value=r.category||'Outros';
  fields.append(makeField('Descrição',name,'sqd-ocr-field-name'),makeField('Quantidade',qty),makeField('Unidade',unit),makeField('Preço unitário (R$)',amount),makeField('Categoria',category,'sqd-ocr-field-category'));
  row.append(top,fields);row.addEventListener('input',updateReviewTotals);row.addEventListener('change',updateReviewTotals);box.append(row);
 }
 updateReviewTotals();
}
function createDialog(){const host=$('#view-market');if(!host||$('#sqd-market-ocr-dialog'))return;
 const h=host.querySelector('.view-intro');if(h){const b=document.createElement('button');b.type='button';b.className='sqd-market-help-button';b.textContent='❔ Como usar';b.id='sqd-market-help-launch';h.append(b);}
 const intro=host.querySelector('.view-intro');if(intro){const btn=document.createElement('button');btn.type='button';btn.id='sqd-market-ocr-launch';btn.className='sqd-market-ocr-launch';btn.textContent='📷 Ler cupom com OCR';intro.append(btn);}
 host.insertAdjacentHTML('beforeend',`<dialog id="sqd-market-help-dialog" class="sqd-market-report-dialog" aria-labelledby="sqd-market-help-title"><div class="sqd-market-report-form"><div class="sqd-market-modal-top"><h3 id="sqd-market-help-title">🐾 Ajuda da Pandora · Mercado</h3><button type="button" class="sqd-market-icon-close" data-ux10-close aria-label="Fechar ajuda">×</button></div><div class="sqd-market-help-content"><p><strong>1. Monte a lista.</strong> Digite produto, quantidade, unidade e preço por unidade. Ex.: 0,5 kg × R$ 25,00 = R$ 12,50.</p><p><strong>2. Use a calculadora.</strong> O subtotal é atualizado antes de salvar; seus itens ficam em “Minha lista”.</p><p><strong>3. Finalize uma compra.</strong> Escolha a conta, informe o nome do mercado, marque apenas os itens comprados e toque em “Registrar compra”. O app registra uma despesa e guarda os itens no histórico.</p><p><strong>4. Exporte do histórico.</strong> No fim do Mercado há botões CSV e PDF, com filtros de datas, estabelecimento e produtos. A lista ainda não comprada não entra nesses arquivos.</p><p><strong>5. OCR (opcional).</strong> Tire uma foto legível do cupom ou escolha uma imagem. Revise as sugestões antes de adicioná-las à lista. OCR pode errar preços, quantidades ou nomes.</p><p class="sqd-market-ocr-explainer">🔒 As imagens são analisadas no dispositivo. O mecanismo de leitura baixa arquivos de processamento pela internet quando necessário; não enviamos a foto para o Supabase.</p></div><button type="button" class="btn primary" data-ux10-close>Entendi!</button></div></dialog>
<dialog id="sqd-market-ocr-dialog" class="sqd-market-report-dialog" aria-labelledby="sqd-market-ocr-title"><div class="sqd-market-report-form"><div class="sqd-market-modal-top"><div><span class="sqd-market-eyebrow">LEITURA DE CUPOM · REVISÃO OBRIGATÓRIA</span><h3 id="sqd-market-ocr-title">📷 Ler cupom com a Pandora</h3><p>Você escolhe o que adicionar à lista. Nenhuma compra ou despesa é registrada automaticamente.</p></div><button type="button" class="sqd-market-icon-close" data-ux10-close aria-label="Fechar OCR">×</button></div><div class="sqd-market-ocr-actions"><button class="btn ghost" id="sqd-ocr-camera" type="button">📸 Tirar foto</button><button class="btn ghost" id="sqd-ocr-gallery" type="button">🖼️ Escolher imagem</button></div><input class="sqd-market-ocr-file" id="sqd-ocr-photo-camera" type="file" accept="image/png,image/jpeg,image/webp" capture="environment"><input class="sqd-market-ocr-file" id="sqd-ocr-photo-gallery" type="file" accept="image/png,image/jpeg,image/webp"><p id="sqd-ocr-status" class="sqd-market-ocr-explainer" role="status" aria-live="polite">Use uma foto nítida, bem iluminada e sem dados pessoais desnecessários.</p><div class="sqd-ocr-review-heading"><h4>🧾 Revise os produtos</h4><p id="sqd-ocr-rows-label">Os produtos reconhecidos aparecerão aqui, separados por descrição e valor.</p></div><div id="sqd-ocr-rows" class="sqd-market-ocr-candidates"></div><p id="sqd-ocr-summary" class="sqd-ocr-summary" aria-live="polite">0 produto(s) marcado(s) · Subtotal estimado: R$ 0,00</p><div class="sqd-market-ocr-actions"><button type="button" class="btn ghost" id="sqd-ocr-add-row">+ Adicionar produto</button><button type="button" class="btn primary" id="sqd-ocr-save">Adicionar selecionados à lista</button></div><small class="sqd-market-ocr-explainer">Confira os valores e o tipo de unidade. O OCR não identifica automaticamente se o preço já inclui descontos nem valida documentos fiscais. Se faltar um item, adicione manualmente.</small></div></dialog>`);
 $('#sqd-market-help-launch')?.addEventListener('click',()=>$('#sqd-market-help-dialog').showModal());
 $('#sqd-market-ocr-launch')?.addEventListener('click',()=>{model.owner=window.SCD_BRIDGE?.user?.id||null;model.lines=[];renderRows();status('Selecione uma imagem para começar.');$('#sqd-market-ocr-dialog').showModal()});
 host.querySelectorAll('[data-ux10-close]').forEach(el=>el.addEventListener('click',()=>el.closest('dialog')?.close()));
 $('#sqd-ocr-camera').addEventListener('click',()=>$('#sqd-ocr-photo-camera').click());
 $('#sqd-ocr-gallery').addEventListener('click',()=>$('#sqd-ocr-photo-gallery').click());
 for(const id of ['#sqd-ocr-photo-camera','#sqd-ocr-photo-gallery'])$(id).addEventListener('change',e=>readPhoto(e.target.files?.[0]));
 $('#sqd-ocr-add-row').addEventListener('click',()=>{if(model.lines.length>=30)return status('Limite de 30 itens por leitura.',true);model.lines.push({name:'',quantity:1,unit:'un',unit_price:0,category:'Outros'});renderRows();});
 $('#sqd-ocr-save').addEventListener('click',saveSelected);
}
function scriptTesseract(){return new Promise((resolve,reject)=>{
 if(window.Tesseract?.createWorker)return resolve();
 const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';script.async=true;script.crossOrigin='anonymous';script.onload=()=>window.Tesseract?.createWorker?resolve():reject(Error('Mecanismo OCR indisponível.'));script.onerror=()=>reject(Error('Não foi possível baixar o leitor de imagem. Verifique sua conexão.'));document.head.append(script);
})}
async function readPhoto(file){
 if(!file)return;if(model.processing)return;
 if(!/^image\/(jpeg|png|webp)$/.test(file.type))return status('Escolha uma imagem JPG, PNG ou WebP. Arquivos PDF e HEIC não são suportados aqui.',true);
 if(file.size>8*1024*1024)return status('Imagem muito grande. Use uma foto com até 8 MB.',true);
 if(!window.SCD_BRIDGE?.user?.id)return status('Entre na conta antes de ler uma nota.',true);
 const owner=window.SCD_BRIDGE.user.id;model.processing=true;const btn=$('#sqd-ocr-save');btn.disabled=true;let worker;
 try{
  status('Preparando leitor local. Na primeira utilização, é necessário baixar o idioma português…');
  await scriptTesseract();
  worker=await window.Tesseract.createWorker('por',1,{logger:x=>{if(x.status==='recognizing text')status('Lendo texto da imagem… '+Math.round((x.progress||0)*100)+'%')}});
  const result=await worker.recognize(file);if(owner!==window.SCD_BRIDGE?.user?.id)throw Error('Sua sessão mudou. Entre novamente.');
  const text=String(result?.data?.text||'').slice(0,15000);
  model.lines=parseReceipt(text);renderRows();
  status(model.lines.length?`Leitura concluída. ${model.lines.length} produto(s) sugerido(s). Verifique tudo antes de adicionar.`:'Não consegui identificar produtos com segurança. Use “+ Adicionar produto” para completar a revisão manualmente.');
 }catch(e){status(e?.message||'Falha ao reconhecer a imagem. Tente uma foto com melhor iluminação.',true)}
 finally{try{await worker?.terminate()}catch{}model.processing=false;btn.disabled=false;for(const id of ['#sqd-ocr-photo-camera','#sqd-ocr-photo-gallery'])$(id).value='';}
}
async function saveSelected(){
 if(model.processing||model.saving)return;
 const bridge=window.SCD_BRIDGE,uid=bridge?.user?.id;
 if(!uid||uid!==model.owner)return status('Sessão não confirmada. Feche a janela, entre novamente e tente de novo.',true);
 const rows=[];for(const row of $$('#sqd-ocr-rows .sqd-market-ocr-row')){
  if(!row.querySelector('[data-col="include"]').checked)continue;
  const val=col=>row.querySelector('[data-col="'+col+'"]').value;
  const name=clean(val('name')).slice(0,100),quantity=Number(val('quantity')),unit=val('unit'),unit_price=Number(val('unit_price'));
  if(name.length<2||!Number.isFinite(quantity)||quantity<=0||quantity>10000||Math.round(quantity*1000)/1000!==quantity||!Number.isFinite(unit_price)||unit_price<0||Math.round(unit_price*100)/100!==unit_price)return status('Revise nome, quantidade (até 3 casas) e preço unitário (2 casas) de cada item marcado.',true);
  rows.push({user_id:uid,name,quantity,unit,unit_price,category:val('category')||'Outros',checked:false,date:(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})()});
 }
 if(!rows.length)return status('Marque ao menos um item para adicionar à lista.',true);
 if(rows.length>30)return status('Adicione no máximo 30 itens por leitura.',true);
 model.saving=true;const button=$('#sqd-ocr-save');button.disabled=true;
 try{const result=await bridge.db.from('market_items').insert(rows);if(result.error)throw result.error;
  await bridge.fetchAll();status(rows.length+' itens adicionados à lista. Revise os produtos antes de registrar a compra.');$('#sqd-market-ocr-dialog').close();bridge.toast(rows.length+' itens adicionados à sua lista.');
  model.lines=[];
 }catch(e){status('Não foi possível adicionar os itens. Nenhum novo envio será feito automaticamente. Verifique a conexão e tente novamente.',true)}
 finally{model.saving=false;button.disabled=false;}
}
window.SCD_MARKET_OCR_PARSE=parseReceipt;
window.addEventListener('load',createDialog);
})();
