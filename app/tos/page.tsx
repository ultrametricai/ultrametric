import type { Metadata } from 'next'
import Link from 'next/link'

// The company Terms of Service, ported verbatim from the retired Astro landing site
// (https://ultrametric.ai/tos, "Last Updated: May 14, 2026") so the page shares the product
// app's layout — one top bar sitewide (founder 2026-09-29). Distinct from /terms (the
// Ultrametric-rankings-specific terms of use, which layer ON TOP of this base ToS).
// The only non-verbatim addition is the muted scope note under the date (founder liability
// pass 2026-10-02): it cross-links /terms so the two documents' scopes reconcile — this page
// covers the company and its Services; /terms adds the site/research-content terms on top.
export const metadata: Metadata = {
  title: 'Ultrametric Terms of Service',
  description: 'Ultrametric Terms of Service',
  alternates: { canonical: 'https://ultrametric.ai/tos' },
}

// Static page — pure text, no data dependency.
export const dynamic = 'force-static'

export default function TosPage() {
  return (
    <article
      // House stand-in for the landing's `prose prose-invert` (no typography plugin here):
      // descendant arbitrary variants style the verbatim-ported markup.
      className="mx-auto max-w-3xl leading-relaxed text-zinc-300 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-zinc-100 [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-zinc-100 [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-1 [&_strong]:font-semibold [&_strong]:text-zinc-100 [&_a]:underline [&_a]:decoration-zinc-700 [&_a:hover]:text-emerald-300 [&_address]:not-italic [&_address]:whitespace-pre-line"
    >
<h1 className="font-display text-3xl font-bold tracking-tight text-zinc-100">Ultrametric Terms of Service</h1> <p className="mt-2 text-sm text-zinc-500"><strong>Last Updated:</strong> May 14, 2026</p>{' '}
{/* Site-local scope note — NOT part of the verbatim-ported landing text. */}
<p className="text-sm text-zinc-400">
  These are the company terms for Ultrametric, Inc. and its Services. The Ultrametric site&apos;s own
  terms — rankings and guides as research not advice, dataset copyright and reuse, trademarks, the
  dispute path — layer on top of this document at{' '}
  <Link href="/terms">/terms</Link>.
</p> <p>
These Terms of Service (&quot;<strong>Terms</strong>&quot;) govern your access to and use of the Ultrametric website, software platform, mobile applications (if any), APIs, and related services (collectively, the &quot;<strong>Services</strong>&quot;) provided by <strong>Ultrametric, Inc.</strong>, a Delaware corporation (&quot;<strong>Ultrametric</strong>,&quot; &quot;<strong>we</strong>,&quot; &quot;<strong>us</strong>,&quot; or &quot;<strong>our</strong>&quot;).
</p> <p>
By accessing or using the Services, you agree to be bound by these Terms. If you do not agree, do not use the Services.
</p> <p>
If you use the Services on behalf of an organization, you represent and warrant that you have authority to bind that organization to these Terms, and &quot;<strong>you</strong>&quot; refers to that organization.
</p> <hr className="my-8 border-zinc-800" /> <h2>1. Description of the Services</h2> <p>
Ultrametric provides software tools designed to help organizations connect software vendors, APIs, and operational workflows through artificial intelligence systems and automated agents, including (as available):
</p> <ul> <li>AI-generated recommendations and outputs</li> <li><strong>Executable automated workflows and agents</strong> that can take actions in connected systems</li> <li>Integrations with third-party software and APIs</li> <li>Analytics, monitoring, and operational insights</li> <li><strong>Administrative and audit tools</strong>, which may include role-based access controls, approvals, logging, configuration management, and activity history</li> <li>APIs and developer tools</li> <li>Mobile applications (if any)</li> </ul> <p>
The Services may include artificial intelligence systems and automated agents that generate outputs and <strong>execute actions</strong> based on provided inputs, Customer Data, system context, configuration, and permissions.
</p> <h2>2. Eligibility and Business Use</h2> <p>The Services are intended for use by businesses and organizations. By using the Services, you represent that you:</p> <ul> <li>are at least 18 years old (or the age of majority in your jurisdiction), and</li> <li>have authority to use the Services and enter into these Terms.</li> </ul> <p>You are responsible for ensuring your use of the Services complies with applicable laws, regulations, and internal policies.</p> <h2>3. Accounts, Roles, Security, and Access</h2> <p>You may need an account to use some Services. You agree to:</p> <ul> <li>provide accurate account information,</li> <li>maintain and promptly update that information, and</li> <li>safeguard credentials, tokens, keys, and account access.</li> </ul> <h3>3.1 Organization Admins</h3> <p>
If your organization enables administrative roles, admins may be able to manage your workspace, including adding/removing users, configuring permissions, connecting integrations, viewing activity logs, and setting approval policies. You acknowledge that your organization&apos;s administrators control and manage the workspace and may access, export, or delete content within the workspace as permitted by the Services and your organization&apos;s policies.
</p> <p>
You are responsible for all activities that occur under your account, including any actions taken via integrations, APIs, and automated agents configured under your account.
</p> <h2>4. Fees, Purchases, and Billing</h2> <p>
Some Services or features may require payment (&quot;<strong>Paid Services</strong>&quot;). If you use Paid Services, you agree to the following:
</p> <h3>4.1 Fees and Pricing</h3> <p>
Fees, billing metrics, and pricing (for example, per task, per seat, usage-based, subscription, add-ons, or other models) will be shown to you at checkout, in the Services, or in an order form, statement of work, or other written agreement referencing these Terms (&quot;<strong>Order Form</strong>&quot;).
</p> <p>
Unless expressly stated otherwise in an Order Form, all fees are quoted and payable in <strong>U.S. dollars</strong> and are <strong>non-refundable</strong> except as required by law.
</p> <h3>4.2 Authorization to Charge</h3> <p>
You authorize Ultrametric (and our payment processors) to charge your payment method for all applicable fees, taxes, and other amounts you approve or incur through your use of Paid Services, including any usage, tasks, overages, or add-ons.
</p> <h3>4.3 Usage, Tasks, and Overages</h3> <p>
If fees are based on usage (including tasks executed by agents, API calls, workflow runs, seats, storage, or other consumption metrics), you are responsible for all charges incurred under your account and workspace, including charges incurred by executable agents configured by you or your organization.
</p> <p>
We may provide tools to set limits, budgets, alerts, or approvals, but you remain responsible for monitoring usage and charges.
</p> <h3>4.4 Taxes</h3> <p>
Fees are exclusive of taxes unless stated otherwise. You are responsible for all applicable taxes, duties, or government assessments, except taxes on Ultrametric&apos;s net income.
</p> <h3>4.5 Changes to Fees</h3> <p>
We may change fees or introduce new fees for the Services by providing reasonable notice (for example, by posting updates in the Services or by email). Changes will apply prospectively.
</p> <h3>4.6 Late Payments; Suspension</h3> <p>
If a payment is late, fails, or is reversed, we may suspend or terminate access to Paid Services and may apply late fees or interest to the maximum extent permitted by law.
</p> <h3>4.7 Payment Processing</h3> <p>
Payments may be processed by third parties (e.g., Stripe). Your payments may also be subject to the processor&apos;s terms.
</p> <h2>5. Subscriptions, Renewals, and Cancellation</h2> <p>If Ultrametric offers subscriptions and you purchase a subscription, the following applies:</p> <h3>5.1 Term and Renewal</h3> <p>
Subscriptions may be offered on a monthly, annual, or other recurring basis and may automatically renew unless canceled before the renewal date. Renewal and billing frequency will be disclosed at checkout or in an Order Form.
</p> <h3>5.2 Cancellation</h3> <p>
You may cancel as described in the Services or in an applicable Order Form. Cancellation prevents future renewal charges but does not retroactively refund prior charges except as required by law or expressly stated in an Order Form.
</p> <h3>5.3 Plan Changes</h3> <p>
Upgrades may take effect immediately and may result in prorated charges. Downgrades may take effect at the end of the current billing period or as described in the Services.
</p> <h3>5.4 Trials</h3> <p>
If we offer free trials, trials may convert to Paid Services unless canceled before the trial ends. Trial terms will be disclosed in the Services.
</p> <h2>6. Order Forms; Precedence</h2> <p>
If you enter into an Order Form with Ultrametric, the Order Form will describe the applicable commercial terms (such as pricing, billing metrics, subscription term, invoicing, and payment terms) for the Paid Services you purchase.
</p> <p>
If there is a conflict between an Order Form and these Terms, the <strong>Order Form will control only with respect to the specific Paid Services covered by that Order Form and only for the conflicting provision</strong>. These Terms otherwise govern.
</p> <h2>7. Artificial Intelligence, Executable Agents, and Your Responsibilities</h2> <h3>7.1 AI Outputs Are Probabilistic</h3> <p>The Services may generate recommendations, outputs, or actions using artificial intelligence systems. You acknowledge and agree that:</p> <ul> <li>AI outputs may be inaccurate, incomplete, misleading, or inappropriate</li> <li>AI systems are probabilistic and may produce errors sometimes described as &quot;hallucinations&quot;</li> <li>AI outputs and behaviors may vary based on context, data, configurations, integrations, and model updates</li> </ul> <p>Ultrametric does not guarantee the accuracy, reliability, or suitability of AI-generated outputs.</p> <h3>7.2 Executable Automated Actions and Operational Risk</h3> <p>
The Services may allow automated agents or workflows to <strong>execute actions</strong> in third-party software, APIs, databases, and operational systems. Automated actions may include creating records, modifying or deleting data, triggering workflows, sending messages, updating configurations, provisioning resources, initiating requests, or interacting with external services.
</p> <p>
You acknowledge and agree that executable automated actions may have unintended consequences and may affect operational systems, data, and business processes, including actions that are difficult or impossible to reverse.
</p> <p><strong>You acknowledge that executable agents may initiate tasks that incur usage-based charges under your account, and you are responsible for those charges.</strong></p> <h3>7.3 Financial Systems and Transactions</h3> <p>
Some integrations may connect to systems capable of initiating payments, transfers, invoices, procurement actions, payroll-related actions, refunds, credits, or other financial operations.
</p> <p>You are solely responsible for:</p> <ul> <li>configuring permissions and scopes (including least-privilege access),</li> <li>implementing approval workflows and safeguards (including human approvals where appropriate),</li> <li>controlling which users and agents may execute actions,</li> <li>monitoring activity, alerts, and audit logs, and</li> <li>preventing unauthorized or unintended financial actions.</li> </ul> <p> <strong>Ultrametric is not responsible for any financial transaction or financial impact executed via the Services or by automated agents, whether authorized or unauthorized, that results from your configuration, credentials, prompts, policies, Customer Data, third-party systems, or third-party service behavior.</strong> </p> <h3>7.4 Human-in-the-Loop Responsibility (Critical)</h3> <p>
You are responsible for determining whether human review or approval is required before AI outputs are relied upon or automated actions are executed. You agree to implement appropriate internal controls and oversight commensurate with your use case and risk profile.
</p> <h3>7.5 Admin and Audit Tooling; Customer Responsibility</h3> <p>The Services may include administrative and audit features such as role-based access controls, approvals, activity logs, and configuration tools. You acknowledge and agree that:</p> <ul> <li>you are responsible for configuring these controls appropriately,</li> <li>audit logs are provided as a convenience and may not capture every event in all circumstances (e.g., due to service interruptions, third-party outages, configuration choices), and</li> <li>you are responsible for retaining and exporting logs if needed for compliance or investigations.</li> </ul> <h2>8. Customer Data and User Content</h2> <h3>8.1 Customer Data Ownership</h3> <p>
You may submit or make available data, documents, prompts, instructions, messages, files, or other information to the Services (&quot;<strong>Customer Data</strong>&quot;). As between you and Ultrametric, you retain ownership of Customer Data.
</p> <h3>8.2 Workspace Visibility (Not a Social Network)</h3> <p>
The Services are designed for organizational use. Customer Data and user content may be visible to other users within your organization&apos;s workspace according to your organization&apos;s configuration, permissions, and policies.
</p> <p>
Ultrametric is not a public social media service, and we do not intend Customer Data to be publicly posted by default. You are responsible for configuring workspace permissions and sharing settings appropriately.
</p> <h3>8.3 License to Operate the Services</h3> <p>
You grant Ultrametric a worldwide, non-exclusive, royalty-free license to host, store, reproduce, process, transmit, and display Customer Data <strong>only as necessary to provide, secure, and improve the Services</strong>, and to comply with law.
</p> <h3>8.4 Your Responsibilities</h3> <p>You are responsible for:</p> <ul> <li>the accuracy, legality, and integrity of Customer Data,</li> <li>ensuring you have all rights and permissions to upload and process Customer Data,</li> <li>complying with all applicable privacy, employment, and data protection obligations, and</li> <li>maintaining backups and retention policies.</li> </ul> <h3>8.5 Data Loss and Backups</h3> <p>
You acknowledge that integrations and executable automation can modify or delete data. You are responsible for maintaining backups. Ultrametric is not responsible for loss, corruption, deletion, or inability to recover Customer Data.
</p> <h2>9. Third-Party Services and Integrations</h2> <p>
The Services may connect with third-party software platforms, APIs, or services (&quot;<strong>Third-Party Services</strong>&quot;). Ultrametric does not control Third-Party Services and is not responsible for their:
</p> <ul> <li>availability, uptime, performance, or functionality,</li> <li>security or data handling,</li> <li>changes to APIs, features, permissions, or terms,</li> <li>access controls, errors, or failures,</li> <li>actions taken within those systems.</li> </ul> <p>Your use of Third-Party Services may be subject to separate terms and policies, and you are responsible for complying with them.</p> <h2>10. APIs, Credentials, and Integration Configuration</h2> <p>If Ultrametric provides APIs or integrates with third-party APIs, you agree that:</p> <ul> <li>you are responsible for managing API keys, credentials, and permissions,</li> <li>you will not share credentials in a way that compromises security,</li> <li>you will configure integrations appropriately for least-privilege access,</li> <li>you will monitor behavior of automated systems interacting with Third-Party Services, and</li> <li>you will implement appropriate rate limits, approvals, and safeguards for executable actions.</li> </ul> <p>Ultrametric is not responsible for errors, failures, or damages arising from:</p> <ul> <li>API misuse,</li> <li>incorrect configuration,</li> <li>leaked credentials,</li> <li>actions taken by Third-Party Services,</li> <li>exceeding limits, quotas, restrictions, or unexpected behavior imposed by Third-Party Services.</li> </ul> <h2>11. Security Risks, Prompt Injection, and Adversarial Inputs</h2> <p>
AI systems that process external inputs may be susceptible to adversarial inputs, including prompt injection, malicious instructions, or manipulated data.
</p> <p>You acknowledge and agree that:</p> <ul> <li>content from external systems (emails, documents, chats, tickets, webpages, third-party tools) may include malicious or misleading instructions,</li> <li>executable agents may be induced to take unintended actions if safeguards are not configured appropriately, and</li> <li>you are responsible for implementing safeguards (e.g., permissions, allowlists, approval steps, monitoring, separation of duties) when using external inputs.</li> </ul> <p>Ultrametric is not responsible for actions or outputs resulting from:</p> <ul> <li>manipulated prompts or prompt injection,</li> <li>malicious external data,</li> <li>instructions embedded within third-party content,</li> <li>unauthorized actions triggered via third-party systems.</li> </ul> <h2>12. Model Updates and Output Variability (Model Drift)</h2> <p>
The Services may evolve over time, including updates to machine learning models, orchestration logic, safety layers, and system behavior. Such updates may affect outputs and performance and may result in changes over time (&quot;<strong>model drift</strong>&quot;).
</p> <p>
Ultrametric does not guarantee that outputs will remain consistent or that prior results will be replicated. You are responsible for validating outputs after updates and monitoring the Services&apos; behavior in production, especially for executable automations.
</p> <h2>13. Acceptable Use and Prohibited Activities</h2> <p>You agree not to:</p> <ul> <li>use the Services in violation of any law or regulation,</li> <li>interfere with or disrupt the Services or the security of the Services,</li> <li>attempt to gain unauthorized access to accounts, systems, or data,</li> <li>reverse engineer, decompile, or attempt to extract underlying models, system prompts, or proprietary components (except to the extent permitted by law),</li> <li>use the Services to develop or train competing products or services,</li> <li>use the Services to perform unauthorized executable actions in Third-Party Services,</li> <li>introduce malware or harmful code,</li> <li>use the Services to violate third-party terms or intellectual property rights.</li> </ul> <p>We may suspend or terminate access for violations of this section.</p> <h2>14. Intellectual Property</h2> <p>
The Services, including software, models, algorithms, interfaces, designs, and documentation, are owned by Ultrametric and protected by intellectual property laws.
</p> <p>
Subject to these Terms, Ultrametric grants you a limited, non-exclusive, non-transferable, revocable right to access and use the Services during the term of your subscription (if any) for your internal business purposes.
</p> <p>No rights are granted except as expressly stated.</p> <h2>15. Feedback</h2> <p>
If you provide feedback, suggestions, or ideas regarding the Services (&quot;<strong>Feedback</strong>&quot;), you grant Ultrametric a worldwide, perpetual, irrevocable, royalty-free license to use and incorporate such Feedback without restriction or compensation.
</p> <h2>16. Mobile Application</h2> <p>If you use a mobile application provided by Ultrametric:</p> <ul> <li>these Terms apply to your use of the mobile app,</li> <li>you are responsible for wireless and data charges, and</li> <li>you must comply with all applicable app store terms (e.g., Apple App Store / Google Play).</li> </ul> <p>Ultrametric does not guarantee that all features available on the web will be available on mobile.</p> <h2>17. SMS/Text Messaging</h2> <p>If we offer SMS/text messaging features, you agree that:</p> <ul> <li>you are responsible for ensuring you have consent and legal authorization to send and receive messages,</li> <li>message and data rates may apply,</li> <li>message delivery is not guaranteed, and</li> <li>you may opt out of non-required messages as described in the Services.</li> </ul> <p>We may modify or discontinue SMS features at any time.</p> <h2>18. Beta Services</h2> <p>
Ultrametric may offer certain features or functionality identified as beta, preview, experimental, or early access (&quot;<strong>Beta Services</strong>&quot;).
</p> <p>Beta Services:</p> <ul> <li>may contain bugs or errors,</li> <li>may be modified or discontinued at any time,</li> <li>may not be supported or maintained.</li> </ul> <p><strong>Beta Services are provided &quot;as is&quot; and without warranties of any kind. Ultrametric has no liability for any damages arising from the use of Beta Services.</strong></p> <h2>19. Modifications and Interruptions</h2> <p>
We may modify, suspend, or discontinue the Services (in whole or in part) at any time. We do not guarantee the Services will be uninterrupted, timely, secure, or error-free.
</p> <p>
You acknowledge that changes—including AI model updates—may affect outputs and system behavior, including executable automation behavior.
</p> <h2>20. Copyright Infringement and DMCA Safe Harbor</h2> <p>
Ultrametric respects intellectual property rights and complies with the Digital Millennium Copyright Act (&quot;<strong>DMCA</strong>&quot;), 17 U.S.C. § 512. We respond to clear notices of alleged copyright infringement and, in appropriate circumstances, may remove or disable access to allegedly infringing material, terminate the accounts of repeat infringers, and take other steps required to qualify for the safe harbor protections of the DMCA.
</p> <h3>20.1 Designated Copyright Agent</h3> <p>
Notices of claimed copyright infringement should be sent to our designated agent:
</p> <address> <strong>Copyright Agent</strong>
Ultrametric, Inc.
1 Harbor Dr, Suite 300 PMB 3786
Sausalito, CA 94965
United States
Phone: +1 (415) 448-6040
Email: <a href="mailto:legal@ultrametric.ai">legal@ultrametric.ai</a> </address> <h3>20.2 Notice of Claimed Infringement</h3> <p>
To submit a DMCA notice, please provide our Copyright Agent with a written communication that includes substantially the following:
</p> <ul> <li>a physical or electronic signature of the copyright owner or a person authorized to act on the owner&apos;s behalf,</li> <li>identification of the copyrighted work claimed to have been infringed (or, if multiple works at a single online site are covered, a representative list),</li> <li>identification of the allegedly infringing material and information reasonably sufficient to permit us to locate it (e.g., URL),</li> <li>your contact information, including name, address, telephone number, and email,</li> <li>a statement that you have a good-faith belief that the use of the material is not authorized by the copyright owner, its agent, or the law, and</li> <li>a statement, made under penalty of perjury, that the information in the notice is accurate and that you are the copyright owner or are authorized to act on the owner&apos;s behalf.</li> </ul> <h3>20.3 Counter-Notification</h3> <p>
If you believe content you posted was removed or disabled by mistake or misidentification, you may submit a counter-notification to our Copyright Agent that includes:
</p> <ul> <li>your physical or electronic signature,</li> <li>identification of the material that was removed or disabled and the location at which it appeared before removal,</li> <li>a statement under penalty of perjury that you have a good-faith belief the material was removed or disabled as a result of mistake or misidentification, and</li> <li>your name, address, and telephone number, a statement that you consent to the jurisdiction of the federal district court for the judicial district in which your address is located (or, if outside the U.S., for any judicial district in which Ultrametric may be found), and that you will accept service of process from the person who provided the original notice or that person&apos;s agent.</li> </ul> <h3>20.4 Repeat Infringer Policy</h3> <p>
Ultrametric will, in appropriate circumstances, terminate the accounts of users determined to be repeat infringers.
</p> <h3>20.5 Misrepresentations</h3> <p>
Under 17 U.S.C. § 512(f), any person who knowingly materially misrepresents that material is infringing, or that material was removed or disabled by mistake or misidentification, may be liable for damages.
</p> <h2>21. Disclaimer of Warranties</h2> <p>
To the maximum extent permitted by law, the Services are provided <strong>&quot;as is&quot;</strong> and <strong>&quot;as available.&quot;</strong> </p> <p>
Ultrametric disclaims all warranties of any kind, whether express, implied, statutory, or otherwise, including warranties of merchantability, fitness for a particular purpose, non-infringement, and any warranties arising from course of dealing or usage of trade.
</p> <h3>AI System Disclaimer</h3> <p>Artificial intelligence systems are probabilistic and may produce outputs that are inaccurate, incomplete, misleading, or inappropriate. Ultrametric makes no warranties regarding:</p> <ul> <li>accuracy, completeness, or reliability of AI outputs,</li> <li>suitability of outputs for business decisions,</li> <li>prevention of unintended automated actions,</li> <li>outcomes from reliance on AI-generated recommendations,</li> <li>successful detection or prevention of adversarial inputs or prompt injection,</li> <li>consistency of outputs over time.</li> </ul> <h2>22. Limitation of Liability</h2> <p>
To the maximum extent permitted by law, Ultrametric will not be liable for any:
</p> <ul> <li>loss of revenue, profits, or business opportunities,</li> <li>loss of data,</li> <li>business interruption,</li> <li>loss of goodwill,</li> <li>indirect, incidental, special, consequential, or punitive damages,</li> </ul> <p>arising out of or related to the Services, even if Ultrametric has been advised of the possibility of such damages.</p> <p>Without limiting the foregoing, Ultrametric will not be liable for damages arising from:</p> <ul> <li>reliance on AI-generated outputs,</li> <li>hallucinated, incorrect, or misleading AI outputs,</li> <li>actions executed by automated agents or workflows,</li> <li>financial or operational actions executed via integrations,</li> <li>API misuse or credential compromise,</li> <li>prompt injection or adversarial inputs,</li> <li>model drift or output variability over time,</li> <li>third-party service outages, failures, or changes.</li> </ul> <h3>Generated Sites and Generated Content — No Liability</h3> <p>
Without limiting any other provision of these Terms, Ultrametric will not be liable to you, your customers, your visitors, your employees, your investors, or any third party for any loss, cost, damage, claim, expense, or harm — direct, indirect, incidental, consequential, special, exemplary, or punitive — arising out of or relating in any way to any website, page, copy, design, layout, logo, code, asset, configuration, domain, hosting environment, deployment, integration, or other content generated, produced, suggested, hosted, served, deployed, or made available by, through, or as a result of the Services (each, a &quot;<strong>Generated Site</strong>&quot;). Without limitation, this exclusion applies to: any loss of business, revenue, profits, customers, leads, conversions, sales, contracts, sign-ups, fundraising, valuation, or business opportunities; any downtime, unavailability, latency, slow performance, errors, defects, regression, security incident, breach, data loss, data corruption, or service interruption affecting a Generated Site, whether caused by Ultrametric, its hosting providers, upstream networks, DNS providers, registrars, certificate authorities, third-party services, your configuration, your prompts, your inputs, your edits, or any other cause whatsoever; the accuracy, completeness, originality, lawfulness, suitability, or fitness of any AI-generated text, imagery, branding, claims, pricing, product descriptions, testimonials, statistics, biographical content, or any other material appearing on or associated with a Generated Site; any intellectual-property, trademark, trade-dress, copyright, right-of-publicity, defamation, disparagement, false-advertising, deceptive-practices, consumer-protection, accessibility, privacy, data-protection, or other regulatory or statutory claim arising from the content of, the existence of, the use of, or the distribution of a Generated Site (including content you authored, edited, accepted, or failed to remove); any takedown, deindexing, suspension, blocklisting, throttling, deplatforming, or enforcement action by a third party (including search engines, hosting providers, registrars, DNS providers, certificate authorities, app stores, social platforms, payment processors, or governmental authorities); any reliance placed by you, your customers, or visitors on a Generated Site, its outputs, or its availability; any failure of a Generated Site to comply with applicable laws, regulations, codes, industry standards, contractual obligations, or third-party terms in your jurisdiction or any other; any inability to access, recover, restore, modify, migrate, export, or back up a Generated Site; any loss of goodwill, brand value, or reputation; and any consequence of you, your collaborators, or your customers acting (or failing to act) on AI-generated suggestions or auto-generated content. You acknowledge that Generated Sites are produced by probabilistic AI systems and are provided <strong>&quot;as is&quot; and &quot;as available&quot;</strong>; you are solely responsible for reviewing, approving, configuring, securing, monitoring, publishing, and maintaining every Generated Site, and for all consequences flowing from doing so. Ultrametric&apos;s role is limited to providing the Services; it does not act as your publisher, editor, lawyer, accountant, security auditor, hosting guarantor, or insurer with respect to any Generated Site.
</p> <h3>Liability Cap</h3> <p>
Ultrametric&apos;s total liability for any claim arising out of or related to the Services will not exceed the greater of:
</p> <p>
(a) the amount paid by you to Ultrametric for the Services in the twelve (12) months preceding the event giving rise to the claim, or<br />
(b) <strong>$100</strong> if you have not paid for the Services.
</p> <p>Some jurisdictions do not allow certain limitations, so some of the above may not apply to you.</p> <h2>23. Indemnification</h2> <p>
You agree to indemnify, defend, and hold harmless Ultrametric and its officers, directors, employees, and agents from and against any claims, damages, losses, liabilities, and expenses (including reasonable attorneys&apos; fees) arising from or related to:
</p> <ul> <li>your use of the Services,</li> <li>your Customer Data,</li> <li>your integrations and executable automated workflows,</li> <li>actions taken based on AI-generated outputs,</li> <li>financial or operational impacts arising from your use of executable agents,</li> <li>your violation of these Terms or applicable law,</li> <li>your violation of third-party rights or Third-Party Services&apos; terms.</li> </ul> <h2>24. Termination</h2> <p>
You may stop using the Services at any time. We may suspend or terminate your access to the Services at any time if you violate these Terms or if we reasonably believe your use poses a security risk or may cause harm.
</p> <p>Upon termination:</p> <ul> <li>your rights to use the Services will end,</li> <li>you remain responsible for any fees owed (if applicable), and</li> <li>Sections intended to survive termination will survive (including IP, disclaimers, limitations, indemnity, dispute provisions).</li> </ul> <h2>25. Electronic Communications, Transactions, and Signatures</h2> <p>
You consent to receive communications from Ultrametric electronically (for example, via email, in-product notices, or posting within the Services). You agree that all agreements, notices, disclosures, and other communications we provide electronically satisfy any legal requirement that such communications be in writing.
</p> <p>
You agree that your electronic assent (including clicking &quot;I agree,&quot; creating an account, using the Services, or executing order forms electronically) constitutes your signature and acceptance.
</p> <h2>26. Export Compliance</h2> <p>
The Services may be subject to United States export control and economic sanctions laws. You agree that you will not use, export, re-export, or transfer the Services except as authorized by U.S. law and the laws of the jurisdiction in which the Services are used.
</p> <p>You represent that you are not:</p> <ul> <li>located in a country subject to comprehensive U.S. sanctions, or</li> <li>a person or entity prohibited under U.S. sanctions or export laws.</li> </ul> <h2>27. Force Majeure</h2> <p>
Ultrametric will not be liable for any delay or failure to perform due to events beyond its reasonable control, including natural disasters, power or internet outages, infrastructure failures, cyberattacks, government actions, labor disputes, war, terrorism, or widespread third-party service disruptions.
</p> <h2>28. Governing Law</h2> <p>
These Terms are governed by the laws of the State of Delaware, without regard to conflict-of-law principles.
</p> <h2>29. Dispute Resolution and Arbitration</h2> <p>
Any dispute, claim, or controversy arising out of or relating to these Terms or the Services will be resolved by <strong>binding arbitration</strong> administered by the American Arbitration Association (&quot;AAA&quot;) under its applicable rules, unless prohibited by law.
</p> <p>
The arbitration will occur in the United States, and the arbitrator&apos;s decision will be final and binding.
</p> <p>
Nothing in this section prevents either party from seeking injunctive or equitable relief for misuse of intellectual property or unauthorized access to the Services.
</p> <h2>30. Corrections</h2> <p>
We may correct errors, inaccuracies, or omissions and change or update information on the Services at any time without prior notice.
</p> <h2>31. Changes to These Terms</h2> <p>
We may update these Terms from time to time. If we make material changes, we will take reasonable steps to provide notice (e.g., by posting the updated Terms). Continued use of the Services after the effective date of updated Terms constitutes acceptance.
</p> <h2>32. Miscellaneous</h2> <h3>32.1 Entire Agreement</h3> <p>
These Terms constitute the entire agreement between you and Ultrametric regarding the Services and supersede all prior agreements relating to the Services.
</p> <h3>32.2 Severability</h3> <p>
If any provision is found unenforceable, it will be modified to the minimum extent necessary to make it enforceable, and the remainder will remain in effect.
</p> <h3>32.3 Assignment</h3> <p>
You may not assign these Terms without Ultrametric&apos;s prior written consent. Ultrametric may assign these Terms in connection with a merger, acquisition, corporate reorganization, or sale of assets.
</p> <h3>32.4 No Waiver</h3> <p>
Failure to enforce any provision is not a waiver of future enforcement of that or any other provision.
</p> <h2>33. Contact</h2> <p><strong>Ultrametric, Inc.</strong></p> <p><strong>Email:</strong> <a href="mailto:legal@ultrametric.ai">legal@ultrametric.ai</a></p> <address>
1 Harbor Drive, Suite 300 PMB 3786,
Sausalito CA 94965
United States
</address>
    </article>
  )
}
