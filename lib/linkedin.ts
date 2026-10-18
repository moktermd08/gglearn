/**
 * LinkedIn's "Add to profile" link for a certificate. LinkedIn has no API for this: the button is a link to its own "add a certification" form,
 * with the certificate's details in the address so the form opens already filled in. The person still has to press Save on LinkedIn, so nothing
 * is posted for them. Pure, so the exact fields and limits can be tested.
 *
 * LinkedIn's form takes: the certification name (100 characters at most), the issuing organisation's name, the month and year it was issued
 * (and, when it expires, the month and year), a credential id and a link to check it. We give it the public verification page as that link.
 */
export const LINKEDIN_NAME_MAX = 100;

export type LinkedInCert = {
  /** what the certification is called, for example "Python: Practitioner" */
  name: string;
  /** who issues it: the company's certificate issuer, or the academy */
  issuer: string;
  issuedAt: number;
  expiresAt: number | null;
  /** the verification code, used as the credential id */
  code: string;
  /** the public page where anyone can check it */
  url: string;
};

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

export function linkedInAddUrl(c: LinkedInCert): string {
  const issued = new Date(c.issuedAt * 1000);
  const q = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: clip(c.name.replace(/\s+/g, " ").trim(), LINKEDIN_NAME_MAX),
    organizationName: clip(c.issuer.replace(/\s+/g, " ").trim(), 100),
    issueYear: String(issued.getUTCFullYear()),
    issueMonth: String(issued.getUTCMonth() + 1),
    certUrl: c.url,
    certId: c.code,
  });
  if (c.expiresAt != null) {
    const e = new Date(c.expiresAt * 1000);
    q.set("expirationYear", String(e.getUTCFullYear()));
    q.set("expirationMonth", String(e.getUTCMonth() + 1));
  }
  return `https://www.linkedin.com/profile/add?${q.toString()}`;
}
