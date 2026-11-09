import { randomBytes } from 'node:crypto';
import { localDate, addDays, slotStart } from '../../../packages/shared/time.js';

const normalize = (value) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim()
    .replace(/\s+/g, ' ');
const newId = () => randomBytes(12).toString('hex');

// Catalog owns venue/pitch relationships. Authorization is inherited from the venue.
export function mountCatalog(
  app,
  { state, BASE, now, problem, envelope, optionalUser, auth, owner },
) {
  const getVenue = (venueId) => state.venues.find((v) => v.id === venueId);
  const activePitches = (venueId) =>
    state.pitches.filter((p) => p.venueId === venueId && p.isActive);
  const venueView = (venue) => {
    const children = activePitches(venue.id);
    return {
      ...venue,
      pitchCount: children.length,
      pitchTypes: [5, 7, 11]
        .map((type) => ({ type, count: children.filter((p) => p.type === type).length }))
        .filter((t) => t.count),
      minPrice: children.length ? Math.min(...children.map((p) => p.price)) : null,
      links: { self: `${BASE}/venues/${venue.id}`, pitches: `${BASE}/venues/${venue.id}/pitches` },
    };
  };
  const pitchView = (pitch) => ({
    ...pitch,
    links: {
      self: `${BASE}/pitches/${pitch.id}`,
      venue: `${BASE}/venues/${pitch.venueId}`,
      availability: `${BASE}/pitches/${pitch.id}/availability`,
    },
  });
  const visibleVenue = (req, venueId) => {
    const venue = getVenue(venueId);
    return venue && (venue.isActive || venue.ownerId === optionalUser(req)?.id) ? venue : null;
  };
  const visiblePitch = (req, pitchId) => {
    const pitch = state.pitches.find((p) => p.id === pitchId);
    const venue = pitch && getVenue(pitch.venueId);
    return venue && ((pitch.isActive && venue.isActive) || venue.ownerId === optionalUser(req)?.id)
      ? pitch
      : null;
  };
  const duplicateName = (venueId, name, excluding) =>
    state.pitches.some(
      (p) => p.venueId === venueId && p.id !== excluding && normalize(p.name) === normalize(name),
    );
  function ownedVenue(req, res, next) {
    const venue = getVenue(req.params.venueId);
    if (!venue) return problem(req, res, 404, 'VENUE_NOT_FOUND', 'Không tìm thấy cơ sở.');
    if (venue.ownerId !== req.user.id)
      return problem(req, res, 403, 'NOT_VENUE_OWNER', 'Bạn không quản lý cơ sở này.');
    if (req.get('If-Match') !== `"${venue.version}"`)
      return problem(
        req,
        res,
        412,
        'VERSION_CONFLICT',
        'Cơ sở hoặc các sân bên trong đã thay đổi. Hãy tải lại.',
      );
    req.venue = venue;
    next();
  }
  function ownedPitch(req, res, next) {
    const pitch = state.pitches.find((p) => p.id === req.params.pitchId);
    if (!pitch) return problem(req, res, 404, 'PITCH_NOT_FOUND', 'Không tìm thấy sân con.');
    const venue = getVenue(pitch.venueId);
    if (!venue || venue.ownerId !== req.user.id)
      return problem(req, res, 403, 'NOT_PITCH_OWNER', 'Bạn không quản lý cơ sở chứa sân này.');
    if (req.get('If-Match') !== `"${pitch.version}"`)
      return problem(
        req,
        res,
        412,
        'VERSION_CONFLICT',
        'Thông tin sân đã thay đổi. Hãy tải lại trước khi lưu.',
      );
    req.pitch = pitch;
    req.venue = venue;
    next();
  }
  function sorted(items, sort) {
    return items.sort((a, b) => {
      for (const key of [...sort.split(','), 'id']) {
        const field = key.replace(/^-/, '');
        const av = field === 'rating' && a.venueId ? getVenue(a.venueId).rating : a[field];
        const bv = field === 'rating' && b.venueId ? getVenue(b.venueId).rating : b[field];
        if (av == null || bv == null) {
          if (av === bv) continue;
          return av == null ? 1 : -1;
        }
        const diff = typeof av === 'number' ? av - bv : av.localeCompare(bv, 'vi');
        if (diff) return key.startsWith('-') ? -diff : diff;
      }
      return 0;
    });
  }
  function page(req, items) {
    const { page, limit } = req.validatedQuery;
    const total = items.length,
      totalPages = Math.ceil(total / limit);
    const link = (number) => {
      const params = new URLSearchParams(req.query);
      params.set('page', String(number));
      params.set('limit', String(limit));
      return `${req.originalUrl.split('?')[0]}?${params}`;
    };
    return {
      data: items.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total, totalPages },
      links: {
        self: req.originalUrl,
        next: page < totalPages ? link(page + 1) : null,
        prev: page > 1 ? link(page - 1) : null,
      },
    };
  }
  function scopeUser(req, res) {
    if (req.validatedQuery.scope !== 'mine') return undefined;
    const user = optionalUser(req);
    if (!user) {
      problem(req, res, 401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập.');
      return null;
    }
    if (user.role !== 'owner') {
      problem(req, res, 403, 'ROLE_REQUIRED', 'Chức năng này dành cho chủ sân.');
      return null;
    }
    return user;
  }
  const matchesChild = (pitch, query) =>
    (!query.type || pitch.type === query.type) &&
    (query.maxPrice === undefined || pitch.price <= query.maxPrice);
  app.get(`${BASE}/venues`, (req, res) => {
    const query = req.validatedQuery,
      user = scopeUser(req, res);
    if (user === null) return;
    let items = state.venues.filter((v) => (user ? v.ownerId === user.id : v.isActive));
    if (query.q)
      items = items.filter((v) => normalize(`${v.name} ${v.address}`).includes(normalize(query.q)));
    if (query.district) items = items.filter((v) => v.district === query.district);
    if (query.type || query.maxPrice !== undefined)
      items = items.filter((v) => activePitches(v.id).some((p) => matchesChild(p, query)));
    res.json(page(req, sorted(items.map(venueView), query.sort)));
  });
  app.post(`${BASE}/venues`, auth, owner, (req, res) => {
    const venue = {
      ...req.body,
      id: newId(),
      ownerId: req.user.id,
      rating: 0,
      reviewCount: 0,
      version: 1,
      createdAt: new Date(now()).toISOString(),
    };
    state.venues.push(venue);
    res
      .status(201)
      .location(`${BASE}/venues/${venue.id}`)
      .set('ETag', '"1"')
      .json(envelope(req, venueView(venue)));
  });
  app.get(`${BASE}/venues/:venueId`, (req, res) => {
    const venue = visibleVenue(req, req.params.venueId);
    if (!venue) return problem(req, res, 404, 'VENUE_NOT_FOUND', 'Không tìm thấy cơ sở.');
    res.set('ETag', `"${venue.version}"`).json(envelope(req, venueView(venue)));
  });
  for (const method of ['put', 'patch'])
    app[method](`${BASE}/venues/:venueId`, auth, owner, ownedVenue, (req, res) => {
      Object.assign(req.venue, req.body, { version: req.venue.version + 1 });
      res.set('ETag', `"${req.venue.version}"`).json(envelope(req, venueView(req.venue)));
    });
  app.delete(`${BASE}/venues/:venueId`, auth, owner, ownedVenue, (req, res) => {
    if (state.pitches.some((p) => p.venueId === req.venue.id))
      return problem(
        req,
        res,
        409,
        'VENUE_HAS_PITCHES',
        'Cơ sở còn sân con. Hãy xử lý từng sân trước khi xóa cơ sở.',
      );
    state.venues = state.venues.filter((v) => v.id !== req.venue.id);
    res.status(204).end();
  });
  function listPitches(req, res) {
    const query = req.validatedQuery,
      user = scopeUser(req, res);
    if (user === null) return;
    const venueId = req.params.venueId || query.venueId;
    if (req.params.venueId) {
      const venue = getVenue(venueId);
      if (!venue || (!user && !venue.isActive))
        return problem(req, res, 404, 'VENUE_NOT_FOUND', 'Không tìm thấy cơ sở.');
      if (user && venue.ownerId !== user.id)
        return problem(req, res, 403, 'NOT_VENUE_OWNER', 'Bạn không quản lý cơ sở này.');
    }
    let items = state.pitches.filter((p) => {
      const venue = getVenue(p.venueId);
      return venue && (user ? venue.ownerId === user.id : p.isActive && venue.isActive);
    });
    if (venueId) items = items.filter((p) => p.venueId === venueId);
    if (query.q)
      items = items.filter((p) => {
        const v = getVenue(p.venueId);
        return normalize(`${p.name} ${v.name} ${v.address}`).includes(normalize(query.q));
      });
    if (query.district)
      items = items.filter((p) => getVenue(p.venueId).district === query.district);
    items = items.filter((p) => matchesChild(p, query));
    res.json(page(req, sorted(items, query.sort).map(pitchView)));
  }
  app.get(`${BASE}/pitches`, listPitches);
  app.get(`${BASE}/venues/:venueId/pitches`, listPitches);
  app.post(`${BASE}/pitches`, auth, owner, (req, res) => {
    const venue = getVenue(req.body.venueId);
    if (!venue) return problem(req, res, 404, 'VENUE_NOT_FOUND', 'Cơ sở không tồn tại.');
    if (venue.ownerId !== req.user.id)
      return problem(req, res, 403, 'NOT_VENUE_OWNER', 'Bạn không quản lý cơ sở này.');
    if (duplicateName(venue.id, req.body.name))
      return problem(req, res, 409, 'PITCH_NAME_EXISTS', 'Tên sân đã tồn tại trong cơ sở này.');
    const pitch = {
      ...req.body,
      id: newId(),
      version: 1,
      createdAt: new Date(now()).toISOString(),
    };
    state.pitches.push(pitch);
    venue.version++;
    res
      .status(201)
      .location(`${BASE}/pitches/${pitch.id}`)
      .set('ETag', '"1"')
      .json(envelope(req, pitchView(pitch)));
  });
  app.get(`${BASE}/pitches/:pitchId`, (req, res) => {
    const pitch = visiblePitch(req, req.params.pitchId);
    if (!pitch) return problem(req, res, 404, 'PITCH_NOT_FOUND', 'Không tìm thấy sân con.');
    res.set('ETag', `"${pitch.version}"`).json(envelope(req, pitchView(pitch)));
  });
  for (const method of ['put', 'patch'])
    app[method](`${BASE}/pitches/:pitchId`, auth, owner, ownedPitch, (req, res) => {
      if (req.body.name && duplicateName(req.venue.id, req.body.name, req.pitch.id))
        return problem(req, res, 409, 'PITCH_NAME_EXISTS', 'Tên sân đã tồn tại trong cơ sở này.');
      Object.assign(req.pitch, req.body, { version: req.pitch.version + 1 });
      req.venue.version++;
      res.set('ETag', `"${req.pitch.version}"`).json(envelope(req, pitchView(req.pitch)));
    });
  app.delete(`${BASE}/pitches/:pitchId`, auth, owner, ownedPitch, (req, res) => {
    if (
      state.bookings.some(
        (b) =>
          b.pitchId === req.pitch.id && b.status === 'confirmed' && Date.parse(b.endAt) > now(),
      )
    )
      return problem(
        req,
        res,
        409,
        'PITCH_HAS_BOOKINGS',
        'Sân còn lịch đặt sắp tới nên chưa thể xóa.',
      );
    state.pitches = state.pitches.filter((p) => p.id !== req.pitch.id);
    req.venue.version++;
    res.status(204).end();
  });
  function slotsFor(pitch, date) {
    return Array.from({ length: 17 }, (_, index) => {
      const hour = index + 6,
        startAt = slotStart(date, hour);
      return {
        startAt,
        endAt: slotStart(date, hour + 1),
        price: pitch.price + (hour >= 17 && hour < 22 ? 100000 : 0),
        currency: 'VND',
        available:
          pitch.isActive &&
          !!getVenue(pitch.venueId)?.isActive &&
          Date.parse(startAt) > now() &&
          !state.bookings.some(
            (b) => b.pitchId === pitch.id && b.startAt === startAt && b.status === 'confirmed',
          ),
      };
    });
  }
  app.get(`${BASE}/pitches/:pitchId/availability`, (req, res) => {
    const pitch = visiblePitch(req, req.params.pitchId),
      { date } = req.validatedQuery;
    if (!pitch) return problem(req, res, 404, 'PITCH_NOT_FOUND', 'Không tìm thấy sân con.');
    if (date < localDate(now()) || date > addDays(localDate(now()), 30))
      return problem(
        req,
        res,
        400,
        'DATE_OUT_OF_RANGE',
        'Chỉ xem lịch từ hôm nay đến 30 ngày tới.',
      );
    res.json(
      envelope(req, {
        pitchId: pitch.id,
        date,
        timeZone: 'Asia/Ho_Chi_Minh',
        slots: slotsFor(pitch, date),
      }),
    );
  });
  return { getVenue, slotsFor };
}
