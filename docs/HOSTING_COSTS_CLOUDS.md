# dbm-portal — Render vs AWS vs GCP cost comparison

**Date:** 2026-06-03
**Companion to:** [HOSTING_COSTS.md](./HOSTING_COSTS.md)

Same five customer-base tiers, same workload assumptions, three different clouds. Pricing pulled 2026-06-03 from [Render Pricing](https://render.com/pricing), [AWS Fargate Pricing](https://aws.amazon.com/fargate/pricing/), [Amazon RDS for PostgreSQL Pricing](https://aws.amazon.com/rds/postgresql/pricing/), [Amazon S3 Pricing](https://aws.amazon.com/s3/pricing/), [Cloud Run pricing](https://cloud.google.com/run/pricing), [Cloud SQL pricing](https://cloud.google.com/sql/pricing), [Cloud Storage pricing](https://cloud.google.com/storage/pricing), and [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/).

Vendor-neutral items (Anthropic Claude, Firebase Auth, Sentry, etc.) are identical across all three and excluded here — see HOSTING_COSTS.md for those. **This doc compares only the infrastructure layer that differs by cloud.**

---

## 1. Architecture mapping

| Layer | Render | AWS | GCP |
|---|---|---|---|
| Web (Next.js) | Web Service | ECS Fargate behind ALB | Cloud Run |
| API (NestJS) | Web Service | ECS Fargate behind ALB | Cloud Run |
| Postgres | Render Postgres | RDS Postgres (gp3) | Cloud SQL Postgres |
| Object storage | Cloudflare R2 | S3 + CloudFront | Cloud Storage (Standard) |
| TLS / domain / load balancer | included | ACM + ALB | included in Cloud Run |
| CDN | included basic | CloudFront | Cloud CDN |
| Egress to internet | $0.15/GB over plan | $0.05-0.09/GB (CloudFront) | $0.085-0.12/GB |
| Secrets | env vars | Secrets Manager / SSM | Secret Manager |

Two design choices matter for the AWS and GCP columns:
- **Keep Cloudflare R2 for blobs in all three scenarios.** R2's free egress saves $200-2,000/mo at Tier C+ vs S3/Cloud Storage. Mentally subtract ~$200-1,500/mo at Tier D and beyond if you instead pick the native option.
- **Multi-AZ Postgres at Tier C and up.** Render's Pro tier includes HA. AWS Multi-AZ doubles RDS cost. Cloud SQL HA adds ~50% on compute + 55% on storage.

---

## 2. Compute — web + API

### Render (web + API combined from HOSTING_COSTS.md)

| Tier | Web | API | Total |
|---|---:|---:|---:|
| A | 7 | 7 | **14** |
| B | 25 | 50 | **75** |
| C | 170 | 350 | **520** |
| D | 525 | 900 | **1,425** |
| E | 1,350 | 2,700 | **4,050** |

### AWS — ECS Fargate (Linux/ARM, always-on tasks)

Fargate ARM: $0.03238/vCPU-hr + $0.00356/GB-hr ≈ **$25.10/mo per (1 vCPU + 2 GB) task**. Add ALB at ~$22/mo flat + $0.008 per LCU-hr (~$10-50/mo).

| Tier | Task spec | Tasks | Fargate $/mo | ALB | Total |
|---|---|---:|---:|---:|---:|
| A | 0.5 vCPU + 1 GB | 2 | 32 | 22 | **54** |
| B | 1 vCPU + 2 GB | 2 web + 2 API | 100 | 25 | **125** |
| C | 2 vCPU + 4 GB | 2 web + 4 API | 360 | 40 | **400** |
| D | 2 vCPU + 4 GB | 4 web + 8 API | 720 | 80 | **800** |
| E | 4 vCPU + 8 GB | 6 web + 12 API | 2,170 | 200 | **2,370** |

### GCP — Cloud Run (Tier 1 region, request-based billing)

Cloud Run: $0.000024/vCPU-sec + $0.0000025/GiB-sec + $0.40/M requests. Best fit for spiky API workloads, scales to zero. For Tier D+ where traffic is steady, "min instances = N" mode bills similar to Fargate. Free tier offsets Tier A entirely.

| Tier | Approach | Est $/mo |
|---|---|---:|
| A | Request-based, free tier covers most | **5** |
| B | Request-based, modest steady traffic | **70** |
| C | Min instances = 2, request-based on top | **320** |
| D | Min instances = 4, busy | **750** |
| E | Min instances = 12, very busy | **2,150** |

### Compute roll-up

| Tier | Render | AWS Fargate | GCP Cloud Run |
|---|---:|---:|---:|
| A | 14 | 54 | 5 |
| B | 75 | 125 | 70 |
| C | 520 | 400 | 320 |
| D | 1,425 | 800 | 750 |
| E | 4,050 | 2,370 | 2,150 |

**Takeaway:** Render is *cheaper at Tier A* (small plans, predictable). AWS and GCP are *cheaper at Tier C and up* because their compute primitives are billed per-second by raw resource — you don't pay a 30-40% Render markup. Cloud Run's scale-to-zero makes Tier A almost free.

---

## 3. Postgres

### Render — flexible plans, $0.30/GB storage

| Tier | Compute $/mo | Storage $/mo | Total |
|---|---:|---:|---:|
| A | 6 | 3 | **9** |
| B | 19 | 15 | **34** |
| C | 75 | 75 | **150** |
| D | 100 | 300 | **400** |
| E (×2 HA) | 400 | 1,200 | **1,600** |

### AWS RDS Postgres (Multi-AZ from Tier C, gp3 storage $0.115/GB)

| Tier | Instance | Storage | Compute $/mo | Storage $/mo | Total |
|---|---|---:|---:|---:|---:|
| A | db.t4g.micro Single-AZ | 20 GB | 15 | 3 | **18** |
| B | db.t4g.small Single-AZ | 50 GB | 30 | 6 | **36** |
| C | db.m6g.large Multi-AZ | 250 GB | 268 | 58 | **326** |
| D | db.m6g.xlarge Multi-AZ | 1,000 GB | 536 | 230 | **766** |
| E | db.r6g.2xlarge Multi-AZ + read replica | 4,000 GB | 1,920 | 920 | **2,840** |

### GCP Cloud SQL Postgres (HA from Tier C, SSD storage $0.22/GB non-HA, $0.34/GB HA)

| Tier | Instance | Storage | Compute $/mo | Storage $/mo | Total |
|---|---|---:|---:|---:|---:|
| A | db-f1-micro (shared) | 10 GB | 7 | 2 | **9** |
| B | db-custom-1-3840 | 50 GB | 50 | 11 | **61** |
| C | db-custom-2-7680 HA | 250 GB | 220 | 85 | **305** |
| D | db-custom-4-15360 HA | 1,000 GB | 440 | 340 | **780** |
| E | db-custom-8-30720 HA + replica | 4,000 GB | 1,680 | 1,360 | **3,040** |

### Postgres roll-up

| Tier | Render | AWS RDS | GCP Cloud SQL |
|---|---:|---:|---:|
| A | 9 | 18 | 9 |
| B | 34 | 36 | 61 |
| C | 150 | 326 | 305 |
| D | 400 | 766 | 780 |
| E | 1,600 | 2,840 | 3,040 |

**Takeaway:** Render Postgres is materially cheaper at every tier, mostly because the storage rate ($0.30/GB) is similar to AWS gp3 but Render's HA primary doesn't double the price like RDS Multi-AZ does. At Tier D this is a **$350-400/mo gap**, at Tier E it's **$1,200+/mo**. This is Render's strongest cost advantage by far.

---

## 4. Object storage + egress

We keep R2 in all three scenarios for the recommended path, then show the native-option costs as the alternative.

### Cloudflare R2 (recommended on all clouds — egress free)

From HOSTING_COSTS.md table 3:

| Tier | $/mo |
|---|---:|
| A | 0 |
| B | 1 |
| C | 9 |
| D | 45 |
| E | 225 |

### If you used AWS S3 + CloudFront instead
S3 standard: $0.023/GB. CloudFront: 1 TB/mo free, then ~$0.085/GB.

Estimating egress = roughly storage × 1.5/mo for read traffic (PDFs viewed several times):

| Tier | Storage $/mo | CloudFront egress $/mo | Total |
|---|---:|---:|---:|
| A | 0 (free tier) | 0 | **0** |
| B | 2 | 0 (free TB) | **2** |
| C | 14 | 60 | **74** |
| D | 70 | 380 | **450** |
| E | 345 | 1,900 | **2,245** |

### If you used GCP Cloud Storage Standard instead
$0.020/GB storage + $0.12/GB internet egress.

| Tier | Storage $/mo | Egress $/mo | Total |
|---|---:|---:|---:|
| A | 0 (free tier) | 0 | **0** |
| B | 1 | 8 | **9** |
| C | 12 | 100 | **112** |
| D | 60 | 540 | **600** |
| E | 300 | 2,700 | **3,000** |

### Object storage roll-up

| Tier | Render + R2 | AWS native (S3+CF) | GCP native (GCS) | AWS/GCP using R2 |
|---|---:|---:|---:|---:|
| A | 0 | 0 | 0 | 0 |
| B | 1 | 2 | 9 | 1 |
| C | 9 | 74 | 112 | 9 |
| D | 45 | 450 | 600 | 45 |
| E | 225 | 2,245 | 3,000 | 225 |

**Takeaway:** Stay on R2 regardless of compute cloud. The native-storage savings only matter if you're already deep in that cloud's ecosystem for other reasons (e.g. heavy AWS Glue/Athena usage on the same data).

---

## 5. Bandwidth on the web/API tier

Egress from your compute services back to users. From HOSTING_COSTS.md, modeled traffic is ~90 MB/MAU/mo.

| Tier | Egress / mo | Render overage | AWS internet egress | GCP internet egress |
|---|---:|---:|---:|---:|
| A | 3 GB | 0 | 0 (free tier) | 0 (free tier) |
| B | 45 GB | 3 | 0 (under 100 GB free) | 4 |
| C | 360 GB | 50 | 23 | 31 |
| D | 1,800 GB | 266 | 153 | 204 |
| E | 9,000 GB | 1,200 | 801 | 1,068 |

AWS calc: ($0.09/GB after first 100 GB free). GCP calc: ($0.12/GB after first 5 GB free, premium tier).

Putting a CDN in front (CloudFront or Cloud CDN) cuts ~50% off these numbers and ships first 1 TB free on CloudFront. At Tier C+ that's worth it on AWS/GCP.

---

## 6. Workspace plans, support, and "everything else"

Often-overlooked cloud-side costs.

| Item | Render | AWS | GCP |
|---|---|---|---|
| Workspace / org plan | $0-499 flat | $0 (pay-per-use) | $0 (pay-per-use) |
| Build minutes | Included | Use GitHub Actions ($0-50) | Cloud Build ($0-50) |
| Support — basic | Email, business hours | Free Developer tier email-only | Free support, paid plans for SLA |
| Support — production tier | Included on Pro+ | Business $100/mo or 10% of bill, whichever is higher | Production $250/mo, Enhanced $500/mo |
| Container registry | Included | ECR $0.10/GB + $0.09/GB transfer | Artifact Registry $0.10/GB |
| Secrets | Env vars (free) | Secrets Manager $0.40/secret/mo + $0.05/10K calls | Secret Manager $0.06/secret/mo + $0.03/10K |
| NAT Gateway (if private subnets) | n/a | ~$45/mo + $0.045/GB | ~$45/mo + $0.045/GB |
| CloudWatch / Cloud Logging | n/a | $0.50/GB ingest, easy to hit $50-200 | $0.50/GB ingest, similar |

### Approximate "AWS overhead surcharge" at each tier
Things that don't exist on Render but do on AWS:

| Tier | NAT + ECR + Secrets + CW + Support |
|---|---:|
| A | 0 |
| B | 50 |
| C | 250 |
| D | 600 |
| E | 1,400 |

GCP is similar but slightly cheaper (~70% of AWS) because of free internal egress and cheaper logging.

---

## 7. Tier-by-tier roll-up — infra only (LLM/Auth/Sec excluded)

Numbers are infra components only: compute + Postgres + object storage + bandwidth + (cloud-overhead for AWS/GCP). Apples-to-apples.

### Tier A — Pilot (30 MAU)

| Line | Render | AWS | GCP |
|---|---:|---:|---:|
| Compute | 14 | 54 | 5 |
| Postgres | 9 | 18 | 9 |
| Object storage (R2) | 0 | 0 | 0 |
| Bandwidth | 0 | 0 | 0 |
| Cloud overhead | 0 | 0 | 0 |
| Workspace plan | 0 | 0 | 0 |
| **Tier A total** | **23** | **72** | **14** |

### Tier B — Small (500 MAU)

| Line | Render | AWS | GCP |
|---|---:|---:|---:|
| Compute | 75 | 125 | 70 |
| Postgres | 34 | 36 | 61 |
| Object storage (R2) | 1 | 1 | 1 |
| Bandwidth | 3 | 0 | 4 |
| Cloud overhead | 0 | 50 | 35 |
| Workspace plan | 25 | 0 | 0 |
| **Tier B total** | **138** | **212** | **171** |

### Tier C — Medium (4,000 MAU)

| Line | Render | AWS | GCP |
|---|---:|---:|---:|
| Compute | 520 | 400 | 320 |
| Postgres | 150 | 326 | 305 |
| Object storage (R2) | 9 | 9 | 9 |
| Bandwidth | 50 | 23 | 31 |
| Cloud overhead | 0 | 250 | 175 |
| Workspace plan | 25 | 0 | 0 |
| **Tier C total** | **754** | **1,008** | **840** |

### Tier D — Large (20,000 MAU)

| Line | Render | AWS | GCP |
|---|---:|---:|---:|
| Compute | 1,425 | 800 | 750 |
| Postgres | 400 | 766 | 780 |
| Object storage (R2) | 45 | 45 | 45 |
| Bandwidth | 266 | 153 | 204 |
| Cloud overhead | 0 | 600 | 420 |
| Workspace plan | 25 | 0 | 0 |
| **Tier D total** | **2,161** | **2,364** | **2,199** |

### Tier E — Viral (100,000 MAU)

| Line | Render | AWS | GCP |
|---|---:|---:|---:|
| Compute | 4,050 | 2,370 | 2,150 |
| Postgres | 1,600 | 2,840 | 3,040 |
| Object storage (R2) | 225 | 225 | 225 |
| Bandwidth | 1,200 | 801 | 1,068 |
| Cloud overhead | 0 | 1,400 | 980 |
| Workspace plan | 499 | 0 | 0 |
| **Tier E total** | **7,574** | **7,636** | **7,463** |

---

## 8. Side-by-side summary

Monthly **infra only** (no LLM, auth, security, headcount):

| Tier | Render | AWS | GCP | Cheapest |
|---|---:|---:|---:|---|
| A. Pilot | **23** | 72 | 14 | GCP |
| B. Small | **138** | 212 | 171 | Render |
| C. Medium | **754** | 1,008 | 840 | Render |
| D. Large | **2,161** | 2,364 | 2,199 | Render (barely) |
| E. Viral | 7,574 | 7,636 | **7,463** | GCP (barely) |

At Tier D and E, **the three are within 5-10% of each other on infra**. That's small enough that the right answer is almost never "switch for cost alone."

---

## 9. The costs that *aren't* on the bill

These are the real reasons companies don't just pick the cheapest:

### Engineering time to migrate from Render → AWS or GCP
- Rewriting `render.yaml` as Terraform / CDK / Pulumi: **~2 weeks of one senior engineer**
- Setting up VPC, subnets, IAM, security groups, ALB, target groups: **~1 week**
- CI/CD pipeline changes (GitHub Actions deploying to ECR/Artifact Registry, ECS/Cloud Run rolling deploys): **~1 week**
- Secret management migration (Render env vars → Secrets Manager / Secret Manager): **~3 days**
- Database migration with zero downtime (Render PG → RDS / Cloud SQL via logical replication): **~1 week + risk**
- Documentation, runbooks, on-call training: **~1 week**
- **Loaded cost: ~$25-50K and 6-8 weeks of focus.** That's 5-15 months of cloud-bill savings even at Tier D.

### Cognitive load and operational complexity
- Render: one dashboard, one yaml file, push to deploy, done.
- AWS: 30+ services minimum (VPC, IAM, ECS, ECR, ALB, RDS, S3, CloudFront, CloudWatch, Route53, ACM, Secrets Manager, KMS, IAM Identity Center, Cost Explorer, Budgets, GuardDuty…). Each has its own gotchas.
- GCP: fewer services than AWS but the IAM model is its own learning curve.
- A solo founder or 2-3 person team will be much more productive on Render until ~Tier C.

### Hidden cost surfaces on AWS/GCP
- **NAT Gateway** is sneaky. $45/mo each, multi-AZ doubles it, and $0.045/GB processing fees add up if your API does a lot of outbound calls (Claude, Firebase). Easy to land at $200-500/mo just on NAT at Tier C+.
- **CloudWatch Logs ingestion** at $0.50/GB hits fast — verbose logging can be $100-500/mo. The default RDS Performance Insights log group is a common surprise.
- **Cross-AZ data transfer** ($0.01/GB each way) on AWS becomes meaningful with chatty microservices.
- **GCP egress to Anthropic** is billed at $0.12/GB. If you're shipping 20 KB prompts × 100K calls/mo = small. But output is bigger and you also pull responses back.

### Switching cost in reverse — leaving AWS/GCP later is harder
Render is mostly a wrapper around git push. AWS/GCP install themselves into your build, deploy, IAM, monitoring, and networking. Lock-in is real and asymmetric.

---

## 10. When each cloud actually wins

### Stay on Render if any of these are true (probably most apply)
- Team size < 5 engineers
- No dedicated DevOps / platform engineer
- Customer base still under 25K MAU
- You value time-to-ship over absolute lowest cost
- You don't yet have specific compliance requirements that need fine-grained IAM (HIPAA/PCI/SOC 2)
- You're comfortable with us-east region (Oregon) and don't need multi-region

### Move to AWS if any of these become true
- You hit Tier D-E (50K+ users) AND have ≥1 dedicated SRE/platform engineer
- You need specific AWS-native services (Bedrock for inference, Redshift, Aurora Serverless v2, IoT Core, SageMaker for ML)
- You have an enterprise customer requiring "deployed on AWS in our region"
- You qualify for AWS Activate startup credits ($1-100K), which can offset year-1 spend completely
- Your team already has deep AWS expertise

### Move to GCP if any of these become true
- You're heavily using BigQuery for analytics on the same data
- You want Vertex AI / Gemini as a primary LLM alongside Claude
- You qualify for Google for Startups credits ($2-200K)
- You need GKE Autopilot for a more complex container topology
- Your team prefers GCP's UX (it is materially nicer than AWS's)

---

## 11. The recommended path

Given your stack and team size:

1. **Stay on Render through Tier C (10K users).** The math works, you ship faster, no migration. Total infra is $138-754/mo across A→C.
2. **At Tier C, hire a part-time SRE** and have them set up Terraform for your Render resources. This makes a future move portable.
3. **Re-evaluate at ~5,000 MAU.** If you've raised funding and want to court enterprise customers, AWS becomes attractive. If you're bootstrapped, the engineering time to move is better spent on features.
4. **If you must pre-optimize for the move someday:** keep blobs on R2 (already done), keep auth on Firebase (portable), use standard Postgres features only (no Render-specific extensions), avoid Render's Key-Value store, deploy via Docker (already done — your Docker images run anywhere).

The good news: **your current architecture is already cloud-portable.** The Dockerfile, Postgres schema, R2 client, Firebase Admin SDK, and Anthropic SDK all work identically on Fargate or Cloud Run with zero code changes. You're paying Render for the convenience layer, not lock-in.

---

## 12. Apples-to-apples decision table

| Concern | Render wins | AWS wins | GCP wins |
|---|:---:|:---:|:---:|
| Lowest infra cost A→C | ✅ | | |
| Lowest infra cost D | (~tied) | | (~tied) |
| Lowest infra cost E | | | ✅ (barely) |
| Easiest to operate | ✅ | | |
| Best Postgres value | ✅ | | |
| Most managed services | | ✅ | |
| Best startup credits | | ✅ | ✅ |
| Compliance breadth (SOC 2, HIPAA, FedRAMP) | | ✅ | ✅ |
| Speed to ship new features | ✅ | | |
| Multi-region maturity | | ✅ | ✅ |
| Lowest egress prices | | ✅ (CloudFront free TB) | |
| Best analytics integration | | (Redshift) | ✅ (BigQuery) |
| Best AI/ML services | | ✅ (Bedrock) | ✅ (Vertex) |
| Lowest cognitive load | ✅ | | |
| Smallest team can run it | ✅ | | |
