// No credentials in query strings, storage, analytics, or third-party scripts.
// This page contacts the approval API only when opened with a complete email token.
const endpoint = 'https://kktwqwppyxerrsusgqsp.supabase.co/functions/v1/unit_request_alert';

export async function initUnitRequest({ document, location, fetch }) {
  const heading = document.getElementById('heading');
  const message = document.getElementById('message');
  const name = document.getElementById('unit-name');
  const button = document.getElementById('confirm');
  const reasonFields = document.getElementById('reason-fields');
  const reasonCode = document.getElementById('reason-code');
  const reasonDetails = document.getElementById('reason-details');
  const reasonLabel = document.getElementById('reason-label');
  const reasonError = document.getElementById('reason-error');
  const savedReason = document.getElementById('decision-reason');
  const params = new URLSearchParams(location.hash.slice(1));
  const token = Object.fromEntries(['id','action','exp','t'].map(key => [key, params.get(key)]));
  let busy = false;
  let nextMode = 'preview';
  let needsReason = false;
  const show = (title, text) => { heading.textContent = title; message.textContent = text; };
  const offer = (text, mode) => { button.textContent = text; button.hidden = false; nextMode = mode; };
  const errors = {
    expired: 'This email link has expired. Request a fresh link to continue.',
    invalid_link: 'This link could not be verified. Open the original request email and try again.',
    not_found: 'This request is no longer available. You can close this page.',
    origin_not_allowed: 'Open this page using the link in your original request email.',
  };

  async function submit(mode) {
    if (busy) return;
    const extra = {};
    if (mode === 'decide' && needsReason) {
      const code = reasonCode.value;
      const details = reasonDetails.value.trim();
      let error = '';
      if (!['already_listed','name_unclear','unable_to_verify','unsupported_unit','other'].includes(code)) error = 'Choose a reason before declining.';
      else if (code === 'other' && !details) error = 'Write an explanation for the requester.';
      else if (details.length > 500) error = 'Keep the explanation to 500 characters or fewer.';
      if (error) {
        reasonError.textContent = error;
        reasonError.hidden = false;
        (code ? reasonDetails : reasonCode).focus();
        return;
      }
      extra.reason_code = code;
      extra.reason_details = details;
    }
    busy = true;
    button.disabled = true;
    reasonCode.disabled = true;
    reasonDetails.disabled = true;
    reasonError.hidden = true;
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...token, mode, ...extra }), credentials: 'omit',
        referrerPolicy: 'no-referrer', cache: 'no-store', signal: AbortSignal.timeout(25000),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        if (data.error === 'already_decided') {
          show('Request already decided', 'This request was already ' + (data.status === 'approved' ? 'approved' : 'rejected') + '. You can close this page.');
          button.hidden = true;
          reasonFields.hidden = true;
          return;
        }
        if (errors[data.error]) {
          show('Unable to open request', errors[data.error]);
          button.hidden = true;
          reasonFields.hidden = true;
          return;
        }
        if (data.error === 'reason_required') {
          reasonError.textContent = 'Choose a reason and add an explanation if you selected Other.';
          reasonError.hidden = false;
          return;
        }
        throw new Error('request unavailable');
      }
      // Unit names are untrusted text; never interpret them as HTML.
      name.textContent = data.name || '';
      savedReason.hidden = data.status !== 'rejected' || !data.reason;
      savedReason.textContent = data.status === 'rejected' && data.reason ? 'Reason: ' + data.reason : '';
      needsReason = data.status === 'pending' && token.action === 'reject';
      reasonFields.hidden = !needsReason;
      if (data.status === 'pending') {
        const approve = token.action === 'approve';
        // The page can publish before the API. Do not let an older API silently
        // discard the owner's explanation during that deployment interval.
        if (!approve && data.decline_reasons !== true) {
          needsReason = false;
          reasonFields.hidden = true;
          show('Unable to load decline options', 'Tap Check again to load the available reasons. Nothing has been changed.');
          offer('Check again', 'preview');
          return;
        }
        show(approve ? 'Approve this unit?' : 'Decline this request?',
          approve ? 'Add this unit to Cadet AI and confirm the request. We will email the cadet once it is approved.'
            : 'Choose a reason below. The unit will not be added, and we will email the requester your explanation.');
        offer(approve ? 'Confirm approval' : 'Confirm decline', 'decide');
      } else if (data.status === 'approved') {
        const notes = {
          sent: 'The request is approved and the confirmation email has been sent. You can close this page.',
          pending: 'The request is approved. The confirmation email could not be confirmed yet. Wait two minutes, then tap Retry email.',
          unavailable: 'The request is approved. This account has no confirmed email address available, so we could not send a confirmation.',
          review: 'The request is approved. Email delivery needs checking before another email can be sent. Contact support@cadetai.co.uk.',
        };
        show('Unit approved', notes[data.notification] || 'This request has already been approved. You can check whether its confirmation email has been sent.');
        button.hidden = true;
        if (data.notification === 'pending' || (!data.notification && token.action === 'approve')) {
          offer(data.notification ? 'Retry email' : 'Check confirmation email', 'decide');
        }
      } else if (data.status === 'rejected') {
        const notes = {
          sent: 'The request is declined and the email with your explanation has been sent. You can close this page.',
          pending: 'The request is declined. The email could not be confirmed yet. Wait two minutes, then tap Retry email.',
          unavailable: 'The request is declined. This account has no confirmed email address available, so we could not send the explanation.',
          review: 'The request is declined. Email delivery needs checking before another email can be sent. Contact support@cadetai.co.uk.',
        };
        show('Request declined', notes[data.notification] || (data.reason
          ? 'This request has already been declined. You can check whether its explanation email has been sent.'
          : 'This request has already been declined. No explanation was recorded for it.'));
        button.hidden = true;
        if (token.action === 'reject' && data.reason && (data.notification === 'pending' || !data.notification)) {
          offer(data.notification ? 'Retry email' : 'Check explanation email', 'decide');
        }
      } else throw new Error('unexpected status');
    } catch {
      show('Connection interrupted', 'We could not check the result. Tap Try again to check safely; an approval will not be applied twice.');
      offer('Try again', mode);
    } finally {
      busy = false;
      button.disabled = false;
      reasonCode.disabled = false;
      reasonDetails.disabled = false;
    }
  }
  button.addEventListener('click', () => submit(nextMode));
  reasonCode.addEventListener('change', () => {
    reasonLabel.textContent = reasonCode.value === 'other' ? 'Explanation for the requester (required)' : 'Extra details (optional)';
    reasonDetails.required = reasonCode.value === 'other';
    reasonError.hidden = true;
  });
  reasonDetails.addEventListener('input', () => { reasonError.hidden = true; });
  if (!/^[0-9a-f-]{36}$/i.test(token.id || '') ||
      !['approve','reject'].includes(token.action) ||
      !/^\d+$/.test(token.exp || '') || !/^[0-9a-f]{64}$/i.test(token.t || '')) {
    show('Open your request email', 'Use the Accept or Reject button in your Cadet AI request email to open this page.');
    button.hidden = true;
    return;
  }
  await submit('preview');
}

if (typeof document !== 'undefined') {
  // Browsers can reuse this document when another email changes only the hash.
  // Reload so a previous request's button/state can never action the new link.
  window.addEventListener('hashchange', () => window.location.reload());
  void initUnitRequest({ document, location: window.location, fetch: window.fetch.bind(window) });
}
