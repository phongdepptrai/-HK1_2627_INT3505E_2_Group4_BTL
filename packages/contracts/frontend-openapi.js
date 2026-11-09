// Frontend handoff contract. The future backend is NOT implemented by this file.
// Browser fixtures implement UI scenarios; callback handling is backend-only.
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const str = (extra) => ({ type: 'string', ...extra });
const number = (minimum = 0, extra = {}) => ({ type: 'integer', minimum, ...extra });
const obj = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required,
});
const arr = (items) => ({ type: 'array', items });
const id = str({
  minLength: 1,
  description: 'Opaque ID. Clients must not assume ObjectId/UUID/seed values.',
});
const dateTime = str({ format: 'date-time' }),
  nullableTime = { type: ['string', 'null'], format: 'date-time' };
const imageKey = str({ enum: ['pitch-1', 'pitch-2', 'pitch-3'] });
const status = str({ enum: ['active', 'inactive'] });
const price = number(50000, { maximum: 3000000, description: 'Integer VND per hour.' });
const teamSize = { type: ['integer', 'null'], enum: [5, 7, 11, null] };
const user = {
  id,
  email: str({ format: 'email' }),
  fullName: str({ minLength: 2, maxLength: 80 }),
  phone: str({ pattern: '^0[0-9]{9}$' }),
  role: str({ enum: ['CUSTOMER', 'OWNER', 'ADMIN'] }),
};
const venueInput = {
  name: str({ minLength: 3, maxLength: 100 }),
  address: str({ minLength: 5, maxLength: 250 }),
  district: str({ minLength: 2 }),
  city: str({ minLength: 2 }),
  description: str({ minLength: 10, maxLength: 2000 }),
  openTime: str({ pattern: '^([01][0-9]|2[0-3]):[03]0$' }),
  closeTime: str({ pattern: '^([01][0-9]|2[0-3]):[03]0$' }),
  timezone: str({ const: 'Asia/Ho_Chi_Minh' }),
  status,
  imageKey,
  amenities: {
    ...arr(str({ enum: ['parking', 'lights', 'water', 'changing'] })),
    uniqueItems: true,
  },
};
const courtInput = {
  name: str({ minLength: 3, maxLength: 100 }),
  sportTypeId: id,
  teamSize,
  basePricePerHour: price,
  description: venueInput.description,
  imageKey,
  status,
};
const paymentStatus = str({ enum: ['unpaid', 'pending', 'paid', 'refund_pending', 'refunded'] });
const bookingStatus = str({ enum: ['pending', 'confirmed', 'completed', 'cancelled', 'expired'] });
const reviewInput = {
  rating: number(1, { maximum: 5 }),
  comment: str({ minLength: 3, maxLength: 1000 }),
};
const schemas = {
  User: obj(user),
  RegisterInput: obj({
    email: user.email,
    password: str({ minLength: 8, maxLength: 128 }),
    fullName: user.fullName,
    phone: user.phone,
  }),
  LoginInput: obj({ email: user.email, password: str({ minLength: 8, maxLength: 128 }) }),
  ProfileInput: obj({ fullName: user.fullName, phone: user.phone }),
  Session: obj({
    accessToken: str(),
    tokenType: str({ const: 'Bearer' }),
    expiresIn: number(1),
    user: ref('User'),
  }),
  SportType: obj({ id, name: str({ minLength: 2, maxLength: 80 }) }),
  SportInput: obj({ name: str({ minLength: 2, maxLength: 80 }) }),
  VenueInput: obj(venueInput),
  Venue: obj({
    id,
    ownerId: id,
    ...venueInput,
    version: number(1),
    createdAt: dateTime,
    updatedAt: dateTime,
    courtCount: number(),
    courtTypes: arr(obj({ sportTypeId: id, sportName: str(), teamSize, count: number(1) })),
    minPrice: {
      type: ['integer', 'null'],
      minimum: 0,
      description: 'Across ALL active courts, independently of search filters.',
    },
    rating: { type: 'number', minimum: 0, maximum: 5 },
    reviewCount: number(),
  }),
  CourtInput: obj(courtInput),
  Court: obj({
    id,
    venueId: id,
    ...courtInput,
    sportName: str(),
    version: number(1),
    createdAt: dateTime,
    updatedAt: dateTime,
  }),
  Slot: obj({ startTime: dateTime, endTime: dateTime, available: { type: 'boolean' } }),
  Availability: obj({
    courtId: id,
    date: str({ format: 'date' }),
    timezone: str({ const: 'Asia/Ho_Chi_Minh' }),
    slotMinutes: number(30, { const: 30 }),
    slots: arr(ref('Slot')),
  }),
  Quote: obj({
    courtId: id,
    startTime: dateTime,
    endTime: dateTime,
    durationMinutes: number(30, { maximum: 180, multipleOf: 30 }),
    currency: str({ const: 'VND' }),
    totalPrice: number(),
    available: { type: 'boolean' },
    lines: arr(obj({ startTime: dateTime, endTime: dateTime, amount: number() })),
  }),
  BookingInput: obj(
    { courtId: id, startTime: dateTime, endTime: dateTime, note: str({ maxLength: 500 }) },
    ['courtId', 'startTime', 'endTime'],
  ),
  Review: obj({
    id,
    venueId: id,
    userId: id,
    bookingId: id,
    fullName: str(),
    ...reviewInput,
    createdAt: dateTime,
    updatedAt: dateTime,
  }),
  ReviewInput: obj({ bookingId: id, ...reviewInput }),
  ReviewUpdate: obj(reviewInput),
  CancellationInput: obj({ reason: str({ minLength: 3, maxLength: 300 }) }),
  PaymentInput: obj({ method: str({ enum: ['cash', 'bank_transfer'] }) }),
  Payment: obj({
    id,
    bookingId: id,
    amount: number(),
    currency: str({ const: 'VND' }),
    method: str({ enum: ['cash', 'bank_transfer'] }),
    status: str({ enum: ['pending', 'succeeded', 'failed', 'refunded'] }),
    transactionRef: { type: ['string', 'null'] },
    paidAt: nullableTime,
    createdAt: dateTime,
    checkoutUrl: { type: ['string', 'null'], format: 'uri' },
  }),
  Problem: obj(
    {
      type: str({ format: 'uri-reference' }),
      title: str(),
      status: number(400, { maximum: 599 }),
      detail: str(),
      instance: str(),
      code: str(),
      requestId: str(),
      errors: arr(obj({ field: str(), message: str() })),
    },
    ['type', 'title', 'status', 'detail', 'instance', 'code'],
  ),
};
const bookingFields = {
  id,
  code: str(),
  userId: id,
  courtId: id,
  venueId: id,
  venueName: str(),
  courtName: str(),
  sportName: str(),
  teamSize,
  address: str(),
  imageKey,
  contactName: str(),
  contactPhone: str(),
  startTime: dateTime,
  endTime: dateTime,
  totalPrice: number(),
  currency: str({ const: 'VND' }),
  status: bookingStatus,
  expiresAt: nullableTime,
  note: str(),
  paymentStatus,
  createdAt: dateTime,
  updatedAt: dateTime,
};
schemas.Booking = obj(
  {
    ...bookingFields,
    cancelledBy: id,
    cancelReason: str(),
    cancelledAt: dateTime,
    review: { oneOf: [ref('Review'), { type: 'null' }] },
  },
  Object.keys(bookingFields),
);
const envelope = (name) => obj({ data: ref(name) });
const links = obj({
  self: str(),
  prev: { type: ['string', 'null'] },
  next: { type: ['string', 'null'] },
});
for (const name of [
  'User',
  'Session',
  'SportType',
  'Venue',
  'Court',
  'Availability',
  'Quote',
  'Booking',
  'Payment',
  'Review',
])
  schemas[`${name}Response`] = envelope(name);
for (const name of ['Venue', 'Court', 'Booking', 'Review'])
  schemas[`${name}List`] = obj({
    data: arr(ref(name)),
    meta: obj({ page: number(1), limit: number(1), total: number(), totalPages: number() }),
    links,
  });
schemas.SportTypeList = obj({ data: arr(ref('SportType')) });
schemas.PaymentList = obj({ data: arr(ref('Payment')) });
const parameter = (name, location, schema, required = false) => ({
  name,
  in: location,
  required,
  schema,
});
const pagination = [
  parameter('page', 'query', number(1, { default: 1 })),
  parameter('limit', 'query', number(1, { maximum: 50, default: 6 })),
];
const match = parameter('If-Match', 'header', str({ pattern: '^"[0-9]+"$' }), true);
const key = parameter('Idempotency-Key', 'header', str({ minLength: 8, maxLength: 100 }), true);
const bearer = [{ bearerAuth: [] }];
const problem = {
  description: 'Problem Details; inspect status/code, not translated detail.',
  content: { 'application/problem+json': { schema: ref('Problem') } },
};
const paths = {};
function operation(
  path,
  method,
  operationId,
  tag,
  summary,
  {
    result,
    input,
    status: code = 200,
    public: isPublic = false,
    parameters = [],
    description = '',
    conditional = false,
  } = {},
) {
  const resourceHeaders =
    result === 'VenueResponse' || result === 'CourtResponse'
      ? { ETag: { schema: str(), description: 'Current resource version, e.g. "1".' } }
      : {};
  const success =
    code === 204
      ? { description: 'Completed; no response body.' }
      : {
          description: 'Success',
          headers: {
            ...resourceHeaders,
            ...(code === 201
              ? { Location: { schema: str(), description: 'Created resource location.' } }
              : {}),
          },
          content: { 'application/json': { schema: ref(result) } },
        };
  paths[path] ||= {};
  paths[path][method] = {
    operationId,
    tags: [tag],
    summary,
    description,
    security: isPublic ? [] : bearer,
    parameters: [...parameters, ...(conditional ? [match] : [])],
    ...(input
      ? { requestBody: { required: true, content: { 'application/json': { schema: ref(input) } } } }
      : {}),
    responses: {
      [code]: success,
      400: problem,
      401: problem,
      403: problem,
      404: problem,
      409: problem,
      422: problem,
      429: problem,
      500: problem,
      ...(conditional ? { 412: problem, 428: problem } : {}),
    },
  };
}
operation('/auth/register', 'post', 'registerUser', 'Auth', 'Create a customer account', {
  public: true,
  input: 'RegisterInput',
  result: 'UserResponse',
  status: 201,
  description:
    'Role is assigned by server. Does not sign in automatically; passwords never appear in a response.',
});
operation('/auth/login', 'post', 'login', 'Auth', 'Sign in', {
  public: true,
  input: 'LoginInput',
  result: 'SessionResponse',
  description:
    'Access token in response. Future backend sets HttpOnly refresh cookie; frontend uses credentials: include.',
});
operation(
  '/auth/refresh',
  'post',
  'refreshSession',
  'Auth',
  'Rotate refresh session and issue access token',
  { result: 'SessionResponse' },
);
paths['/auth/refresh'].post.security = [{ refreshCookie: [] }];
operation(
  '/auth/logout',
  'post',
  'logout',
  'Auth',
  'Revoke refresh session and current access token',
  { status: 204 },
);
operation('/users/me', 'get', 'getProfile', 'Users', 'Read own profile', {
  result: 'UserResponse',
});
operation('/users/me', 'put', 'replaceProfile', 'Users', 'Replace editable name and phone', {
  input: 'ProfileInput',
  result: 'UserResponse',
});
operation('/sport-types', 'get', 'listSports', 'Sports', 'List available sports', {
  public: true,
  result: 'SportTypeList',
});
operation('/sport-types', 'post', 'createSport', 'Sports', 'Create sport (ADMIN)', {
  input: 'SportInput',
  result: 'SportTypeResponse',
  status: 201,
});
operation('/sport-types/{id}', 'put', 'replaceSport', 'Sports', 'Rename sport (ADMIN)', {
  input: 'SportInput',
  result: 'SportTypeResponse',
});
operation('/sport-types/{id}', 'delete', 'deleteSport', 'Sports', 'Delete unused sport (ADMIN)', {
  status: 204,
});
const catalogQuery = [
  parameter('sportTypeId', 'query', id),
  parameter('city', 'query', str()),
  parameter('district', 'query', str()),
  parameter('keyword', 'query', str()),
  parameter('teamSize', 'query', number(5, { enum: [5, 7, 11] })),
  parameter('maxPrice', 'query', number()),
  parameter(
    'sort',
    'query',
    str({
      enum: ['-rating,minPrice', 'minPrice,name', '-minPrice,name', 'name'],
      default: '-rating,minPrice',
    }),
  ),
  ...pagination,
];
operation('/venues', 'get', 'listVenues', 'Venues', 'Find active facilities', {
  public: true,
  result: 'VenueList',
  parameters: catalogQuery,
  description:
    'Sport/teamSize/maxPrice must match the same active court. Summary covers ALL active courts. Date selection in UI is not an availability filter.',
});
operation('/venues/{id}', 'get', 'getVenue', 'Venues', 'Read facility and active-court summary', {
  public: true,
  result: 'VenueResponse',
  description: 'Inactive facility is visible only to its owner when authenticated.',
});
operation('/venues', 'post', 'createVenue', 'Venues', 'Create facility (OWNER)', {
  input: 'VenueInput',
  result: 'VenueResponse',
  status: 201,
});
operation(
  '/venues/{id}',
  'put',
  'replaceVenue',
  'Venues',
  'Replace editable facility fields (owning OWNER)',
  { input: 'VenueInput', result: 'VenueResponse', conditional: true },
);
operation(
  '/venues/{id}',
  'delete',
  'deleteVenue',
  'Venues',
  'Delete empty facility (owning OWNER)',
  {
    status: 204,
    conditional: true,
    description: '409 if any child court exists, including inactive. No cascade.',
  },
);
operation(
  '/owner/venues',
  'get',
  'listOwnedVenues',
  'Venues',
  'List own active/inactive facilities (OWNER)',
  { result: 'VenueList', parameters: catalogQuery },
);
operation(
  '/venues/{venueId}/courts',
  'get',
  'listVenueCourts',
  'Courts',
  'List distinct physical courts',
  {
    public: true,
    result: 'CourtList',
    parameters: [
      parameter('sportTypeId', 'query', id),
      parameter('teamSize', 'query', number(5, { enum: [5, 7, 11] })),
      ...pagination,
    ],
    description:
      'Owner token includes inactive children; everyone else sees active children of active venues only.',
  },
);
operation('/venues/{venueId}/courts', 'post', 'createCourt', 'Courts', 'Add court (owning OWNER)', {
  input: 'CourtInput',
  result: 'CourtResponse',
  status: 201,
  description:
    'Parent determined by path. Unique normalized name inside venue. Multiple courts of the same sport/team size are allowed.',
});
operation('/courts/{id}', 'get', 'getCourt', 'Courts', 'Read one physical court', {
  public: true,
  result: 'CourtResponse',
});
operation(
  '/courts/{id}',
  'put',
  'replaceCourt',
  'Courts',
  'Replace editable court fields (owning OWNER)',
  {
    input: 'CourtInput',
    result: 'CourtResponse',
    conditional: true,
    description: 'venueId immutable. Parent version increments when child changes.',
  },
);
operation(
  '/courts/{id}',
  'delete',
  'deleteCourt',
  'Courts',
  'Delete court without upcoming holds/bookings',
  { status: 204, conditional: true },
);
operation(
  '/courts/{id}/availability',
  'get',
  'getCourtAvailability',
  'Courts',
  'Read availability in 30-minute units',
  {
    public: true,
    result: 'AvailabilityResponse',
    parameters: [parameter('date', 'query', str({ format: 'date' }), true)],
    description:
      'No customer identity in public slots. Venue timezone, from today through day +30.',
  },
);
operation(
  '/courts/{id}/quote',
  'get',
  'quoteCourt',
  'Courts',
  'Quote a 30–180 minute interval without reserving',
  {
    public: true,
    result: 'QuoteResponse',
    parameters: [
      parameter('start', 'query', dateTime, true),
      parameter('end', 'query', dateTime, true),
    ],
    description:
      '30-minute boundaries; start/end on same local day and inside opening hours. Server recomputes price and availability during booking.',
  },
);
operation(
  '/bookings',
  'post',
  'createBooking',
  'Bookings',
  'Request one court interval (CUSTOMER)',
  {
    input: 'BookingInput',
    result: 'BookingResponse',
    status: 201,
    parameters: [key],
    description:
      'Derive contact/user/venue/price from authenticated user and catalog. Status pending, hold until min(now+30min,startTime). Idempotency scoped to user+operation, retained at least 24h in real backend. 409 on overlap.',
  },
);
operation(
  '/bookings/{id}',
  'get',
  'getBooking',
  'Bookings',
  'Read own or managed-facility booking',
  {
    result: 'BookingResponse',
    description: 'Includes review (object/null) on detail; unrelated caller receives 404.',
  },
);
const bookingQuery = [parameter('status', 'query', bookingStatus), ...pagination];
operation(
  '/users/me/bookings',
  'get',
  'listMyBookings',
  'Bookings',
  'List authenticated user bookings',
  { result: 'BookingList', parameters: bookingQuery },
);
operation(
  '/venues/{venueId}/bookings',
  'get',
  'listVenueBookings',
  'Bookings',
  'List facility bookings (owning OWNER)',
  {
    result: 'BookingList',
    parameters: [parameter('date', 'query', str({ format: 'date' })), ...bookingQuery],
  },
);
operation(
  '/bookings/{id}/cancel',
  'post',
  'cancelBooking',
  'Bookings',
  'Cancel own or managed booking',
  {
    input: 'CancellationInput',
    result: 'BookingResponse',
    description:
      'Customer >=2h before start; owner before start. Only pending/confirmed. Repeated cancellation returns existing result; paid booking becomes refund_pending, pending payments invalidated.',
  },
);
operation(
  '/bookings/{id}/confirm',
  'post',
  'confirmBooking',
  'Bookings',
  'Confirm an unexpired request (owning OWNER)',
  {
    result: 'BookingResponse',
    description:
      'pending -> confirmed before startTime, clears expiresAt. Repeated confirmed action returns existing result.',
  },
);
operation(
  '/bookings/{id}/complete',
  'post',
  'completeBooking',
  'Bookings',
  'Complete after endTime (owning OWNER)',
  {
    result: 'BookingResponse',
    description:
      'confirmed -> completed after endTime. Repeated completed action returns existing result. Does not imply payment success.',
  },
);
operation(
  '/bookings/{id}/payments',
  'post',
  'createPayment',
  'Payments',
  'Initiate payment for own confirmed booking',
  {
    input: 'PaymentInput',
    result: 'PaymentResponse',
    status: 201,
    parameters: [key],
    description:
      'Amount/currency derived from booking. Result pending, never marks paid based on client input. One active pending attempt per booking. checkoutUrl is provider URL or null for cash/mock.',
  },
);
operation(
  '/bookings/{id}/payments',
  'get',
  'listBookingPayments',
  'Payments',
  'Read attempts for own or managed booking',
  { result: 'PaymentList' },
);
operation('/payments/{id}', 'get', 'getPayment', 'Payments', 'Read authorized payment', {
  result: 'PaymentResponse',
});
paths['/payments/callback'] = {
  post: {
    operationId: 'paymentCallback',
    tags: ['Payments'],
    summary: 'Provider callback — future backend only',
    description:
      'FRONTEND DOES NOT CALL THIS. Payload, signature header, response and retry protocol must follow the chosen payment provider. Verify signature, amount/currency and unique event/transaction; handle duplicate/late callbacks and refunds. This reserved operation is not implemented by browser fixtures.',
    'x-backend-only': true,
    'x-provider-contract-pending': true,
    security: [{ providerSignature: [] }],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            additionalProperties: true,
            description: 'Provider-specific payload; intentionally not invented by the frontend.',
          },
        },
      },
    },
    responses: {
      200: { description: 'Provider acknowledgement, to be specified with integration.' },
      400: problem,
      401: problem,
    },
  },
};
operation(
  '/venues/{venueId}/reviews',
  'get',
  'listVenueReviews',
  'Reviews',
  'List verified-visit reviews',
  { public: true, result: 'ReviewList', parameters: pagination },
);
operation(
  '/venues/{venueId}/reviews',
  'post',
  'createReview',
  'Reviews',
  'Review own completed booking at this facility',
  {
    input: 'ReviewInput',
    result: 'ReviewResponse',
    status: 201,
    description:
      'Exactly one review per booking. Derive author from token and verify booking venue matches path.',
  },
);
operation('/reviews/{id}', 'put', 'replaceReview', 'Reviews', 'Edit own review', {
  input: 'ReviewUpdate',
  result: 'ReviewResponse',
});
operation('/reviews/{id}', 'delete', 'deleteReview', 'Reviews', 'Delete own review', {
  status: 204,
});
for (const [path, item] of Object.entries(paths)) {
  const names = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  if (names.length) item.parameters = names.map((name) => parameter(name, 'path', id, true));
}
export const frontendContract = {
  openapi: '3.1.1',
  info: {
    title: 'Kèo Sân — Courts frontend handoff',
    version: '2.0.0-draft',
    description:
      'Frontend contract for the agreed venues/courts/bookings model. No production backend or MongoDB implementation. All 37 frontend operations are simulated by the browser mock for UI development; see docs/MOCK_SCOPE.md for behavior and limitations. Payment callback is reserved for a future backend/provider integration and is not mocked.',
  },
  servers: [
    { url: '/api/v1', description: 'Future backend via same-origin gateway or Vite proxy' },
  ],
  tags: ['Auth', 'Users', 'Sports', 'Venues', 'Courts', 'Bookings', 'Payments', 'Reviews'].map(
    (name) => ({ name }),
  ),
  paths,
  components: {
    schemas,
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer' },
      refreshCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'refreshToken',
        description:
          'Future HttpOnly cookie, Secure in production; rotation/revocation and CSRF protections belong to backend.',
      },
      providerSignature: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Provider-Signature',
        description:
          'PLACEHOLDER; use the actual header and verification scheme required by the selected provider.',
      },
    },
  },
};
