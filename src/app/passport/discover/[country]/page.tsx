import { notFound } from "next/navigation";
import { getDiscoveryCountry } from "@/lib/passport-discovery";
import CountryMovies from "./CountryMovies";

export default async function PassportCountryPage({ params }: { params: Promise<{ country: string }> }) {
  const { country: code } = await params;
  const country = getDiscoveryCountry(code);
  if (!country) notFound();
  return <CountryMovies country={country} />;
}
