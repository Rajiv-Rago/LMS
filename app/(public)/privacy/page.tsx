import type { Metadata } from "next";
import Link from "next/link";

// DRAFT legal text based on standard SaaS templates — requires owner/lawyer
// review before public launch. Not legal advice.

export const metadata: Metadata = {
  title: "Privacy Policy — Kantigo",
  description: "How Kantigo collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <article className="prose dark:prose-invert max-w-none">
        <h1>Privacy Policy</h1>
        <p>
          <strong>Last updated:</strong> July 7, 2026
        </p>

        <p>
          This policy describes what data Kantigo (kantigo.dev) collects, how
          we use it, and the choices you have. Questions:{" "}
          <a href="mailto:support@kantigo.dev">support@kantigo.dev</a>.
        </p>

        <h2>1. Data We Collect</h2>
        <ul>
          <li>
            <strong>Account data</strong> — your email address, name, and a
            hashed password (never stored in plain text). If you sign in with
            Google or GitHub, we receive your name, email, and profile image
            from that provider.
          </li>
          <li>
            <strong>Content you create</strong> — courses, lessons,
            assignments, quiz answers, project submissions, uploaded files,
            and AI tutor conversations.
          </li>
          <li>
            <strong>Usage data</strong> — server logs of requests and errors
            (including IP address and user agent), and audit records of
            security-relevant account events such as logins and account
            changes.
          </li>
        </ul>
        <p>
          We do not run client-side analytics or advertising trackers in your
          browser.
        </p>

        <h2>2. How We Use Your Data</h2>
        <p>
          We use your data to operate the platform: authenticate you, store
          and display your courses and submissions, generate AI content you
          request, send account-related email (such as password resets),
          secure the service, and debug problems. We do not sell your
          personal data or use it for third-party advertising.
        </p>

        <h2>3. Third-Party Processors</h2>
        <p>
          We share data with service providers only as needed to run Kantigo:
        </p>
        <ul>
          <li>
            <strong>AI providers</strong> — OpenAI, Anthropic, Google
            (Gemini), Groq, and Cerebras. When you use AI features (course
            generation, lesson content, the AI tutor), the prompts and
            relevant course context you provide are sent to the selected
            provider to generate a response.
          </li>
          <li>
            <strong>Google (YouTube Data API)</strong> — used to search and
            retrieve video metadata for YouTube-based learning paths.
          </li>
          <li>
            <strong>Sign-in providers</strong> — Google and GitHub, if you
            choose OAuth sign-in.
          </li>
          <li>
            <strong>Email delivery</strong> — a transactional email provider
            (SendGrid, Amazon SES, or Resend) to send account emails to your
            address.
          </li>
          <li>
            <strong>Axiom</strong> — server-side log storage for error and
            request logs.
          </li>
          <li>
            <strong>Database and file hosting</strong> — our MongoDB database
            host and S3-compatible object storage hold your account data,
            content, and uploaded files.
          </li>
        </ul>

        <h2>4. Cookies</h2>
        <p>
          We use only strictly necessary cookies: httpOnly session cookies
          that keep you signed in and a CSRF protection cookie. We do not set
          tracking or advertising cookies, so no cookie consent banner is
          required.
        </p>

        <h2>5. Retention</h2>
        <p>
          We keep your data for as long as your account is active. When you
          delete your account, your personal data is deleted or anonymized,
          except for copies retained in backups for a limited period and
          records we must keep for security or legal reasons (such as audit
          logs). Server logs are retained on a rolling basis and then
          discarded.
        </p>

        <h2>6. Your Rights</h2>
        <p>
          From <Link href="/settings">Settings</Link> you can export a copy
          of your data or delete your account at any time. Depending on your
          jurisdiction (including under the Philippine Data Privacy Act of
          2012), you may also have rights to access, correct, or object to
          processing of your personal data — contact{" "}
          <a href="mailto:support@kantigo.dev">support@kantigo.dev</a> to
          exercise them.
        </p>

        <h2>7. Children</h2>
        <p>
          Kantigo is not directed at children under 13, and we do not
          knowingly collect personal data from them. If you believe a child
          under 13 has created an account, contact us and we will delete it.
        </p>

        <h2>8. Security</h2>
        <p>
          We protect your data with industry-standard measures, including
          hashed passwords, encrypted connections (HTTPS), and access
          controls. No system is perfectly secure; if a breach affects your
          personal data, we will notify you as required by law.
        </p>

        <h2>9. Changes</h2>
        <p>
          We may update this policy. If we make material changes, we will
          notify you (for example by email or an in-app notice) before they
          take effect. The &quot;Last updated&quot; date above reflects the
          current version.
        </p>

        <h2>10. Contact</h2>
        <p>
          Privacy questions and requests:{" "}
          <a href="mailto:support@kantigo.dev">support@kantigo.dev</a>.
        </p>
      </article>
    </div>
  );
}
