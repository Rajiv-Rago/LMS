import type { Metadata } from "next";

// DRAFT legal text based on standard SaaS templates — requires owner/lawyer
// review before public launch. Not legal advice.

export const metadata: Metadata = {
  title: "DMCA & Copyright Policy — Kantigo",
  description:
    "How to report copyright infringement on Kantigo and how we handle takedown notices.",
};

export default function DmcaPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <article className="prose dark:prose-invert max-w-none">
        <h1>DMCA &amp; Copyright Policy</h1>
        <p>
          <strong>Last updated:</strong> July 7, 2026
        </p>

        <p>
          Kantigo respects the intellectual property rights of others and
          expects its users to do the same. We respond to notices of alleged
          copyright infringement that comply with the U.S. Digital Millennium
          Copyright Act (DMCA) and equivalent laws. This page is also our
          published contact for general support and abuse reports.
        </p>

        <h2>Designated Contact</h2>
        <p>
          Send copyright notices, counter-notices, abuse reports, and support
          requests to:{" "}
          <a href="mailto:support@kantigo.dev">support@kantigo.dev</a>
        </p>

        <h2>Filing a Takedown Notice</h2>
        <p>
          If you believe content on Kantigo infringes your copyright, send a
          written notice including:
        </p>
        <ol>
          <li>
            identification of the copyrighted work you claim is infringed;
          </li>
          <li>
            identification of the infringing material and its location on
            Kantigo (a URL to the course or lesson);
          </li>
          <li>
            your name, address, telephone number, and email address;
          </li>
          <li>
            a statement that you have a good-faith belief that the use is not
            authorized by the copyright owner, its agent, or the law;
          </li>
          <li>
            a statement, under penalty of perjury, that the information in
            the notice is accurate and that you are the copyright owner or
            authorized to act on the owner&apos;s behalf;
          </li>
          <li>your physical or electronic signature.</li>
        </ol>
        <p>
          On receiving a valid notice, we will remove or disable access to
          the identified material and notify the user who posted it.
          Knowingly misrepresenting that material is infringing may expose
          you to liability.
        </p>

        <h2>Counter-Notice</h2>
        <p>
          If your content was removed and you believe this was a mistake or
          misidentification, you may send a counter-notice including:
        </p>
        <ol>
          <li>
            identification of the removed material and its location before
            removal;
          </li>
          <li>
            a statement, under penalty of perjury, that you have a good-faith
            belief the material was removed as a result of mistake or
            misidentification;
          </li>
          <li>
            your name, address, telephone number, and email address, and a
            statement that you consent to the jurisdiction of the courts in
            your location (or, for U.S. matters, the federal district court
            for your judicial district) and will accept service of process
            from the person who filed the original notice;
          </li>
          <li>your physical or electronic signature.</li>
        </ol>
        <p>
          If we receive a valid counter-notice, we will forward it to the
          original complainant and may restore the material within 10–14
          business days unless the complainant informs us they have filed a
          court action.
        </p>

        <h2>Embedded Third-Party Content</h2>
        <p>
          Courses may embed YouTube videos. We do not host that video
          content; complaints about a video itself should be directed to
          YouTube. Complaints about a Kantigo course that embeds or organizes
          infringing content may be sent to us as described above.
        </p>

        <h2>Repeat Infringers</h2>
        <p>
          We terminate the accounts of users who are determined to be repeat
          infringers.
        </p>
      </article>
    </div>
  );
}
