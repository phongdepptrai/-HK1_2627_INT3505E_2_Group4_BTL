import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../apps/mock-api/src/app.js';
import { contract } from '../packages/contracts/openapi.js';
import { validateSchema } from '../apps/mock-api/src/validation.js';
import { DEMO_PASSWORD } from '../apps/mock-api/src/data.js';

// Isolated HTTP server; no MongoDB and no reliance on the development server.
const fixedNow = Date.parse('2026-11-08T08:00:00Z');
const { app, state } = createApp({ now: () => fixedNow });
let server, base, player, other, owner;
const pitchId = '000000000000000000000001';
const operations = new Set();
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  player = (
    await call('POST', '/sessions', {
      body: { email: 'player@keosan.demo', password: DEMO_PASSWORD },
    })
  ).body.data.accessToken;
  other = (
    await call('POST', '/sessions', {
      body: { email: 'other@keosan.demo', password: DEMO_PASSWORD },
    })
  ).body.data.accessToken;
  owner = (
    await call('POST', '/sessions', {
      body: { email: 'owner@keosan.demo', password: DEMO_PASSWORD },
    })
  ).body.data.accessToken;
});
after(() => {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
});

async function call(method, path, { body, token, headers = {}, status = 200, raw } = {}) {
  const response = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  // Every request validates its response against the documented operation + status.
  const route = Object.entries(contract.paths).find(([key]) =>
    new RegExp(`^${key.replace(/\{[^}]+\}/g, '[^/]+')}$`).test(path.split('?')[0]),
  );
  const operation = route?.[1][method.toLowerCase()];
  if (operation) {
    operations.add(operation.operationId);
    let expected = operation.responses[response.status];
    assert.ok(expected, `${method} ${path}: undocumented HTTP ${response.status}: ${text}`);
    if (expected.$ref) expected = contract.components.responses[expected.$ref.split('/').at(-1)];
    if (expected.content) {
      const mediaType = response.headers.get('content-type').split(';')[0];
      assert.ok(
        expected.content[mediaType],
        `${method} ${path}: unexpected media type ${mediaType}`,
      );
      const result = validateSchema(expected.content[mediaType].schema, payload);
      assert.equal(result.valid, true, JSON.stringify(result.errors));
    } else assert.equal(text, '');
  }
  assert.ok(response.headers.get('x-request-id'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(
    response.status,
    status === 200 &&
      method === 'POST' &&
      ['/sessions', '/bookings', '/pitches', '/venues'].includes(path)
      ? 201
      : status,
    `${method} ${path}: ${text}`,
  );
  if (response.status >= 400) {
    assert.equal(payload.status, response.status);
    assert.equal(payload.requestId, response.headers.get('x-request-id'));
  }
  return { body: payload, headers: response.headers, status: response.status };
}
const bookingBody = (hour = 18) => ({
  pitchId,
  startAt: `2026-11-09T${hour}:00:00+07:00`,
  contactName: 'Khách thử nghiệm',
  contactPhone: '0900000000',
  note: 'Test',
});
const makeBooking = (hour, key) =>
  call('POST', '/bookings', {
    token: player,
    body: bookingBody(hour),
    headers: { 'Idempotency-Key': key },
  });

test('health and authenticated profile are contract compliant', async () => {
  assert.equal((await call('GET', '/health')).body.mode, 'mock');
  assert.equal((await call('GET', '/users/me', { token: player })).body.data.role, 'customer');
});
test('catalog pagination links preserve filters, deterministic multi-key order and no duplicate rows', async () => {
  const first = (await call('GET', '/pitches?limit=2&sort=price,name')).body;
  const second = (await call('GET', first.links.next.replace('/api/v1', ''))).body;
  assert.equal(first.meta.total, 11);
  assert.equal(new Set([...first.data, ...second.data].map((p) => p.id)).size, 4);
  assert.ok(first.data[0].price <= first.data[1].price);
  assert.match(first.links.next, /sort=price%2Cname/);
});
test('catalog filtering handles accent-insensitive queries and budgets', async () => {
  const { body } = await call('GET', '/pitches?q=quoc%20gia&maxPrice=250000&type=5');
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].price, 200000);
  for (const query of ['dai hoc', 'ĐẠI HỌC']) {
    const result = await call('GET', `/pitches?q=${encodeURIComponent(query)}`);
    assert.equal(result.body.data.length, 1);
    assert.equal(result.body.data[0].venueId, '200000000000000000000004');
  }
});
test('invalid and unknown query parameters are rejected instead of ignored', async () => {
  for (const query of [
    'limit=0',
    'limit=51',
    'sort=password',
    'page=abc',
    'type=9',
    'q=a&q=b',
    'ownerId=anything',
    'maxPrice=-1',
    'q[$ne]=x',
  ])
    await call('GET', `/pitches?${query}`, { status: 400 });
});
test('malformed IDs and missing resources have distinct status codes', async () => {
  await call('GET', '/pitches/not-an-id', { status: 400 });
  await call('GET', '/pitches/aaaaaaaaaaaaaaaaaaaaaaaa', { status: 404 });
});
test('availability validates real dates, booking horizon, duration and peak pricing', async () => {
  for (const date of ['2026-02-30', '2026-11-07', '2026-12-09'])
    await call('GET', `/pitches/${pitchId}/availability?date=${date}`, { status: 400 });
  await call('GET', `/pitches/${pitchId}/availability`, { status: 400 });
  const { body } = await call('GET', `/pitches/${pitchId}/availability?date=2026-11-09`);
  assert.equal(body.data.slots.length, 17);
  assert.equal(body.data.slots[0].startAt, '2026-11-08T23:00:00.000Z');
  assert.equal(body.data.slots[11].price, body.data.slots[0].price + 100000);
  for (const slot of body.data.slots)
    assert.equal(Date.parse(slot.endAt) - Date.parse(slot.startAt), 3600000);
});
test('missing authentication returns 401 with a Bearer challenge', async () => {
  const response = await call('GET', '/bookings', { status: 401 });
  assert.match(response.headers.get('www-authenticate'), /Bearer/);
});
test('roles are enforced on the server, including the private catalog', async () => {
  await call('GET', '/pitches?scope=mine', { status: 401 });
  await call('GET', '/pitches?scope=mine', { token: player, status: 403 });
  const input = Object.fromEntries(
    Object.keys(contract.components.schemas.PitchInput.properties).map((key) => [
      key,
      state.pitches[0][key],
    ]),
  );
  await call('POST', '/pitches', { token: player, body: input, status: 403 });
});
test('request schemas prevent mass assignment and price tampering', async () => {
  for (const extra of [
    { total: 1 },
    { userId: '100000000000000000000003' },
    { status: 'confirmed' },
  ])
    await call('POST', '/bookings', {
      token: player,
      headers: { 'Idempotency-Key': 'invalid-body-key' },
      body: { ...bookingBody(), ...extra },
      status: 422,
    });
  await call('POST', '/bookings', {
    token: player,
    headers: { 'Idempotency-Key': 'invalid-phone-key' },
    body: { ...bookingBody(), contactPhone: 'abc' },
    status: 422,
  });
});
test('booking requires Idempotency-Key and a published slot boundary', async () => {
  await call('POST', '/bookings', { token: player, body: bookingBody(), status: 400 });
  await call('POST', '/bookings', {
    token: player,
    body: { ...bookingBody(), startAt: '2026-11-09T18:30:00+07:00' },
    headers: { 'Idempotency-Key': 'bad-slot-key' },
    status: 422,
  });
});
test('booking returns 201 and Location; exact retries replay; changed body conflicts', async () => {
  const first = await makeBooking(18, 'same-booking-key');
  const again = await makeBooking(18, 'same-booking-key');
  assert.deepEqual(first.body, again.body);
  assert.match(first.headers.get('location'), /\/bookings\/[a-f0-9]{24}$/);
  assert.equal(first.body.data.total, 450000);
  await call('POST', '/bookings', {
    token: player,
    body: bookingBody(19),
    headers: { 'Idempotency-Key': 'same-booking-key' },
    status: 409,
  });
});
test('two concurrent callers cannot reserve the same slot in this mock process', async () => {
  const requests = ['race-key-one', 'race-key-two'].map((key) =>
    fetch(`${base}/api/v1/bookings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${player}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify(bookingBody(19)),
    }),
  );
  const responses = await Promise.all(requests);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  assert.equal(state.bookings.filter((b) => b.startAt === '2026-11-09T12:00:00.000Z').length, 1);
});
test('booking ownership protects both read and cancellation endpoints (BOLA)', async () => {
  const booking = (await makeBooking(20, 'ownership-key')).body.data;
  await call('GET', `/bookings/${booking.id}`, { token: player });
  await call('GET', `/bookings/${booking.id}`, { token: other, status: 404 });
  await call('PUT', `/bookings/${booking.id}/cancellation`, {
    token: other,
    body: { reason: 'Try IDOR' },
    status: 404,
  });
  assert.equal((await call('GET', '/bookings', { token: other })).body.data.length, 0);
});
test('cursor pagination is stable across tied timestamps and scoped to filter/user', async () => {
  const first = (await call('GET', '/bookings?limit=1&status=confirmed', { token: player })).body;
  assert.equal(first.meta.hasMore, true);
  const second = (await call('GET', first.links.next.replace('/api/v1', ''), { token: player }))
    .body;
  assert.notEqual(first.data[0].id, second.data[0].id);
  await call('GET', `/bookings?cursor=${first.meta.nextCursor}`, { token: player, status: 400 });
  await call('GET', `/bookings?status=confirmed&cursor=${first.meta.nextCursor}`, {
    token: other,
    status: 400,
  });
  await call('GET', '/bookings?cursor=garbage', { token: player, status: 400 });
});
test('cancellation is idempotent and releases availability; changed reason conflicts', async () => {
  const booking = (await makeBooking(21, 'cancel-booking-key')).body.data;
  const path = `/bookings/${booking.id}/cancellation`;
  const first = await call('PUT', path, {
    token: player,
    body: { reason: 'Đội đổi lịch' },
    status: 201,
  });
  const again = await call('PUT', path, { token: player, body: { reason: 'Đội đổi lịch' } });
  assert.deepEqual(first.body, again.body);
  await call('PUT', path, { token: player, body: { reason: 'Lý do mới' }, status: 409 });
  assert.equal(
    (await call('GET', `/bookings/${booking.id}`, { token: player })).body.data.status,
    'cancelled',
  );
  await makeBooking(21, 'new-booking-after-cancel');
  // A replay still returns the original creation result, not a second reservation.
  assert.equal((await makeBooking(21, 'cancel-booking-key')).body.data.id, booking.id);
});
test('cancellation cutoff is enforced server-side', async () => {
  const created = await call('POST', '/bookings', {
    token: player,
    body: { ...bookingBody(16), startAt: '2026-11-08T16:00:00+07:00' },
    headers: { 'Idempotency-Key': 'cutoff-booking-key' },
  });
  await call('PUT', `/bookings/${created.body.data.id}/cancellation`, {
    token: player,
    body: { reason: 'Too late' },
    status: 409,
  });
});
test('owner CRUD uses Location, ETag, If-Match; PUT and PATCH differ', async () => {
  const input = Object.fromEntries(
    Object.keys(contract.components.schemas.PitchInput.properties).map((key) => [
      key,
      state.pitches[0][key],
    ]),
  );
  input.name = 'Sân kiểm thử hợp đồng';
  const created = await call('POST', '/pitches', { token: owner, body: input });
  const path = `/pitches/${created.body.data.id}`;
  assert.equal(created.headers.get('etag'), '"1"');
  const read = await call('GET', path);
  await call('PATCH', path, { token: owner, body: { price: 400000 }, status: 428 });
  const patched = await call('PATCH', path, {
    token: owner,
    body: { price: 400000 },
    headers: { 'If-Match': read.headers.get('etag') },
  });
  assert.equal(patched.body.data.price, 400000);
  assert.equal(patched.body.data.name, input.name);
  await call('PATCH', path, {
    token: owner,
    body: { price: 410000 },
    headers: { 'If-Match': '"1"' },
    status: 412,
  });
  await call('PATCH', path, {
    token: owner,
    body: { ownerId: '100000000000000000000003' },
    headers: { 'If-Match': '"2"' },
    status: 422,
  });
  await call('PUT', path, {
    token: owner,
    body: { price: 400000 },
    headers: { 'If-Match': '"2"' },
    status: 422,
  });
  const replaced = await call('PUT', path, {
    token: owner,
    body: {
      ...Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'venueId')),
      isActive: false,
    },
    headers: { 'If-Match': '"2"' },
  });
  await call('GET', path, { status: 404 });
  await call('GET', path, { token: owner });
  await call('DELETE', path, {
    token: owner,
    headers: { 'If-Match': replaced.headers.get('etag') },
    status: 204,
  });
  await call('GET', path, { token: owner, status: 404 });
});
test('owner cannot delete a pitch with upcoming confirmed bookings', async () => {
  await call('DELETE', `/pitches/${pitchId}`, {
    token: owner,
    headers: { 'If-Match': '"1"' },
    status: 409,
  });
});
test('owner cannot mutate another owner’s pitch', async () => {
  const pitch = state.pitches[1],
    venue = state.venues.find((v) => v.id === pitch.venueId),
    original = venue.ownerId;
  venue.ownerId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  try {
    await call('PATCH', `/pitches/${pitch.id}`, {
      token: owner,
      body: { price: 400000 },
      headers: { 'If-Match': '"1"' },
      status: 403,
    });
  } finally {
    venue.ownerId = original;
  }
});
test('protocol errors: malformed JSON, unsupported media type, excessive payload and method', async () => {
  await call('POST', '/sessions', {
    raw: '{bad',
    headers: { 'Content-Type': 'application/json' },
    status: 400,
  });
  await call('POST', '/sessions', {
    raw: 'x',
    headers: { 'Content-Type': 'text/plain' },
    status: 415,
  });
  await call('POST', '/sessions', {
    body: { email: 'a@a.com', password: 'x'.repeat(33000) },
    status: 413,
  });
  const response = await fetch(`${base}/api/v1/health`, { method: 'DELETE' });
  assert.equal(response.status, 405);
  assert.match(response.headers.get('allow'), /GET/);
  assert.match(response.headers.get('content-type'), /application\/problem\+json/);
});
test('logout revokes access and expired sessions are rejected', async () => {
  const token = (
    await call('POST', '/sessions', {
      body: { email: 'player@keosan.demo', password: DEMO_PASSWORD },
    })
  ).body.data.accessToken;
  await call('DELETE', '/sessions/current', { token, status: 204 });
  await call('GET', '/users/me', { token, status: 401 });
  state.sessions.set('expired', { userId: state.bookings[0].userId, expiresAt: fixedNow - 1 });
  await call('GET', '/users/me', { token: 'expired', status: 401 });
});
test('login rejects credentials generically and rate limits with Retry-After', async () => {
  state.attempts.clear();
  for (let index = 0; index < 20; index++)
    await call('POST', '/sessions', {
      body: { email: 'unknown@example.com', password: 'wrong-password' },
      status: 401,
    });
  const response = await call('POST', '/sessions', {
    body: { email: 'unknown@example.com', password: 'wrong-password' },
    status: 429,
  });
  assert.ok(Number(response.headers.get('retry-after')) > 0);
});
const haDong = '200000000000000000000005';
const inputFrom = (schema, item) =>
  Object.fromEntries(
    Object.keys(contract.components.schemas[schema].properties).map((key) => [key, item[key]]),
  );

test('venue tree exposes two separate 5-a-side pitches and one 11-a-side pitch at Ha Dong', async () => {
  const venues = (await call('GET', '/venues?limit=2&sort=minPrice,name')).body;
  assert.equal(venues.meta.total, 9);
  const next = (await call('GET', venues.links.next.replace('/api/v1', ''))).body;
  assert.equal(new Set([...venues.data, ...next.data].map((v) => v.id)).size, 4);
  const venue = (await call('GET', `/venues/${haDong}`)).body.data;
  assert.equal(venue.name, 'Sân bóng Hà Đông');
  assert.deepEqual(venue.pitchTypes, [
    { type: 5, count: 2 },
    { type: 11, count: 1 },
  ]);
  assert.equal(venue.pitchCount, 3);
  assert.equal(venue.minPrice, 250000);
  const children = (await call('GET', `/venues/${haDong}/pitches?sort=name&limit=50`)).body;
  assert.deepEqual(
    children.data.map((p) => p.name),
    ['Sân số 1', 'Sân số 2', 'Sân số 3'],
  );
  assert.equal(new Set(children.data.map((p) => p.id)).size, 3);
  assert.ok(children.data.every((p) => p.venueId === haDong && p.links.venue.endsWith(haDong)));
  assert.equal((await call('GET', `/pitches?venueId=${haDong}`)).body.meta.total, 3);
  const paged = (await call('GET', `/venues/${haDong}/pitches?type=5&limit=1`)).body;
  assert.equal(paged.meta.total, 2);
  assert.match(paged.links.next, new RegExp(`/venues/${haDong}/pitches`));
  assert.notEqual(
    paged.data[0].id,
    (await call('GET', paged.links.next.replace('/api/v1', ''))).body.data[0].id,
  );
  await call('GET', '/venues/bad-id', { status: 400 });
  await call('GET', '/venues/aaaaaaaaaaaaaaaaaaaaaaaa/pitches', { status: 404 });
});
test('venue type and budget filters must match the same active physical pitch', async () => {
  const q = encodeURIComponent('Tô Hiệu');
  assert.equal((await call('GET', `/venues?q=${q}&type=11&maxPrice=300000`)).body.meta.total, 0);
  assert.equal(
    (await call('GET', `/venues?q=${q}&type=5&maxPrice=260000`)).body.data[0].id,
    haDong,
  );
});
test('independent sibling pitches can be booked simultaneously; cancellation releases only its own pitch', async () => {
  const pitches = (await call('GET', `/venues/${haDong}/pitches?sort=name`)).body.data;
  const bookings = await Promise.all(
    pitches.map((pitch, index) =>
      call('POST', '/bookings', {
        token: player,
        body: { ...bookingBody(18), pitchId: pitch.id },
        headers: { 'Idempotency-Key': `independent-sibling-${index}` },
      }),
    ),
  );
  assert.equal(new Set(bookings.map((result) => result.body.data.id)).size, 3);
  assert.equal(bookings[0].body.data.venueId, haDong);
  assert.equal(bookings[0].body.data.venueName, 'Sân bóng Hà Đông');
  assert.deepEqual(
    bookings.map((r) => r.body.data.total),
    [350000, 380000, 700000],
  );
  await call('POST', '/bookings', {
    token: other,
    body: { ...bookingBody(18), pitchId: pitches[0].id },
    headers: { 'Idempotency-Key': 'sibling-double-booking' },
    status: 409,
  });
  await call('PUT', `/bookings/${bookings[0].body.data.id}/cancellation`, {
    token: player,
    body: { reason: 'Chỉ hủy Sân số 1' },
    status: 201,
  });
  for (let i = 0; i < pitches.length; i++) {
    const slots = (await call('GET', `/pitches/${pitches[i].id}/availability?date=2026-11-09`)).body
      .data.slots;
    assert.equal(slots.find((s) => s.startAt === '2026-11-09T11:00:00.000Z').available, i === 0);
  }
  assert.equal(
    (await call('GET', `/bookings/${bookings[1].body.data.id}`, { token: player })).body.data
      .status,
    'confirmed',
  );
});
test('venue CRUD enforces schema, ownership and ETag; an empty venue has null minimum price', async () => {
  const input = { ...inputFrom('VenueInput', state.venues[0]), name: 'Cơ sở kiểm thử' };
  await call('POST', '/venues', { token: player, body: input, status: 403 });
  const created = await call('POST', '/venues', { token: owner, body: input });
  const path = `/venues/${created.body.data.id}`;
  assert.equal(created.body.data.minPrice, null);
  assert.equal(created.body.data.pitchCount, 0);
  assert.equal(created.headers.get('location'), `/api/v1${path}`);
  await call('PATCH', path, { token: owner, body: { name: 'Cơ sở mới' }, status: 428 });
  const updated = await call('PATCH', path, {
    token: owner,
    body: { name: 'Cơ sở mới' },
    headers: { 'If-Match': '"1"' },
  });
  assert.equal(updated.headers.get('etag'), '"2"');
  await call('PUT', path, {
    token: owner,
    body: { name: 'Thiếu field' },
    headers: { 'If-Match': '"2"' },
    status: 422,
  });
  await call('PUT', path, { token: owner, body: input, headers: { 'If-Match': '"2"' } });
  await call('DELETE', path, { token: owner, headers: { 'If-Match': '"1"' }, status: 412 });
  await call('DELETE', path, { token: owner, headers: { 'If-Match': '"3"' }, status: 204 });
  await call('GET', path, { status: 404 });
});
test('parent ownership cannot be bypassed by adding or changing a child or using scope=mine', async () => {
  const venue = state.venues[8],
    original = venue.ownerId;
  const input = {
    ...inputFrom('PitchInput', state.pitches[0]),
    venueId: venue.id,
    name: 'Sân mới',
  };
  await call('GET', '/venues?scope=mine', { status: 401 });
  await call('GET', '/venues?scope=mine', { token: player, status: 403 });
  venue.ownerId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  try {
    await call('POST', '/pitches', { token: owner, body: input, status: 403 });
    await call('GET', `/venues/${venue.id}/pitches?scope=mine`, { token: owner, status: 403 });
    await call('PATCH', `/venues/${venue.id}`, {
      token: owner,
      body: { name: 'BOLA attempt' },
      headers: { 'If-Match': `"${venue.version}"` },
      status: 403,
    });
    await call('DELETE', `/venues/${venue.id}`, {
      token: owner,
      headers: { 'If-Match': `"${venue.version}"` },
      status: 403,
    });
    assert.ok(
      !(await call('GET', '/venues?scope=mine&limit=50', { token: owner })).body.data.some(
        (v) => v.id === venue.id,
      ),
    );
  } finally {
    venue.ownerId = original;
  }
});
test('a pitch cannot move venues or impersonate a parent; names are unique only within one venue', async () => {
  const input = inputFrom('PitchInput', state.pitches[0]);
  await call('POST', '/pitches', {
    token: owner,
    body: { ...input, venueId: 'aaaaaaaaaaaaaaaaaaaaaaaa' },
    status: 404,
  });
  await call('POST', '/pitches', {
    token: owner,
    body: { ...input, name: '  SÂN SỐ 1  ' },
    status: 409,
  });
  await call('PATCH', `/pitches/${pitchId}`, {
    token: owner,
    body: { venueId: haDong },
    headers: { 'If-Match': '"1"' },
    status: 422,
  });
  await call('POST', '/bookings', {
    token: player,
    body: { ...bookingBody(18), venueId: haDong },
    headers: { 'Idempotency-Key': 'tampered-parent-booking' },
    status: 422,
  });
  const child = (await call('GET', `/venues/${haDong}/pitches?sort=name`)).body.data[1];
  await call('PATCH', `/pitches/${child.id}`, {
    token: owner,
    body: { name: 'Sân số 1' },
    headers: { 'If-Match': `"${child.version}"` },
    status: 409,
  });
});
test('child mutations change venue summaries and parent ETag; venue deletion never cascades', async () => {
  const venue = state.venues[7],
    path = `/venues/${venue.id}`;
  const before = await call('GET', path);
  const input = {
    ...inputFrom('PitchInput', state.pitches[0]),
    venueId: venue.id,
    name: 'Sân số 2',
    price: 100000,
    type: 11,
  };
  const child = (await call('POST', '/pitches', { token: owner, body: input })).body.data;
  const after = await call('GET', path);
  assert.notEqual(after.headers.get('etag'), before.headers.get('etag'));
  assert.equal(after.body.data.pitchCount, before.body.data.pitchCount + 1);
  assert.equal(after.body.data.minPrice, 100000);
  await call('DELETE', path, {
    token: owner,
    headers: { 'If-Match': after.headers.get('etag') },
    status: 409,
  });
  await call('PATCH', `/pitches/${child.id}`, {
    token: owner,
    body: { isActive: false },
    headers: { 'If-Match': '"1"' },
  });
  const inactive = await call('GET', path);
  assert.equal(inactive.body.data.pitchCount, before.body.data.pitchCount);
  assert.equal(
    (await call('GET', `${path}/pitches?scope=mine`, { token: owner })).body.meta.total,
    before.body.data.pitchCount + 1,
  );
  await call('DELETE', `/pitches/${child.id}`, {
    token: owner,
    headers: { 'If-Match': '"2"' },
    status: 204,
  });
});
test('closing a venue hides and blocks every child without changing sibling booking history', async () => {
  const venue = (await call('GET', `/venues/${haDong}`)).body.data;
  const close = await call('PATCH', `/venues/${haDong}`, {
    token: owner,
    body: { isActive: false },
    headers: { 'If-Match': `"${venue.version}"` },
  });
  const child = state.pitches.find((p) => p.venueId === haDong);
  await call('GET', `/pitches/${child.id}`, { status: 404 });
  await call('GET', `/venues/${haDong}/pitches`, { status: 404 });
  await call('GET', `/pitches/${child.id}/availability?date=2026-11-09`, { status: 404 });
  await call('GET', `/venues/${haDong}`, { token: owner });
  const owned = (await call('GET', `/venues/${haDong}/pitches?scope=mine`, { token: owner })).body;
  assert.equal(owned.meta.total, 3);
  await call('POST', '/bookings', {
    token: player,
    body: { ...bookingBody(20), pitchId: child.id },
    headers: { 'Idempotency-Key': 'closed-parent-booking' },
    status: 404,
  });
  assert.ok(state.bookings.some((b) => b.venueId === haDong && b.status === 'confirmed'));
  await call('PATCH', `/venues/${haDong}`, {
    token: owner,
    body: { isActive: true },
    headers: { 'If-Match': close.headers.get('etag') },
  });
});
test('booking history snapshots the original facility and physical pitch names', async () => {
  const booking = state.bookings.find((b) => b.venueId === haDong && b.status === 'confirmed');
  const venue = state.venues.find((v) => v.id === haDong),
    original = venue.name;
  const pitch = state.pitches.find((p) => p.id === booking.pitchId),
    originalPitch = pitch.name;
  venue.name = 'Tên cơ sở mới';
  pitch.name = 'Tên sân mới';
  try {
    const read = (await call('GET', `/bookings/${booking.id}`, { token: player })).body.data;
    assert.equal(read.venueName, 'Sân bóng Hà Đông');
    assert.equal(read.pitchName, originalPitch);
  } finally {
    venue.name = original;
    pitch.name = originalPitch;
  }
});

test('all declared operations have exercised contract-validated responses', () => {
  const expected = Object.values(contract.paths).flatMap((item) =>
    Object.values(item)
      .filter((op) => op.operationId)
      .map((op) => op.operationId),
  );
  assert.deepEqual([...operations].sort(), expected.sort());
});
