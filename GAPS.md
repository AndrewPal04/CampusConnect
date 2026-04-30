# CampusConnect Requirements Gap Review

Reviewed on: 2026-04-30  
Scope reviewed: `server/` and `mobile/`

## Notes

- The full text of "Requirements Specification v1.1" is not present in this repository.
- Mapping below is based on requirement IDs referenced in `campus_event_tracker_v2.pptx` (traceability slide and roadmap slides).
- Status values:
  - `Implemented`: clearly present in current code.
  - `Partial`: some capability exists, but not complete to spec intent.
  - `Gap`: missing, or cannot be validated from the current codebase.

## UR-01 to UR-15

| ID | Status | Gap / Notes |
|---|---|---|
| UR-01 | Implemented | Event browse flow exists (`GET /api/events`, Home screen event feed). |
| UR-02 | Gap | Requirement text not available in repo; unable to verify exact behavior. |
| UR-03 | Partial | Search/filter are implemented; nearby/map capability is not implemented in current mobile/server code. |
| UR-04 | Implemented | RSVP create flow exists (`POST /api/rsvp/:eventId`). |
| UR-05 | Partial | Ticket display exists in mobile (`MyTicketScreen`), but advanced ticketing behavior depends on unimplemented payment/event-creation features. |
| UR-06 | Implemented | RSVP cancellation exists (`DELETE /api/rsvp/:eventId`). |
| UR-07 | Partial | QR check-in endpoint exists (`POST /api/rsvp/checkin`), but no full organizer scanner app workflow with production scan pipeline. |
| UR-08 | Implemented | Notifications list/read flows exist (`/api/users/notifications` + mobile Notifications screen). |
| UR-09 | Gap | Notification preferences management is not implemented (no preference model/API/UI). |
| UR-10 | Gap | Event creation flow is missing (no create-event API/UI). |
| UR-11 | Gap | Ticketing configuration for paid events is missing (no payment integration/ticket config APIs). |
| UR-12 | Gap | Analytics viewing UI/API is not complete for organizer/admin dashboards. |
| UR-13 | Gap | Admin alerting/policy-event notification workflow is not implemented end-to-end. |
| UR-14 | Partial | Org verification request + admin approval APIs exist; complete portal UI is not present in mobile app. |
| UR-15 | Partial | Account registration/login/profile update/logout exist; deeper account management (e.g., password reset/delete account) not present. |

## SR-01 to SR-20

| ID | Status | Gap / Notes |
|---|---|---|
| SR-01 | Implemented | Scraper infrastructure exists (`server/scrapers/*`, scheduler). |
| SR-02 | Gap | NLP deduplication is not implemented (dedupe mainly by `source_url` uniqueness). |
| SR-03 | Gap | BERT categorization is not implemented (keyword heuristic categorization is used). |
| SR-04 | Partial | Recommendation signal exists (`aiRecommended` heuristics), not a hybrid ML engine. |
| SR-05 | Gap | Personalized recommendation behavior is not fully implemented/validated. |
| SR-06 | Gap | Cold-start preference onboarding logic is not implemented end-to-end. |
| SR-07 | Gap | Paid ticket payment pipeline is not implemented. |
| SR-08 | Partial | QR token generation exists for RSVPs; broader ticketing platform behavior is incomplete. |
| SR-09 | Gap | No measurable SLA/performance validation for `<2s` QR validation in repo. |
| SR-10 | Gap | Event creation wizard and full capacity workflow are not implemented (capacity checks exist only at RSVP). |
| SR-11 | Partial | Notification records are generated in DB; push delivery infrastructure/SLA not implemented. |
| SR-12 | Gap | Featured placements / preference-linked notifications are not implemented. |
| SR-13 | Partial | Some aggregate attendance/event counters exist, but complete organizer analytics endpoints are incomplete. |
| SR-14 | Gap | Campus-wide aggregate analytics/reporting not implemented. |
| SR-15 | Implemented | Role-based access controls exist (`student`, `org_leader`, `admin`) in middleware/routes. |
| SR-16 | Partial | FERPA hardening improved: check-in response now returns aggregate counts only; broader compliance program/audit controls not present in repo. |
| SR-17 | Gap | Uptime objective not verifiable from code alone (no SLO/monitoring evidence in repo). |
| SR-18 | Gap | Search latency objective not benchmarked/verified in repo. |
| SR-19 | Gap | Horizontal scalability objective not validated (no scaling architecture/tests in repo). |
| SR-20 | Partial | Admin verification APIs exist (`/api/admin/orgs/:id`), but full verification portal UX is incomplete. |

## Security-Focused Changes Completed in This Pass

- Added request validation/sanitization on all POST/PATCH routes via `express-validator`.
- Added input length limits:
  - `name <= 100`
  - `description <= 2000`
  - `email <= 254`
- Added `helmet` and API rate limiting (`100 requests / 15 minutes`) in `server/index.js`.
- Removed attendee PII (`name/email`) from check-in response; now returns aggregate attendance counts only.
- Confirmed no API response returns `password_hash`.
- Removed dynamic SQL string construction patterns from key user-facing queries (`events` listing and user profile update), keeping value parameterization via `$1...$n`.
