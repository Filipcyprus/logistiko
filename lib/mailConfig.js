export function isMailConfigured(mail) {
  return !!(mail && (mail.relayUrl || mail.host));
}
