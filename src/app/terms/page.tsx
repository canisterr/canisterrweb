import LegalDocument from "@/components/LegalDocument";
import { TERMS_VERSION } from "@/lib/legal-versions";

const effectiveDate = "November 26, 2026";

const sections = [
  {
    title: "1. Agreement and eligibility",
    body: [
      "By creating an account or using Canisterr, you agree to these Terms and the Privacy Policy. If you do not agree, do not create an account or use account features.",
      "Canisterr accounts are limited to people aged 18 or older. By accepting these Terms and creating an account, you confirm that you meet this age requirement. Do not create an account on behalf of a person under 18.",
    ],
  },
  {
    title: "2. Who can use Canisterr",
    body: [
      "You must provide accurate account details and keep your login credentials secure. You are responsible for activity under your account until you tell us it may be compromised.",
      "You may delete your account and request an export of your Canisterr data from Account settings.",
    ],
  },
  {
    title: "3. Your account",
    body: [
      "You are responsible for all activity that happens under your account.",
      "You may not create accounts using false information, impersonate another person, or use someone else’s account without permission.",
    ],
  },
  {
    title: "4. User content",
    body: [
      "You keep ownership of content you create, such as logs, reviews, comments, lists, and messages. You give Canisterr a non-exclusive, worldwide, royalty-free license to host, store, reproduce, display, transmit, and format that content only as needed to provide, secure, and maintain the features you use.",
      "This license ends when the content is removed from Canisterr, except for copies retained in backups, records required by law, or content already shared or copied by other users. We do not claim ownership of your writing or images.",
    ],
  },
  {
    title: "5. What you agree not to do",
    items: [
      "Use the service in a way that breaks the law or violates another person’s rights.",
      "Post hateful, harassing, abusive, threatening, sexually explicit, or otherwise harmful content.",
      "Share another person’s private information or content outside the audience they selected.",
      "Post material you do not have permission to use, including copyrighted posters, photographs, or text you upload yourself.",
      "Attempt to scrape, reverse engineer, attack, disrupt, or overload the service.",
      "Upload malware or anything designed to harm users, devices, or data.",
      "Use automation or bots in a way that interferes with normal use.",
    ],
  },
  {
    title: "6. Social features",
    body: [
      "Use privacy settings to control the audience for your profile, logs, lists, and activity. Do not assume that content set to public is confidential.",
      "We may review reports, remove content, limit features, suspend accounts, or preserve information when necessary to enforce these Terms, protect users, respond to valid legal requests, or meet legal duties. We will provide notice or a review path where required by law.",
    ],
  },
  {
    title: "7. Reports and copyright complaints",
    body: [
      "Report abuse, privacy issues, or illegal content to support@canisterr.com. Include the page or account involved, the relevant link or log ID, and enough detail for us to review it. We will acknowledge and handle complaints within applicable legal deadlines.",
      "For copyright complaints, identify the protected work and the Canisterr URL or content at issue, explain why you believe it infringes your rights, include your contact details, and confirm that your report is accurate and authorized. We may remove or restrict access to reported material and may restrict repeat infringers. A counter-notice or appeal can be sent to the same address.",
      "Canisterr uses third-party catalogs and services. Movie and television data and images may be supplied by TMDB or TVmaze; provider availability data is supplied via TMDB and JustWatch. These providers retain their own rights and terms. See the Credits page. This product uses the TMDB API but is not endorsed or certified by TMDB.",
    ],
  },
  {
    title: "8. Service changes and availability",
    body: [
      "We may update, change, suspend, or discontinue features for security, legal, or operational reasons, with notice where required.",
      "We do not guarantee that the service will always be available, uninterrupted, secure, or error free.",
    ],
  },
  {
    title: "9. Termination",
    body: [
      "You may stop using Canisterr at any time and delete your account in settings. We may restrict or terminate access for serious or repeated violations, security risks, or legal requirements. You may contact support to challenge an enforcement decision.",
    ],
  },
  {
    title: "10. Disclaimers and liability",
    body: [
      "Canisterr is provided on an \"as available\" basis. Movie metadata, ratings, credits, images, and streaming availability can be incomplete, delayed, or incorrect; streaming catalogs and prices are controlled by third parties.",
      "Nothing in these Terms excludes rights or remedies that cannot legally be excluded. Any limitation of liability applies only to the extent permitted by the law that applies to you.",
    ],
  },
  {
    title: "11. Contact and updates",
    body: [
      "For support, grievance, abuse, or copyright reports, contact support@canisterr.com. We will route reports to the Canisterr team responsible for review.",
      `These Terms version ${TERMS_VERSION} may be updated as Canisterr or applicable law changes. We will update the date and provide additional notice or ask for renewed acceptance where required.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      current="terms"
      title="Terms & Conditions"
      intro="These terms set out the rules for using Canisterr, including accounts, social features, and content you share."
      effectiveDate={effectiveDate}
      version={TERMS_VERSION}
      sections={sections}
    />
  );
}
