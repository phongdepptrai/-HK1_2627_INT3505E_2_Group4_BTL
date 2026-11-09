// LEGACY pitches schema. NOT the current courts/payment/review model; do not run for the new frontend.
// Current requirements: docs/FRONTEND_HANDOFF.md. New backend/index implementation is deferred.
// DESIGN HANDOFF ONLY — review before running with mongosh against a development DB.
// No connection is opened and no command is executed by npm dev/build/test.
// Run explicitly, e.g. mongosh <development-uri> --file database/indexes.mongosh.js
// Does not delete data or drop collections. Existing conflicting records must be resolved first.
const keosanDb = db.getSiblingDB('keosan');

keosanDb.users.createIndex({ emailNormalized: 1 }, { unique: true, name: 'unique_user_email' });
keosanDb.venues.createIndex(
  { isActive: 1, district: 1, rating: -1, _id: 1 },
  { name: 'venue_catalog_region' },
);
keosanDb.venues.createIndex({ ownerId: 1, _id: 1 }, { name: 'owner_venues' });
keosanDb.pitches.createIndex(
  { venueId: 1, isActive: 1, type: 1, price: 1, _id: 1 },
  { name: 'venue_pitches_filter_price' },
);
// normalizedName is server-generated; multiple pitches of the same type are allowed.
keosanDb.pitches.createIndex(
  { venueId: 1, normalizedName: 1 },
  { unique: true, name: 'unique_pitch_name_in_venue' },
);
keosanDb.bookings.createIndex(
  { userId: 1, createdAt: -1, _id: -1 },
  { name: 'user_booking_cursor' },
);
keosanDb.bookings.createIndex(
  { userId: 1, status: 1, createdAt: -1, _id: -1 },
  { name: 'user_status_booking_cursor' },
);
keosanDb.bookings.createIndex(
  { pitchId: 1, status: 1, endAt: 1 },
  { name: 'upcoming_pitch_bookings' },
);
keosanDb.slotClaims.createIndex(
  { pitchId: 1, startAt: 1 },
  { unique: true, name: 'one_claim_per_pitch_slot' },
);
keosanDb.slotClaims.createIndex(
  { bookingId: 1 },
  { unique: true, name: 'one_slot_per_mvp_booking' },
);
keosanDb.cancellations.createIndex(
  { bookingId: 1 },
  { unique: true, name: 'one_cancellation_per_booking' },
);
keosanDb.idempotencyKeys.createIndex(
  { userId: 1, operation: 1, key: 1 },
  { unique: true, name: 'scoped_idempotency_key' },
);
keosanDb.idempotencyKeys.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'idempotency_retention' },
);
keosanDb.sessions.createIndex(
  { tokenHash: 1 },
  { unique: true, name: 'unique_session_token_hash' },
);
keosanDb.sessions.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'session_retention' },
);
