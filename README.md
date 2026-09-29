# Sentinel Uptime

> Production-grade uptime monitoring SaaS — track your URLs, get alerted on incidents, share public status pages.

[![CI](https://github.com/sgonzalez-devv/sentinel-uptime/actions/workflows/ci.yml/badge.svg)](https://github.com/sgonzalez-devv/sentinel-uptime/actions/workflows/ci.yml)
[![Deploy](https://github.com/sgonzalez-devv/sentinel-uptime/actions/workflows/deploy.yml/badge.svg)](https://github.com/sgonzalez-devv/sentinel-uptime/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Overview

Sentinel is a multi-tenant uptime monitoring platform. Users register monitors (URLs), a distributed worker polls them on configurable intervals, and incidents are created automatically when services go down. Every account gets a public-facing status page.

**Live features:**
- HTTP/HTTPS endpoint monitoring with configurable intervals (1–60 min)
- Automatic incident creation and resolution
- Response-time history with p50/p95 metrics
- Public status pages (`/status/:slug`)
- Email + webhook alerting via SQS
- Multi-tenant with JWT auth

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                            AWS Cloud                                 │
│                                                                      │
│  ┌──────────────┐       ┌──────────────────────────────────────┐    │
│  │  CloudFront  │──────▶│   S3  (Next.js static build)         │    │
│  └──────────────┘       └──────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────┐       ┌──────────────────────────────────────┐    │
│  │     ALB      │──────▶│   ECS Fargate  (NestJS API)          │    │
│  └──────────────┘       └──────────────┬─────────────────────┘    │
│                                         │                           │
│                          ┌──────────────┼──────────────┐           │
│                          │              │              │            │
│                   ┌──────▼──────┐ ┌────▼──────┐ ┌────▼──────┐   │
│                   │  RDS Aurora │ │ SQS Queue │ │  Secrets  │   │
│                   │ (PostgreSQL)│ │ (alerts)  │ │  Manager  │   │
│                   └─────────────┘ └───────────┘ └───────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  EventBridge (cron: every 1 min) ──▶ Lambda (monitor worker) │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | Next.js 14, TypeScript, Tailwind, shadcn/ui | Dashboard + status pages |
| API | NestJS, TypeORM, PostgreSQL | REST API, auth, business logic |
| Worker | AWS Lambda (Node.js 20) | Polls monitored URLs every minute |
| Database | AWS RDS Aurora PostgreSQL | State persistence |
| Queue | AWS SQS | Decoupled alert delivery |
| CDN | AWS CloudFront + S3 | Static frontend delivery |
| IaC | Terraform 1.8+ | All AWS infrastructure |
| CI/CD | GitHub Actions | Test → Build → Push ECR → Deploy ECS |

---

## Local Development

**Prerequisites:** Docker 24+, Node.js 20+, pnpm 9+

```bash
# 1. Clone and install
git clone https://github.com/sgonzalez-devv/sentinel-uptime.git
cd sentinel-uptime
pnpm install

# 2. Start infrastructure (PostgreSQL + LocalStack)
docker-compose up -d

# 3. Run migrations
pnpm --filter api db:migrate

# 4. Start dev servers (API + web in parallel)
pnpm dev
```

The API runs on `http://localhost:3001` and the web on `http://localhost:3000`.

### Environment variables

Copy `.env.example` to `.env` in each app:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

---

## Deployment

All infrastructure is managed with Terraform. A single `terraform apply` provisions:
- VPC with public/private subnets across 2 AZs
- ECS Fargate cluster with auto-scaling
- RDS Aurora PostgreSQL (Multi-AZ in production)
- ALB with HTTPS termination
- CloudFront distribution + S3 bucket
- Lambda worker + EventBridge schedule
- SQS queue with dead-letter queue
- Secrets Manager entries
- IAM roles with least-privilege policies

```bash
cd infrastructure/terraform

# Initialize (first time)
terraform init

# Plan
terraform plan -var-file=environments/production.tfvars

# Apply
terraform apply -var-file=environments/production.tfvars
```

> CI/CD deploys automatically on push to `main` — see `.github/workflows/deploy.yml`.

---

## Project Structure

```
sentinel-uptime/
├── apps/
│   ├── api/              # NestJS REST API
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/         # JWT auth (register, login, refresh)
│   │       │   ├── monitors/     # Monitor CRUD + pause/resume
│   │       │   ├── checks/       # Check history + metrics
│   │       │   └── incidents/    # Incident tracking
│   │       └── workers/          # URL poller (also deployed as Lambda)
│   └── web/              # Next.js 14 App Router frontend
│       └── src/
│           ├── app/
│           │   ├── dashboard/    # Main dashboard
│           │   ├── monitors/     # Monitor management
│           │   └── status/[slug] # Public status pages
│           └── components/
├── infrastructure/
│   └── terraform/        # Complete AWS IaC
├── .github/
│   └── workflows/        # CI + deploy pipelines
└── docker-compose.yml    # Local dev stack
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get JWT tokens |
| GET | `/monitors` | List user's monitors |
| POST | `/monitors` | Create monitor |
| PATCH | `/monitors/:id` | Update monitor |
| DELETE | `/monitors/:id` | Delete monitor |
| GET | `/monitors/:id/checks` | Check history (paginated) |
| GET | `/monitors/:id/metrics` | p50/p95 response times |
| GET | `/incidents` | List incidents |
| GET | `/status/:slug` | Public status page data |

---

## Tech Decisions

**Why NestJS over Express?** Dependency injection, decorators, and module boundaries enforce separation of concerns at scale — easier to hand off to a team.

**Why ECS Fargate over Lambda for the API?** Persistent DB connections via TypeORM connection pooling. Lambda cold starts + connection churn against RDS was measurably worse in load tests.

**Why the monitor worker IS a Lambda?** It's a pure function: receive list of URLs, make HTTP requests, write results. Stateless, event-driven, and runs once per minute — Lambda's natural fit.

**Why SQS for alerts?** Decouples the monitor worker from email/webhook delivery. If the alert provider is slow or down, checks keep running and alerts drain when it recovers.

---

## License

MIT
