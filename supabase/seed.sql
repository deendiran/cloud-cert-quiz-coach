-- =============================================================================
-- Azure Quiz Coach — Seed Data
-- Topics + 2 placeholder questions per topic (replace these with your own!)
-- Run AFTER 001_schema.sql.
-- =============================================================================

-- -------------------------
-- Topics
-- -------------------------
insert into public.topics (name, weight) values
  ('Cloud basics',  1),
  ('Compute',       1),
  ('Storage',       1),
  ('Networking',    1),
  ('Security',      1),
  ('Cost',          1)
on conflict (name) do nothing;

-- -------------------------
-- Placeholder questions (is_published = true so they appear immediately)
-- Replace these with your own content.
-- -------------------------

-- Cloud basics
insert into public.questions (topic_id, stem, options, correct_ids, explanation, memory_hook, hint, difficulty, is_published)
values
(
  (select id from public.topics where name = 'Cloud basics'),
  'Which cloud deployment model keeps all resources on a provider''s shared infrastructure that is accessible to any subscribing organisation?',
  '[{"id":"a","text":"Private cloud"},{"id":"b","text":"Public cloud"},{"id":"c","text":"Hybrid cloud"},{"id":"d","text":"Community cloud"}]',
  array['b'],
  'A public cloud is operated by a third-party provider and made available to any organisation over the internet. A private cloud, by contrast, is dedicated to a single organisation. The most tempting wrong answer is "Hybrid cloud", which actually combines private and public environments rather than being a standalone model. Memory hook: "Public = Provider owns everything, anyone can subscribe."',
  'Public = open to all tenants on shared infrastructure.',
  'Think about who owns and who can use the resources.',
  1,
  true
),
(
  (select id from public.topics where name = 'Cloud basics'),
  'What term describes the ability to increase or decrease computing resources to match current demand automatically?',
  '[{"id":"a","text":"High availability"},{"id":"b","text":"Elasticity"},{"id":"c","text":"Fault tolerance"},{"id":"d","text":"Geo-redundancy"}]',
  array['b'],
  'Elasticity is the ability to scale resources up or down automatically in response to demand. High availability focuses on uptime, fault tolerance on surviving failures, and geo-redundancy on geographic distribution. Memory hook: "Elastic band — stretches with demand, shrinks when done."',
  'Elastic band: stretches with demand, returns when not needed.',
  'Which term is specifically about automatic scaling in both directions?',
  1,
  true
);

-- Compute
insert into public.questions (topic_id, stem, options, correct_ids, explanation, memory_hook, hint, difficulty, is_published)
values
(
  (select id from public.topics where name = 'Compute'),
  'Which service model gives you the most control over the operating system and middleware while relieving you of hardware management?',
  '[{"id":"a","text":"Software as a Service (SaaS)"},{"id":"b","text":"Platform as a Service (PaaS)"},{"id":"c","text":"Infrastructure as a Service (IaaS)"},{"id":"d","text":"Function as a Service (FaaS)"}]',
  array['c'],
  'IaaS provides virtualised hardware (VMs, networking, storage) so you control the OS and above, but the provider manages the physical servers. SaaS gives you finished software with no infrastructure control. The most tempting wrong answer is PaaS, but PaaS abstracts away the OS too. Memory hook: "IaaS = I am in charge of the OS."',
  'IaaS = you manage OS and up; provider manages hardware.',
  'Which model gives you a virtual machine you can configure yourself?',
  2,
  true
),
(
  (select id from public.topics where name = 'Compute'),
  'What is the primary advantage of serverless compute compared with running a dedicated virtual machine?',
  '[{"id":"a","text":"Lower latency for all requests"},{"id":"b","text":"You pay only when your code executes"},{"id":"c","text":"Unlimited execution time per invocation"},{"id":"d","text":"Full control over the underlying OS"}]',
  array['b'],
  'Serverless functions bill per execution, so idle time costs nothing. VMs are billed even when idle. Serverless does not guarantee lower latency (cold starts can add delay) and typically limits execution duration. Memory hook: "No code running = no charge — the cloud sleeps for free."',
  'Pay-per-execution is the defining financial benefit of serverless.',
  'Think about what happens to cost when your code is not being called.',
  2,
  true
);

-- Storage
insert into public.questions (topic_id, stem, options, correct_ids, explanation, memory_hook, hint, difficulty, is_published)
values
(
  (select id from public.topics where name = 'Storage'),
  'Which storage type is best suited for storing large numbers of unstructured files such as images, videos and backups?',
  '[{"id":"a","text":"Relational database"},{"id":"b","text":"Block storage"},{"id":"c","text":"Object storage"},{"id":"d","text":"Queue storage"}]',
  array['c'],
  'Object storage stores data as objects with metadata and a unique identifier, making it ideal for unstructured data at massive scale. Block storage is used for OS disks and databases. Queue storage handles message passing. Memory hook: "Objects in a bucket — each with its own label."',
  'Object storage: flat namespace, infinite scale, metadata-rich.',
  'Which type uses a flat namespace and is accessed via HTTP?',
  1,
  true
),
(
  (select id from public.topics where name = 'Storage'),
  'What does "geo-redundant storage" protect against that "locally redundant storage" does not?',
  '[{"id":"a","text":"Disk failure within a single server"},{"id":"b","text":"A failure affecting an entire data centre region"},{"id":"c","text":"Accidental file deletion by a user"},{"id":"d","text":"Network packet loss during upload"}]',
  array['b'],
  'Locally redundant storage replicates data within a single data centre, protecting against hardware failures there. Geo-redundant storage additionally copies data to a paired region, protecting against a complete regional outage. User deletion is a separate concern handled by soft-delete or versioning. Memory hook: "GRS survives the data centre falling over entirely."',
  'GRS adds a second geographic copy; LRS keeps all copies in one location.',
  'Think about what a large-scale regional disaster would affect.',
  2,
  true
);

-- Networking
insert into public.questions (topic_id, stem, options, correct_ids, explanation, memory_hook, hint, difficulty, is_published)
values
(
  (select id from public.topics where name = 'Networking'),
  'What is the purpose of a Virtual Network (VNet) in a cloud environment?',
  '[{"id":"a","text":"To provide a managed database service"},{"id":"b","text":"To isolate and segment cloud resources into a private network"},{"id":"c","text":"To monitor application performance metrics"},{"id":"d","text":"To cache static content closer to users"}]',
  array['b'],
  'A VNet creates a logically isolated network in the cloud, letting you control IP address ranges, subnets, routing, and traffic flow between resources. It is not for databases, monitoring, or content delivery. Memory hook: "VNet = your own private neighbourhood in the cloud."',
  'VNet = private, isolated network you control.',
  'What does the "V" in VNet stand for, and why does that matter?',
  1,
  true
),
(
  (select id from public.topics where name = 'Networking'),
  'Which networking component distributes incoming traffic across multiple server instances to improve availability?',
  '[{"id":"a","text":"Firewall"},{"id":"b","text":"VPN Gateway"},{"id":"c","text":"Load balancer"},{"id":"d","text":"DNS resolver"}]',
  array['c'],
  'A load balancer spreads incoming requests across a pool of backend servers so no single instance is overwhelmed, improving both availability and performance. A firewall controls traffic by rules; a VPN Gateway connects private networks over the internet; a DNS resolver translates domain names to IP addresses. Memory hook: "Load balancer = traffic director at the door."',
  'Load balancer distributes traffic; it does not filter or translate.',
  'Think about what handles the "spreading" of requests.',
  1,
  true
);

-- Security
insert into public.questions (topic_id, stem, options, correct_ids, explanation, memory_hook, hint, difficulty, is_published)
values
(
  (select id from public.topics where name = 'Security'),
  'What principle states that users should be granted the minimum level of access required to perform their job?',
  '[{"id":"a","text":"Defence in depth"},{"id":"b","text":"Zero-trust"},{"id":"c","text":"Least privilege"},{"id":"d","text":"Separation of duties"}]',
  array['c'],
  'Least privilege means granting only the permissions needed for a task—nothing more. Defence in depth uses layered controls; zero-trust verifies every request regardless of network location; separation of duties divides critical tasks among multiple people. Memory hook: "Least privilege = just enough access, nothing extra."',
  'Least privilege: minimum access required, nothing more.',
  'Which principle is specifically about minimising access rights?',
  1,
  true
),
(
  (select id from public.topics where name = 'Security'),
  'What type of attack floods a service with requests to make it unavailable to legitimate users?',
  '[{"id":"a","text":"Phishing"},{"id":"b","text":"Distributed Denial of Service (DDoS)"},{"id":"c","text":"SQL injection"},{"id":"d","text":"Man-in-the-middle"}]',
  array['b'],
  'A DDoS attack overwhelms a service with traffic from many sources, denying access to real users. Phishing tricks users into revealing credentials; SQL injection manipulates database queries; man-in-the-middle intercepts communications. Memory hook: "DDoS = door blocked by a crowd of bots."',
  'DDoS = overwhelm with traffic from many sources.',
  'Which attack targets availability rather than confidentiality?',
  2,
  true
);

-- Cost
insert into public.questions (topic_id, stem, options, correct_ids, explanation, memory_hook, hint, difficulty, is_published)
values
(
  (select id from public.topics where name = 'Cost'),
  'Which pricing model charges you based only on the resources you actually consume, with no upfront commitment?',
  '[{"id":"a","text":"Reserved instances"},{"id":"b","text":"Spot pricing"},{"id":"c","text":"Pay-as-you-go"},{"id":"d","text":"Bring-your-own-licence"}]',
  array['c'],
  'Pay-as-you-go (consumption-based) charges only for what you use, with no upfront payment. Reserved instances require a commitment (1 or 3 years) in exchange for a discount. Spot pricing offers deep discounts but resources can be reclaimed. BYOL lets you reuse existing software licences. Memory hook: "Pay-as-you-go = taxi meter, not a monthly bus pass."',
  'Pay-as-you-go = no commitment, billed only for usage.',
  'Which model has zero upfront cost and no usage commitment?',
  1,
  true
),
(
  (select id from public.topics where name = 'Cost'),
  'Moving from on-premises infrastructure to the cloud primarily shifts capital expenditure (CapEx) to what?',
  '[{"id":"a","text":"Higher capital expenditure"},{"id":"b","text":"Operational expenditure (OpEx)"},{"id":"c","text":"Depreciation expenditure"},{"id":"d","text":"Zero expenditure"}]',
  array['b'],
  'On-premises hardware requires large upfront capital purchases (CapEx). Cloud services are billed as an ongoing operating expense (OpEx), which improves cash flow and allows costs to scale with use. Memory hook: "Cloud = rent, not buy — OpEx, not CapEx."',
  'Cloud = operational expense; on-premises = capital expense.',
  'What type of expenditure recurs monthly on a subscription or usage basis?',
  1,
  true
);
