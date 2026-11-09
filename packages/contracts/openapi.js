// Authoritative API contract. Run `npm run contract:export` after editing.
// Every endpoint below is implemented by the HTTP mock, not just documented.
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const array = (items) => ({ type: 'array', items });
const object = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required,
});
const str = (extra = {}) => ({ type: 'string', ...extra });
const integer = (minimum = 0, extra = {}) => ({ type: 'integer', minimum, ...extra });
const id = str({
  pattern: '^[a-f0-9]{24}$',
  description: 'Opaque resource ID; MongoDB ObjectId serialized as a string.',
});
const dateTime = str({ format: 'date-time' });
const nullableString = { type: ['string', 'null'] };
const links = object({ self: str(), next: nullableString, prev: nullableString });
const envelope = (schema) => object({ data: schema, links: object({ self: str() }) });
const money = integer(50000, {
  maximum: 3000000,
  description: 'Integer Vietnamese đồng, per 60-minute slot before peak-hour surcharge.',
});
const venueFields = {
  name: str({ minLength: 3, maxLength: 100 }),
  district: str({
    enum: ['Cầu Giấy', 'Nam Từ Liêm', 'Bắc Từ Liêm', 'Thanh Xuân', 'Tây Hồ', 'Hà Đông'],
  }),
  address: str({ minLength: 5, maxLength: 250 }),
  description: str({ minLength: 10, maxLength: 2000 }),
  amenities: {
    ...array(str({ enum: ['parking', 'lights', 'water', 'changing'] })),
    minItems: 1,
    uniqueItems: true,
  },
  imageKey: str({ enum: ['pitch-1', 'pitch-2', 'pitch-3'] }),
  isActive: { type: 'boolean' },
};
const pitchFields = {
  name: str({ minLength: 3, maxLength: 100, pattern: '\\S' }),
  type: { type: 'integer', enum: [5, 7, 11] },
  price: money,
  description: venueFields.description,
  imageKey: venueFields.imageKey,
  isActive: { type: 'boolean' },
};
const pageMeta = object({
  page: integer(1),
  limit: integer(1),
  total: integer(),
  totalPages: integer(),
});
const schemas = {
  User: object({
    id,
    name: str(),
    email: str({ format: 'email' }),
    role: str({ enum: ['customer', 'owner'] }),
  }),
  LoginInput: object({
    email: str({ format: 'email', maxLength: 254 }),
    password: str({ minLength: 8, maxLength: 128 }),
  }),
  Session: object({
    accessToken: str(),
    tokenType: str({ const: 'Bearer' }),
    expiresIn: integer(1),
    user: ref('User'),
  }),
  SessionResponse: envelope(ref('Session')),
  UserResponse: envelope(ref('User')),
  VenueInput: object(venueFields),
  VenuePatch: { ...object(venueFields, []), minProperties: 1 },
  Venue: object({
    id,
    ownerId: id,
    ...venueFields,
    rating: { type: 'number', minimum: 0, maximum: 5 },
    reviewCount: integer(),
    version: integer(1),
    createdAt: dateTime,
    pitchCount: integer(0, {
      description: 'Number of active physical pitches, regardless of list filters.',
    }),
    pitchTypes: array(object({ type: pitchFields.type, count: integer(1) })),
    minPrice: {
      type: ['integer', 'null'],
      minimum: 0,
      description:
        'Lowest base price across ALL active pitches; null when none. Type/price filters must match the same child.',
    },
    links: object({ self: str(), pitches: str() }),
  }),
  VenueResponse: envelope(ref('Venue')),
  VenueList: object({ data: array(ref('Venue')), meta: pageMeta, links }),
  PitchInput: object({ venueId: id, ...pitchFields }),
  PitchReplace: object(pitchFields),
  PitchPatch: { ...object(pitchFields, []), minProperties: 1 },
  Pitch: object({
    id,
    venueId: id,
    ...pitchFields,
    version: integer(1),
    createdAt: dateTime,
    links: object({ self: str(), venue: str(), availability: str() }),
  }),
  PitchResponse: envelope(ref('Pitch')),
  PitchList: object({
    data: array(ref('Pitch')),
    meta: object({ page: integer(1), limit: integer(1), total: integer(), totalPages: integer() }),
    links,
  }),
  Slot: object({
    startAt: dateTime,
    endAt: dateTime,
    price: integer(),
    currency: str({ const: 'VND' }),
    available: { type: 'boolean' },
  }),
  Availability: object({
    pitchId: id,
    date: str({ format: 'date' }),
    timeZone: str({ const: 'Asia/Ho_Chi_Minh' }),
    slots: array(ref('Slot')),
  }),
  AvailabilityResponse: envelope(ref('Availability')),
  BookingInput: object(
    {
      pitchId: id,
      startAt: dateTime,
      contactName: str({ minLength: 2, maxLength: 80 }),
      contactPhone: str({ pattern: '^0[0-9]{9}$' }),
      note: str({ maxLength: 500 }),
    },
    ['pitchId', 'startAt', 'contactName', 'contactPhone'],
  ),
  Booking: object({
    id,
    code: str(),
    userId: id,
    pitchId: id,
    pitchName: str(),
    pitchType: pitchFields.type,
    venueId: id,
    venueName: str(),
    address: str(),
    imageKey: str(),
    startAt: dateTime,
    endAt: dateTime,
    total: integer(),
    currency: str({ const: 'VND' }),
    status: str({ enum: ['confirmed', 'cancelled'] }),
    contactName: str(),
    contactPhone: str(),
    note: str(),
    createdAt: dateTime,
    links: object({ self: str(), pitch: str(), venue: str(), cancellation: str() }),
  }),
  BookingResponse: envelope(ref('Booking')),
  BookingList: object({
    data: array(ref('Booking')),
    meta: object({ limit: integer(1), hasMore: { type: 'boolean' }, nextCursor: nullableString }),
    links,
  }),
  CancellationInput: object({ reason: str({ minLength: 3, maxLength: 300 }) }),
  Cancellation: object({ bookingId: id, reason: str(), createdAt: dateTime }),
  CancellationResponse: envelope(ref('Cancellation')),
  Problem: object(
    {
      type: str({ format: 'uri-reference' }),
      title: str(),
      status: integer(400, { maximum: 599 }),
      detail: str(),
      instance: str(),
      code: str(),
      requestId: str(),
      errors: array(object({ field: str(), message: str() })),
    },
    ['type', 'title', 'status', 'detail', 'instance', 'code', 'requestId'],
  ),
  Health: object({ status: str({ const: 'ok' }), mode: str({ const: 'mock' }), version: str() }),
};

schemas.LoginInput.examples = [{ email: 'player@keosan.demo', password: 'Demo@12345' }];
schemas.PitchInput.examples = [
  {
    venueId: '200000000000000000000005',
    name: 'Sân số 4',
    type: 7,
    price: 300000,
    description: 'Sân bóng minh họa cho đồ án của nhóm.',
    imageKey: 'pitch-1',
    isActive: true,
  },
];
schemas.PitchPatch.examples = [{ price: 350000 }];
schemas.BookingInput.examples = [
  {
    pitchId: '000000000000000000000001',
    startAt: '2026-11-09T18:00:00+07:00',
    contactName: 'Khách demo',
    contactPhone: '0900000000',
    note: 'Cập nhật ngày ví dụ trước khi thử.',
  },
];
schemas.CancellationInput.examples = [{ reason: 'Đội thay đổi kế hoạch' }];

const parameter = (name, location, schema, description, required = false) => ({
  name,
  in: location,
  required,
  description,
  schema,
});
const pathId = (name) => parameter(name, 'path', id, 'Resource identifier.', true);
const limit = parameter(
  'limit',
  'query',
  integer(1, { maximum: 50, default: 6 }),
  'Page size, maximum 50.',
);
const requestIdHeader = { description: 'Server-generated correlation ID.', schema: str() };
const commonHeaders = {
  'X-Request-Id': requestIdHeader,
  'Cache-Control': {
    description: 'no-store for mock, authentication and booking responses.',
    schema: str(),
  },
};
const response = (description, schema, headers = {}) => ({
  description,
  headers: { ...commonHeaders, ...headers },
  ...(schema ? { content: { 'application/json': { schema: ref(schema) } } } : {}),
});
const locationHeader = { Location: { description: 'URI of created resource.', schema: str() } };
const etagHeader = {
  ETag: {
    description: 'Strong entity tag, e.g. "1". Pass it in If-Match on updates/deletion.',
    schema: str(),
  },
};
const errors = (...statuses) =>
  Object.fromEntries(
    statuses.map((status) => [status, { $ref: `#/components/responses/Error${status}` }]),
  );
const body = (name) => ({ required: true, content: { 'application/json': { schema: ref(name) } } });
const security = [{ bearerAuth: [] }];
const ifMatch = parameter(
  'If-Match',
  'header',
  str({ pattern: '^"[1-9][0-9]*"$' }),
  'The exact ETag from the latest GET. Required; wildcard and weak tags are not accepted.',
  true,
);
const operation = (operationId, summary, tag, extra) => ({
  operationId,
  summary,
  description: summary,
  tags: [tag],
  ...extra,
});
const paths = {
  '/health': {
    get: operation('getHealth', 'Read mock service health', 'System', {
      responses: { 200: response('Available', 'Health') },
    }),
  },
  '/sessions': {
    post: operation('createSession', 'Sign in with a demo account', 'Identity', {
      requestBody: body('LoginInput'),
      responses: {
        201: response(
          'Session created; mock access token expires in 15 minutes.',
          'SessionResponse',
          { Location: { description: 'Current session URI', schema: str() } },
        ),
        ...errors(400, 401, 415, 422, 429),
      },
    }),
  },
  '/sessions/current': {
    delete: operation('deleteSession', 'Revoke the current access token', 'Identity', {
      security,
      responses: { 204: response('Session revoked; no response body'), ...errors(401) },
    }),
  },
  '/users/me': {
    get: operation('getCurrentUser', 'Read the authenticated user profile', 'Identity', {
      security,
      responses: { 200: response('Profile', 'UserResponse'), ...errors(401) },
    }),
  },
  '/pitches': {
    get: operation('listPitches', 'Search, filter and paginate football pitches', 'Catalog', {
      security: [{}, ...security],
      parameters: [
        parameter(
          'q',
          'query',
          str({ maxLength: 100 }),
          'Case- and accent-insensitive name/address search.',
        ),
        parameter('district', 'query', venueFields.district, 'Exact district of the parent venue.'),
        parameter('venueId', 'query', id, 'Filter to one parent venue.'),
        parameter('type', 'query', pitchFields.type, 'Team size.'),
        parameter(
          'maxPrice',
          'query',
          integer(0, { maximum: 3000000 }),
          'Maximum base hourly price; peak surcharge excluded.',
        ),
        parameter(
          'sort',
          'query',
          str({
            enum: ['-rating,price', 'price,name', '-price,name', 'name'],
            default: '-rating,price',
          }),
          'Whitelisted multi-key ordering, always with id as final tie-breaker.',
        ),
        parameter(
          'scope',
          'query',
          str({ enum: ['public', 'mine'], default: 'public' }),
          'mine requires owner bearer token and includes inactive owned pitches.',
        ),
        parameter(
          'page',
          'query',
          integer(1, { maximum: 10000, default: 1 }),
          'Offset pagination page.',
        ),
        limit,
      ],
      responses: {
        200: response('Pitch page and navigation links', 'PitchList'),
        ...errors(400, 401, 403),
      },
    }),
    post: operation('createPitch', 'Create a pitch owned by the caller', 'Catalog', {
      security,
      'x-roles': ['owner'],
      requestBody: body('PitchInput'),
      responses: {
        201: response('Physical pitch created in an owned venue', 'PitchResponse', {
          ...locationHeader,
          ...etagHeader,
        }),
        ...errors(400, 401, 403, 404, 409, 415, 422),
      },
    }),
  },
  '/pitches/{pitchId}': {
    parameters: [pathId('pitchId')],
    get: operation('getPitch', 'Read a pitch and its ETag', 'Catalog', {
      security: [{}, ...security],
      responses: {
        200: response(
          'Pitch; inactive pitches are visible only to their owner.',
          'PitchResponse',
          etagHeader,
        ),
        ...errors(400, 404),
      },
    }),
    put: operation('replacePitch', 'Replace every editable field of an owned pitch', 'Catalog', {
      security,
      'x-roles': ['owner'],
      parameters: [ifMatch],
      requestBody: body('PitchReplace'),
      responses: {
        200: response('Replaced pitch', 'PitchResponse', etagHeader),
        ...errors(400, 401, 403, 404, 409, 412, 415, 422, 428),
      },
    }),
    patch: operation(
      'updatePitch',
      'Partially update editable fields of an owned pitch',
      'Catalog',
      {
        description:
          'Project-specific partial JSON update, application/json; not JSON Patch or JSON Merge Patch. Null values are rejected.',
        security,
        'x-roles': ['owner'],
        parameters: [ifMatch],
        requestBody: body('PitchPatch'),
        responses: {
          200: response('Updated pitch', 'PitchResponse', etagHeader),
          ...errors(400, 401, 403, 404, 409, 412, 415, 422, 428),
        },
      },
    ),
    delete: operation(
      'deletePitch',
      'Delete an owned pitch without upcoming confirmed bookings',
      'Catalog',
      {
        security,
        'x-roles': ['owner'],
        parameters: [ifMatch],
        responses: {
          204: response('Deleted; no body'),
          ...errors(400, 401, 403, 404, 409, 412, 428),
        },
      },
    ),
  },
  '/pitches/{pitchId}/availability': {
    parameters: [pathId('pitchId')],
    get: operation('getAvailability', 'Read 60-minute slots for a local calendar date', 'Catalog', {
      security: [{}, ...security],
      description:
        '06:00–23:00 Asia/Ho_Chi_Minh. Date must be today through 30 days ahead. Peak slots 17:00–22:00 add 100,000 VND. Availability is advisory; POST /bookings rechecks atomically.',
      parameters: [
        parameter(
          'date',
          'query',
          str({ format: 'date' }),
          'Local YYYY-MM-DD, not UTC date.',
          true,
        ),
      ],
      responses: {
        200: response('Slots and authoritative quote per slot', 'AvailabilityResponse'),
        ...errors(400, 404),
      },
    }),
  },
  '/bookings': {
    get: operation('listBookings', 'List only the authenticated customer’s bookings', 'Booking', {
      security,
      parameters: [
        limit,
        parameter(
          'cursor',
          'query',
          str({ maxLength: 1000 }),
          'Opaque composite (createdAt,id) cursor; bound to caller and status filter.',
        ),
        parameter(
          'status',
          'query',
          str({ enum: ['confirmed', 'cancelled'] }),
          'Optional booking status.',
        ),
      ],
      responses: { 200: response('Newest-first cursor page', 'BookingList'), ...errors(400, 401) },
    }),
    post: operation('createBooking', 'Reserve one available 60-minute slot', 'Booking', {
      security,
      parameters: [
        parameter(
          'Idempotency-Key',
          'header',
          str({ minLength: 8, maxLength: 100, pattern: '^[a-zA-Z0-9_-]+$' }),
          'Project convention, required. Scope: caller + operation; retained 24 hours. Same key/body replays original 201; changed body gives 409.',
          true,
        ),
      ],
      requestBody: body('BookingInput'),
      responses: {
        201: response(
          'Confirmed booking; price is calculated server-side.',
          'BookingResponse',
          locationHeader,
        ),
        ...errors(400, 401, 404, 409, 415, 422),
      },
    }),
  },
  '/bookings/{bookingId}': {
    parameters: [pathId('bookingId')],
    get: operation('getBooking', 'Read a booking owned by the caller', 'Booking', {
      security,
      description: 'Another customer’s booking returns 404 to prevent identifier enumeration.',
      responses: { 200: response('Booking', 'BookingResponse'), ...errors(400, 401, 404) },
    }),
  },
  '/bookings/{bookingId}/cancellation': {
    parameters: [pathId('bookingId')],
    put: operation(
      'cancelBooking',
      'Create an idempotent cancellation of an owned booking',
      'Booking',
      {
        security,
        description:
          'Allowed until 2 hours before start. First creation returns 201; identical retry returns 200 even after the cutoff. Changing an existing reason returns 409. No money transfer occurs.',
        requestBody: body('CancellationInput'),
        responses: {
          201: response('Cancellation created', 'CancellationResponse', locationHeader),
          200: response('Existing identical cancellation', 'CancellationResponse'),
          ...errors(400, 401, 404, 409, 415, 422),
        },
      },
    ),
  },
};
// A venue is a business/location; a pitch is an independently bookable physical field.
const catalogParams = paths['/pitches'].get.parameters;
paths['/venues'] = {
  get: operation(
    'listVenues',
    'Find facilities containing independently bookable pitches',
    'Venues',
    {
      description:
        'type and maxPrice must match the SAME active child. Summary counts/minPrice describe all active children. Empty active venues can be returned without child filters. scope=mine requires owner authentication.',
      security: [{}, ...security],
      parameters: catalogParams
        .filter((p) => p.name !== 'venueId')
        .map((p) =>
          p.name === 'sort'
            ? {
                ...p,
                schema: str({
                  enum: ['-rating,minPrice', 'minPrice,name', '-minPrice,name', 'name'],
                  default: '-rating,minPrice',
                }),
                description:
                  'Order venues; minPrice null always sorts last; id is the final tie-breaker.',
              }
            : p,
        ),
      responses: {
        200: response('Venue page with active-pitch summaries', 'VenueList'),
        ...errors(400, 401, 403),
      },
    },
  ),
  post: operation('createVenue', 'Create a facility owned by the caller', 'Venues', {
    security,
    'x-roles': ['owner'],
    requestBody: body('VenueInput'),
    responses: {
      201: response('Venue created, initially without pitches', 'VenueResponse', {
        ...locationHeader,
        ...etagHeader,
      }),
      ...errors(400, 401, 403, 415, 422),
    },
  }),
};
paths['/venues/{venueId}'] = {
  parameters: [pathId('venueId')],
  get: operation('getVenue', 'Read facility details and its active-pitch summary', 'Venues', {
    security: [{}, ...security],
    responses: {
      200: response(
        'Venue; ETag also changes when a child pitch changes',
        'VenueResponse',
        etagHeader,
      ),
      ...errors(400, 404),
    },
  }),
  ...Object.fromEntries(
    ['put', 'patch'].map((method) => [
      method,
      operation(
        method === 'put' ? 'replaceVenue' : 'updateVenue',
        method === 'put'
          ? 'Replace all editable facility fields'
          : 'Partially update facility fields',
        'Venues',
        {
          security,
          'x-roles': ['owner'],
          parameters: [ifMatch],
          requestBody: body(method === 'put' ? 'VenueInput' : 'VenuePatch'),
          responses: {
            200: response('Updated venue', 'VenueResponse', etagHeader),
            ...errors(400, 401, 403, 404, 412, 415, 422, 428),
          },
        },
      ),
    ]),
  ),
  delete: operation(
    'deleteVenue',
    'Delete an owned facility only after all its pitches have been removed',
    'Venues',
    {
      security,
      'x-roles': ['owner'],
      parameters: [ifMatch],
      responses: {
        204: response('Venue deleted; no cascade deletion'),
        ...errors(400, 401, 403, 404, 409, 412, 428),
      },
    },
  ),
};
paths['/venues/{venueId}/pitches'] = {
  parameters: [pathId('venueId')],
  get: operation(
    'listVenuePitches',
    'List the distinct physical fields inside one facility',
    'Venues',
    {
      security: [{}, ...security],
      parameters: catalogParams.filter((p) => !['venueId', 'district', 'q'].includes(p.name)),
      description:
        'Public sees active children of active venues. scope=mine requires ownership and includes inactive children. Every result has its own ID, price and availability link.',
      responses: {
        200: response('Physical pitch page', 'PitchList'),
        ...errors(400, 401, 403, 404),
      },
    },
  ),
};
schemas.VenueInput.examples = [
  {
    name: 'Sân bóng Hà Đông',
    district: 'Hà Đông',
    address: 'Đường Tô Hiệu, Hà Nội',
    description: 'Cơ sở gồm nhiều sân vật lý riêng biệt, mỗi sân có lịch đặt riêng.',
    amenities: ['parking', 'lights', 'water'],
    imageKey: 'pitch-1',
    isActive: true,
  },
];
const titles = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  412: 'Precondition Failed',
  413: 'Content Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Content',
  428: 'Precondition Required',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};
// Protocol-level errors apply to all operations, including malformed/oversized payloads.
for (const item of Object.values(paths))
  for (const [method, op] of Object.entries(item)) {
    if (['get', 'post', 'put', 'patch', 'delete'].includes(method))
      Object.assign(op.responses, errors(400, 405, 413, 500));
  }
export const contract = {
  openapi: '3.1.1',
  info: {
    title: 'Kèo Sân API',
    version: '1.1.0',
    description:
      'Contract-first coursework skeleton. Mock endpoints are implemented in memory. No real MongoDB, payments or production authentication are connected. See docs/API_DESIGN.md for conventions and backend handoff.',
    contact: { name: 'Kèo Sân project team' },
  },
  servers: [
    { url: 'http://127.0.0.1:3001/api/v1', description: 'Local HTTP mock' },
    { url: '/api/v1', description: 'Same-origin gateway/proxy' },
  ],
  tags: [
    {
      name: 'Venues',
      description: 'Facilities containing independently bookable physical pitches',
    },
    { name: 'System', description: 'Service metadata' },
    { name: 'Identity', description: 'Sessions and identity' },
    { name: 'Catalog', description: 'Pitch catalog, ownership and availability' },
    { name: 'Booking', description: 'Reservations and cancellation' },
  ],
  paths,
  components: {
    schemas,
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description:
          'Opaque, short-lived token in the mock. Real backend may use a validated JWT without changing the client.',
      },
    },
    responses: Object.fromEntries(
      Object.entries(titles).map(([status, title]) => [
        `Error${status}`,
        {
          description: title,
          headers: {
            ...commonHeaders,
            ...(status === '401'
              ? { 'WWW-Authenticate': { description: 'Bearer challenge', schema: str() } }
              : {}),
            ...(status === '429'
              ? { 'Retry-After': { description: 'Seconds until retry', schema: integer(1) } }
              : {}),
            ...(status === '405'
              ? { Allow: { description: 'Supported methods for the resource', schema: str() } }
              : {}),
          },
          content: { 'application/problem+json': { schema: ref('Problem') } },
        },
      ]),
    ),
  },
};

export { titles };
