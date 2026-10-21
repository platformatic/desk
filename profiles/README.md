# Profiles

Profiles are versioned and this version is directly related to our Helm chart
major version. Every profile version 

## Development notifications

The development profile configures Gmail SMTP and Slack. Delivery is disabled
by default with `platformatic.services.icc.notifications.enable: false`.
No local mail server is installed.

Set `PLT_NOTIFICATIONS_SMTP_USER` and `PLT_NOTIFICATIONS_SMTP_PASSWORD` in Desk's
local `.env` (use a Gmail App Password). Set `PLT_NOTIFICATIONS_EMAIL_TO` in the same `.env` for the test recipient. Optional Slack credentials use
`PLT_NOTIFICATIONS_SLACK_TOKEN` and `PLT_NOTIFICATIONS_SLACK_CHANNEL`; select
`providers: [email, slack]` under `notifications` to use both.

When ready, change `notifications.enable` to `true` in the profile and
reapply the development profile. The flag requires an ICC restart and overrides
all saved provider settings. Setting it back to `false` preserves those settings.

Recipients, providers, minimum level, and excluded services are seeded only on
first initialization. For an existing settings row, change them through
`PATCH /notifications/settings`; restarting does not overwrite saved settings.
Desk's database initialization includes the `notifications` database.

The profile maps directly to Helm's `services.icc.notifications` values. Helm
creates the environment variables, credential Secret, and notification database
URL using the shared database configuration. To test a local chart checkout,
set `PLT_HELM_CHART_PATH=/path/to/helm/chart` in Desk's local `.env`.
