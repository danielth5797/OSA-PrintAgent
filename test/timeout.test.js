// Auditoría (2026-10-01) — ver `src/timeout.js`: `withTimeout` es lo que
// garantiza que un trabajo colgado (impresora pausada/puerto serial sin
// respuesta) libere el `await` de `pollOnce` en vez de congelar el sondeo
// entero del agente.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout } from '../src/timeout.js';

describe('withTimeout', () => {
  test('resuelve con el valor real si la promesa termina antes del límite', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 1000, 'no debería dispararse');
    assert.equal(result, 'ok');
  });

  test('rechaza con el mensaje real si la promesa de verdad falla antes del límite', async () => {
    await assert.rejects(
      () => withTimeout(Promise.reject(new Error('falla real')), 1000, 'no debería dispararse'),
      /falla real/
    );
  });

  test('rechaza con el mensaje del timeout si la promesa nunca se resuelve', async () => {
    const neverSettles = new Promise(() => {}); // simula exactamente el hang real (execFile/writeFile colgado)
    await assert.rejects(() => withTimeout(neverSettles, 30, 'tiempo de espera agotado'), /tiempo de espera agotado/);
  });
});
