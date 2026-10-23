-- =============================================================================
-- Azure Quiz Coach (unofficial study aid): Seed Content
-- 48 original practice questions, 8 per topic, written from general
-- cloud-computing concepts. Not copied from any real exam.
--
-- RUN ORDER: Run 001_schema.sql first (tables, RLS, triggers), then this file.
-- Built-in questions have owner_id = null and are published immediately.
--
-- Idempotent: Does not insert duplicates if run multiple times.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Topics
-- -----------------------------------------------------------------------------
insert into public.topics (name, weight) values
  ('Cloud basics', 1),
  ('Compute',      1),
  ('Storage',      1),
  ('Networking',   1),
  ('Security',     1),
  ('Cost',         1)
on conflict (name) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Remove legacy placeholder questions if previously seeded
-- -----------------------------------------------------------------------------
delete from public.questions
where owner_id is null
  and stem in (
    'Which cloud deployment model keeps all resources on a provider''s shared infrastructure that is accessible to any subscribing organisation?',
    'What term describes the ability to increase or decrease computing resources to match current demand automatically?',
    'Which service model gives you the most control over the operating system and middleware while relieving you of hardware management?',
    'What is the primary advantage of serverless compute compared with running a dedicated virtual machine?',
    'Which Azure storage service is best suited for storing petabytes of unstructured text or binary data such as video files?',
    'Which Azure storage redundancy option provides replication across three separate physical facilities within a single region?',
    'What is the primary function of an Azure Virtual Network (VNet)?',
    'Which Azure service provides a distributed network of servers that delivers high-bandwidth content by caching it at physical nodes around the world?',
    'What is the primary role of Microsoft Entra ID (formerly Azure Active Directory)?',
    'Which Azure feature enables you to grant users only the permissions they need to perform their jobs?',
    'Which pricing model charges you based only on the resources you actually consume, with no upfront commitment?',
    'Moving from on-premises infrastructure to the cloud primarily shifts capital expenditure (CapEx) to what?'
  );

-- -----------------------------------------------------------------------------
-- 3. 48 Original Questions (8 per topic)
-- -----------------------------------------------------------------------------
insert into public.questions
  (topic_id, difficulty, type, stem, options, correct_ids, explanation, memory_hook, hint, source, is_published)
select
  t.id, v.diff, 'mcq', v.stem,
  jsonb_build_array(
    jsonb_build_object('id','a','text',v.a),
    jsonb_build_object('id','b','text',v.b),
    jsonb_build_object('id','c','text',v.c),
    jsonb_build_object('id','d','text',v.d)
  ),
  array[v.correct], v.expl, v.hook, v.hint, 'authored', true
from (values

-- ---------------------------------------------------------------- Cloud basics
('Cloud basics',1,'A company replaces its own server room with rented cloud capacity and pays monthly based on use. What is the main financial change?',
 'Large upfront purchases become ongoing, usage-based costs','All costs disappear','Costs become fixed whatever the usage','Hardware is bought in bulk every year','a',
 'Cloud moves spending from buying equipment up front (capital expense) to paying as you go (operating expense). Costs do not vanish, and they normally follow usage.',
 'Buying a car versus paying for taxis.','Think capital versus operating costs.'),

('Cloud basics',1,'Which statement best describes scalability?',
 'Keeping identical data in two buildings','Locking every resource so nothing can change','The ability to handle more or less workload by adding or removing resources','Encrypting every file automatically','c',
 'Scalability means a system can grow or shrink its capacity to match demand. The other options describe replication, restriction and encryption.',
 'A stretchy waistband for your workload.','Think growing and shrinking.'),

('Cloud basics',1,'Under the shared responsibility idea, who is always responsible for deciding who may access the data a customer stores in the cloud?',
 'Only the cloud provider','The customer','Only the internet provider','Nobody, because it is automatic','b',
 'Providers secure the underlying infrastructure, but customers remain responsible for their own data and access to it. The exact split of other duties changes with the service model.',
 'The landlord secures the building; you lock your own door.','Your data, your duty.'),

('Cloud basics',2,'A team wants to publish a web app and only manage their own code, not servers or operating systems. Which service model fits best?',
 'Infrastructure as a service','Software as a service','On-premises hosting','Platform as a service','d',
 'Platform as a service manages servers and operating systems so developers focus on code. IaaS leaves the operating system to you, and SaaS is a finished product you simply use.',
 'A fully equipped kitchen: you bring ingredients, not appliances.','You supply the code only.'),

('Cloud basics',2,'Which deployment model connects a company''s own datacentre with services from a public cloud provider?',
 'Hybrid cloud','Public-only cloud','Offline cloud','Single-tenant desktop','a',
 'A hybrid cloud links private, on-premises resources with a public cloud so workloads can use both.',
 'A hybrid car uses two power sources; hybrid cloud uses two environments.','A mix of your own and rented.'),

('Cloud basics',2,'Why might a business run an important application in more than one region?',
 'To make the application slower on purpose','To lower availability','To keep working if one location has a major outage','To remove the need for backups','c',
 'Spreading across regions helps the application survive a regional failure and can place it closer to users. It does not replace backups.',
 'Do not keep every egg in one basket, or in one town.','Think disaster tolerance.'),

('Cloud basics',3,'A shop''s website is busy only during a few holiday weeks. Which cloud property helps it avoid paying all year for peak capacity?',
 'Fixed hardware','Elasticity','Manual provisioning','Dedicated cabling','b',
 'Elasticity adds capacity for peaks and releases it afterwards, so you pay only while it is needed. Fixed or manual capacity has to be sized for the peak all year.',
 'A rubber band stretches for the load, then relaxes.','Automatic stretch and shrink.'),

('Cloud basics',3,'What does high availability aim to do?',
 'Reduce the size of stored files','Increase the number of passwords','Delay software updates indefinitely','Minimise downtime so the service stays reachable','d',
 'High availability uses redundancy so the service remains usable even when a component fails.',
 'A spare tyre already fitted and ready to roll.','Focus on uptime.'),

-- ---------------------------------------------------------------- Compute
('Compute',1,'What is a virtual machine?',
 'A physical server you carry home','A type of network cable','A software-based computer running on shared physical hardware','A database backup file','c',
 'A virtual machine emulates a full computer, with its own operating system, on a physical host that can run many of them.',
 'Apartments in one building: separate homes, shared structure.','A computer made of software.'),

('Compute',1,'Which option suits a small task that runs only when triggered, such as resizing a photo after upload?',
 'A permanently running large virtual machine','A physical file server','A tape drive','A serverless function','d',
 'Serverless functions run in response to a trigger and you pay mainly for the time they execute, which suits short, event-driven jobs.',
 'A motion-sensor light that is on only when needed.','Event-driven.'),

('Compute',2,'How does a container differ from a virtual machine?',
 'It always includes a full operating system of its own','It packages an app and its dependencies and shares the host operating system kernel','It is a kind of storage disk','It is a network firewall','b',
 'Containers are lightweight because they share the host kernel, while each virtual machine carries its own operating system.',
 'Lunchboxes on one table versus separate kitchens.','Lightweight and shares the kernel.'),

('Compute',2,'A web app slows down because CPU use stays high. Which action spreads the load by adding more identical instances?',
 'Scale out','Scale up to a smaller size','Turn off monitoring','Delete the load balancer','a',
 'Scaling out adds instances so work is shared. Scaling up makes a single instance bigger.',
 'More cashiers (out) versus one faster cashier (up).','Out means more copies.'),

('Compute',2,'What does a load balancer do?',
 'Encrypts data at rest','Stores backups','Distributes incoming requests across several instances','Assigns billing tags','c',
 'A load balancer shares traffic between instances so no single one is overwhelmed, and it can skip unhealthy ones.',
 'A traffic officer sending cars down different lanes.','It shares the work.'),

('Compute',2,'Which workload is best suited to a virtual machine rather than a serverless function?',
 'A job that runs for a few seconds once a day','A legacy application that needs a specific operating system and long-running processes','A quick image-resize trigger','A webhook that must reply in milliseconds','b',
 'Long-running or legacy software that expects control of the operating system fits virtual machines better than short, stateless functions.',
 'A permanent shop versus a pop-up stall.','Think long-running and specific setup.'),

('Compute',3,'What most commonly triggers an autoscale rule?',
 'The colour of the dashboard','A user''s browser choice','A manager''s email','A metric such as CPU use or request count crossing a threshold','d',
 'Autoscale rules usually watch metrics like CPU or queue length, or follow a schedule, and then add or remove instances.',
 'A thermostat: the temperature crosses a line, the heater reacts.','Watch the metrics.'),

('Compute',3,'Why do many teams run several smaller instances behind a load balancer instead of one very large server?',
 'Because the loss of one instance does not stop the whole service','Because networking is no longer needed','Because it makes updates impossible','Because large servers cannot be rented','a',
 'Several instances improve resilience and allow rolling updates, since one failure or restart does not take everything offline.',
 'Many small boats are harder to sink than one big ship.','Think resilience.'),

-- ---------------------------------------------------------------- Storage
('Storage',1,'Which type of data is best kept in object storage?',
 'CPU registers','Photos, videos and documents','Live network packets','Passwords in plain text','b',
 'Object storage holds large amounts of unstructured data such as images, videos and documents, each stored as an object with metadata.',
 'A huge warehouse of labelled boxes.','Unstructured files.'),

('Storage',1,'What does keeping extra copies of data (redundancy) mainly protect against?',
 'Slow typing','Colour fading on screens','Rising prices','Losing data when a device fails','d',
 'With several copies, a failed disk or device does not mean lost data.',
 'A photocopy kept in another drawer.','Think failure.'),

('Storage',2,'Data that is read every day should be placed in which kind of storage tier?',
 'Archive','A vault with offline tapes','Hot','Deleted storage','c',
 'Hot tiers are built for frequent access with low delay. Archive tiers are cheaper but slower to retrieve.',
 'Keep daily clothes on the chair, winter coats in the attic.','Frequent means hot.'),

('Storage',2,'What is a key difference between block storage and file storage?',
 'Block storage presents raw volumes that a system formats, while file storage shares folders and files over a network','Block storage cannot be used by virtual machines','File storage has no folders','They are exactly the same','a',
 'Block storage behaves like a raw disk attached to a machine. File storage offers shared folders and files that many clients can open.',
 'A blank notebook (block) versus a shared filing cabinet (file).','Raw disk versus shared folders.'),

('Storage',2,'Why take backups even when data is already replicated to another location?',
 'Replication encrypts data','Replication copies mistakes and deletions too, while backups let you return to an earlier point','Backups speed up the network','Replication prevents all human error','b',
 'If someone deletes or corrupts data, replication usually copies that change. A backup keeps older versions you can restore.',
 'A mirror shows your mistakes too; a photo album remembers the past.','Think restore to an earlier time.'),

('Storage',2,'A rule says certain data must stay inside one country. Which step helps?',
 'Adding more tags','Increasing disk speed','Using a longer password','Choosing a storage location in a permitted region','d',
 'Choosing where data is stored, and where it is replicated, controls its location for residency rules.',
 'Decide which cupboard in which house holds the documents.','Think location.'),

('Storage',3,'A team keeps logs for seven years but rarely reads old ones. What is a sensible cost-saving step?',
 'Keep everything in the fastest tier','Delete all logs after one day','Move older logs to a cheaper, slower tier using a lifecycle rule','Email logs to staff','c',
 'Lifecycle rules can automatically move ageing data to cheaper tiers, lowering cost while keeping it available when needed.',
 'Move old files from the desk to the archive room automatically.','Automate moving old data to a cheaper place.'),

('Storage',3,'What is the purpose of encrypting data at rest?',
 'To make stored data unreadable without the correct key','To speed up reads','To compress files','To remove duplicates','a',
 'Encryption at rest protects stored data, so a stolen disk or copy is useless without the key.',
 'A locked diary: the pages are there, but unreadable without the key.','Protects stored data.'),

-- ---------------------------------------------------------------- Networking
('Networking',1,'What is an IP address used for?',
 'Storing passwords','Encrypting email','Measuring disk space','Identifying a device on a network so data can be sent to it','d',
 'An IP address works like a postal address for a device, letting data find its destination.',
 'The house number on a street.','It identifies the device.'),

('Networking',1,'What does the Domain Name System (DNS) do?',
 'Translates names like a website address into IP addresses','Blocks all incoming traffic','Compresses images','Creates user accounts','a',
 'DNS lets people use friendly names while computers look up the matching IP addresses.',
 'The phone book that turns names into numbers.','Names to numbers.'),

('Networking',2,'In a virtual network, what is a subnet?',
 'A type of backup','A password policy','A smaller range of addresses inside the network used to group resources','A billing report','c',
 'Subnets divide a virtual network into sections so resources can be organised and controlled separately.',
 'Rooms inside a house.','A slice of the address range.'),

('Networking',2,'What does a network security group do?',
 'Stores data in tiers','Allows or denies network traffic using rules','Creates cost reports','Replaces user passwords','b',
 'A network security group holds rules that allow or deny traffic by source, destination, port and protocol.',
 'A guard with a list of who may enter and leave.','Rules for traffic.'),

('Networking',2,'Which approach lets two virtual networks communicate privately without sending traffic over the public internet?',
 'Sharing a password','Using a longer domain name','Adding a tag','Virtual network peering','d',
 'Peering connects virtual networks so resources in each can talk over the provider''s private backbone.',
 'A private bridge between two neighbourhoods.','Connect networks privately.'),

('Networking',2,'What is a VPN mainly used for?',
 'Creating an encrypted tunnel over the internet to a private network','Speeding up disk access','Counting website visitors','Compressing video','a',
 'A VPN encrypts traffic between a device or site and a network, so data travels safely over public links.',
 'An armoured tunnel through a busy city.','Encrypted tunnel.'),

('Networking',3,'Why might you place a database in a private subnet with no public IP address?',
 'To make it slower','To limit exposure so only internal resources can reach it','To avoid using passwords','To remove the need for backups','b',
 'Keeping a database off the public internet shrinks the attack surface. Approved internal services can still connect.',
 'Keep the vault inside the building, not by the front door.','Think exposure.'),

('Networking',3,'What does a content delivery network (CDN) mainly improve?',
 'Password strength','Disk encryption','Loading speed by serving cached copies of content from locations close to users','Database indexing','c',
 'A CDN stores copies of content in many locations so users download from a nearby one, which lowers delay.',
 'Local shops stocking popular items so you do not wait for a faraway warehouse.','Closer to the user.'),

-- ---------------------------------------------------------------- Security
('Security',1,'Giving each person only the access they need to do their job is called what?',
 'Open access','Shared passwords','Least privilege','Default administrator','c',
 'Least privilege limits damage if an account is misused or taken over, because each identity can do only what it needs.',
 'You get the key to your classroom, not the whole school.','Only what you need.'),

('Security',1,'Which control asks for a second proof of identity in addition to a password?',
 'Multi-factor authentication','Longer file names','Automatic saving','Dark mode','a',
 'Multi-factor authentication combines something you know with something you have or are, so a stolen password alone is not enough.',
 'A key plus a secret knock.','Password plus something else.'),

('Security',2,'What is the role of an identity provider?',
 'Storing large video files','Balancing traffic between servers','Estimating monthly costs','Verifying who a user is and issuing proof of that identity','d',
 'An identity provider authenticates users and gives applications trusted information about them, often enabling single sign-on.',
 'The passport office that confirms who you are.','It proves identity.'),

('Security',2,'What is the difference between authentication and authorisation?',
 'They mean the same thing','Authentication proves who you are; authorisation decides what you may do','Authentication decides what you may do; authorisation proves who you are','Authentication is only for administrators','b',
 'Sign-in is authentication. Permissions after sign-in are authorisation.',
 'Showing your ticket at the gate versus being allowed into the VIP area.','Who versus what.'),

('Security',2,'Why should secrets such as API keys not be written into code that runs in the browser?',
 'Anyone using the site can read that code and copy the key','Browsers cannot run code','Keys make pages slower','Secrets are never needed','a',
 'Code sent to a browser can be inspected, so keys must stay on a server or in a secrets store.',
 'Do not tape your house key to the front door.','Anyone can read browser code.'),

('Security',2,'What does role-based access control do?',
 'Encrypts every file twice','Moves data between regions','Grants permissions through roles assigned to people or groups','Deletes old accounts automatically','c',
 'Instead of giving each person separate permissions, you assign roles such as reader or contributor, which makes access easier to manage and review.',
 'Job badges: the badge decides which doors open.','Permissions bundled into roles.'),

('Security',3,'What is the core idea of a zero trust approach?',
 'Trust every device inside the office network','Never use passwords','Allow all traffic by default','Verify every request explicitly and assume a breach is possible','d',
 'Zero trust does not treat any location as automatically safe. It checks identity, device and context for each request.',
 'Show your badge at every door, even inside the building.','Never trust, always verify.'),

('Security',3,'Why turn on logging and alerts for sign-in activity?',
 'To reduce storage costs','To spot unusual activity such as repeated failures or sign-ins from unexpected places','To make passwords shorter','To replace backups','b',
 'Logs and alerts help you notice and respond to suspicious behaviour early.',
 'A doorbell camera that tells you about visitors.','Detect the unusual.'),

-- ---------------------------------------------------------------- Cost
('Cost',1,'In pay-as-you-go pricing, what mainly determines your bill?',
 'The colour of your account','How much of each service you actually use','Only the day of the week','The length of your password','b',
 'Pay-as-you-go charges follow consumption, such as compute hours, storage used and data transferred.',
 'A taxi meter: you pay for the distance travelled.','Usage drives cost.'),

('Cost',1,'What helps you group resources so you can see which team or project is spending what?',
 'Wallpapers','Ping tests','Longer passwords','Tags','d',
 'Tags are labels such as team or project that you attach to resources, so cost reports can be grouped and filtered by them.',
 'Coloured stickers on lunchboxes.','Labels on resources.'),

('Cost',2,'You want a warning before monthly spending passes a set limit. Which feature helps?',
 'A budget with alert thresholds','A larger disk','A shorter password','A new region','a',
 'A budget sets a spending target and sends alerts at percentages you choose, so you can act before overspending.',
 'A piggy bank that beeps when nearly empty.','Set a limit and an alert.'),

('Cost',2,'A test environment is used only during working hours. What usually reduces its cost the most?',
 'Leaving it on all night','Doubling its size','Stopping or deallocating it outside working hours','Adding extra tags','c',
 'Compute resources generally charge while they are allocated, so switching them off when unused cuts cost.',
 'Turn off the lights when you leave the room.','Stop paying for idle time.'),

('Cost',2,'What does right-sizing mean?',
 'Making every resource as large as possible','Matching resource size to the actual need','Choosing the most expensive region','Deleting all backups','b',
 'Right-sizing reviews real usage and picks a size that meets the need without paying for unused capacity.',
 'Buying shoes that fit, not the biggest pair.','Fit the size to the need.'),

('Cost',2,'You commit to using a certain amount of capacity for one or three years in return for a lower price. What is this usually called?',
 'Pay-per-click','A free tier','A random discount','A reservation or commitment discount','d',
 'Committing to steady usage for a fixed term typically earns a lower rate than pure pay-as-you-go.',
 'A gym annual plan is cheaper than paying per visit.','Commit longer, pay less.'),

('Cost',3,'A forecast shows spending will exceed the budget by month end. What is the best first response?',
 'Review the cost breakdown to find the biggest drivers and any unused resources','Ignore the forecast','Delete every resource immediately','Raise the budget without checking','a',
 'Looking at what is driving spend lets you fix the cause, such as idle or oversized resources, instead of guessing.',
 'Check the receipt before cancelling the party.','Find the drivers first.'),

('Cost',3,'Why is an unused but still-running resource a cost problem?',
 'It improves performance','It keeps accruing charges while delivering no value','It lowers security','It deletes itself','b',
 'Many resources bill while they exist or run, whether or not anyone uses them, so idle resources quietly waste money.',
 'A tap left dripping all month.','Paying for nothing.')

) as v(topic, diff, stem, a, b, c, d, correct, expl, hook, hint)
join public.topics t on t.name = v.topic
where not exists (
  select 1 from public.questions q
  where q.owner_id is null
    and q.stem = v.stem
);

-- -----------------------------------------------------------------------------
-- Verification check (optional run in SQL editor to see counts):
-- select t.name, count(*)
-- from public.questions q
-- join public.topics t on t.id = q.topic_id
-- where q.owner_id is null
-- group by t.name
-- order by t.name;
-- -----------------------------------------------------------------------------
