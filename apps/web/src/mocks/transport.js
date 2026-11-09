import { createFixtures, demoPassword } from './fixtures.js';
import { localDate, addDays, clockTime } from '../../../../packages/shared/time.js';

// A frontend fixture adapter, NOT an HTTP server, auth system or MongoDB backend.
// State belongs to this tab and resets on reload. No real credentials or payment requests.
export function createMockTransport({ now = () => Date.now() } = {}) {
  const state = createFixtures(now());
  const passwords = new Map(state.users.map((u) => [u.id, demoPassword]));
  const sessions = new Map(),
    attempts = new Map();
  let refreshUserId = null;
  const id = () => crypto.randomUUID();
  const stamp = () => new Date(now()).toISOString();
  const normal = (value) =>
    String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .trim()
      .replace(/\s+/g, ' ');
  const fail = (status, code, detail) => {
    throw { status, code, detail };
  };
  const found = (rows, value, label) =>
    rows.find((x) => x.id === value) || fail(404, 'NOT_FOUND', `Không tìm thấy ${label}.`);
  const response = (data, status = 200, headers = {}) =>
    new Response(status === 204 ? null : JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
    });
  const single = (data, status = 200, location) =>
    response({ data }, status, {
      ...(data?.version ? { ETag: `"${data.version}"` } : {}),
      ...(location ? { Location: `/api/v1${location}` } : {}),
    });
  function expire() {
    state.bookings.forEach((b) => {
      if (b.status === 'pending' && Date.parse(b.expiresAt) <= now())
        Object.assign(b, { status: 'expired', updatedAt: stamp() });
    });
  }
  function principal(headers, required = true) {
    const token = new Headers(headers).get('Authorization')?.replace(/^Bearer /, '');
    const session = sessions.get(token);
    const user =
      session && session.expiresAt > now()
        ? state.users.find((u) => u.id === session.userId)
        : null;
    if (!user && required) fail(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập lại.');
    return user;
  }
  const role = (user, expected) => {
    if (user?.role !== expected)
      fail(403, 'FORBIDDEN', 'Tài khoản không có quyền thực hiện thao tác này.');
  };
  function owner(user, venue) {
    role(user, 'OWNER');
    if (venue.ownerId !== user.id) fail(403, 'NOT_OWNER', 'Bạn không quản lý cơ sở này.');
  }
  function version(item, headers) {
    const match = new Headers(headers).get('If-Match');
    if (!match) fail(428, 'PRECONDITION_REQUIRED', 'Cần tải thông tin mới nhất trước khi lưu.');
    if (match !== `"${item.version}"`)
      fail(412, 'VERSION_CONFLICT', 'Dữ liệu đã thay đổi. Đóng form và tải lại trước khi sửa.');
  }
  const touch = (item) => Object.assign(item, { version: item.version + 1, updatedAt: stamp() });
  function list(rows, url) {
    const page = Number(url.searchParams.get('page') || 1),
      limit = Number(url.searchParams.get('limit') || 6);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50)
      fail(400, 'INVALID_PAGE', 'Tham số phân trang không hợp lệ.');
    const link = (p) => {
      const u = new URL(url);
      u.searchParams.set('page', p);
      return `/api/v1${u.pathname}${u.search}`;
    };
    return response({
      data: rows.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total: rows.length, totalPages: Math.ceil(rows.length / limit) },
      links: {
        self: link(page),
        prev: page > 1 ? link(page - 1) : null,
        next: page * limit < rows.length ? link(page + 1) : null,
      },
    });
  }
  function venueView(v) {
    const courts = state.courts.filter((c) => c.venueId === v.id && c.status === 'active');
    const reviews = state.reviews.filter((r) => r.venueId === v.id);
    const courtTypes = [];
    courts.forEach((c) => {
      const match = courtTypes.find(
        (t) => t.sportTypeId === c.sportTypeId && t.teamSize === c.teamSize,
      );
      if (match) match.count++;
      else
        courtTypes.push({
          sportTypeId: c.sportTypeId,
          sportName: found(state.sports, c.sportTypeId, 'môn thể thao').name,
          teamSize: c.teamSize,
          count: 1,
        });
    });
    return {
      ...v,
      courtCount: courts.length,
      courtTypes,
      minPrice: courts.length ? Math.min(...courts.map((c) => c.basePricePerHour)) : null,
      rating: reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0,
      reviewCount: reviews.length,
    };
  }
  const courtView = (c) => ({
    ...c,
    sportName: found(state.sports, c.sportTypeId, 'môn thể thao').name,
  });
  function visibleVenue(venueId, user) {
    const v = found(state.venues, venueId, 'cơ sở');
    if (v.status !== 'active' && v.ownerId !== user?.id)
      fail(404, 'NOT_FOUND', 'Cơ sở đang tạm ngừng.');
    return v;
  }
  function visibleCourt(courtId, user) {
    const c = found(state.courts, courtId, 'sân');
    const v = visibleVenue(c.venueId, user);
    if (c.status !== 'active' && v.ownerId !== user?.id)
      fail(404, 'NOT_FOUND', 'Sân đang tạm ngừng.');
    return c;
  }
  function bookingAccess(bookingId, user) {
    const b = found(state.bookings, bookingId, 'lịch đặt');
    if (
      b.userId !== user.id &&
      !state.venues.some(
        (v) => v.id === b.venueId && v.ownerId === user.id && user.role === 'OWNER',
      )
    )
      fail(404, 'NOT_FOUND', 'Không tìm thấy lịch đặt.');
    return b;
  }
  const blocked = (courtId, start, end) =>
    state.bookings.some(
      (b) =>
        b.courtId === courtId &&
        ['pending', 'confirmed'].includes(b.status) &&
        Date.parse(b.startTime) < end &&
        Date.parse(b.endTime) > start,
    );
  function quote(court, start, end) {
    const a = Date.parse(start),
      z = Date.parse(end),
      durationMinutes = (z - a) / 60000;
    const venue = found(state.venues, court.venueId, 'cơ sở');
    if (
      !Number.isFinite(a) ||
      !Number.isFinite(z) ||
      a <= now() ||
      a % 1800000 ||
      z % 1800000 ||
      durationMinutes < 30 ||
      durationMinutes > 180 ||
      localDate(a) !== localDate(z) ||
      localDate(a) > addDays(localDate(now()), 30)
    )
      fail(422, 'INVALID_INTERVAL', 'Chọn 30–180 phút theo bước 30 phút, trong 30 ngày tới.');
    if (
      clockTime(a) < venue.openTime ||
      clockTime(z) > venue.closeTime ||
      court.status !== 'active' ||
      venue.status !== 'active'
    )
      fail(409, 'CLOSED', 'Khung giờ nằm ngoài thời gian hoạt động.');
    const lines = [];
    for (let t = a; t < z; t += 1800000) {
      const peak = clockTime(t) >= '17:00' && clockTime(t) < '22:00';
      lines.push({
        startTime: new Date(t).toISOString(),
        endTime: new Date(t + 1800000).toISOString(),
        amount: Math.round((court.basePricePerHour + (peak ? 100000 : 0)) / 2),
      });
    }
    return {
      courtId: court.id,
      startTime: new Date(a).toISOString(),
      endTime: new Date(z).toISOString(),
      durationMinutes,
      currency: 'VND',
      totalPrice: lines.reduce((s, l) => s + l.amount, 0),
      available: !blocked(court.id, a, z),
      lines,
    };
  }
  function session(user) {
    const token = id();
    sessions.set(token, { userId: user.id, expiresAt: now() + 15 * 60000 });
    refreshUserId = user.id;
    return { accessToken: token, tokenType: 'Bearer', expiresIn: 900, user };
  }
  function editable(body, fields) {
    for (const key of Object.keys(body))
      if (!fields.includes(key)) fail(422, 'UNKNOWN_FIELD', `Không nhận trường ${key}.`);
  }
  const venueFields = [
    'name',
    'address',
    'district',
    'city',
    'description',
    'openTime',
    'closeTime',
    'timezone',
    'status',
    'amenities',
    'imageKey',
  ];
  const courtFields = [
    'name',
    'sportTypeId',
    'teamSize',
    'basePricePerHour',
    'description',
    'imageKey',
    'status',
  ];
  function validateVenue(b) {
    editable(b, venueFields);
    if (
      ![b.name, b.address, b.district, b.city, b.description].every(
        (x) => typeof x === 'string' && x.trim().length >= 2,
      ) ||
      !/^\d{2}:[03]0$/.test(b.openTime) ||
      !/^\d{2}:[03]0$/.test(b.closeTime) ||
      b.openTime >= b.closeTime ||
      b.closeTime > '23:30' ||
      b.timezone !== 'Asia/Ho_Chi_Minh' ||
      !['active', 'inactive'].includes(b.status)
    )
      fail(
        422,
        'INVALID_VENUE',
        'Kiểm tra thông tin cơ sở và giờ mở/đóng cửa (bước 30 phút, trong cùng ngày).',
      );
  }
  function validateCourt(b, venueId, excluding) {
    editable(b, courtFields);
    found(state.sports, b.sportTypeId, 'môn thể thao');
    if (
      !b.name?.trim() ||
      !Number.isInteger(b.basePricePerHour) ||
      b.basePricePerHour < 50000 ||
      b.basePricePerHour > 3000000 ||
      !['active', 'inactive'].includes(b.status) ||
      (b.sportTypeId === 'football' && ![5, 7, 11].includes(b.teamSize))
    )
      fail(422, 'INVALID_COURT', 'Kiểm tra tên, loại và giá sân.');
    if (
      state.courts.some(
        (c) => c.venueId === venueId && c.id !== excluding && normal(c.name) === normal(b.name),
      )
    )
      fail(409, 'DUPLICATE_NAME', 'Tên sân đã có trong cơ sở.');
  }
  async function send(path, options = {}) {
    const url = new URL(path, 'http://frontend.mock'),
      p = url.pathname.split('/').filter(Boolean),
      method = options.method || 'GET',
      body = options.body || {},
      headers = options.headers || {};
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    expire();
    try {
      if (p[0] === 'auth' && method === 'POST') {
        if (p[1] === 'login') {
          const user = state.users.find(
            (u) => u.email.toLowerCase() === String(body.email).trim().toLowerCase(),
          );
          if (!user || passwords.get(user.id) !== body.password)
            fail(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu chưa đúng.');
          return single(session(user));
        }
        if (p[1] === 'register') {
          editable(body, ['email', 'password', 'fullName', 'phone']);
          if (
            !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email || '') ||
            (body.password || '').length < 8 ||
            !body.fullName?.trim() ||
            !/^0\d{9}$/.test(body.phone || '')
          )
            fail(
              422,
              'INVALID_PROFILE',
              'Điền họ tên, email, số điện thoại 10 số và mật khẩu ít nhất 8 ký tự.',
            );
          if (state.users.some((u) => u.email.toLowerCase() === body.email.trim().toLowerCase()))
            fail(409, 'EMAIL_EXISTS', 'Email đã được sử dụng.');
          const user = {
            id: id(),
            email: body.email.trim().toLowerCase(),
            fullName: body.fullName.trim(),
            phone: body.phone,
            role: 'CUSTOMER',
          };
          state.users.push(user);
          passwords.set(user.id, body.password);
          return single(user, 201, '/users/me');
        }
        if (p[1] === 'refresh') {
          const user = state.users.find((u) => u.id === refreshUserId);
          if (!user) fail(401, 'SESSION_EXPIRED', 'Phiên đăng nhập đã hết hạn.');
          return single(session(user));
        }
        if (p[1] === 'logout') {
          const user = principal(headers, false);
          if (user)
            for (const [token, s] of sessions) if (s.userId === user.id) sessions.delete(token);
          refreshUserId = null;
          return response(null, 204);
        }
      }
      const user = principal(headers, false),
        required = () => principal(headers);
      if (p[0] === 'users' && p[1] === 'me' && p.length === 2) {
        const me = required();
        if (method === 'PUT') {
          editable(body, ['fullName', 'phone']);
          if (!body.fullName?.trim() || !/^0\d{9}$/.test(body.phone || ''))
            fail(422, 'INVALID_PROFILE', 'Họ tên và số điện thoại không hợp lệ.');
          Object.assign(me, body);
        }
        return single(me);
      }
      if (p[0] === 'sport-types') {
        if (method === 'GET') return response({ data: state.sports });
        role(required(), 'ADMIN');
        if (method === 'DELETE') {
          if (state.courts.some((c) => c.sportTypeId === p[1]))
            fail(409, 'SPORT_IN_USE', 'Môn thể thao đang được sân sử dụng.');
          found(state.sports, p[1], 'môn thể thao');
          state.sports = state.sports.filter((s) => s.id !== p[1]);
          return response(null, 204);
        }
        editable(body, ['name']);
        if (!body.name?.trim()) fail(422, 'INVALID_NAME', 'Nhập tên môn thể thao.');
        if (state.sports.some((s) => normal(s.name) === normal(body.name) && s.id !== p[1]))
          fail(409, 'DUPLICATE_NAME', 'Môn thể thao đã tồn tại.');
        if (method === 'POST') {
          const sport = { id: id(), name: body.name.trim() };
          state.sports.push(sport);
          return single(sport, 201, `/sport-types/${sport.id}`);
        }
        const sport = found(state.sports, p[1], 'môn thể thao');
        sport.name = body.name.trim();
        return single(sport);
      }
      if (
        (p[0] === 'venues' && p.length === 1 && method === 'GET') ||
        (path.startsWith('/owner/venues') && method === 'GET')
      ) {
        const mine = p[0] === 'owner';
        if (mine) role(required(), 'OWNER');
        let items = state.venues.filter((v) =>
          mine ? v.ownerId === user.id : v.status === 'active',
        );
        const q = Object.fromEntries(url.searchParams);
        if (q.keyword)
          items = items.filter((v) => normal(v.name + ' ' + v.address).includes(normal(q.keyword)));
        if (q.city) items = items.filter((v) => v.city === q.city);
        if (q.district) items = items.filter((v) => v.district === q.district);
        if (q.sportTypeId || q.teamSize || q.maxPrice)
          items = items.filter((v) =>
            state.courts.some(
              (c) =>
                c.venueId === v.id &&
                c.status === 'active' &&
                (!q.sportTypeId || c.sportTypeId === q.sportTypeId) &&
                (!q.teamSize || c.teamSize === Number(q.teamSize)) &&
                (!q.maxPrice || c.basePricePerHour <= Number(q.maxPrice)),
            ),
          );
        items = items.map(venueView);
        const sort = q.sort || '-rating,minPrice';
        items.sort((a, b) => {
          for (const key of [...sort.split(','), 'id']) {
            const k = key.replace(/^-/, ''),
              av = a[k],
              bv = b[k];
            if (av == null || bv == null) {
              if (av !== bv) return av == null ? 1 : -1;
              continue;
            }
            const d = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'vi');
            if (d) return key.startsWith('-') ? -d : d;
          }
          return 0;
        });
        return list(items, url);
      }
      if (p[0] === 'venues' && p.length <= 2) {
        if (method === 'POST') {
          const me = required();
          role(me, 'OWNER');
          validateVenue(body);
          const v = {
            ...body,
            id: id(),
            ownerId: me.id,
            version: 1,
            createdAt: stamp(),
            updatedAt: stamp(),
          };
          state.venues.push(v);
          return single(venueView(v), 201, `/venues/${v.id}`);
        }
        const v = found(state.venues, p[1], 'cơ sở');
        if (method === 'GET') return single(venueView(visibleVenue(v.id, user)));
        owner(required(), v);
        version(v, headers);
        if (method === 'DELETE') {
          if (state.courts.some((c) => c.venueId === v.id))
            fail(
              409,
              'VENUE_HAS_COURTS',
              'Cơ sở còn sân con. Hãy tạm ngừng hoặc xử lý từng sân trước.',
            );
          state.venues = state.venues.filter((x) => x.id !== v.id);
          return response(null, 204);
        }
        validateVenue(body);
        Object.assign(v, body);
        touch(v);
        return single(venueView(v));
      }
      if (p[0] === 'venues' && p[2] === 'courts') {
        const v = visibleVenue(p[1], user);
        if (method === 'GET') {
          const mine = user?.role === 'OWNER' && user.id === v.ownerId;
          let rows = state.courts.filter(
            (c) => c.venueId === v.id && (mine || c.status === 'active'),
          );
          const size = url.searchParams.get('teamSize'),
            sport = url.searchParams.get('sportTypeId');
          if (size) rows = rows.filter((c) => c.teamSize === Number(size));
          if (sport) rows = rows.filter((c) => c.sportTypeId === sport);
          return list(
            rows.map(courtView).sort((a, b) => a.name.localeCompare(b.name, 'vi')),
            url,
          );
        }
        owner(required(), v);
        validateCourt(body, v.id);
        const c = {
          ...body,
          venueId: v.id,
          id: id(),
          version: 1,
          createdAt: stamp(),
          updatedAt: stamp(),
        };
        state.courts.push(c);
        touch(v);
        return single(courtView(c), 201, `/courts/${c.id}`);
      }
      if (p[0] === 'courts') {
        const c = visibleCourt(p[1], user),
          v = found(state.venues, c.venueId, 'cơ sở');
        if (p[2] === 'quote')
          return single(quote(c, url.searchParams.get('start'), url.searchParams.get('end')));
        if (p[2] === 'availability') {
          const date = url.searchParams.get('date');
          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(date || '') ||
            !Number.isFinite(Date.parse(`${date}T12:00:00+07:00`)) ||
            localDate(`${date}T12:00:00+07:00`) !== date ||
            date < localDate(now()) ||
            date > addDays(localDate(now()), 30)
          )
            fail(400, 'INVALID_DATE', 'Ngày không hợp lệ hoặc ngoài 30 ngày tới.');
          const slots = [];
          const close = Date.parse(`${date}T${v.closeTime}:00+07:00`);
          for (let t = Date.parse(`${date}T${v.openTime}:00+07:00`); t < close; t += 1800000)
            slots.push({
              startTime: new Date(t).toISOString(),
              endTime: new Date(t + 1800000).toISOString(),
              available:
                t > now() &&
                c.status === 'active' &&
                v.status === 'active' &&
                !blocked(c.id, t, t + 1800000),
            });
          return single({ courtId: c.id, date, timezone: v.timezone, slotMinutes: 30, slots });
        }
        if (method === 'GET') return single(courtView(c));
        owner(required(), v);
        version(c, headers);
        if (method === 'DELETE') {
          if (
            state.bookings.some(
              (b) =>
                b.courtId === c.id &&
                ['pending', 'confirmed'].includes(b.status) &&
                Date.parse(b.endTime) > now(),
            )
          )
            fail(409, 'COURT_HAS_BOOKINGS', 'Sân còn lịch sắp tới, hãy tạm ngừng nhận lịch.');
          state.courts = state.courts.filter((x) => x.id !== c.id);
          touch(v);
          return response(null, 204);
        }
        validateCourt(body, v.id, c.id);
        Object.assign(c, body);
        touch(c);
        touch(v);
        return single(courtView(c));
      }
      if ((p[0] === 'users' && p[2] === 'bookings') || (p[0] === 'venues' && p[2] === 'bookings')) {
        const me = required();
        if (p[0] === 'venues') owner(me, found(state.venues, p[1], 'cơ sở'));
        let rows = state.bookings.filter((b) =>
          p[0] === 'venues' ? b.venueId === p[1] : b.userId === me.id,
        );
        const status = url.searchParams.get('status'),
          date = url.searchParams.get('date');
        if (status) rows = rows.filter((b) => b.status === status);
        if (date) rows = rows.filter((b) => localDate(b.startTime) === date);
        return list(
          rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)),
          url,
        );
      }
      if (p[0] === 'bookings' && p.length === 1 && method === 'POST') {
        const me = required();
        role(me, 'CUSTOMER');
        editable(body, ['courtId', 'startTime', 'endTime', 'note']);
        const key = new Headers(headers).get('Idempotency-Key');
        if (!key) fail(400, 'KEY_REQUIRED', 'Thiếu mã chống gửi trùng.');
        const token = `${me.id}:booking:${key}`,
          fingerprint = JSON.stringify(body),
          previous = attempts.get(token);
        if (previous) {
          if (previous.fingerprint !== fingerprint)
            fail(409, 'KEY_REUSED', 'Mã gửi đã được dùng cho nội dung khác.');
          return single(previous.data, 201, `/bookings/${previous.data.id}`);
        }
        if (!me.phone)
          fail(422, 'PHONE_REQUIRED', 'Cập nhật số điện thoại trong hồ sơ trước khi đặt sân.');
        const c = visibleCourt(body.courtId, me),
          v = found(state.venues, c.venueId, 'cơ sở'),
          q = quote(c, body.startTime, body.endTime);
        if (!q.available)
          fail(409, 'SLOT_UNAVAILABLE', 'Khung giờ vừa được giữ hoặc đặt. Vui lòng chọn giờ khác.');
        const bookingId = id();
        const b = {
          id: bookingId,
          code: `KS-${bookingId.slice(0, 6).toUpperCase()}`,
          userId: me.id,
          courtId: c.id,
          venueId: v.id,
          venueName: v.name,
          courtName: c.name,
          teamSize: c.teamSize,
          sportName: courtView(c).sportName,
          address: v.address,
          imageKey: c.imageKey,
          contactName: me.fullName,
          contactPhone: me.phone,
          startTime: q.startTime,
          endTime: q.endTime,
          totalPrice: q.totalPrice,
          currency: 'VND',
          status: 'pending',
          expiresAt: new Date(Math.min(now() + 30 * 60000, Date.parse(q.startTime))).toISOString(),
          note: body.note || '',
          paymentStatus: 'unpaid',
          createdAt: stamp(),
          updatedAt: stamp(),
        };
        state.bookings.push(b);
        attempts.set(token, { fingerprint, data: structuredClone(b) });
        return single(b, 201, `/bookings/${b.id}`);
      }
      if (p[0] === 'bookings' && p[2] === 'payments') {
        const me = required(),
          b = bookingAccess(p[1], me);
        if (method === 'GET')
          return response({ data: state.payments.filter((x) => x.bookingId === b.id) });
        if (b.userId !== me.id) fail(403, 'FORBIDDEN', 'Chỉ người đặt được khởi tạo thanh toán.');
        editable(body, ['method']);
        if (!['cash', 'bank_transfer'].includes(body.method))
          fail(422, 'INVALID_METHOD', 'Chọn phương thức thanh toán.');
        const key = new Headers(headers).get('Idempotency-Key');
        if (!key) fail(400, 'KEY_REQUIRED', 'Thiếu mã chống gửi trùng.');
        const token = `${me.id}:payment:${key}`,
          old = attempts.get(token),
          fingerprint = JSON.stringify({ bookingId: b.id, ...body });
        if (old) {
          if (old.fingerprint !== fingerprint) fail(409, 'KEY_REUSED', 'Mã gửi đã được sử dụng.');
          return single(old.data, 201, `/payments/${old.data.id}`);
        }
        if (b.status !== 'confirmed' || b.paymentStatus === 'paid')
          fail(409, 'INVALID_STATE', 'Chỉ thanh toán lịch đã xác nhận và chưa trả tiền.');
        if (state.payments.some((x) => x.bookingId === b.id && x.status === 'pending'))
          fail(409, 'PAYMENT_PENDING', 'Đã có lượt thanh toán đang chờ xử lý.');
        const payment = {
          id: id(),
          bookingId: b.id,
          amount: b.totalPrice,
          currency: b.currency,
          method: body.method,
          status: 'pending',
          transactionRef: null,
          paidAt: null,
          createdAt: stamp(),
          checkoutUrl: null,
        };
        state.payments.push(payment);
        b.paymentStatus = 'pending';
        attempts.set(token, { fingerprint, data: structuredClone(payment) });
        return single(payment, 201, `/payments/${payment.id}`);
      }
      if (p[0] === 'payments' && method === 'GET') {
        const payment = found(state.payments, p[1], 'thanh toán');
        bookingAccess(payment.bookingId, required());
        return single(payment);
      }
      if (p[0] === 'bookings') {
        const me = required(),
          b = bookingAccess(p[1], me);
        if (method === 'GET')
          return single({ ...b, review: state.reviews.find((r) => r.bookingId === b.id) || null });
        if (p[2] === 'cancel') {
          if (b.status === 'cancelled') return single(b);
          if (!['pending', 'confirmed'].includes(b.status))
            fail(409, 'INVALID_STATE', 'Lịch này không thể hủy.');
          const cutoff = b.userId === me.id ? 2 * 3600000 : 0;
          if (Date.parse(b.startTime) - now() < cutoff)
            fail(409, 'CANCEL_CUTOFF', 'Đã quá thời hạn hủy lịch.');
          if ((body.reason || '').trim().length < 3)
            fail(422, 'REASON_REQUIRED', 'Nhập lý do hủy ít nhất 3 ký tự.');
          Object.assign(b, {
            status: 'cancelled',
            cancelledBy: me.id,
            cancelReason: body.reason,
            cancelledAt: stamp(),
          });
          state.payments
            .filter((x) => x.bookingId === b.id && x.status === 'pending')
            .forEach((x) => (x.status = 'failed'));
          b.paymentStatus = b.paymentStatus === 'paid' ? 'refund_pending' : 'unpaid';
        } else {
          owner(me, found(state.venues, b.venueId, 'cơ sở'));
          if (p[2] === 'confirm') {
            if (b.status === 'confirmed') return single(b);
            if (b.status !== 'pending' || Date.parse(b.startTime) <= now())
              fail(409, 'INVALID_STATE', 'Chỉ xác nhận yêu cầu đang chờ và chưa bắt đầu.');
            b.status = 'confirmed';
            b.expiresAt = null;
          } else if (p[2] === 'complete') {
            if (b.status === 'completed') return single(b);
            if (b.status !== 'confirmed' || Date.parse(b.endTime) > now())
              fail(409, 'INVALID_STATE', 'Chỉ hoàn thành sau giờ kết thúc của lịch đã xác nhận.');
            b.status = 'completed';
          } else fail(404, 'NOT_FOUND', 'Không có thao tác này.');
        }
        b.updatedAt = stamp();
        return single(b);
      }
      if (p[0] === 'venues' && p[2] === 'reviews') {
        visibleVenue(p[1], user);
        if (method === 'GET')
          return list(
            state.reviews
              .filter((r) => r.venueId === p[1])
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
            url,
          );
        const me = required();
        editable(body, ['bookingId', 'rating', 'comment']);
        const b = bookingAccess(body.bookingId, me);
        if (b.userId !== me.id || b.venueId !== p[1] || b.status !== 'completed')
          fail(
            403,
            'REVIEW_NOT_ELIGIBLE',
            'Chỉ đánh giá cơ sở sau khi hoàn thành lịch của chính bạn.',
          );
        if (state.reviews.some((r) => r.bookingId === b.id))
          fail(409, 'ALREADY_REVIEWED', 'Lịch này đã được đánh giá.');
        validateReview(body);
        const review = {
          id: id(),
          venueId: p[1],
          bookingId: b.id,
          userId: me.id,
          fullName: me.fullName,
          rating: body.rating,
          comment: body.comment,
          createdAt: stamp(),
          updatedAt: stamp(),
        };
        state.reviews.push(review);
        touch(found(state.venues, p[1], 'cơ sở'));
        return single(review, 201, `/reviews/${review.id}`);
      }
      if (p[0] === 'reviews') {
        const me = required(),
          r = found(state.reviews, p[1], 'đánh giá');
        if (r.userId !== me.id)
          fail(403, 'NOT_AUTHOR', 'Chỉ người viết được sửa hoặc xóa đánh giá.');
        if (method === 'DELETE') {
          state.reviews = state.reviews.filter((x) => x.id !== r.id);
          touch(found(state.venues, r.venueId, 'cơ sở'));
          return response(null, 204);
        }
        editable(body, ['rating', 'comment']);
        validateReview(body);
        Object.assign(r, body, { updatedAt: stamp() });
        touch(found(state.venues, r.venueId, 'cơ sở'));
        return single(r);
      }
      fail(404, 'NOT_MOCKED', 'Chưa có fixture cho endpoint này.');
    } catch (error) {
      if (!error.status) throw error;
      return response(
        {
          type: `urn:keosan:problem:${error.code.toLowerCase().replaceAll('_', '-')}`,
          title: 'Request failed',
          status: error.status,
          detail: error.detail,
          code: error.code,
          instance: path,
        },
        error.status,
        { 'Content-Type': 'application/problem+json' },
      );
    }
  }
  function validateReview(b) {
    if (
      !Number.isInteger(b.rating) ||
      b.rating < 1 ||
      b.rating > 5 ||
      typeof b.comment !== 'string' ||
      b.comment.trim().length < 3 ||
      b.comment.length > 1000
    )
      fail(422, 'INVALID_REVIEW', 'Chọn 1–5 sao và nhận xét từ 3 đến 1.000 ký tự.');
  }
  // Explicit demo control: never exposed as a public backend callback or bundled in HTTP mode.
  function settlePayment(paymentId, outcome = 'succeeded') {
    expire();
    const p = found(state.payments, paymentId, 'thanh toán'),
      b = found(state.bookings, p.bookingId, 'lịch đặt');
    if (p.status !== 'pending') return p;
    if (b.status !== 'confirmed')
      fail(409, 'INVALID_STATE', 'Lịch không còn đủ điều kiện thanh toán.');
    if (!['succeeded', 'failed'].includes(outcome))
      fail(422, 'INVALID_STATE', 'Kết quả mô phỏng không hợp lệ.');
    Object.assign(p, {
      status: outcome,
      paidAt: outcome === 'succeeded' ? stamp() : null,
      transactionRef: outcome === 'succeeded' ? `DEMO-${id().slice(0, 8)}` : null,
    });
    b.paymentStatus = outcome === 'succeeded' ? 'paid' : 'unpaid';
    return p;
  }
  return { send, settlePayment };
}
export const mockTransport = createMockTransport();
