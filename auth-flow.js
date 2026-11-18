/* Será Que Devo? UX12 — retorno seguro de links de autenticação.
 * Não registra tokens em console, não modifica dados financeiros e não redefine senha sem sessão de recuperação validada.
 * Complementa o fluxo do index.html; a troca de senha dentro da conta continua independente.
 */
(() => {
  'use strict';
  const query = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const intent = {
    action: query.get('auth_action'),
    type: fragment.get('type'),
    error: fragment.get('error') || query.get('error'),
    errorCode: fragment.get('error_code') || query.get('error_code'),
    hasImplicit: Boolean(fragment.get('access_token') && fragment.get('refresh_token')),
    // Guardar em memória apenas até a biblioteca Supabase processar o retorno.
    accessToken: fragment.get('access_token'),
    hasCode: Boolean(query.get('code')),
  };
  const isRecovery = intent.action === 'recovery' || intent.type === 'recovery';
  const isSignup = intent.action === 'signup' || intent.type === 'signup';
  let recoveryEventReceived = false;
  let recoveryLocked = isRecovery;
  let activeDB = null;

  const $ = id => document.getElementById(id);
  const cleanURL = () => {
    history.replaceState(history.state, '', window.location.pathname);
    intent.accessToken = null;
  };
  const message = text => {
    const box = $('auth-message');
    if (box) {
      box.textContent = text;
      box.setAttribute('role', 'status');
    }
  };

  const feedbackError = () => {
    const code = String(intent.errorCode || '');
    if (/expired|otp_expired|invalid|access_denied/i.test(code)) {
      return 'Este link expirou ou não pode mais ser utilizado. Digite seu e-mail e solicite um novo link.';
    }
    return 'Não foi possível confirmar este link. Solicite um novo e-mail e tente novamente.';
  };

  function bind(db) {
    activeDB = db;
    db.auth.onAuthStateChange((event) => {
      // É importante manter este callback síncrono: chamadas assíncronas aqui podem causar travamento.
      if (event === 'PASSWORD_RECOVERY') recoveryEventReceived = true;
    });
  }

  async function handleReturn(db, session, showLoggedOut) {
    if (!isRecovery && !intent.error) return false;
    showLoggedOut();

    if (intent.error) {
      message(feedbackError());
      cleanURL();
      recoveryLocked = false;
      return true;
    }

    // Implicit flow: a sessão deve conter exatamente o access token do link retornado.
    // PKCE: apenas um evento PASSWORD_RECOVERY originado do cliente confirma o fluxo.
    const validReturn = Boolean(session?.user && (
      (intent.hasImplicit && session.access_token === intent.accessToken && intent.type === 'recovery') ||
      (intent.hasCode && recoveryEventReceived)
    ));
    if (!validReturn) {
      message('Link de recuperação inválido ou expirado. Use “Esqueci minha senha” para receber outro.');
      cleanURL();
      recoveryLocked = false;
      return true;
    }

    const { data, error } = await db.auth.getUser();
    if (error || !data?.user || data.user.id !== session.user.id) {
      message('A sessão de recuperação não pôde ser validada. Solicite um novo link.');
      cleanURL();
      recoveryLocked = false;
      return true;
    }

    const dialog = $('scd-recovery-dialog');
    const form = $('scd-recovery-form');
    form.reset();
    $('scd-recovery-feedback').textContent = '';
    $('scd-recovery-done').hidden = true;
    form.hidden = false;
    updateStrength();
    dialog.showModal();
    cleanURL();
    return true;
  }

  function scorePassword(password) {
    if (!password) return {score:0,label:'Digite sua nova senha.'};
    const variety = [/[a-zá-ú]/i,/[A-ZÁ-Ú]/,/\d/,/[^\w\s]/].reduce((s,r)=>s+Number(r.test(password)),0);
    const score = Math.min(4, (password.length >= 8 ? 1 : 0) + (password.length >= 12 ? 1 : 0) + (variety >= 3 ? 1 : 0) + (variety === 4 ? 1 : 0));
    return {score,label:score <= 1 ? 'Senha fraca: use mais caracteres.' : score <= 2 ? 'Senha razoável: pode melhorar.' : score === 3 ? 'Boa senha!' : 'Senha forte!'};
  }

  function updateStrength() {
    const form = $('scd-recovery-form');
    if (!form) return;
    const pw = form.elements.password.value;
    const confirm = form.elements.confirm.value;
    const res = scorePassword(pw);
    $('scd-recovery-meter').value = res.score;
    $('scd-recovery-strength').textContent = res.label;
    $('scd-recovery-match').textContent = confirm ? (pw === confirm ? '✓ As senhas coincidem.' : 'As senhas ainda não coincidem.') : 'Repita a senha para confirmar.';
  }

  async function finish() {
    try {
      if (activeDB) await activeDB.auth.signOut({scope:'local'});
    } catch (_) { /* O retorno ao login ainda é seguro. */ }
    window.location.replace(window.location.origin + window.location.pathname);
  }

  async function submitRecovery(ev) {
    ev.preventDefault();
    if (!recoveryLocked || !activeDB) return;
    const form = ev.currentTarget;
    const password = form.elements.password.value;
    const confirm = form.elements.confirm.value;
    const feedback = $('scd-recovery-feedback');
    if (password.length < 8 || password.length > 128) {
      feedback.textContent = 'Use uma senha entre 8 e 128 caracteres.';
      return;
    }
    if (password !== confirm) {
      feedback.textContent = 'As senhas precisam ser iguais.';
      return;
    }
    const btn = $('scd-recovery-submit');
    btn.disabled = true;
    feedback.textContent = 'Atualizando sua senha com segurança…';
    try {
      const { error } = await activeDB.auth.updateUser({ password });
      if (error) throw error;
      form.reset();
      form.hidden = true;
      $('scd-recovery-done').hidden = false;
      feedback.textContent = 'Senha alterada com sucesso! Use a nova senha para entrar no aplicativo.';
    } catch (error) {
      feedback.textContent = /expired|session|token|jwt/i.test(String(error.message || '')) ?
        'Sua sessão expirou. Solicite outro e-mail de recuperação.' :
        'Não foi possível alterar a senha. Verifique os requisitos e tente novamente.';
    } finally {
      btn.disabled = false;
    }
  }

  async function resendConfirmation(db, email) {
    const input = String(email || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(input)) {
      message('Informe seu e-mail no campo acima para reenviar a confirmação.');
      return;
    }
    const button = $('scd-resend-confirmation');
    if (button) button.disabled = true;
    try {
      const { error } = await db.auth.resend({
        type: 'signup',
        email: input,
        options: {emailRedirectTo:window.location.origin + window.location.pathname + '?auth_action=signup'}
      });
      if (error) throw error;
      message('Se houver uma confirmação pendente para este endereço, enviaremos outro e-mail. Confira também Spam e Lixo Eletrônico.');
    } catch (error) {
      message(/rate|limit|frequent/i.test(String(error.message || '')) ?
        'Muitas tentativas seguidas. Aguarde um pouco antes de solicitar outro e-mail.' :
        'Não foi possível solicitar o reenvio agora. Confira o e-mail e tente novamente.');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function notifySignup(session, toast) {
    if (!isSignup) return;
    if (session?.user) {
      cleanURL();
      toast('E-mail confirmado! Bem-vindo ao Será Que Devo? 🐾');
    } else if (!intent.error) {
      message('Se você confirmou seu e-mail, faça login para continuar.');
      cleanURL();
    }
  }

  function installUI() {
    const form = $('scd-recovery-form');
    if (!form) return;
    form.addEventListener('input', updateStrength);
    form.addEventListener('submit', submitRecovery);
    const dialog = $('scd-recovery-dialog');
    dialog.addEventListener('cancel', e => e.preventDefault());
    $('scd-recovery-back').addEventListener('click',finish);
    $('scd-recovery-success-back').addEventListener('click',finish);
    $('scd-recovery-visibility').addEventListener('change', e => {
      for (const name of ['password','confirm']) form.elements[name].type = e.target.checked ? 'text' : 'password';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installUI, {once:true});
  else installUI();

  window.SCD_AUTH_FLOW = Object.freeze({bind, handleReturn, notifySignup, resendConfirmation,
    isRecoveryReturn: () => isRecovery,
    isHandlingRecovery: () => recoveryLocked
  });
})();
