import { COUNTRY_NAME_TO_CODE } from "./passport-country-codes";

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", GB: "United Kingdom", KR: "South Korea",
  CZ: "Czech Republic", TW: "Taiwan", IR: "Iran", VN: "Vietnam",
};

const namesByCode = new Map<string, string>();
for (const [name, code] of Object.entries(COUNTRY_NAME_TO_CODE)) {
  const previous = namesByCode.get(code);
  if (!previous || (previous.includes(".") && !name.includes("."))) {
    namesByCode.set(code, name);
  }
}

export const DISCOVERY_COUNTRIES = [...namesByCode.keys()]
  .filter((code) => /^[A-Z]{2}$/.test(code) && code !== "AQ")
  .map((code) => ({ code, name: COUNTRY_NAMES[code] || namesByCode.get(code) || code }))
  .sort((a, b) => {
    const first = a.name.toLowerCase();
    const second = b.name.toLowerCase();
    return first < second ? -1 : first > second ? 1 : a.code < b.code ? -1 : 1;
  });

export function getDiscoveryCountry(code: string) {
  return DISCOVERY_COUNTRIES.find((country) => country.code === code.toUpperCase()) || null;
}

export function getDiscoveryCountryHref(code: string) {
  return `/passport/discover/${code.toLowerCase()}`;
}
