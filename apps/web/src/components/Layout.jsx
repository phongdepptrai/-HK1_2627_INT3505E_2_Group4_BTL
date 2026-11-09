import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { ArrowUpRight, MapPin, Menu, X, LogOut, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui';
export default function Layout() {
  const { user, openLogin, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  return (
    <>
      <a className="skip-link" href="#main">
        Đến nội dung chính
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label="Kèo Sân - trang chủ">
            <img src="/favicon.svg" alt="" />
            <span>
              kèo<span className="brand-light">sân</span>
              <span className="brand-dot">.</span>
            </span>
          </Link>
          <nav
            aria-label="Điều hướng chính"
            className={menu ? 'main-nav open' : 'main-nav'}
            onClick={() => setMenu(false)}
          >
            <NavLink to="/" end>
              Tìm sân
            </NavLink>
            <NavLink to="/lich-dat">Lịch đặt của tôi</NavLink>
            <NavLink to="/huong-dan">Cách đặt sân</NavLink>
            {user?.role === 'ADMIN' && <NavLink to="/quan-tri/mon-the-thao">Môn thể thao</NavLink>}
            {user?.role === 'OWNER' && <NavLink to="/chu-san">Quản lý sân</NavLink>}
          </nav>
          <div className="header-actions">
            <span className="city">
              <MapPin size={15} /> Hà Nội
            </span>
            {user ? (
              <>
                <Link to="/tai-khoan" className="user-pill" aria-label="Hồ sơ của tôi">
                  <span>{user.fullName.charAt(0)}</span>
                  {user.fullName}
                </Link>
                <button
                  className="icon-button"
                  aria-label="Đăng xuất"
                  onClick={() => logout().catch(() => {})}
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Button variant="dark" onClick={openLogin}>
                Đăng nhập <ArrowUpRight size={16} />
              </Button>
            )}
            <button
              className="icon-button mobile-menu"
              aria-label={menu ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container footer-top">
          <Link to="/" className="brand">
            <img src="/favicon.svg" alt="" />
            <span>kèosân.</span>
          </Link>
          <p>
            Hẹn nhau trên sân.
            <br />
            <span>Phần còn lại, để Kèo Sân lo.</span>
          </p>
          <Link to="/huong-dan">
            Sẵn sàng cho trận tiếp theo? <ArrowRight size={18} />
          </Link>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 Kèo Sân · Đồ án Kiến trúc hướng dịch vụ</span>
          <span className="demo-label">
            <i /> Bản demo · Sân, đánh giá và lịch đặt là dữ liệu mẫu
          </span>
        </div>
      </footer>
    </>
  );
}
