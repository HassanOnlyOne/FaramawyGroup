# Faramawy Group — B2B Wholesale & ERP Management Platform

A full-stack B2B e-commerce, inventory, and enterprise resource planning (ERP) system tailored for wholesale distribution and supply chain management. Built with **Next.js (App Router)**, **TypeScript**, and **Supabase (PostgreSQL)**.

## 🚀 Key Features & Architecture

- **Multi-Role Access Control (RBAC):** Granular permission system supporting `Super Owner`, `Admin/Manager`, `Sales Delegate`, `Warehouse Staff`, and `Verified Merchant/Customer`.
- **Order & Supply Chain Engine:** Real-time order processing, custom invoice generation, automated stock deduction, and delivery status tracking.
- **Financial & Credit Ledger:** Support for both Cash-on-Delivery (COD) and merchant credit limits, tracking previous balances, partial payments, and payment vouchers.
- **Real-Time Inventory & Auditing:** Stock level monitoring, low-stock alerts, category management, and a comprehensive system-wide **Audit Log** tracking all administrative actions.
- **Database Security & Integrity:** Enforced via Supabase Row-Level Security (RLS) policies, custom PL/pgSQL triggers, and automated schema synchronization.

## 🛠️ Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, Lucide Icons
- **Backend:** Next.js API Routes, Supabase Auth & Admin SDK
- **Database:** PostgreSQL (Supabase), PL/pgSQL Functions & Triggers, RLS Policies
- **Deployment:** Vercel (CI/CD)

## 📌 Active Development Roadmap

- [ ] Advanced analytics dashboard for delegate sales performance and route optimization.
- [ ] Automated PDF invoice and financial statement exports.
- [ ] Batch inventory import/export via CSV/Excel with validation pipelines.
- [ ] Webhook integrations for real-time WhatsApp/SMS order status notifications.