import config from '../config.js';

const FIDE_RATING_SERVER = 'https://ratings.fide.com';

/**
 * Envía un archivo TRF al servidor de ratings FIDE.
 * Retorna el response de FIDE.
 */
export async function submitTRF(tournamentId, trfContent, federationCode) {
  if (!config.fide.submitUrl) {
    throw new Error('FIDE submit URL no configurada');
  }

  const formData = new FormData();
  formData.append('file', new Blob([trfContent], { type: 'text/plain' }), `tournament_${tournamentId}.trf`);
  formData.append('federation', federationCode);
  formData.append('api_key', config.fide.apiKey);

  const res = await fetch(config.fide.submitUrl, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FIDE submit error ${res.status}: ${text}`);
  }

  return res.json();
}

/**
 * Verifica el estado de un envío.
 */
export async function checkSubmissionStatus(submissionId) {
  const url = `${config.fide.submitUrl}/status/${submissionId}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${config.fide.apiKey}` },
  });
  if (!res.ok) throw new Error(`FIDE status error: ${res.status}`);
  return res.json();
}
