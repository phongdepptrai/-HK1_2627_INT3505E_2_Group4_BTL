import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  MapPin,
  CalendarDays,
  Star,
  SlidersHorizontal,
  Check,
  ChevronLeft,
  ChevronRight,
  Users,
  Sparkles,
  Goal,
} from 'lucide-react';
import { venueApi, sportApi } from '../api/services';
import { useResource } from '../hooks/useResource';
import { Button, ErrorBox, Loading, EmptyState, imageFor, districts } from '../components/ui';
import { localDate, addDays, money, bookingDate } from '../../../../packages/shared/time';
export default function Explore() {
  const [params, setParams] = useSearchParams();
  const [filterOpen, setFilterOpen] = useState(false);
  const date = bookingDate(params.get('date'));
  const query = {
    keyword: params.get('keyword') || '',
    district: params.get('district') || '',
    city: params.get('city') || '',
    sportTypeId: params.get('sportTypeId') || '',
    teamSize: params.get('teamSize') || '',
    maxPrice: params.get('maxPrice') || '',
    sort: params.get('sort') || '-rating,minPrice',
    page: params.get('page') || '1',
    limit: 6,
  };
  const resource = useResource((signal) => venueApi.list(query, signal), [params.toString()]);
  const sports = useResource((signal) => sportApi.list(signal), []);
  function update(values) {
    const next = new URLSearchParams(params);
    next.delete('page');
    Object.entries(values).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    setParams(next, { preventScrollReset: true });
  }
  function search(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    update(Object.fromEntries(data));
    document.getElementById('pitch-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  return (
    <div className="container explore-page">
      <section className="hero">
        <div className="hero-photo" />
        <div className="hero-content">
          <div className="eyebrow">
            <span /> HẸN NHAU TRÊN SÂN
          </div>
          <h1>
            Đủ đội rồi.
            <br />
            Tìm <em>sân thôi.</em>
          </h1>
          <p>
            Một trận bóng hay bắt đầu từ một sân tốt.
            <br />
            Tìm sân vừa ý, chọn giờ đẹp, cùng đội ra sân.
          </p>
          <div className="hero-note">
            <span>
              <Check size={13} />
            </span>{' '}
            Rõ giá sân <b>·</b> Chủ động lịch chơi <b>·</b> Đặt sân dễ dàng
          </div>
        </div>
        <div className="hero-sticker">
          <Goal size={25} />
          <span>
            LESS SCROLL.
            <br />
            <strong>MORE GOAL.</strong>
          </span>
          <ArrowUpRight size={21} />
        </div>
        <div className="hero-caption">01 / THE BEAUTIFUL GAME</div>
      </section>
      <form
        className="search-panel"
        onSubmit={search}
        key={params.get('keyword') + ':' + params.get('district') + ':' + date}
      >
        <label className="search-field search-keyword">
          <Search size={21} />
          <span>
            <small>BẠN MUỐN CHƠI Ở ĐÂU?</small>
            <input
              name="keyword"
              defaultValue={query.keyword}
              placeholder="Tìm tên sân, địa chỉ…"
              aria-label="Tìm tên sân hoặc địa chỉ"
            />
          </span>
        </label>
        <label className="search-field">
          <MapPin size={20} />
          <span>
            <small>KHU VỰC</small>
            <input
              name="district"
              list="district-suggestions"
              defaultValue={query.district}
              aria-label="Khu vực"
              placeholder="Tất cả khu vực"
            />
            <datalist id="district-suggestions">
              {districts.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </span>
        </label>
        <label className="search-field">
          <CalendarDays size={20} />
          <span>
            <small>NGÀY RA SÂN</small>
            <input
              name="date"
              type="date"
              min={localDate()}
              max={addDays(localDate(), 30)}
              defaultValue={date}
              aria-label="Ngày ra sân"
              required
            />
          </span>
        </label>
        <Button type="submit">
          <Search size={18} /> Tìm sân
        </Button>
      </form>
      <div className="quick-locations">
        <span>Gợi ý gần bạn</span>
        {['Cầu Giấy', 'Nam Từ Liêm', 'Tây Hồ'].map((d) => (
          <button key={d} onClick={() => update({ district: d })}>
            {d}
            <ArrowUpRight size={13} />
          </button>
        ))}
      </div>
      <section id="pitch-results" className="results-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow muted">CHỌN SÂN. CHỌN CUỘC VUI.</div>
            <h2>
              Cơ sở phù hợp cho cả đội<span>.</span>
            </h2>
          </div>
          <span className="results-count">
            {resource.data ? `${resource.data.meta.total} cơ sở phù hợp` : 'Đang tìm cơ sở…'}
          </span>
        </div>
        <div className="catalog-layout">
          <aside className={`filters ${filterOpen ? 'expanded' : ''}`}>
            <div className="filter-title">
              <h3>
                <SlidersHorizontal size={17} /> Bộ lọc
              </h3>
              <button
                className="text-button"
                onClick={() => {
                  setParams({ date });
                }}
              >
                Đặt lại
              </button>
            </div>
            <fieldset>
              <legend>Môn thể thao</legend>
              <select
                aria-label="Môn thể thao"
                value={query.sportTypeId}
                onChange={(e) => update({ sportTypeId: e.target.value, teamSize: '' })}
              >
                <option value="">Tất cả môn</option>
                {sports.data?.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {sports.error && <ErrorBox error={sports.error} retry={sports.reload} />}
            </fieldset>
            <fieldset>
              <legend>Thành phố</legend>
              <input
                aria-label="Thành phố"
                list="city-suggestions"
                placeholder="Tất cả thành phố"
                value={query.city}
                onChange={(e) => update({ city: e.target.value, district: '' })}
              />
              <datalist id="city-suggestions">
                <option value="Hà Nội" />
                <option value="Hồ Chí Minh" />
                <option value="Đà Nẵng" />
              </datalist>
            </fieldset>
            <fieldset>
              <legend>Số người mỗi đội</legend>
              <div className="type-filters">
                {[5, 7, 11].map((type) => (
                  <button
                    key={type}
                    className={query.teamSize === String(type) ? 'selected' : ''}
                    aria-pressed={query.teamSize === String(type)}
                    onClick={() =>
                      update({ teamSize: query.teamSize === String(type) ? '' : String(type) })
                    }
                  >
                    <Users size={18} />
                    Sân {type}
                    <span>{query.teamSize === String(type) && <Check size={13} />}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Ngân sách mỗi giờ</legend>
              <label className="price-select">
                <select
                  aria-label="Giá sân tối đa"
                  value={query.maxPrice}
                  onChange={(e) => update({ maxPrice: e.target.value })}
                >
                  <option value="">Tất cả mức giá</option>
                  <option value="300000">Đến 300.000đ</option>
                  <option value="400000">Đến 400.000đ</option>
                  <option value="600000">Đến 600.000đ</option>
                </select>
              </label>
              <small>Giá cơ bản, chưa gồm phụ thu giờ cao điểm.</small>
            </fieldset>
            <div className="filter-tip">
              <Sparkles size={21} />
              <h4>Kèo hay không đợi!</h4>
              <p>Chọn sân để xem các khung giờ còn trống trong ngày bạn muốn chơi.</p>
              <Link to="/huong-dan">
                Cách đặt sân <ArrowRight size={15} />
              </Link>
            </div>
          </aside>
          <div className="catalog-main">
            <div className="catalog-toolbar">
              <button className="filter-mobile-toggle" onClick={() => setFilterOpen(!filterOpen)}>
                <SlidersHorizontal size={17} /> Bộ lọc
              </button>
              <div className="active-filter">
                {query.district ? (
                  <>
                    <MapPin size={15} />
                    {query.district}
                    <button aria-label="Bỏ lọc khu vực" onClick={() => update({ district: '' })}>
                      ×
                    </button>
                  </>
                ) : (
                  <>
                    <span className="green-dot" />
                    Khám phá cơ sở thể thao
                  </>
                )}
              </div>
              <label className="sort-control">
                Sắp xếp
                <select
                  aria-label="Sắp xếp sân"
                  value={query.sort}
                  onChange={(e) => update({ sort: e.target.value })}
                >
                  <option value="-rating,minPrice">Đánh giá cao nhất</option>
                  <option value="minPrice,name">Giá tăng dần</option>
                  <option value="-minPrice,name">Giá giảm dần</option>
                  <option value="name">Tên A → Z</option>
                </select>
              </label>
            </div>
            {resource.loading ? (
              <Loading cards />
            ) : resource.error ? (
              <ErrorBox error={resource.error} retry={resource.reload} />
            ) : resource.data.data.length === 0 ? (
              <EmptyState
                icon={Search}
                title="Chưa tìm thấy sân phù hợp"
                action={
                  <Button variant="outline" onClick={() => setParams({ date })}>
                    Xóa bộ lọc
                  </Button>
                }
              >
                Thử khu vực khác hoặc tăng ngân sách một chút nhé.
              </EmptyState>
            ) : (
              <>
                <div className="pitch-grid">
                  {resource.data.data.map((venue) => (
                    <VenueCard
                      key={venue.id}
                      venue={venue}
                      date={date}
                      teamSize={query.teamSize}
                      sportTypeId={query.sportTypeId}
                    />
                  ))}
                </div>
                <div className="pagination">
                  <span>
                    Trang {resource.data.meta.page} / {resource.data.meta.totalPages}
                  </span>
                  <div>
                    <button
                      className="icon-button"
                      aria-label="Trang trước"
                      disabled={!resource.data.links.prev}
                      onClick={() => {
                        const p = new URLSearchParams(params);
                        p.set('page', String(Number(query.page) - 1));
                        setParams(p, { preventScrollReset: true });
                      }}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="current-page">{query.page}</span>
                    <button
                      className="icon-button"
                      aria-label="Trang tiếp theo"
                      disabled={!resource.data.links.next}
                      onClick={() => {
                        const p = new URLSearchParams(params);
                        p.set('page', String(Number(query.page) + 1));
                        setParams(p, { preventScrollReset: true });
                      }}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
      <section className="team-banner">
        <div className="mini-pitch">
          <span />
          <i />
        </div>
        <div>
          <div className="eyebrow">BÓNG ĐÁ LÀ CÁI CỚ.</div>
          <h2>Gặp nhau mới là điều quan trọng.</h2>
          <p>Rủ hội bạn, xỏ giày và để một tuần dài lại phía sau.</p>
        </div>
        <a href="#pitch-results" className="button dark">
          Lên kèo ngay <ArrowUpRight size={18} />
        </a>
      </section>
    </div>
  );
}
function VenueCard({ venue: pitch, date, teamSize, sportTypeId }) {
  const href = `/co-so/${pitch.id}?${new URLSearchParams({ date, ...(teamSize ? { teamSize } : {}), ...(sportTypeId ? { sportTypeId } : {}) })}`;
  return (
    <article className="pitch-card">
      <Link className="card-image" to={href} tabIndex={-1} aria-hidden="true">
        <img src={imageFor(pitch.imageKey)} alt="" loading="lazy" />
        <span className="pitch-type">{pitch.courtCount} SÂN RIÊNG BIỆT</span>
        {pitch.rating >= 4.8 && (
          <span className="card-pick">
            <Sparkles size={12} /> Được yêu thích
          </span>
        )}
      </Link>
      <div className="card-body">
        <div className="card-location">
          <MapPin size={13} />
          {pitch.district}
          <span>
            <Star size={13} fill="currentColor" /> {pitch.rating.toFixed(1)}{' '}
            <small>({pitch.reviewCount})</small>
          </span>
        </div>
        <h3>
          <Link to={href}>{pitch.name}</Link>
        </h3>
        <p className="card-pitch-types">
          {pitch.courtTypes
            .map(
              (item) =>
                `${item.count} sân ${item.teamSize ? item.teamSize + ' người' : item.sportName}`,
            )
            .join(' · ') || 'Chưa có sân đang hoạt động'}
        </p>
        <div className="card-bottom">
          <div>
            <small>Toàn cơ sở · giá từ</small>
            <strong>
              {pitch.minPrice === null ? 'Chưa có giá' : money(pitch.minPrice)}
              {pitch.minPrice !== null && <span> / giờ</span>}
            </strong>
          </div>
          <Link className="card-arrow" to={href} aria-label={`Xem ${pitch.name}`}>
            <ArrowUpRight size={21} />
          </Link>
        </div>
      </div>
    </article>
  );
}
