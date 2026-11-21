import {
  sakbeBuscadestinoCandidates,
  SAKBE_BUSCADESTINO_MAX_CHARS,
} from './sakbe-buscadestino-search.util';

describe('sakbeBuscadestinoCandidates', () => {
  it('prioriza municipio/estado y respeta el límite de caracteres', () => {
    const raw =
      'Obrera, Monterrey, Nuevo León con texto adicional que excede limite';
    const candidates = sakbeBuscadestinoCandidates(raw);
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(c.length).toBeLessThanOrEqual(SAKBE_BUSCADESTINO_MAX_CHARS);
    }
    expect(candidates.some((c) => /monterrey/i.test(c))).toBe(true);
  });
});