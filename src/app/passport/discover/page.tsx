import CountryBrowser from "./CountryBrowser";
import { DISCOVERY_COUNTRIES } from "@/lib/passport-discovery";

export default function PassportDiscoverPage() {
  return <CountryBrowser initialCountries={DISCOVERY_COUNTRIES} />;
}
