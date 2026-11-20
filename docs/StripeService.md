# StripeService

`RentalWeb/Services/StripeService.cs` holds all payment and booking logic. `StripeController` is a thin router: it checks the JWT, reads the caller's user id and admin flag, calls one service method, and maps the result to an HTTP status. The pseudo-code below is simplified; see the source for exact behaviour.

## Big picture

```
Browser ──► StripeController ──► StripeService ──► Stripe API  (Checkout, Refunds, Customers)
                                      │
                                      └──────────► Database    (Booking, Payment, Refund, StripeWebhookEvent)

Stripe ──webhook──► StripeController.Webhook ──► StripeService.HandleWebhookAsync
```

Rules that apply everywhere:
- The client only sends a rental id and dates. **Amounts, status and fees are always computed on the server.**
- Stripe Checkout hosts the card form, so card data never reaches this server.
- Failures the caller should see are thrown as `PaymentException` (kind: Validation, NotFound, Conflict, Upstream). The controller maps them to 400 / 404 / 409 / 502. Anything else becomes a generic 500.
- A user can only see or cancel their own bookings and payments. Someone else's id returns **NotFound** (not Forbidden), so ids can't be probed. Admins can see everything.

## Lifecycle of a booking

```
CreateCheckout ─► Booking: PendingPayment   Payment: Pending
                      │
   customer pays      │  hold expires / session expires      CancelPending
        │             │            │                              │
        ▼             │            ▼                              ▼
 Booking: Confirmed   │    Booking: Expired               Booking: Cancelled
 Payment: Succeeded   │    Payment: Canceled              Payment: Canceled
        │
   CancelBooking
        │
        ▼
 Booking: Cancelled
 Payment: Refunded (no fee) or PartiallyRefunded (late-cancel fee kept)
```

Status changes from Stripe arrive through `SyncPaymentAsync` or the webhook; both end up in `ApplySessionAsync`.

## Configuration

| Setting | Where | Meaning |
|---|---|---|
| `Booking:CheckoutHoldMinutes` (31) | appsettings.json | How long an unpaid booking blocks its dates. Stripe needs a session to last at least 30 minutes. |
| `Booking:CancellationWindowDays` (7) | appsettings.json | Cancelling fewer than this many days before the start date costs a fee. |
| `Booking:LateCancellationFeePercent` (25) | appsettings.json | Percentage of the amount paid that is kept on a late cancel. |
| `STRIPE_SECRET_KEY` / `STRIPE_MOCK` | env | Real key, or the stripe-mock container (see `Program.cs`). |
| `STRIPE_WEBHOOK_SECRET` | env | Used to verify webhook signatures. |
| `APP_BASE_URL` | env | Used to build the Checkout success and cancel URLs. |

---

## Public methods

### CreateCheckoutAsync(userId, request)

Starts a booking and returns a Stripe-hosted payment page URL. Controller: `POST /api/stripe/checkout`.

```
today = current UTC date
if request.StartDate < today            -> Validation error
days = EndDate - StartDate
if days < 1 or days > 365               -> Validation error
rental = find rental by request.RentalId
if rental missing or not visible        -> NotFound
user = find user by userId              -> NotFound if missing

unitPriceCents = round(rental.pricePerDay * 100)
if unitPriceCents <= 0                  -> Validation error

booking = new Booking(
    status = PendingPayment,
    total  = unitPriceCents * days,
    expiresAt = now + CheckoutHoldMinutes)

begin transaction
    if any other booking for this rental overlaps [start, end)
       and is Confirmed, or PendingPayment and not yet expired
        -> Conflict "dates not available"
    save booking
commit

try
    customerId = EnsureCustomer(user)
    session = Stripe.CreateCheckoutSession(
        mode = payment, customer = customerId,
        one line item for booking.total,
        success/cancel URLs from APP_BASE_URL,
        expires at booking.ExpiresAt,
        metadata.bookingId = booking.Id,
        idempotency key = "checkout-" + booking.Id)
    save Payment(status = Pending, sessionId = session.Id, amount = booking.total)
    return (booking.Id, session.Url)
catch StripeException
    booking.status = Expired        // free the dates right away
    save
    -> Upstream error
```

### GetPaymentAsync(userId, isAdmin, paymentId)

Returns one payment. Controller: `GET /api/stripe/payments/{id}`.

```
payment = LoadPayment(userId, isAdmin, paymentId)   // NotFound if missing or not yours
return ToResponse(payment)
```

### GetBookingPaymentsAsync(userId, isAdmin, bookingId)

Returns every payment attempt for a booking, oldest first. Controller: `GET /api/stripe/bookings/{id}/payments`.

```
booking = LoadBooking(userId, isAdmin, bookingId)   // NotFound if missing or not yours
return booking.Payments ordered by CreatedAt, each ToResponse
```

### SyncPaymentAsync(userId, isAdmin, paymentId)

Manual "refresh from Stripe" for one payment. Safe to call repeatedly. Controller: `POST /api/stripe/payments/{id}/sync`.

```
payment = LoadPayment(userId, isAdmin, paymentId)
try    ApplySession(payment)
catch StripeException -> Upstream error
save
return ToResponse(payment)
```

### HandleWebhookAsync(rawBody, signatureHeader)

Receives events from Stripe. No JWT; the signature is the authentication. Controller: `POST /api/stripe/webhook`.

```
secret = STRIPE_WEBHOOK_SECRET          // not set -> server error (500)
if signatureHeader is empty             -> Validation error (400)
event = Stripe.VerifyAndParse(rawBody, signatureHeader, secret)
        if the signature is invalid     -> Validation error (400)

if event.Id already in StripeWebhookEvents
    return                              // duplicate delivery, ignore

Dispatch(event)                         // updates payment / booking in memory
record StripeWebhookEvent(event.Id)
save everything in ONE SaveChanges      // if anything failed, nothing is recorded,
                                        // so Stripe's retry will be processed again
if the save fails because another request recorded this event first
    ignore (duplicate)
```

#### Dispatch(event) (private)

```
switch the event's object:
    Checkout Session            -> find Payment by StripeCheckoutSessionId
    PaymentIntent (payment_failed) -> find latest Payment of metadata.bookingId
    Charge (charge.refunded)    -> find Payment by StripePaymentIntentId
                                   ApplyRefundTotals(payment, charge.AmountRefunded); done
    anything else               -> ignore

if no payment found: log a warning and return
ApplySession(payment)
```

### CancelPendingPaymentAsync(userId, isAdmin, bookingId)

Cancels a booking that has not been paid. No money moves. Controller: `POST /api/stripe/bookings/{id}/cancel-pending`.

```
booking = LoadBooking(...)
if booking.status != PendingPayment -> Conflict

for each Pending payment on the booking
    try
        Stripe.ExpireCheckoutSession(payment.sessionId)
        payment.status = Canceled
    catch StripeException
        // the customer probably paid at the same moment
        ApplySession(payment); save
        if payment is now Succeeded -> Conflict "already paid"
        else -> Upstream error

booking.status = Cancelled
save
return (bookingId, "Cancelled", fee 0, refund 0)
```

### GetCancellationQuoteAsync(userId, isAdmin, bookingId)

Shows what cancelling would cost, without changing anything, so the UI can ask the customer to confirm. Controller: `GET /api/stripe/bookings/{id}/cancel-quote`.

```
booking = LoadBooking(...)
payment = GetCancellablePayment(booking)
return BuildQuote(booking, payment)
```

### CancelBookingAsync(userId, isAdmin, bookingId)

Cancels a paid booking and refunds the customer, minus the late-cancellation fee if one applies. Controller: `POST /api/stripe/bookings/{id}/cancel`.

```
booking = LoadBooking(...)
payment = GetCancellablePayment(booking)
quote   = BuildQuote(booking, payment)          // fee and refund amounts

if quote.RefundCents > 0
    try
        refund = Stripe.CreateRefund(
            paymentIntent = payment.StripePaymentIntentId,
            amount = quote.RefundCents,
            idempotency key = "cancel-" + bookingId + "-" + refundCents)
    catch StripeException -> Upstream error      // nothing changed in our DB yet

    add Refund row (stripeRefundId, amount, reason, requestedBy = userId)
    ApplyRefundTotals(payment, alreadyRefunded + refundCents)

booking.status = Cancelled
save
    if the save fails on a duplicate refund id -> Conflict "already cancelled"
return (bookingId, "Cancelled", quote.FeeCents, quote.RefundCents)
```

---

## Private helpers

### BuildQuote(booking, payment)

The fee rule lives here; both the quote and the real cancel use it, so the numbers always agree.

```
daysUntilStart = booking.StartDate - today (UTC)
if daysUntilStart < 0 -> Conflict "rental already started"

late = daysUntilStart < CancellationWindowDays
fee  = late ? round(payment.Amount * FeePercent / 100) : 0
fee  = min(fee, payment.Amount)
refund = max(0, payment.Amount - alreadyRefunded - fee)
return (paid, fee, refund, late, window, percent, currency)
```

Example with the defaults (7 days, 25%), booking paid at $1000.00:

| Cancelled | Late? | Fee | Refund |
|---|---|---|---|
| 14 days before start | no | $0.00 | $1000.00 |
| 7 days before start | no (7 is not less than 7) | $0.00 | $1000.00 |
| 3 days before start | yes | $250.00 | $750.00 |
| After the start date | n/a | rejected (Conflict) | n/a |

### GetCancellablePayment(booking)

```
if booking.status != Confirmed
    -> Conflict (PendingPayment: "cancel it as unpaid", otherwise "already cancelled")
payment = the Succeeded payment on the booking
if none, or it has no PaymentIntent id -> Conflict
return payment
```

### ApplySession(payment)

The one place where Stripe's state is copied into our database. Used by sync, the webhook and the pending-cancel race handling.

```
session = Stripe.GetCheckoutSession(payment.sessionId, expand payment_intent.latest_charge)
booking = payment.Booking

payment.StripePaymentIntentId = session's payment intent (if not yet stored)
if the charge exists
    copy chargeId, receiptUrl, card brand, last4
    ApplyRefundTotals(payment, charge.AmountRefunded)

if session is "paid" and payment is Pending / Failed / Canceled
    payment.status = Succeeded, set PaidAt, clear failure info
    if booking is PendingPayment -> booking.status = Confirmed
    else log warning "paid for a booking that was already released: manual refund needed"
else if session is "expired" and payment is Pending
    payment.status = Canceled
    if booking is PendingPayment -> booking.status = Expired
else if payment is Pending and the intent has a last payment error
    store failure code and message      // customer can retry, so it stays Pending
```

A payment is never moved backwards out of Succeeded or a refunded state.

### ApplyRefundTotals(payment, totalRefundedCents)

```
if totalRefunded <= 0, or payment is Pending / Failed / Canceled -> do nothing
payment.AmountRefunded = min(totalRefunded, payment.Amount)
payment.status = (AmountRefunded >= Amount) ? Refunded : PartiallyRefunded
```

### EnsureCustomer(user)

```
if user already has StripeCustomerId -> return it
customer = Stripe.CreateCustomer(email, metadata.userId, idempotency key "customer-" + userId)
user.StripeCustomerId = customer.Id
save
return customer.Id
```

### LoadPayment / LoadBooking

```
LoadPayment: payment (with its booking) by id
LoadBooking: booking (with its payments) by id
if missing, or (caller is not admin and booking.UserId != userId)
    -> NotFound                      // same answer for "doesn't exist" and "not yours"
```

### BaseUrl()

```
url = APP_BASE_URL
if empty or not an absolute URL -> server error (misconfiguration)
return url without trailing "/"
```

### Upstream(stripeException, operation)

```
log the Stripe error details (server side only)
return PaymentException(Upstream, "The payment provider is unavailable. Please try again.")
// the client never sees Stripe's error text
```

### ToResponse(payment)

Maps a `Payment` to the `PaymentResponse` DTO (status as text, card brand and last4, receipt URL, amounts, timestamps).

---

## How the pieces work together: a typical booking

1. The customer picks dates; the frontend calls `POST /api/stripe/checkout`. `CreateCheckoutAsync` creates a `PendingPayment` booking and a `Pending` payment, and returns the Stripe URL.
2. The browser goes to Stripe, the customer pays, and Stripe redirects them back to `APP_BASE_URL`.
3. Stripe also sends `checkout.session.completed` to `/api/stripe/webhook`. `HandleWebhookAsync` verifies it, `ApplySession` marks the payment `Succeeded` and the booking `Confirmed`. If the webhook is late, the frontend can call `POST /payments/{id}/sync` to get the same result.
4. If the customer abandons checkout, either the session expires (`expired` webhook, booking becomes `Expired`) or they call `cancel-pending`.
5. Later, the customer calls `GET cancel-quote` to see the fee, then `POST cancel`. `CancelBookingAsync` refunds the amount minus any late fee. Stripe then sends `charge.refunded`, which `ApplyRefundTotals` applies again harmlessly.
