import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { frontendContract } from '../packages/contracts/frontend-openapi.js';
import { createMockTransport } from '../apps/web/src/mocks/transport.js';
import { localDate, addDays, slotStart } from '../packages/shared/time.js';
const V = '200000000000000000000005',
  C1 = '00000000000000000000000a',
  C2 = '00000000000000000000000b';
const NOW = Date.parse('2026-11-09T09:00:00+07:00');
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validators = new Map(),
  covered = new Set();
function validateResponse(path, method, status, body, mediaType) {
  const route = Object.entries(frontendContract.paths).find(([key]) =>
    new RegExp(`^${key.replace(/\{[^}]+\}/g, '[^/]+')}$`).test(path.split('?')[0]),
  );
  const op = route?.[1][method.toLowerCase()];
  assert.ok(op, `Missing operation ${method} ${path}`);
  covered.add(op.operationId);
  const result = op.responses[status];
  assert.ok(result, `Undocumented status ${status}: ${method} ${path}`);
  if (!result.content) return assert.equal(body, null);
  const schema = result.content[mediaType]?.schema;
  assert.ok(schema, `Undocumented content type ${mediaType}`);
  const key = `${op.operationId}:${status}`;
  if (!validators.has(key))
    validators.set(key, ajv.compile({ ...schema, components: frontendContract.components }));
  const validate = validators.get(key);
  assert.ok(validate(body), `${method} ${path}: ${JSON.stringify(validate.errors)}`);
}
async function setup() {
  let time = NOW;
  const mock = createMockTransport({ now: () => time });
  async function call(path, { user, ...options } = {}) {
    const res = await mock.send(path, {
      ...options,
      headers: {
        ...(user ? { Authorization: `Bearer ${user.accessToken}` } : {}),
        ...options.headers,
      },
    });
    const body = res.status === 204 ? null : await res.json();
    validateResponse(
      path,
      options.method || 'GET',
      res.status,
      body,
      res.headers.get('Content-Type').split(';')[0],
    );
    return {
      status: res.status,
      etag: res.headers.get('ETag'),
      body,
    };
  }
  const login = async (who) =>
    (
      await call('/auth/login', {
        method: 'POST',
        body: { email: `${who}@keosan.demo`, password: 'Demo@12345' },
      })
    ).body.data;
  return {
    mock,
    call,
    player: await login('player'),
    owner: await login('owner'),
    admin: await login('admin'),
    advance: (ms) => {
      time += ms;
    },
  };
}
const interval = (courtId = C1) => ({
  courtId,
  startTime: slotStart(addDays(localDate(NOW), 1), 18),
  endTime: slotStart(addDays(localDate(NOW), 1), 19),
  note: 'Kiểm thử frontend',
});
const book = (ctx, body = interval(), key = crypto.randomUUID()) =>
  ctx.call('/bookings', {
    user: ctx.player,
    method: 'POST',
    body,
    headers: { 'Idempotency-Key': key },
  });
test('frontend catalog keeps distinct sibling courts and same-child filters', async () => {
  const t = await setup();
  const venue = (await t.call(`/venues/${V}`)).body.data;
  assert.equal(venue.courtCount, 3);
  assert.deepEqual(
    venue.courtTypes.map((x) => [x.teamSize, x.count]).sort(),
    [
      [5, 2],
      [11, 1],
    ].sort(),
  );
  assert.equal((await t.call(`/venues/${V}/courts?teamSize=5`)).body.data.length, 2);
  assert.equal(
    (await t.call('/venues?sportTypeId=football&teamSize=11&maxPrice=300000')).body.meta.total,
    0,
  );
  assert.equal((await t.call('/venues?keyword=ha%20dong')).body.data[0].id, V);
});
test('quote prices 90 minutes across peak boundary and availability covers full interval', async () => {
  const t = await setup();
  const day = addDays(localDate(NOW), 1);
  const start = `${day}T16:30:00+07:00`,
    end = `${day}T18:00:00+07:00`;
  const q = await t.call(`/courts/${C1}/quote?${new URLSearchParams({ start, end })}`);
  assert.equal(q.status, 200);
  assert.equal(q.body.data.totalPrice, 475000);
  assert.equal(q.body.data.lines.length, 3);
  assert.equal((await book(t, { ...interval(), startTime: start, endTime: end })).status, 201);
  const overlap = await book(t, { ...interval(), startTime: `${day}T17:30:00+07:00` });
  assert.equal(overlap.status, 409);
  assert.equal((await book(t)).status, 201); // adjacent 18:00 is permitted
});
test('independent courts book together; same key replays and same court conflicts', async () => {
  const t = await setup();
  const key = crypto.randomUUID();
  const a = await book(t, interval(), key),
    b = await book(t, interval(C2));
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal(a.body.data.status, 'pending');
  assert.equal((await book(t, interval(), key)).body.data.id, a.body.data.id);
  assert.equal((await book(t)).status, 409);
  assert.equal((await book(t, interval(C2), key)).status, 409);
});
test('expiry releases holds and prevents late owner confirmation', async () => {
  const t = await setup(),
    a = await book(t);
  t.advance(31 * 60000);
  // Sign in again after the 15-minute access-token lifetime.
  const login = await t.call('/auth/login', {
    method: 'POST',
    body: { email: 'owner@keosan.demo', password: 'Demo@12345' },
  });
  const owner = login.body.data;
  assert.equal(
    (await t.call(`/bookings/${a.body.data.id}/confirm`, { method: 'POST', user: owner })).status,
    409,
  );
  const avail = (await t.call(`/courts/${C1}/availability?date=${addDays(localDate(NOW), 1)}`)).body
    .data;
  assert.equal(avail.slots.find((s) => s.startTime === interval().startTime).available, true);
});
test('owner confirms, customer initiates payment, demo settles separately, retry is safe', async () => {
  const t = await setup(),
    b = (await book(t)).body.data;
  const payment = () =>
    t.call(`/bookings/${b.id}/payments`, {
      user: t.player,
      method: 'POST',
      body: { method: 'bank_transfer' },
      headers: { 'Idempotency-Key': 'payment-test' },
    });
  assert.equal((await payment()).status, 409);
  assert.equal(
    (await t.call(`/bookings/${b.id}/confirm`, { user: t.player, method: 'POST' })).status,
    403,
  );
  assert.equal(
    (await t.call(`/bookings/${b.id}/confirm`, { user: t.owner, method: 'POST' })).body.data.status,
    'confirmed',
  );
  const p = (await payment()).body.data;
  assert.equal(p.status, 'pending');
  assert.equal((await payment()).body.data.id, p.id);
  t.mock.settlePayment(p.id);
  t.mock.settlePayment(p.id);
  assert.equal(
    (await t.call(`/bookings/${b.id}`, { user: t.player })).body.data.paymentStatus,
    'paid',
  );
  assert.equal(
    (await t.call(`/bookings/${b.id}/complete`, { user: t.owner, method: 'POST' })).status,
    409,
  );
});
test('cancellation preserves payment history and releases only the cancelled court', async () => {
  const t = await setup(),
    a = (await book(t)).body.data,
    b = (await book(t, interval(C2))).body.data;
  assert.equal(
    (
      await t.call(`/bookings/${a.id}/cancel`, {
        user: t.player,
        method: 'POST',
        body: { reason: 'Đổi lịch chơi' },
      })
    ).body.data.status,
    'cancelled',
  );
  assert.equal((await book(t)).status, 201);
  assert.equal((await book(t, interval(C2))).status, 409);
  assert.equal((await t.call(`/bookings/${b.id}`, { user: t.owner })).status, 200);
});
test('reviews require completed owned booking, support edit/delete and update aggregate', async () => {
  const t = await setup();
  const create = (bookingId) =>
    t.call(`/venues/${V}/reviews`, {
      user: t.player,
      method: 'POST',
      body: { bookingId, rating: 5, comment: 'Mặt sân tốt, đèn sáng.' },
    });
  assert.equal((await create('demo-confirmed')).status, 403);
  const r = await create('demo-completed');
  assert.equal(r.status, 201);
  assert.equal((await create('demo-completed')).status, 409);
  assert.equal((await t.call(`/venues/${V}`)).body.data.rating, 5);
  assert.equal(
    (await t.call(`/reviews/${r.body.data.id}`, { user: t.owner, method: 'DELETE' })).status,
    403,
  );
  await t.call(`/reviews/${r.body.data.id}`, {
    user: t.player,
    method: 'PUT',
    body: { rating: 4, comment: 'Đã chỉnh nhận xét.' },
  });
  assert.equal(
    (await t.call('/bookings/demo-completed', { user: t.player })).body.data.review.rating,
    4,
  );
  await t.call(`/reviews/${r.body.data.id}`, { user: t.player, method: 'DELETE' });
  assert.equal((await t.call(`/venues/${V}`)).body.data.reviewCount, 0);
});
test('registration/profile/refresh/logout work without accepting roles from registration', async () => {
  const t = await setup();
  const body = {
    email: 'demo@example.test',
    fullName: 'Người chơi thử',
    phone: '0912345678',
    password: 'Password123',
  };
  assert.equal(
    (await t.call('/auth/register', { method: 'POST', body: { ...body, role: 'ADMIN' } })).status,
    422,
  );
  assert.equal((await t.call('/auth/register', { method: 'POST', body })).status, 201);
  assert.equal((await t.call('/auth/register', { method: 'POST', body })).status, 409);
  const user = (await t.call('/auth/login', { method: 'POST', body })).body.data;
  assert.equal(
    (
      await t.call('/users/me', {
        method: 'PUT',
        user,
        body: { fullName: 'Tên mới', phone: '0911111111' },
      })
    ).body.data.fullName,
    'Tên mới',
  );
  t.advance(16 * 60000);
  assert.equal((await t.call('/users/me', { user })).status, 401);
  const refreshed = (await t.call('/auth/refresh', { method: 'POST' })).body.data;
  assert.equal(refreshed.user.id, user.user.id);
  await t.call('/auth/logout', { method: 'POST', user: refreshed });
  assert.equal((await t.call('/auth/refresh', { method: 'POST' })).status, 401);
});
test('owner CRUD uses parent ownership, version and no cascade; sport mutations require admin', async () => {
  const t = await setup();
  assert.equal((await t.call('/owner/venues', { user: t.player })).status, 403);
  assert.equal(
    (await t.call('/sport-types', { user: t.owner, method: 'POST', body: { name: 'Bóng rổ' } }))
      .status,
    403,
  );
  const s = (
    await t.call('/sport-types', { user: t.admin, method: 'POST', body: { name: 'Bóng rổ' } })
  ).body.data;
  assert.equal(
    (await t.call(`/sport-types/${s.id}`, { user: t.admin, method: 'DELETE' })).status,
    204,
  );
  const venue = await t.call(`/venues/${V}`, { user: t.owner });
  assert.equal(
    (
      await t.call(`/venues/${V}`, {
        user: t.owner,
        method: 'DELETE',
        headers: { 'If-Match': venue.etag },
      })
    ).status,
    409,
  );
  const court = await t.call(`/courts/${C1}`),
    { id, venueId, version, createdAt, updatedAt, sportName, ...body } = court.body.data;
  assert.equal(
    (
      await t.call(`/courts/${C1}`, {
        user: t.owner,
        method: 'PUT',
        body: { ...body, basePricePerHour: 290000 },
        headers: { 'If-Match': court.etag },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await t.call(`/courts/${C1}`, {
        user: t.owner,
        method: 'PUT',
        body,
        headers: { 'If-Match': court.etag },
      })
    ).status,
    412,
  );
  assert.notEqual((await t.call(`/venues/${V}`)).etag, venue.etag);
});

test('catalog CRUD round trip and paginated lists conform to the frontend contract', async () => {
  const t = await setup();
  const sports = await t.call('/sport-types');
  assert.equal(sports.body.data.length, 3);
  const sport = (
    await t.call('/sport-types', { user: t.admin, method: 'POST', body: { name: 'Bóng chuyền' } })
  ).body.data;
  assert.equal(
    (
      await t.call(`/sport-types/${sport.id}`, {
        user: t.admin,
        method: 'PUT',
        body: { name: 'Bóng chuyền hơi' },
      })
    ).body.data.name,
    'Bóng chuyền hơi',
  );
  const body = {
    name: 'Cơ sở thử nghiệm',
    address: '123 Đường Mẫu',
    district: 'Hải Châu',
    city: 'Đà Nẵng',
    description: 'Cơ sở thử nghiệm giao diện.',
    openTime: '06:00',
    closeTime: '23:00',
    timezone: 'Asia/Ho_Chi_Minh',
    status: 'active',
    imageKey: 'pitch-1',
    amenities: ['lights'],
  };
  const venue = await t.call('/venues', { user: t.owner, method: 'POST', body });
  assert.equal(venue.status, 201);
  const path = `/venues/${venue.body.data.id}`;
  const updated = await t.call(path, {
    user: t.owner,
    method: 'PUT',
    body: { ...body, name: 'Cơ sở đã sửa' },
    headers: { 'If-Match': venue.etag },
  });
  assert.equal(updated.body.data.name, 'Cơ sở đã sửa');
  const court = await t.call(`${path}/courts`, {
    user: t.owner,
    method: 'POST',
    body: {
      name: 'Sân chuyền số 1',
      sportTypeId: sport.id,
      teamSize: null,
      basePricePerHour: 200000,
      description: 'Sân dùng kiểm tra thao tác quản lý.',
      imageKey: 'pitch-1',
      status: 'active',
    },
  });
  assert.equal(court.status, 201);
  assert.equal((await t.call('/venues?city=Đà%20Nẵng&district=Hải%20Châu')).body.meta.total, 1);
  assert.equal(
    (await t.call('/owner/venues?page=2&limit=6', { user: t.owner })).body.meta.total,
    10,
  );
  assert.equal(
    (await t.call(`/sport-types/${sport.id}`, { user: t.admin, method: 'DELETE' })).status,
    409,
  );
  assert.equal(
    (
      await t.call(`/courts/${court.body.data.id}`, {
        user: t.owner,
        method: 'DELETE',
        headers: { 'If-Match': court.etag },
      })
    ).status,
    204,
  );
  const latest = await t.call(path, { user: t.owner });
  assert.equal(
    (await t.call(path, { user: t.owner, method: 'DELETE', headers: { 'If-Match': latest.etag } }))
      .status,
    204,
  );
  assert.equal(
    (await t.call(`/sport-types/${sport.id}`, { user: t.admin, method: 'DELETE' })).status,
    204,
  );
});

test('booking/payment privacy, completion and refund state remain separate', async () => {
  const t = await setup();
  assert.equal((await t.call('/users/me', { user: t.player })).body.data.role, 'CUSTOMER');
  assert.equal(
    (await t.call('/users/me/bookings?status=confirmed&page=1&limit=1', { user: t.player })).body
      .meta.total,
    2,
  );
  assert.equal(
    (await t.call(`/venues/${V}/bookings?date=${addDays(localDate(NOW), 1)}`, { user: t.owner }))
      .body.meta.total,
    2,
  );
  assert.equal((await t.call('/bookings/demo-confirmed', { user: t.admin })).status, 404);
  const pay = (
    await t.call('/bookings/demo-confirmed/payments', {
      user: t.player,
      method: 'POST',
      body: { method: 'cash' },
      headers: { 'Idempotency-Key': 'cash-fixture-test' },
    })
  ).body.data;
  assert.equal(
    (await t.call(`/payments/${pay.id}`, { user: t.owner })).body.data.status,
    'pending',
  );
  assert.equal((await t.call(`/payments/${pay.id}`, { user: t.admin })).status, 404);
  assert.equal(
    (await t.call('/bookings/demo-confirmed/payments', { user: t.player })).body.data.length,
    1,
  );
  t.mock.settlePayment(pay.id);
  const cancel = await t.call('/bookings/demo-confirmed/cancel', {
    user: t.player,
    method: 'POST',
    body: { reason: 'Đổi kế hoạch đội' },
  });
  assert.equal(cancel.body.data.paymentStatus, 'refund_pending');
  assert.equal(
    (await t.call(`/payments/${pay.id}`, { user: t.player })).body.data.status,
    'succeeded',
  );
  const completed = await t.call('/bookings/demo-ready/complete', {
    user: t.owner,
    method: 'POST',
  });
  assert.equal(completed.body.data.status, 'completed');
  assert.equal(completed.body.data.paymentStatus, 'unpaid');
  assert.equal((await t.call(`/venues/${V}/reviews`)).body.meta.total, 0);
});

test('all 37 frontend operations have contract-validated responses; callback is reserved', () => {
  const expected = Object.values(frontendContract.paths).flatMap((item) =>
    Object.values(item)
      .filter((op) => op.operationId && !op['x-backend-only'])
      .map((op) => op.operationId),
  );
  assert.equal(expected.length, 37);
  assert.deepEqual(
    expected.filter((id) => !covered.has(id)),
    [],
  );
});
