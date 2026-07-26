import type { Metadata } from "next";
import Link from "next/link";

// DRAFT legal text based on standard SaaS templates — requires owner/lawyer
// review before public launch. Not legal advice.

export const metadata: Metadata = {
  title: "Terms of Service — Kantigo",
  description: "The terms that govern your use of Kantigo.",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <article className="prose dark:prose-invert max-w-none">
        <h1>Terms of Service</h1>
        <p>
          <strong>Last updated:</strong> July 7, 2026
        </p>

        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and
          use of Kantigo (kantigo.dev), a learning platform operated from the
          Republic of the Philippines (&quot;Kantigo&quot;, &quot;we&quot;,
          &quot;us&quot;). By creating an account or using Kantigo, you agree
          to these Terms and to our{" "}
          <Link href="/privacy">Privacy Policy</Link>. If you do not agree, do
          not use the service.
        </p>

        <h2>1. Eligibility</h2>
        <p>
          You must be at least 13 years old to use Kantigo. If you are under
          the age of majority in your jurisdiction, you may only use Kantigo
          with the consent of a parent or legal guardian. By using the
          service, you represent that you meet these requirements.
        </p>

        <h2>2. Your Account</h2>
        <p>
          You are responsible for your account credentials and for all
          activity that occurs under your account. Provide accurate
          registration information and keep it up to date. Notify us at{" "}
          <a href="mailto:support@kantigo.dev">support@kantigo.dev</a> if you
          suspect unauthorized use of your account.
        </p>

        <h2>3. Your Content</h2>
        <p>
          You retain ownership of the content you create on Kantigo — courses,
          lessons, assignments, submissions, and other materials
          (&quot;User Content&quot;). By posting User Content, you grant
          Kantigo a worldwide, non-exclusive, royalty-free license to host,
          store, reproduce, and display it as needed to operate the service.
          For courses you choose to publish publicly, this license includes
          displaying the course to other users and in public course listings.
          This license ends when you delete the content or your account,
          except for copies reasonably retained in backups for a limited
          time.
        </p>
        <p>
          You are responsible for your User Content. You represent that you
          have the rights necessary to post it and that it does not infringe
          the rights of others. See our{" "}
          <Link href="/legal/dmca">DMCA &amp; Copyright Policy</Link> for how
          we handle copyright complaints.
        </p>

        <h2>4. AI-Generated Content</h2>
        <p>
          Kantigo uses third-party artificial intelligence models to generate
          course syllabi, lesson content, quizzes, and tutoring responses.
          AI-generated content may be inaccurate, incomplete, or misleading.
          It is provided for educational convenience only, without warranty
          of accuracy, and should not be relied on as professional advice
          (medical, legal, financial, or otherwise). You are responsible for
          reviewing AI-generated content before relying on or publishing it.
        </p>

        <h2>5. Third-Party Content</h2>
        <p>
          Courses may embed videos and other content hosted by third parties
          such as YouTube. That content belongs to its respective owners and
          is subject to the third party&apos;s own terms. We do not control
          and are not responsible for third-party content.
        </p>

        <h2>6. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>
            post content that is unlawful, infringing, harassing, hateful,
            sexually exploitative of minors, or that violates the rights of
            others;
          </li>
          <li>
            impersonate any person or misrepresent your affiliation with any
            entity;
          </li>
          <li>
            attempt to gain unauthorized access to the service, other
            accounts, or our systems, or probe, scan, or test their
            vulnerability without authorization;
          </li>
          <li>
            interfere with the service&apos;s operation, including by
            overloading, flooding, or spamming;
          </li>
          <li>
            scrape or bulk-collect content or user data except as permitted
            by us in writing;
          </li>
          <li>
            misuse AI features, including attempts to generate unlawful or
            harmful content;
          </li>
          <li>use the service to send unsolicited communications.</li>
        </ul>

        {/* Billing/refund terms land here when payments ship (see PAYMENTS_SPEC.md). */}

        <h2>7. Termination</h2>
        <p>
          You may delete your account at any time from Settings. We may
          suspend or terminate your account if you violate these Terms, if
          required by law, or if we discontinue the service. Where
          practicable, we will give you notice and an opportunity to export
          your data. Sections that by their nature should survive termination
          (including content licenses for retained backups, disclaimers, and
          limitations of liability) survive.
        </p>

        <h2>8. Disclaimers</h2>
        <p>
          Kantigo is provided &quot;as is&quot; and &quot;as available&quot;
          without warranties of any kind, express or implied, including
          merchantability, fitness for a particular purpose, and
          non-infringement. We do not warrant that the service will be
          uninterrupted, secure, or error-free, or that content (including
          AI-generated content) will be accurate.
        </p>

        <h2>9. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, Kantigo and its operators
          will not be liable for any indirect, incidental, special,
          consequential, or punitive damages, or any loss of profits, data,
          or goodwill, arising from your use of the service. Our total
          liability for any claim arising out of these Terms or the service
          will not exceed the greater of the amount you paid us in the twelve
          months before the claim arose or PHP 5,000. Nothing in these Terms
          limits liability that cannot be limited under applicable law.
        </p>

        <h2>10. Changes to the Service and These Terms</h2>
        <p>
          We may modify or discontinue features at any time. We may update
          these Terms; if we make material changes, we will notify you (for
          example by email or an in-app notice) before they take effect.
          Continued use of the service after changes take effect constitutes
          acceptance.
        </p>

        <h2>11. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the Republic of the
          Philippines, without regard to conflict-of-law principles. Any
          dispute arising from these Terms or the service will be brought
          exclusively in the competent courts of the Philippines, and you
          consent to their jurisdiction.
        </p>

        <h2>12. Contact</h2>
        <p>
          Questions about these Terms:{" "}
          <a href="mailto:support@kantigo.dev">support@kantigo.dev</a>.
        </p>
      </article>
    </div>
  );
}
