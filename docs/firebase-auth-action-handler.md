# Firebase authentication action handler

## Action URL

After deploying `src/app/auth/action`, setting the Canisterr domain up in Firebase, and completing the live verification checklist, configure this URL in Firebase Authentication templates:

`https://canisterr.com/auth/action`

Do not set it before the route has been deployed and verified. This implementation does not make Firebase Console or production configuration changes.

## Firebase Console steps

1. Deploy the app and confirm `https://canisterr.com/auth/action` loads over HTTPS.
2. In Firebase Console, open the `filmshare-72c31` project and go to **Authentication → Settings → Authorized domains**. Add `canisterr.com` and `www.canisterr.com` if they are not already listed.
3. Go to **Authentication → Templates**. For Email address verification, Password reset, Email address change, and Email address recovery, open the template settings and set the **Action URL / Customize action URL** to `https://canisterr.com/auth/action`. Save each supported template. Firebase Console labels can vary slightly by console version.
4. Keep MFA emails on Firebase's supported flow. Test every email type with a non-production test account before relying on it.

The handler also accepts Firebase's `revertSecondFactorAddition` mode when Firebase issues that action link. Firebase's template availability for MFA recovery depends on the project's enabled MFA configuration; do not assume a template exists unless the console exposes it.

## Email templates and delivery

HTML and plain-text pairs plus safe previews are in [`email-templates/`](../email-templates/README.md). Firebase's built-in messages support limited sender, reply-to, subject, and action URL customization; they do not act as a general arbitrary-HTML sender. The HTML files are not wired to delivery because this project has no SMTP/provider credentials or configured service. Existing Firebase-managed auth email sending remains in place.

If a provider is approved and configured, keep credentials on the server only. Suggested SMTP variables are `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `AUTH_EMAIL_FROM`, and `AUTH_EMAIL_FROM_NAME`; action-link generation additionally needs Firebase Admin credentials. The SMTP sender/domain must be verified with the provider. Do not put secrets in `NEXT_PUBLIC_*` variables.

## Test checklist before activation

- Use Firebase-generated links for verify email, reset password, verify-and-change email, recover email, and MFA-factor recovery where enabled.
- Test a used/expired code, an altered code, missing parameters, a mismatched API key, and an unreachable Firebase endpoint.
- Check password length, letter, digit, and confirmation errors, then complete a test reset.
- Confirm external `continueUrl` values fall back to `/dashboard`; only same-site Canisterr paths are kept and their query/fragment are stripped.
- Inspect desktop and mobile layouts and verify the browser address loses `mode`, `oobCode`, `apiKey`, and `continueUrl` immediately after hydration.
- Check Firebase and hosting provider access-log retention separately: the app does not log action URLs, but the initial HTTP request reaches the hosting platform before client-side URL cleanup.
