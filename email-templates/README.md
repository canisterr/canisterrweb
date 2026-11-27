# Canisterr authentication email templates

These are branded HTML and plain-text source templates for verification, password reset, email change, account recovery, and welcome messages. Open `previews/index.html` to inspect sample layouts. Preview action links are inert placeholders and contain no Firebase credentials.

## Firebase delivery limits

Firebase Authentication's built-in email templates allow sender/reply-to/subject and action URL customization, but they do not provide a general-purpose editor for arbitrary branded HTML. Firebase can continue sending verification, password reset, recovery, email-change, and MFA recovery emails using its own templates. The app's `/auth/action` handler can process Firebase-generated links, but those emails are not replaced by these HTML files automatically.

Custom delivery requires a trusted server integration that generates action links with the Firebase Admin SDK and sends the HTML plus text alternatives through a configured provider. This repository currently has no SMTP credentials or email delivery provider configured. No email provider was purchased or enabled as part of this change, and no user-facing auth flow was switched to a nonfunctional sender.

## Provider configuration for a future sender

For SMTP, the server would need `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `AUTH_EMAIL_FROM=support@canisterr.com`, and `AUTH_EMAIL_FROM_NAME=Canisterr`. The sender domain must be authorized by the chosen provider. Keep all credentials server-side; never add them to `NEXT_PUBLIC_*` variables. Firebase Admin link generation additionally needs the existing `FIREBASE_SERVICE_ACCOUNT_JSON` or Application Default Credentials.

The account-recovery and MFA-recovery templates are design references only: Firebase Admin SDK does not expose generators for those recovery action links. Keep those system emails on Firebase unless a supported, secure flow is designed.

## Source placeholders

`{{ACTION_URL}}` must be replaced by a short-lived Firebase-generated link with HTML escaping. Never place an email address, password, action code, or generated link into logs or analytics. Send the corresponding `.txt` file as the plain-text alternative.
