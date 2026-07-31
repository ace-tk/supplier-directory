const COUNTRY_FLAGS: Record<string, string> = {
  India: "🇮🇳",
  China: "🇨🇳",
  USA: "🇺🇸",
  Germany: "🇩🇪",
  Turkey: "🇹🇷",
  Vietnam: "🇻🇳",
  Bangladesh: "🇧🇩",
  "United Kingdom": "🇬🇧",
  UK: "🇬🇧",
  UAE: "🇦🇪",
  Italy: "🇮🇹",
  France: "🇫🇷",
  Japan: "🇯🇵",
  "South Korea": "🇰🇷",
  Taiwan: "🇹🇼",
  Canada: "🇨🇦",
  Australia: "🇦🇺",
};

export function countryFlag(country: string): string {
  return COUNTRY_FLAGS[country] ?? "🏳️";
}

// Indian city → state, for a cleaner single-line location display.
// Cities outside this map (or outside India) fall back to "City, Country".
const INDIAN_CITY_STATE: Record<string, string> = {
  Ahmedabad: "Gujarat",
  Amritsar: "Punjab",
  Bengaluru: "Karnataka",
  Jaipur: "Rajasthan",
  Kochi: "Kerala",
  Ludhiana: "Punjab",
  Mumbai: "Maharashtra",
  Nagpur: "Maharashtra",
  Pune: "Maharashtra",
  Surat: "Gujarat",
  Tiruppur: "Tamil Nadu",
};

export function formatLocation(city: string, country: string): string {
  const state = INDIAN_CITY_STATE[city];
  if (state && state !== city) return `${city}, ${state}, ${country}`;
  return `${city}, ${country}`;
}
