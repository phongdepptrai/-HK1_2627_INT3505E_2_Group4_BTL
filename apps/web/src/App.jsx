import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Link } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import Explore from './pages/Explore';
import CourtDetail from './pages/CourtDetail';
import Account from './pages/Account';
import BookingDetail from './pages/BookingDetail';
import SportsAdmin from './pages/SportsAdmin';
import VenueDetail from './pages/VenueDetail';
import Bookings from './pages/Bookings';
import Owner from './pages/Owner';
import Guide from './pages/Guide';
import { EmptyState } from './components/ui';
function NavigationEffects() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NavigationEffects />
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Explore />} />
            <Route path="san/:id" element={<CourtDetail />} />
            <Route path="co-so/:id" element={<VenueDetail />} />
            <Route path="lich-dat" element={<Bookings />} />
            <Route path="lich-dat/:id" element={<BookingDetail />} />
            <Route path="tai-khoan" element={<Account />} />
            <Route path="quan-tri/mon-the-thao" element={<SportsAdmin />} />
            <Route path="chu-san" element={<Owner />} />
            <Route path="huong-dan" element={<Guide />} />
            <Route
              path="*"
              element={
                <div className="container page">
                  <EmptyState
                    title="Trang này đã ra ngoài đường biên"
                    action={
                      <Link className="button primary" to="/">
                        Về trang tìm sân
                      </Link>
                    }
                  >
                    Không tìm thấy trang bạn yêu cầu.
                  </EmptyState>
                </div>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
