# Beauty Salon SaaS — Project Context

## 1. Project Overview

We are building a multi-tenant SaaS platform for premium beauty salons, starting with a premium nail salon oriented toward women.

The platform provides:

1. A public website for each salon.
2. Online appointment booking.
3. Customer accounts.
4. Staff appointment management.
5. Salon management/CMS.
6. Business analytics.
7. Reviews.
8. Newsletter management.
9. Multi-tenant architecture.

The first implementation will be for a single salon, but the architecture MUST support multiple salons from day one.

Each salon has its own public URL.

Example:

    yourplatform.com/salon/luxe-nails
    yourplatform.com/salon/beauty-house
    yourplatform.com/salon/nail-studio

The system should be designed so that custom domains could potentially be supported in the future without redesigning the core architecture.

---

# 2. Product Vision

The long-term vision is a SaaS platform where salons can create/manage their own digital presence and booking system.

Each salon is an isolated tenant.

Example:

    Platform
    ├── Salon A
    │   ├── Website
    │   ├── Customers
    │   ├── Staff
    │   ├── Services
    │   ├── Appointments
    │   ├── Reviews
    │   └── Analytics
    │
    ├── Salon B
    │   ├── Website
    │   ├── Customers
    │   ├── Staff
    │   ├── Services
    │   ├── Appointments
    │   ├── Reviews
    │   └── Analytics
    │
    └── Salon C
        └── ...

IMPORTANT:

Customers belong to ONE salon.

A customer must NOT be able to rotate between salons or have a global customer identity shared between salons.

The customer model should therefore be salon-scoped:

    customer.salon_id

Staff are also associated with a salon.

Platform administrators are separate from salon staff.

---

# 3. Technology Stack

Use:

- Next.js
- React
- TypeScript
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Vercel
- GitHub

Preferred architecture:

    Vercel
       |
       v
    Next.js
       |
       +-------------------+
       |                   |
       v                   v
    Public Website       Admin Dashboard
       |                   |
       +---------+---------+
                 |
                 v
             Supabase
          +------+------+
          |      |      |
         Auth   DB    Storage

Authentication:

- Google OAuth
- Email/password

Storage:

- Supabase Storage for portfolio images, artist images, service images, branding assets, etc.

---

# 4. Multi-Tenancy

Multi-tenancy is a first-class architectural requirement.

Every salon-owned entity must be scoped to a salon.

Typical entities should contain:

    salon_id

Examples:

    services.salon_id
    artists.salon_id
    customers.salon_id
    appointments.salon_id
    reviews.salon_id
    portfolio_items.salon_id
    notifications.salon_id

Supabase Row Level Security (RLS) MUST enforce tenant isolation.

Salon A must NEVER be able to access Salon B's data.

Do not rely only on application-level filtering such as:

    WHERE salon_id = currentSalon

RLS must provide the security boundary.

---

# 5. User Types / Roles

There are two broad levels of users.

## Platform Level

### Platform Admin

Responsible for the SaaS platform itself.

Potential responsibilities:

- Manage salons
- Manage salon owners
- View platform-level information
- Manage platform configuration
- Future subscription/billing management

Platform Admin is NOT a normal salon employee.

---

# 6. Salon Roles

Each salon can have:

## Owner

Full access to the salon.

Can manage:

- Staff
- Services
- Appointments
- Customers
- Portfolio
- Reviews
- Newsletter
- Website content
- Analytics
- Salon settings

## Manager

Operational administrator.

Can manage:

- Appointments
- Customers
- Staff
- Services
- Portfolio
- Reviews
- Website content
- Analytics

Permissions should be configurable in the future if necessary.

## Receptionist

Operational role.

Can:

- View appointments
- Manage appointments
- View/manage customers
- View calendar
- Take/open appointments
- Reschedule/cancel according to business rules

## Stylist / Artist

Can:

- View their appointments
- View Open Appointments
- Take Open Appointments
- Reject an appointment they previously accepted
- Complete appointments
- View relevant customer information
- Manage their own profile if allowed by permissions

The current product direction treats Receptionist and Stylist as sharing much of the same operational functionality. Do not unnecessarily create completely separate systems for them.

---

# 7. Public Website

Each salon has its own public website.

The landing page should contain:

1. Hero
2. Services
3. Portfolio
4. Artists
5. Brands carousel
6. FAQ
7. Reviews
8. Newsletter
9. Footer

The website should have a premium luxury visual direction.

## Branding

Use the "Luxury" direction:

- Black
- White
- Gold / metallic accents
- Elegant typography
- Serif typography where appropriate
- Editorial/high-end photography
- Premium beauty aesthetic
- Spacious layouts
- Sophisticated visual hierarchy

Avoid generic template-like beauty salon design.

The UI should feel like a premium boutique nail salon.

---

# 8. CMS Requirements

All public website content must be manageable from the admin dashboard.

The salon should NOT need a developer to update website content.

Admin/Manager should be able to manage:

- Hero content
- Services
- Service descriptions
- Service images
- Artists
- Artist profiles
- Portfolio
- Brands
- FAQ
- Reviews
- Newsletter
- Footer content
- Other salon settings

The system should be designed as a lightweight CMS.

---

# 9. Services

Services must be dynamic and configurable.

The salon starts with:

- Nails
- Manicure
- Pedicure
- Gel
- Acrylic

But the system MUST allow adding more services.

Use a category / service / variant structure.

Example:

    Category
      |
      +-- Service
             |
             +-- Variant
             +-- Variant

Example:

    Manicure
      |
      +-- Classic Manicure
      |      price: $25
      |      duration: 45 min
      |      buffer: 10 min
      |
      +-- Gel Manicure
      |      price: $40
      |      duration: 60 min
      |      buffer: 15 min
      |
      +-- French Gel Manicure
             price: $50
             duration: 75 min
             buffer: 15 min

A service/variant should support at least:

- Name
- Description
- Price
- Duration
- Buffer time
- Category
- Image
- Active/inactive state
- Ordering/position

The buffer time is configurable.

The booking engine must consider:

    service duration + buffer time

when calculating availability.

---

# 10. Artists

Every artist can perform all services.

However, every artist has their own profile and portfolio.

Important distinction:

## Service capability

All artists can perform all services.

Do NOT create unnecessary service restrictions per artist unless the product evolves to need this.

## Portfolio

The salon has a GENERAL portfolio.

Portfolio items do NOT have to be tied to a particular service.

Only Manager/Owner/Admin should manage portfolio content.

Portfolio items may contain:

- Image
- Title
- Description
- Artist
- Published/unpublished
- Sort order

The portfolio is primarily intended to showcase the salon's work.

---

# 11. Artist Schedules

Every artist has their own schedule.

The system must support:

- Weekly working hours
- Different hours per day
- Breaks
- Days off
- Vacation/time-off periods

Example:

    Maria

    Monday
    09:00 - 17:00
    Break: 13:00 - 14:00

    Tuesday
    10:00 - 18:00

    Wednesday
    OFF

Availability must be calculated using:

    Salon business rules
    +
    Artist schedule
    +
    Breaks
    +
    Time off
    +
    Existing appointments
    +
    Service duration
    +
    Service buffer

---

# 12. Booking Flow

Preferred customer booking flow:

    1. Select service
    2. Select artist preference
    3. Select date
    4. Select available time
    5. Authenticate/register
    6. Confirm booking

Artist selection:

    Option 1:
    Specific artist

    Option 2:
    Any artist

---

# 13. Booking — Specific Artist

Example:

    Gel Manicure
    Maria
    August 20
    2:00 PM

The system verifies Maria's availability.

If available:

    Appointment
    status = PENDING
    artist_id = Maria

The artist can accept the appointment.

Once accepted:

    status = CONFIRMED

---

# 14. Booking — Any Artist

This is a key product behavior.

If the customer selects:

    Any Artist

the system checks which artists are available.

Example:

    Maria   AVAILABLE
    Ana     AVAILABLE
    Laura   AVAILABLE

BUT:

The system MUST NOT assign an artist automatically.

The appointment is created as:

    status = OPEN
    artist_id = NULL

This is called an "Open Appointment".

Eligible staff members receive a notification.

Example:

    New Open Appointment

    Gel Manicure
    August 20
    2:00 PM

    [Take Appointment]

When an artist takes it:

    OPEN
       |
       v
    CONFIRMED

and:

    artist_id = selected artist

---

# 15. Appointment Rejection / Reopening

If an artist takes an appointment but later cannot perform it:

    CONFIRMED
       |
       v
    REJECTED / RELEASED
       |
       v
    OPEN

The appointment becomes available to eligible staff again.

The system should preserve an appointment event/history.

Example:

    Appointment Event:
    Maria took appointment

    Appointment Event:
    Maria released appointment

Do not destroy the history.

---

# 16. Appointment Statuses

Initial conceptual state machine:

    OPEN
    PENDING
    CONFIRMED
    CANCELLED
    REJECTED
    COMPLETED
    NO_SHOW

The final state machine and allowed transitions should be explicitly designed before implementation.

Important:

Not every role can perform every transition.

The system must enforce valid transitions.

---

# 17. Cancellation

Customer can cancel an appointment.

Cancellation is allowed ONLY until 24 hours before the appointment.

Example:

    Appointment > 24 hours away
    -> Customer can cancel

    Appointment <= 24 hours away
    -> Customer cannot cancel online

The exact business rule should be configurable in the future.

Staff/admin may have different permissions.

---

# 18. Rescheduling

Rescheduling is a MUST-HAVE feature.

Customers must be able to reschedule appointments.

Rescheduling should reuse the booking availability engine.

Flow:

    Existing Appointment
        |
        v
    Reschedule
        |
        v
    Select new date/time
        |
        v
    Validate availability
        |
        v
    Confirm
        |
        v
    Updated Appointment

Appointment history should preserve the rescheduling event.

---

# 19. Customer Account

Customers can authenticate with:

- Google
- Email/password

Customer account:

    My Account

    - Profile
    - Upcoming appointments
    - Appointment history
    - Reschedule
    - Cancel
    - Notifications
    - Account settings

Customers belong to ONE salon.

There is NO cross-salon customer identity.

Customer record should be salon-scoped:

    customers.salon_id

A customer from Salon A must not automatically exist in Salon B.

---

# 20. Notifications

Initial notification channels:

- Email
- In-app/dashboard notifications

Customer notifications:

- Booking request received
- Booking confirmed
- Booking rejected/released
- Appointment rescheduled
- Appointment cancelled
- Appointment reminder
- Review request

Staff notifications:

- New Open Appointment
- Appointment assigned
- Appointment cancelled
- Appointment rescheduled
- Other operational notifications

Push notifications and SMS/WhatsApp can be considered in the future.

---

# 21. Appointment Completion

When a stylist completes a service:

    Appointment
       |
       v
    COMPLETED

The staff records the amount paid.

Example:

    Appointment
    Service: Gel Manicure
    Price: $50
    Payment: $50
    Status: COMPLETED

This is NOT online payment yet.

We are simply recording the payment/result for business analytics.

Future version:

    Appointment
       |
       +-- Payment
              |
              +-- Online payment provider

The data model should not prevent future payment integration.

---

# 22. Future Online Payments

Online payments are NOT part of the initial MVP.

Future requirement:

    Book appointment
        +
    Pay deposit

Potential future flow:

    Booking
       |
       v
    Deposit Payment
       |
       v
    Confirmed

Do not tightly couple appointment creation to a specific payment provider.

---

# 23. Reviews

After an appointment is marked:

    COMPLETED

the customer receives a review request.

Review:

- 1–5 stars
- Comment

The review is associated with:

- Salon
- Customer
- Appointment
- Artist who completed the appointment

Example:

    Review
      salon_id
      customer_id
      appointment_id
      artist_id
      rating
      comment

Reviews can appear on the public landing page.

The artist should receive attribution for the review.

Example:

    ⭐⭐⭐⭐⭐
    "Amazing service!"

    — Customer
    Maria, Nail Artist

Admin/Manager should have moderation controls before a review is publicly displayed.

---

# 24. Analytics

The admin dashboard should provide business analytics.

Overview KPI cards:

- Appointments
- Revenue
- Customers
- Pending/Open appointments

Charts/analytics:

- Revenue over time
- Appointments over time
- Popular services
- Revenue by service
- Revenue by artist
- New vs returning customers
- Cancellation rate
- No-show rate
- Peak booking hours
- Customer growth
- Average ticket
- Review ratings
- Top artists
- Top services

Potential future feature:

    Business Insights

Example:

    "Gel Manicure bookings increased 18% this month."

Do not implement AI insights until the core analytics are reliable.

---

# 25. Revenue

Initial revenue calculation is based on completed appointments/payment records.

For example:

    Appointment
      price = 50
      payment_status = PAID
      status = COMPLETED

Revenue can be calculated from completed paid appointments.

The architecture should eventually support:

- deposits
- online payments
- refunds
- payment providers
- payment history

But these are future features.

---

# 26. Newsletter

Newsletter functionality should include:

    Newsletter
      |
      +-- Subscribers
      |
      +-- Campaigns
      |
      +-- Templates

Public landing page:

    Email
    [Subscribe]

Admin dashboard:

    Subscribers
    Campaigns
    Templates

Actual email marketing provider integration can be implemented later if needed.

---

# 27. Public URL Structure

Initial public URL strategy:

    /salon/[slug]

Examples:

    /salon/luxe-nails
    /salon/beauty-house

The salon slug uniquely identifies the public tenant.

Future custom domain support should remain possible.

---

# 28. Admin Dashboard

Dashboard navigation should roughly contain:

    Overview
    Calendar
    Appointments
    Customers
    Staff
    Services
    Portfolio
    Brands
    Reviews
    Newsletter
    Analytics
    Settings

Platform Admin should have a separate platform-level dashboard.

Do not mix Platform Admin concerns with normal salon admin functionality.

---

# 29. Calendar

The admin/staff calendar should allow staff to see:

- appointments
- open appointments
- confirmed appointments
- completed appointments
- cancellations
- artist schedules

The calendar must respect:

- artist schedules
- breaks
- time off
- appointment duration
- service buffer
- salon business hours

---

# 30. Security Requirements

Security is a first-class requirement.

Use:

- Supabase Auth
- PostgreSQL RLS
- Server-side authorization
- Role-based access control
- Tenant isolation

Never trust client-side role checks.

Never rely only on UI hiding.

Server/database authorization must enforce permissions.

Sensitive operations should be protected server-side.

---

# 31. Auditability

Important appointment actions should be recorded.

Potential appointment event model:

    appointment_events

Examples:

    CREATED
    ASSIGNED
    ACCEPTED
    RELEASED
    RESCHEDULED
    CANCELLED
    COMPLETED
    NO_SHOW

Useful metadata:

- appointment_id
- salon_id
- actor_user_id
- event_type
- previous status
- new status
- timestamp
- metadata

This is useful for:

- debugging
- analytics
- customer support
- operational history

---

# 32. MVP Philosophy

Do NOT attempt to build every future SaaS feature immediately.

Prioritize a reliable booking system and salon management system.

The booking engine and tenant isolation are more important than visual CMS complexity.

Potential MVP priorities:

1. Authentication
2. Salon / tenant architecture
3. Staff / roles
4. Services
5. Artist schedules
6. Availability engine
7. Booking
8. Open appointments
9. Appointment management
10. Customer account
11. Cancellation
12. Rescheduling
13. Appointment completion
14. Basic notifications
15. Reviews
16. Public website
17. Basic CMS
18. Basic analytics

Future:

- Online deposits
- Stripe/payment provider
- SMS/WhatsApp
- Push notifications
- Custom domains
- Subscription billing
- Advanced marketing
- AI insights
- Advanced platform administration

---

# 33. Development Principles

Before implementing large features:

1. Understand the domain.
2. Design the database.
3. Design state transitions.
4. Design authorization.
5. Design RLS.
6. Define server-side business rules.
7. Then implement UI.

Avoid building UI first and inventing the data model afterward.

Business rules must live in appropriate server/domain layers, not only React components.

Prefer strongly typed TypeScript.

Use reusable components.

Keep salon/tenant boundaries explicit.

Avoid premature abstraction.

Avoid overengineering for hypothetical features unless they affect foundational architecture.

---

# 34. Current Product Decisions

These are confirmed decisions and should not be re-opened unless a technical contradiction is discovered:

- Premium nail salon
- Women-oriented premium positioning
- Multi-tenant SaaS
- One physical location per salon initially
- Each salon has its own URL
- Customer belongs to exactly one salon
- Google + email/password authentication
- Individual artist schedules
- Configurable service duration
- Configurable service buffer time
- Category → Service → Variant model
- All artists can perform all services
- General salon portfolio
- Portfolio managed by Manager/Owner
- Specific artist booking
- Any artist booking
- Any artist = OPEN appointment, artist_id NULL
- Staff can take Open Appointments
- Customer cancellation cutoff = 24 hours
- Customer rescheduling is required
- Email + in-app notifications
- 5-star reviews + comments
- Reviews attributed to completing artist
- Appointment completion records payment amount
- No online payments in MVP
- Future deposit/payment support
- Admin analytics
- CMS-managed public website
- Supabase Storage
- Luxury visual design
- Platform Admin role
- Owner
- Manager
- Receptionist
- Stylist
- Next.js
- Supabase
- Vercel
- GitHub