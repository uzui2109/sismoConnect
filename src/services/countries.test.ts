import {
  countryLabel,
  getCountries,
  getCountryAt,
  getCountryByCode,
} from '@/services/countries';

describe('country lookup', () => {
  it('loads the Natural Earth dataset', () => {
    const countries = getCountries();
    expect(countries.length).toBeGreaterThan(150);
    expect(countries.filter((country) => country.code.length === 2).length).toBeGreaterThan(170);
    expect(new Set(countries.map((country) => country.code)).size).toBe(countries.length);
  });

  it('finds countries by ISO alpha-2 code', () => {
    expect(getCountryByCode('MX')?.name).toBe('México');
    expect(getCountryByCode('CL')?.name).toBe('Chile');
    expect(getCountryByCode('XX')).toBeNull();
    expect(getCountryByCode(null)).toBeNull();
    expect(getCountryByCode('')).toBeNull();
  });
});

describe('getCountryAt', () => {
  it('locates inland coordinates', () => {
    expect(getCountryAt(19.4326, -99.1332)?.code).toBe('MX');
    expect(getCountryAt(-33.4489, -70.6693)?.code).toBe('CL');
    expect(getCountryAt(40.4168, -3.7038)?.code).toBe('ES');
  });

  it('returns null for ocean and invalid coordinates', () => {
    expect(getCountryAt(0, -140)).toBeNull();
    expect(getCountryAt(Number.NaN, 0)).toBeNull();
    expect(getCountryAt(0, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('labels missing countries', () => {
    expect(countryLabel(null)).toBe('Sin país');
    expect(countryLabel(getCountryByCode('MX'))).toBe('México');
  });
});
