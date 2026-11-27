import LegalDocument from "@/components/LegalDocument";
import { PRIVACY_POLICY_VERSION } from "@/lib/legal-versions";

const effectiveDate = "November 26, 2026";

const sections = [
  {
    title: "1. Information Canisterr handles",
    items: [
      "Account details such as your username, display name, email address, and profile image.",
      "Content you create, including logs, comments, lists, reactions, follows, messages, and shared items.",
      "Taste preferences and derived recommendations based on your logged titles and ratings.",
      "Device and service data such as authentication identifiers, push tokens when enabled, request logs, timestamps, and diagnostic information.",
    ],
  },
  {
    title: "2. Why we use it",
    items: [
      "Create and manage your account.",
      "Show your profile, logs, lists, followers, and related social activity.",
      "Build taste summaries and recommendations from the titles and ratings you choose to record.",
      "Send notifications and emails you opt into.",
      "Improve performance, diagnose issues, and protect the service from abuse.",
      "Respond to support requests and account issues.",
    ],
  },
  {
    title: "3. Legal grounds and service providers",
    body: [
      "We use account information to provide the service you request, use consent where required, and process limited technical information for security, reliability, and legal obligations. The legal ground depends on your location and the specific processing.",
      "Canisterr uses Firebase services from Google for authentication, database storage, and push delivery; TMDB for film, television, and watch-provider metadata (including JustWatch-sourced availability data); TVmaze for television metadata; and the configured hosting and email providers to operate the service. These providers process information under their own terms and applicable service agreements.",
      "We do not sell personal information for money. We do not currently run behavior-based advertising. If that changes, we will update this policy and obtain any consent required by law before enabling it.",
    ],
  },
  {
    title: "4. Who can see your content",
    body: [
      "Privacy settings let you choose the intended audience for your profile, lists, logs, and activity. Some older app data paths and database access rules are still being migrated to enforce these choices consistently. Until that migration is complete, do not treat a private setting as a guarantee that content is inaccessible to every other signed-in account. The movie page’s Watched by section is designed to show only accepted accounts you follow, but this does not close other direct database access paths.",
      "Content you choose to make public may be accessible to other users and may be indexed or copied outside Canisterr. Other users can screenshot or share information they can see. Changing a setting cannot remove copies already made elsewhere.",
    ],
  },
  {
    title: "5. Cookies and local storage",
    body: [
      "Canisterr uses browser storage and similar technologies for sign-in, user preferences, search history, and service functionality. Optional analytics are not loaded unless you select Allow. You can reject analytics or change your choice later in Privacy settings on that device. If allowed, usage data is processed by our analytics provider under its own terms. Essential sign-in and security technologies remain active. We do not currently run behavioral advertising.",
      "You can clear browser storage in your browser settings. Doing so may sign you out or reset preferences stored on that device.",
    ],
  },
  {
    title: "6. Retention and deletion",
    body: [
      "We keep account information and content while your account is active and as needed to provide the service. You can request an export or permanently delete your account in Account settings. Deletion removes associated account content from the live database; encrypted backups and security records may persist until their scheduled expiry or for a longer period required by law.",
      "Technical and security records are held only as long as needed for the stated purposes or as required by law. Retention periods depend on the record and provider. Before operating in a jurisdiction that imposes specific log-retention duties, Canisterr must configure those periods and disclose the applicable details here. For example, CERT-In directions require covered entities to retain ICT logs for a rolling 180 days and report specified cyber incidents within six hours.",
    ],
  },
  {
    title: "7. Security and incidents",
    body: [
      "We use access controls and technical safeguards intended to protect account data. No online service can guarantee perfect security. If a reportable incident occurs, we will follow the notification duties that apply to us, which may include notifying regulators and affected people.",
      "Keep your password private and use a unique password. Contact support promptly if you believe your account is compromised.",
    ],
  },
  {
    title: "8. Your rights and choices",
    items: [
      "Update account details, privacy settings, and notification preferences in the app.",
      "Download a JSON export of account data from Account settings.",
      "Request access, correction, deletion, withdrawal of consent, or other rights available under the privacy law that applies to you by emailing support@canisterr.com.",
      "We may need to verify your account before acting on a request. We respond within the time limits required by applicable law and explain if a request cannot be fulfilled.",
    ],
  },
  {
    title: "9. Age eligibility",
    body: [
      "Canisterr accounts are limited to people aged 18 or older under our Terms. Do not create an account for someone under 18 or provide a child’s personal information. If you believe a child has provided information, contact support so we can review and remove it where appropriate.",
      "This age restriction is a product safeguard, not a substitute for legally required age assurance or parental-consent procedures. We will not knowingly profile or behaviorally monitor children.",
    ],
  },
  {
    title: "10. International processing",
    body: [
      "Canisterr and its service providers may process data in countries other than the one where you live. Where required, we will use an approved transfer mechanism and additional safeguards. Contact support for information about transfers relevant to your request.",
    ],
  },
  {
    title: "11. Complaints and changes",
    body: [
      "For privacy questions or complaints, contact Canisterr Support at support@canisterr.com. We will route privacy and content complaints to the person responsible for handling them.",
      `This policy version is ${PRIVACY_POLICY_VERSION}. We may update it as the service or applicable law changes. We will update the effective date and provide additional notice or obtain consent where required.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      current="privacy"
      title="Privacy Policy"
      intro="This policy describes what information Canisterr uses, what we use it for, and the choices available to you."
      effectiveDate={effectiveDate}
      version={PRIVACY_POLICY_VERSION}
      sections={sections}
    />
  );
}
