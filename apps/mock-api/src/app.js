import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { randomBytes, randomUUID } from 'node:crypto';
import { contract, titles } from '../../../packages/contracts/openapi.js';
import { localDate, addDays } from '../../../packages/shared/time.js';
import { demoUsers, DEMO_PASSWORD, seedPitches, seedVenues } from './data.js';
import { validateSchema } from './validation.js';
import { mountCatalog } from './catalog.js';

const BASE = '/api/v1';
const id = () => randomBytes(12).toString('hex');
const canonical = (value) => JSON.stringify(value, Object.keys(value).sort());
const routes = Object.entries(contract.paths).map(([path, item]) => ({
  path,
  item,
  regex: new RegExp(`^${path.replace(/\{[^}]+\}/g, '([^/]+)')}/?$`),
  names: [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]),
}));

export function createApp({ now = () => Date.now() } = {}) {
  const app = express();
  const state = {
    venues: seedVenues(),
    pitches: seedPitches(),
    bookings: [],
    cancellations: new Map(),
    sessions: new Map(),
    idempotency: new Map(),
    attempts: new Map(),
  };
  app.disable('x-powered-by');
  app.disable('etag');
  app.use(
    cors({
      origin: [
        'http://127.0.0.1:5173',
        'http://localhost:5173',
        'http://127.0.0.1:4173',
        'http://localhost:4173',
      ],
      exposedHeaders: ['ETag', 'Location', 'X-Request-Id', 'Retry-After', 'WWW-Authenticate'],
    }),
  );
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.set({
      'X-Request-Id': req.requestId,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    next();
  });
  app.use(express.json({ limit: '32kb', strict: true }));
  app.get('/openapi.json', (req, res) => res.json(contract));
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(contract, {
      customSiteTitle: 'Kèo Sân · API Explorer',
      swaggerOptions: { persistAuthorization: false },
    }),
  );

  function problem(req, res, status, code, detail, errors) {
    if (status === 401) res.set('WWW-Authenticate', 'Bearer realm="keosan"');
    return res
      .status(status)
      .type('application/problem+json')
      .json({
        type: `urn:keosan:problem:${code.toLowerCase().replaceAll('_', '-')}`,
        title: titles[status],
        status,
        detail,
        instance: req.originalUrl,
        code,
        requestId: req.requestId,
        ...(errors ? { errors } : {}),
      });
  }
  const envelope = (req, data) => ({ data, links: { self: req.originalUrl } });
  function optionalUser(req) {
    const token = req.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    const session = state.sessions.get(token);
    if (!session || session.expiresAt <= now()) return null;
    return demoUsers.find((user) => user.id === session.userId);
  }
  function auth(req, res, next) {
    req.user = optionalUser(req);
    if (!req.user)
      return problem(req, res, 401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập lại để tiếp tục.');
    next();
  }
  function owner(req, res, next) {
    if (req.user.role !== 'owner')
      return problem(req, res, 403, 'ROLE_REQUIRED', 'Chức năng này dành cho chủ sân.');
    next();
  }
  function ownedBooking(req, res, next) {
    req.booking = state.bookings.find(
      (item) => item.id === req.params.bookingId && item.userId === req.user.id,
    );
    if (!req.booking)
      return problem(req, res, 404, 'BOOKING_NOT_FOUND', 'Không tìm thấy lịch đặt sân.');
    next();
  }
  const validDateWindow = (date) =>
    date >= localDate(now()) && date <= addDays(localDate(now()), 30);

  // Validate requests against the same OpenAPI definition used by Swagger and tests.
  app.use(BASE, (req, res, next) => {
    const route = routes.find((item) => item.regex.test(req.path));
    if (!route) return problem(req, res, 404, 'ROUTE_NOT_FOUND', 'Endpoint không tồn tại.');
    const method = req.method === 'HEAD' ? 'get' : req.method.toLowerCase();
    const op = route.item[method];
    if (!op) {
      res.set(
        'Allow',
        Object.keys(route.item)
          .filter((key) => ['get', 'post', 'put', 'patch', 'delete'].includes(key))
          .flatMap((key) => (key === 'get' ? ['GET', 'HEAD'] : [key.toUpperCase()]))
          .join(', '),
      );
      return problem(
        req,
        res,
        405,
        'METHOD_NOT_ALLOWED',
        'HTTP method không được hỗ trợ cho tài nguyên này.',
      );
    }
    const pathValues = Object.fromEntries(
      route.names.map((name, i) => [name, req.path.match(route.regex)[i + 1]]),
    );
    const parameters = [...(route.item.parameters || []), ...(op.parameters || [])];
    const knownQueries = parameters.filter((p) => p.in === 'query').map((p) => p.name);
    if (Object.keys(req.query).some((key) => !knownQueries.includes(key)))
      return problem(req, res, 400, 'INVALID_QUERY', 'Có tham số truy vấn không được hỗ trợ.');
    req.validatedQuery = {};
    for (const p of parameters) {
      let value =
        p.in === 'path'
          ? pathValues[p.name]
          : p.in === 'header'
            ? req.get(p.name)
            : req.query[p.name];
      if (value === undefined) {
        if (p.required)
          return problem(
            req,
            res,
            p.name === 'If-Match' ? 428 : 400,
            'MISSING_PARAMETER',
            `Thiếu tham số ${p.name}.`,
          );
        value = p.schema.default;
        if (value === undefined) continue;
      }
      if (p.schema.type === 'integer' && typeof value === 'string' && /^\d+$/.test(value))
        value = Number(value);
      const result = validateSchema(p.schema, value);
      if (!result.valid)
        return problem(
          req,
          res,
          400,
          'INVALID_PARAMETER',
          `Tham số ${p.name} không hợp lệ.`,
          result.errors,
        );
      if (p.in === 'query') req.validatedQuery[p.name] = value;
    }
    if (op.requestBody) {
      if (!req.is('application/json'))
        return problem(
          req,
          res,
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'Body phải dùng Content-Type: application/json.',
        );
      const result = validateSchema(op.requestBody.content['application/json'].schema, req.body);
      if (!result.valid)
        return problem(
          req,
          res,
          422,
          'VALIDATION_FAILED',
          'Dữ liệu gửi lên chưa hợp lệ.',
          result.errors,
        );
    }
    next();
  });

  app.get(`${BASE}/health`, (req, res) =>
    res.json({ status: 'ok', mode: 'mock', version: contract.info.version }),
  );
  app.post(`${BASE}/sessions`, (req, res) => {
    const current = state.attempts.get(req.ip);
    const attempt = current && current.until > now() ? current : { count: 0, until: now() + 60000 };
    attempt.count++;
    state.attempts.set(req.ip, attempt);
    if (attempt.count > 20) {
      res.set('Retry-After', String(Math.ceil((attempt.until - now()) / 1000)));
      return problem(
        req,
        res,
        429,
        'RATE_LIMITED',
        'Bạn thử đăng nhập quá nhiều lần. Vui lòng đợi một phút.',
      );
    }
    const user = demoUsers.find((item) => item.email === req.body.email.toLowerCase());
    if (!user || req.body.password !== DEMO_PASSWORD)
      return problem(req, res, 401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
    const accessToken = randomBytes(32).toString('base64url');
    state.sessions.set(accessToken, { userId: user.id, expiresAt: now() + 900000 });
    res
      .status(201)
      .location(`${BASE}/sessions/current`)
      .json(envelope(req, { accessToken, tokenType: 'Bearer', expiresIn: 900, user }));
  });
  app.delete(`${BASE}/sessions/current`, auth, (req, res) => {
    state.sessions.delete(req.get('Authorization').split(' ')[1]);
    res.status(204).end();
  });
  app.get(`${BASE}/users/me`, auth, (req, res) => res.json(envelope(req, req.user)));

  const { getVenue, slotsFor } = mountCatalog(app, {
    state,
    BASE,
    now,
    problem,
    envelope,
    optionalUser,
    auth,
    owner,
  });

  app.get(`${BASE}/bookings`, auth, (req, res) => {
    const { limit, cursor, status } = req.validatedQuery;
    let items = state.bookings
      .filter((item) => item.userId === req.user.id && (!status || item.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    if (cursor) {
      let decoded;
      try {
        decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      } catch {
        /* rejected below */
      }
      if (
        !decoded ||
        decoded.userId !== req.user.id ||
        decoded.status !== (status || '') ||
        !/^[a-f0-9]{24}$/.test(decoded.id) ||
        !Number.isFinite(Date.parse(decoded.createdAt))
      )
        return problem(
          req,
          res,
          400,
          'INVALID_CURSOR',
          'Cursor không hợp lệ hoặc không khớp bộ lọc/tài khoản.',
        );
      items = items.filter(
        (item) =>
          item.createdAt < decoded.createdAt ||
          (item.createdAt === decoded.createdAt && item.id < decoded.id),
      );
    }
    const data = items.slice(0, limit),
      hasMore = items.length > limit;
    const last = data.at(-1);
    const nextCursor = hasMore
      ? Buffer.from(
          JSON.stringify({
            id: last.id,
            createdAt: last.createdAt,
            userId: req.user.id,
            status: status || '',
          }),
        ).toString('base64url')
      : null;
    const params = new URLSearchParams({
      limit: String(limit),
      ...(status ? { status } : {}),
      ...(nextCursor ? { cursor: nextCursor } : {}),
    });
    res.json({
      data,
      meta: { limit, hasMore, nextCursor },
      links: {
        self: req.originalUrl,
        next: hasMore ? `${BASE}/bookings?${params}` : null,
        prev: null,
      },
    });
  });
  app.post(`${BASE}/bookings`, auth, (req, res) => {
    const key = `${req.user.id}:${req.get('Idempotency-Key')}`;
    const fingerprint = canonical(req.body);
    const saved = state.idempotency.get(key);
    if (saved && saved.expiresAt > now()) {
      if (saved.fingerprint !== fingerprint)
        return problem(
          req,
          res,
          409,
          'IDEMPOTENCY_CONFLICT',
          'Mã yêu cầu đã được dùng với dữ liệu khác.',
        );
      return res.status(201).location(saved.location).json(saved.body);
    }
    const pitch = state.pitches.find(
      (item) => item.id === req.body.pitchId && item.isActive && getVenue(item.venueId)?.isActive,
    );
    if (!pitch) return problem(req, res, 404, 'PITCH_NOT_FOUND', 'Sân không còn nhận đặt lịch.');
    const date = localDate(req.body.startAt);
    if (!validDateWindow(date))
      return problem(req, res, 422, 'INVALID_SLOT', 'Ngày đặt sân phải trong vòng 30 ngày tới.');
    const slot = slotsFor(pitch, date).find(
      (item) => item.startAt === new Date(req.body.startAt).toISOString(),
    );
    if (!slot)
      return problem(
        req,
        res,
        422,
        'INVALID_SLOT',
        'Chọn một khung giờ 60 phút được công bố trên lịch sân.',
      );
    if (!slot.available)
      return problem(
        req,
        res,
        409,
        'SLOT_UNAVAILABLE',
        'Khung giờ này vừa được đặt hoặc đã qua. Vui lòng chọn giờ khác.',
      );
    // Synchronous mutation is atomic only within this single-process in-memory mock.
    // Real backend must use DB slot claims + unique index/transaction (see MONGODB.md).
    const bookingId = id();
    const location = `${BASE}/bookings/${bookingId}`;
    const booking = {
      id: bookingId,
      code: `KS-${bookingId.slice(-6).toUpperCase()}`,
      userId: req.user.id,
      pitchId: pitch.id,
      pitchName: pitch.name,
      pitchType: pitch.type,
      venueId: pitch.venueId,
      venueName: getVenue(pitch.venueId).name,
      address: getVenue(pitch.venueId).address,
      imageKey: pitch.imageKey,
      startAt: slot.startAt,
      endAt: slot.endAt,
      total: slot.price,
      currency: 'VND',
      status: 'confirmed',
      contactName: req.body.contactName,
      contactPhone: req.body.contactPhone,
      note: req.body.note || '',
      createdAt: new Date(now()).toISOString(),
      links: {
        self: location,
        pitch: `${BASE}/pitches/${pitch.id}`,
        venue: `${BASE}/venues/${pitch.venueId}`,
        cancellation: `${location}/cancellation`,
      },
    };
    state.bookings.push(booking);
    const body = envelope(req, booking);
    state.idempotency.set(key, {
      fingerprint,
      body: structuredClone(body),
      location,
      expiresAt: now() + 86400000,
    });
    res.status(201).location(location).json(body);
  });
  app.get(`${BASE}/bookings/:bookingId`, auth, ownedBooking, (req, res) =>
    res.json(envelope(req, req.booking)),
  );
  app.put(`${BASE}/bookings/:bookingId/cancellation`, auth, ownedBooking, (req, res) => {
    const existing = state.cancellations.get(req.booking.id);
    if (existing) {
      if (existing.reason !== req.body.reason)
        return problem(req, res, 409, 'CANCELLATION_EXISTS', 'Lịch đã hủy với một lý do khác.');
      return res.json(envelope(req, existing));
    }
    if (Date.parse(req.booking.startAt) - now() < 7200000)
      return problem(
        req,
        res,
        409,
        'CANCELLATION_CUTOFF',
        'Chỉ có thể hủy trước giờ bắt đầu ít nhất 2 tiếng.',
      );
    const cancellation = {
      bookingId: req.booking.id,
      reason: req.body.reason,
      createdAt: new Date(now()).toISOString(),
    };
    req.booking.status = 'cancelled';
    state.cancellations.set(req.booking.id, cancellation);
    res
      .status(201)
      .location(`${BASE}/bookings/${req.booking.id}/cancellation`)
      .json(envelope(req, cancellation));
  });
  app.use((req, res) => problem(req, res, 404, 'ROUTE_NOT_FOUND', 'Endpoint không tồn tại.'));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed')
      return problem(req, res, 400, 'MALFORMED_JSON', 'Body JSON không đúng cú pháp.');
    if (error.type === 'entity.too.large')
      return problem(req, res, 413, 'PAYLOAD_TOO_LARGE', 'Body vượt quá 32 KB.');
    console.error(error);
    problem(req, res, 500, 'INTERNAL_ERROR', 'Đã có lỗi xảy ra. Vui lòng thử lại.');
  });
  return { app, state };
}
