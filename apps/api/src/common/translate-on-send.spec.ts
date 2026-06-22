import { normalizeOriginal } from './translate-on-send';

describe('normalizeOriginal (translate-on-send persistence rules)', () => {
  const BODY = 'Hola';

  it('stores originalBody + originalLang when a real translation happened', () => {
    expect(normalizeOriginal(BODY, { originalBody: 'Hello', originalLang: 'auto' })).toEqual({
      originalBody: 'Hello',
      originalLang: 'auto',
    });
  });

  it('drops originalBody when it is blank (edge case 4)', () => {
    expect(normalizeOriginal(BODY, { originalBody: '   ', originalLang: 'auto' })).toEqual({
      originalBody: null,
      originalLang: null,
    });
  });

  it('drops originalBody when it equals the stored body (edge case 3)', () => {
    expect(normalizeOriginal(BODY, { originalBody: BODY, originalLang: 'auto' })).toEqual({
      originalBody: null,
      originalLang: null,
    });
  });

  it('returns nulls when no original is provided (edge cases 1/2/5)', () => {
    expect(normalizeOriginal(BODY)).toEqual({ originalBody: null, originalLang: null });
    expect(normalizeOriginal(BODY, {})).toEqual({ originalBody: null, originalLang: null });
  });

  it('keeps originalBody but nulls a blank originalLang', () => {
    expect(normalizeOriginal(BODY, { originalBody: 'Hello' })).toEqual({
      originalBody: 'Hello',
      originalLang: null,
    });
  });
});
