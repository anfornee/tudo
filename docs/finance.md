# Finance and Bills Module

## Purpose

The finance module provides personal financial visibility inside TUDO.

It is not intended to be full accounting software.

The primary goal is to quickly understand:

* Monthly obligations
* Upcoming bills
* Income
* Cash flow
* Debt
* Savings
* Financial progress

## Core Concepts

Potential financial entities include:

* Income
* Recurring bills
* Subscriptions
* Loans
* Debt balances
* Savings goals
* Accounts
* One-time expenses

Keep these concepts distinct when their behavior differs.

## Bills

A recurring bill may contain fields such as:

* Name
* Amount
* Due day
* Category
* Frequency
* Auto-pay status
* Active status

Possible categories include:

* Housing
* Utilities
* Transportation
* Insurance
* Debt
* Entertainment
* Health
* Subscriptions
* Other

Categories should remain flexible.

## Dashboard Integration

The main dashboard may surface finance information such as:

* Bills due soon
* Total upcoming bills
* Monthly recurring expenses
* Remaining monthly obligations
* Savings progress
* Debt progress

Detailed calculations should remain inside the finance domain.

The dashboard should consume already-computed values where practical.

## Financial Calculations

Financial calculations should be deterministic and separated from rendering.

Examples include:

* Monthly recurring expense totals
* Disposable income
* Loan payoff projections
* Interest calculations
* Remaining balances
* Savings projections
* Cash-flow forecasts

Prefer pure utility functions where possible.

For example:

```text
calculateMonthlyExpenses(bills)
calculateLoanPayoff(...)
calculateDisposableIncome(...)
```

Avoid embedding complex formulas directly into React components.

## Debt Tracking

Loans may eventually track:

* Original balance
* Current balance
* APR
* Minimum payment
* Payment amount
* Remaining term
* Payoff date
* Interest paid
* Interest remaining

Potential tools include:

* Extra-payment scenarios
* Refinancing comparisons
* Payoff projections
* Debt prioritization

Calculated estimates should be clearly distinguished from known account values.

## Income

Income may include:

* Regular pay
* Bonus income
* Other recurring income
* One-time income

Where pay schedules vary, normalize carefully rather than assuming four checks per month.

Examples include:

* Weekly
* Biweekly
* Semimonthly
* Monthly

Annualized and monthly averages should be calculated explicitly.

## Cash Flow

A useful cash-flow view may include:

```text
Income
- Fixed obligations
- Variable expected expenses
- Debt payments
- Savings
= Remaining cash flow
```

Avoid implying that a theoretical monthly average is identical to actual account cash at any moment.

## Dates

Bill scheduling should correctly handle:

* Month length
* Due dates
* Upcoming month transitions
* Recurring dates
* Paid / unpaid state

Avoid brittle calculations based solely on string comparisons.

## Data Integrity

Financial values should not be fabricated.

Distinguish between:

* User-entered values
* Imported values
* Calculated values
* Estimated values

Calculations should preserve appropriate precision.

Round values primarily for display rather than unnecessarily during intermediate calculations.

## Security and Privacy

Financial information is sensitive.

Avoid:

* Logging unnecessary financial values
* Exposing data in URLs
* Persisting secrets in client-side source
* Hardcoding credentials
* Sending financial information to unrelated services

Use environment variables for secrets and API credentials.

## UX Philosophy

The finance module should reduce anxiety, not create more bookkeeping.

Prefer:

* Clear totals
* Upcoming obligations
* Useful comparisons
* Simple editing
* Easy-to-understand projections

Avoid requiring excessive categorization or manual maintenance for minor benefits.

## Future Features

Possible additions include:

* Account integrations
* Transaction imports
* Spending categories
* Net worth tracking
* Savings goals
* Debt payoff simulations
* Monthly history
* Charts
* Budget targets
* Credit tracking
* Financial alerts

These should be introduced only as they become useful.
