// A country is assigned to the side of Greenwich containing its map point.
// Derived from WORLD_COUNTRIES in world-map-data.ts (Natural Earth 1:50m).
const WEST = new Set([
  "AG", "AI", "AR", "AS", "AW", "BB", "BF", "BL", "BM", "BO", "BR", "BS",
  "BZ", "CA", "CI", "CK", "CL", "CO", "CR", "CU", "CV", "CW", "DM", "DO",
  "EC", "EH", "ES", "FK", "FO", "GB", "GD", "GG", "GH", "GL", "GM", "GN",
  "GS", "GT", "GW", "GY", "HN", "HT", "IE", "IM", "IS", "JE", "JM", "KI",
  "KN", "KY", "LC", "LR", "MA", "MF", "ML", "MR", "MS", "MX", "NI", "NU",
  "PA", "PE", "PF", "PM", "PN", "PR", "PT", "PY", "SH", "SL", "SN", "SR",
  "SV", "SX", "TC", "TO", "TT", "US", "UY", "VC", "VE", "VG", "VI", "WF",
  "WS",
]);
const EAST = new Set([
  "AD", "AE", "AF", "AL", "AM", "AO", "AT", "AU", "AX", "AZ", "BA", "BD",
  "BE", "BG", "BH", "BI", "BJ", "BN", "BT", "BW", "BY", "CD", "CF", "CG",
  "CH", "CM", "CN", "CY", "CZ", "DE", "DJ", "DK", "DZ", "EE", "EG", "ER",
  "ET", "FI", "FJ", "FM", "FR", "GA", "GE", "GQ", "GR", "GU", "HK", "HM",
  "HR", "HU", "ID", "IL", "IN", "IO", "IQ", "IR", "IT", "JO", "JP", "KE",
  "KG", "KH", "KM", "KP", "KR", "KW", "KZ", "LA", "LB", "LI", "LK", "LS",
  "LT", "LU", "LV", "LY", "MC", "MD", "ME", "MG", "MH", "MK", "MM", "MN",
  "MO", "MP", "MT", "MU", "MV", "MW", "MY", "MZ", "NA", "NC", "NE", "NF",
  "NG", "NL", "NO", "NP", "NR", "NZ", "OM", "PG", "PH", "PK", "PL", "PS",
  "PW", "QA", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD", "SE", "SG",
  "SI", "SK", "SM", "SO", "SS", "ST", "SY", "SZ", "TD", "TF", "TG", "TH",
  "TJ", "TL", "TM", "TN", "TR", "TV", "TW", "TZ", "UA", "UG", "UZ", "VA",
  "VN", "VU", "XK", "YE", "ZA", "ZM", "ZW",
]);

export function getCountryHemisphere(code: string | null): "west" | "east" | null {
  if (!code) return null;
  if (WEST.has(code)) return "west";
  if (EAST.has(code)) return "east";
  return null;
}
