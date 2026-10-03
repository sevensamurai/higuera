# Payments: how they work today, and options for later

**Status:** not planned. These notes are for when payments become a bottleneck. Written October 2026;
check the providers' current terms before building anything.

## Today

Payments happen outside the app, **mostly by bank transfer**. The app only records the outcome:

- Each confirmed session has a payment status, *Payment pending* or *Paid*.
- The researcher marks a session paid after seeing the money arrive, with an optional note such as
  "transferencia 12/10". The client sees the status on their dashboard and session page.
- Clients can't change payment status. `firestore.rules` allows them to update only one thing on a
  booking: withdrawing their own pending request.

This is deliberate. Electronic payments in Chile aren't frictionless for small businesses, paying
from overseas is a pain for clients, and the researcher's clients are already used to bank transfers.

## The problems worth solving, in order

1. **Clients ask "how much, and where do I send it?"** The answer lives in emails and chats today.
2. **The researcher has to match each incoming transfer to a session.**
3. **Clients abroad** can't easily send a Chilean bank transfer.
4. **Confirming a payment is manual.** Fine at a few sessions a month; tedious at many.

Each option below solves more of these, at more cost and friction. They build on each other.

## Option A: transfer instructions in the app (no new services, stays on the free plan)

Make the existing bank-transfer habit smoother without involving any payment company.

- **Bank details shown once a session is confirmed and unpaid:** bank, account type and number,
  holder name, RUT, and the email address for the receipt. The researcher edits them in one place,
  e.g. a `content/payment` document in both languages. Make it readable by signed-in users only,
  not public like `content/overview`.
- **A reference code per session** (e.g. `FR-7K3Q`, derived from the booking ID) for the client to
  put in the transfer comment. That solves the matching problem.
- **An "I've made the transfer" button.** It sets a separate `paymentClaimedAt` field, so the
  researcher sees *Client reports paid* and checks the bank. Only the researcher can still set
  *Paid*. The rules would allow the owner to set only that one field.
- **The amount, if known.** The app stores no prices today; see *Prices* below. Without prices,
  this option still works: the researcher states the amount in a note.

Effort: about half a day. No billing account, no fees, no new accounts for the business.

## Option B: clients abroad

The app can't fix international banking, but it can point clients to the least painful route.
Ways for a client abroad to pay a Chilean account:

- **Money-transfer services** such as Wise or Global66. The client pays in their own currency and
  the money arrives in CLP in the researcher's account. Usually much cheaper than a bank wire.
- **PayPal** to the researcher's PayPal account. Easy for the client; check fees and how
  withdrawals reach a Chilean bank.
- **International (SWIFT) wire.** Works, but it's slow, with fees on both sides.

In the app, this is a small extra on Option A: a short "Paying from abroad" note with whichever
links the researcher uses, plus an optional approximate amount in the client's currency,
labelled as approximate.

## Option C: automatically confirmed bank transfers

Services such as **Khipu** (also offered through **Flow.cl**) start a bank transfer from the
client's own Chilean bank and notify the app when it completes. It's the same habit, with no
manual matching.

What it takes:
- **Paid Firebase plan:** the provider calls a server address on completion, which needs a Cloud
  Function. Expected cost is $0 at this volume, but it requires a billing account.
- **Prices per session**, since the provider needs an exact amount.
- **Two small functions:** one creates the payment and sends the client to the provider; the other
  receives the notification, checks its authenticity with the provider, and marks the session paid.
- **A per-transaction fee** to the provider, plus account verification for the business.

This only helps clients with Chilean bank accounts; clients abroad still need Option B.

## Option D: card checkout

**Mercado Pago Checkout Pro** or **Flow (Webpay)** for cards in Chile, and possibly **PayPal** for
clients abroad. The technical shape is the same as Option C, but card fees are higher.

**Stripe isn't available to businesses based in Chile.** Its supported-countries list includes
Brazil and Mexico in Latin America, not Chile. Using it would mean a company registered abroad.

## Applies to every option

- **Prices.** Nothing in the data model stores an amount. Prices could be set per session type and
  length on the Availability page, with an optional override when confirming a session. The
  currency is CLP; amounts in other currencies are informational only.
- **Keep the manual "Mark paid"** in every option, for cash, transfers outside the app, and
  corrections.
- **Tax documents.** Chilean freelancers usually issue a *boleta de honorarios*, and no payment
  provider issues it automatically. Check with the accountant. The app could later store the boleta
  number per session.
- **Refunds** start manual: in the bank, or in the provider's dashboard.
- **Security.** Only the researcher, or server code acting on a verified provider notification,
  may set a session to *Paid*. A client's "I've paid" goes in its own field, never in `payment`.

## Recommendation

1. **Option A** (plus Option B's note) as soon as answering "how do I pay?" becomes repetitive.
   It's cheap, has no fees, and matches how clients already pay.
2. **Option C** if volume grows enough that matching transfers by hand becomes real work.
3. **Option D** only if clients ask to pay by card.

## Where the changes would go

| Area | File |
|---|---|
| Booking fields (`paymentClaimedAt`, `paymentRef`, `amount`, `currency`) | `src/types.ts`, `src/services/bookings.ts` (next to `setPayment`) |
| Session payment section, "Pay now" / "I've transferred" | `src/views/SessionDetailView.vue` |
| Payment badge (*Client reports paid*) | `src/components/PaymentBadge.vue` |
| Owner may set only `paymentClaimedAt` | `firestore.rules`, the `bookings` update rule; tests in `tests/rules.test.mjs` |
| Bank details and prices editor | `src/views/admin/AvailabilityView.vue`, new `content/payment` doc |
| All new text, in both languages | `src/i18n/en.ts`, `src/i18n/es.ts` |
| Provider notification handler (Options C, D) | new `functions/` directory; deployed by `.github/workflows/pipeline.yml` |
