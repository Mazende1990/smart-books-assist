# AI Ledger

Build a modern SaaS web application called AccountAI, an AI-powered accounting assistant for small and medium-sized businesses.

The application should provide a ChatGPT-style interface where business owners can ask questions about accounting, bookkeeping, VAT, taxes, invoices, expenses, and their company's financial data.

The goal is NOT to create a simple chatbot. Build the foundation for an AI accounting agent that can eventually connect to accounting systems, retrieve company data, use tools, analyze transactions, and perform controlled accounting workflows.

Tech Stack

Use:

React / Next.js

TypeScript

Tailwind CSS

Supabase for database and authentication

Server-side API routes/functions for AI calls

An LLM API for the AI assistant

Clean modular architecture so accounting integrations can be added later

Never expose API keys in frontend code.

Authentication

Create:

Sign up

Login

Logout

Forgot password

Protected dashboard

Each user belongs to a company/workspace.

All conversations and company data must be isolated by user/company.

Use Supabase Row Level Security where appropriate.

Main Dashboard

Create a professional accounting SaaS dashboard.

Sidebar navigation:

Overview

AI Assistant

Transactions

Documents

Reports

Integrations

Settings

The design should feel trustworthy, modern, minimal, and appropriate for a financial/accounting product.

AI Assistant

Create a ChatGPT-style accounting assistant.

The interface should contain:

Conversation history

New conversation button

Message input

Send button

Loading state

Markdown responses

Suggested questions

Ability to create multiple conversations

Example suggested questions:

"What VAT do I need to pay this month?"

"Explain this transaction."

"How much did my company spend on software this year?"

"Are there any transactions that look incorrectly categorized?"

"How is the company performing compared with last month?"

Store conversations and messages in Supabase.

AI Agent Architecture

Do NOT implement the assistant as only:

user message → LLM → response.

Create an agent/tool architecture.

The backend should determine whether the AI needs to:

Answer from general accounting knowledge.

Search company data.

Retrieve transactions.

Retrieve invoices/documents.

Perform a calculation.

Generate an accounting report.

Ask the user for missing information.

Create a modular tool layer that the AI can call.

Initial tools can use mock/demo data but should be structured so real APIs can replace them later.

Create tools/functions such as:

get_transactions

search_transactions

get_invoice

get_company_financial_summary

calculate_vat_summary

get_expenses_by_category

compare_financial_periods

search_accounting_knowledge

Each tool should have clearly defined input and output types.

Agent Workflow

The expected workflow is:

User question
→ understand intent
→ decide whether tools are required
→ call appropriate tool(s)
→ analyze returned information
→ generate a clear answer
→ show the user what information was used

For example:

User:

"How much VAT do I need to pay for July?"

Agent:

Determine requested accounting period.

Retrieve relevant transactions.

Calculate output VAT.

Calculate deductible input VAT.

Calculate estimated VAT payable.

Explain the calculation.

Example response:

"Your estimated VAT payable for July is 18,450 SEK.

Output VAT: 31,200 SEK
Deductible input VAT: 12,750 SEK
Estimated VAT payable: 18,450 SEK."

Clearly label calculations based on incomplete or demo data as estimates.

Transactions

Create a transactions page containing a table with:

Date

Description

Supplier/customer

Amount

VAT

Account/category

Status

Allow filtering by:

Date

Category

Amount

Supplier/customer

Status

For the MVP, populate it with realistic demo accounting data.

Documents

Create a documents page for:

Supplier invoices

Customer invoices

Receipts

Other accounting documents

Create the UI for uploading documents.

Store document metadata securely.

Design the architecture so document parsing/OCR can be implemented later.

Reports

Create a reports section containing:

Revenue

Expenses

Profit

VAT summary

Expense categories

Allow users to select accounting periods.

Use charts where appropriate.

Integrations

Create an integrations page.

Show cards for future integrations such as:

Fortnox

Visma

Bank connection

Email

Document storage

For now these can display:

"Coming soon"

However, structure the application so integrations can later provide tools to the AI agent.

For example:

Fortnox API
→ integration service
→ normalized accounting data
→ agent tools
→ AI assistant.

Do not tightly couple the AI assistant directly to one accounting provider.

Safety and Accounting Controls

Accounting is a high-trust domain.

The AI must distinguish between:

informational answers

calculations

recommendations

proposed accounting actions

executed actions

The agent must NEVER silently execute sensitive financial/accounting actions.

For actions such as:

changing bookkeeping entries

creating journal entries

submitting VAT declarations

sending invoices

initiating payments

deleting accounting records

require explicit user confirmation.

Use a workflow like:

AI proposes action
→ show exactly what will happen
→ user approves
→ backend executes action
→ audit log records result.

For the MVP, action execution can be mocked.

Audit Log

Design an audit system that records important agent activity.

Store:

User

Timestamp

User request

Tool called

Important parameters

Result/status

Whether user approval was required

Whether approval was granted

Do not store secrets or unnecessary sensitive information in logs.

Database

Create appropriate Supabase tables such as:

profiles

companies

company_members

conversations

messages

transactions

documents

integrations

agent_runs

agent_tool_calls

approval_requests

audit_logs

Use UUID primary keys and timestamps.

Create proper relationships and indexes.

Enable Row Level Security so users can only access data belonging to companies they are authorized to access.

Demo Mode

Create a demo company with realistic fictional accounting data so the application can be tested without connecting a real accounting system.

Include:

Revenue

Expenses

Purchases

Sales

VAT transactions

Several invoices

Multiple accounting categories

The AI assistant should be able to use this demo data through the agent tools.

Important Development Requirements

Build this as a real extensible SaaS application rather than a static prototype.

Keep:

UI

AI orchestration

agent tools

accounting logic

integrations

database access

separated into appropriate modules.

Use TypeScript types throughout the application.

Validate server-side inputs.

Handle API and AI errors gracefully.

Never expose database service-role keys or LLM API keys to the browser.

Do not let the LLM directly query the database using arbitrary SQL. Give it access only through validated server-side tools.

Initial Goal

The first working version should allow me to:

Create an account.

Log in.

Open the accounting dashboard.

View demo transactions.

Start a conversation with the AI assistant.

Ask accounting questions.

Let the agent decide when company data is needed.

Let the agent call predefined accounting tools.

Receive answers based on demo company data.

View basic financial reports.

See agent/tool activity in an audit log.

Prioritize getting this complete end-to-end flow working before adding advanced features.

After generating the application, explain:

The project architecture.

The database schema.

How the AI agent works.

Where the LLM API is configured.

How tools are registered with the agent.

How to add a new agent tool.

How Supabase authentication and RLS work.

Which parts currently use mock data.

What needs to be implemented before connecting real accounting customers.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/913f1335-2d69-4460-9bba-2c097d00ed53).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
