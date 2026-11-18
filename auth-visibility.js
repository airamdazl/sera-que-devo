/* Será Que Devo? UX14 — visibilidade opcional de senha.
   Somente interface: não altera Supabase, validação ou armazenamento de senhas.
   O reset por e-mail já tem seu próprio controle "Mostrar senhas". */
(()=>{
 'use strict';
 const eye='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
 const hidden='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.1A11 11 0 0 1 12 6c6.4 0 10 6 10 6a14 14 0 0 1-3.6 4.2"/><path d="M6.1 7.4A14.4 14.4 0 0 0 2 12s3.6 6 10 6a10.3 10.3 0 0 0 4.2-.9"/><path d="M10 10a3 3 0 0 0 4 4"/></svg>';
 const controls=[];
 function mount(input){
  if(!input||input.parentElement?.classList.contains('scd-password-field'))return;
  const frame=document.createElement('span');frame.className='scd-password-field';
  const btn=document.createElement('button');btn.type='button';btn.className='scd-password-toggle';
  btn.setAttribute('aria-label','Mostrar senha');btn.setAttribute('aria-pressed','false');btn.title='Mostrar senha';btn.innerHTML=eye;
  input.parentNode.insertBefore(frame,input);frame.append(input,btn);
  const conceal=()=>{input.type='password';btn.setAttribute('aria-pressed','false');btn.setAttribute('aria-label','Mostrar senha');btn.title='Mostrar senha';btn.innerHTML=eye};
  btn.addEventListener('click',()=>{
    if(input.type==='password'){input.type='text';btn.setAttribute('aria-pressed','true');btn.setAttribute('aria-label','Ocultar senha');btn.title='Ocultar senha';btn.innerHTML=hidden;}
    else conceal();
    input.focus({preventScroll:true});
  });
  controls.push(conceal);
 }
 function init(){
  document.querySelectorAll('#auth-form input[name="password"],#password-form input[name="password"],#password-form input[name="confirm"]').forEach(mount);
  document.querySelectorAll('[data-auth-mode]').forEach(btn=>btn.addEventListener('click',()=>controls.forEach(c=>c())));
  document.getElementById('auth-form')?.addEventListener('submit',()=>controls.forEach(c=>c()));
  document.getElementById('password-form')?.addEventListener('reset',()=>controls.forEach(c=>c()));
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
