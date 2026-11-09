import { createContext, useContext, useEffect, useState } from 'react';
import { LogIn, UserRound, ShieldCheck } from 'lucide-react';
import { identityApi } from '../api/services';
import { setAccessToken, API_MODE } from '../api/client';
import { Button, Modal, Field, ErrorBox } from '../components/ui';
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [showLogin, setShowLogin] = useState(false),
    [expired, setExpired] = useState(false),
    [authError, setAuthError] = useState(null);
  useEffect(() => {
    const handle = () => {
      setUser(null);
      setExpired(true);
      setShowLogin(true);
    };
    window.addEventListener('session-expired', handle);
    return () => window.removeEventListener('session-expired', handle);
  }, []);
  async function logout() {
    setAuthError(null);
    try {
      await identityApi.logout();
      setAccessToken(null);
      setUser(null);
    } catch (error) {
      setAuthError(error);
    }
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        logout,
        openLogin: () => {
          setExpired(false);
          setShowLogin(true);
        },
      }}
    >
      {authError && (
        <div className="container">
          <ErrorBox error={authError} retry={logout} />
        </div>
      )}
      {children}
      {showLogin && (
        <LoginModal
          expired={expired}
          onClose={() => setShowLogin(false)}
          onSuccess={(session) => {
            setAccessToken(session.accessToken);
            setUser(session.user);
            setShowLogin(false);
          }}
        />
      )}
    </AuthContext.Provider>
  );
}
function LoginModal({ onClose, onSuccess, expired }) {
  const [mode, setMode] = useState('login'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [fullName, setFullName] = useState(''),
    [phone, setPhone] = useState(''),
    [error, setError] = useState(null),
    [success, setSuccess] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'register') {
        await identityApi.register({ email, password, fullName, phone });
        setMode('login');
        setSuccess('Tạo tài khoản thành công. Đăng nhập để bắt đầu.');
        setPassword('');
      } else onSuccess((await identityApi.login({ email, password })).data);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={mode === 'register' ? 'Gia nhập đội của bạn' : 'Chào mừng về đội!'}
      onClose={onClose}
    >
      <p className="muted">
        {expired
          ? 'Phiên đã hết hạn. Đăng nhập lại để tiếp tục.'
          : 'Đặt sân, theo dõi lịch chơi và chia sẻ trải nghiệm.'}
      </p>
      <div className="tabs">
        <button
          type="button"
          className={mode === 'login' ? 'active' : ''}
          onClick={() => {
            setMode('login');
            setError(null);
          }}
        >
          Đăng nhập
        </button>
        <button
          type="button"
          className={mode === 'register' ? 'active' : ''}
          onClick={() => {
            setMode('register');
            setError(null);
            setSuccess('');
          }}
        >
          Tạo tài khoản
        </button>
      </div>
      {success && (
        <p className="success-notice" role="status">
          {success}
        </p>
      )}
      <form className="form-stack" onSubmit={submit}>
        {mode === 'register' && (
          <>
            <Field label="Họ và tên">
              <input
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </Field>
            <Field label="Số điện thoại">
              <input
                required
                type="tel"
                pattern="0[0-9]{9}"
                maxLength={10}
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
          </>
        )}
        <Field label="Email">
          <input
            required
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ban@example.com"
          />
        </Field>
        <Field label="Mật khẩu">
          <input
            required
            type="password"
            minLength={8}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ít nhất 8 ký tự"
          />
        </Field>
        <ErrorBox error={error} />
        <Button type="submit" loading={busy}>
          <LogIn size={18} />
          {mode === 'register' ? 'Đăng ký' : 'Vào đội'}
        </Button>
      </form>
      {API_MODE === 'mock' && (
        <div className="demo-accounts">
          <span>TÀI KHOẢN TRẢI NGHIỆM</span>
          <div>
            {[
              ['player', 'Người đặt sân'],
              ['owner', 'Chủ sân'],
              ['admin', 'Quản trị'],
            ].map(([account, label]) => (
              <button
                key={account}
                onClick={() => {
                  setMode('login');
                  setEmail(`${account}@keosan.demo`);
                  setPassword('Demo@12345');
                  setError(null);
                }}
              >
                {account === 'player' ? <UserRound size={17} /> : <ShieldCheck size={17} />}
                {label}
              </button>
            ))}
          </div>
          <small>
            Dữ liệu thử trong tab hiện tại, được đặt lại khi tải lại trang. Chỉ dùng thông tin giả
            khi đăng ký demo.
          </small>
        </div>
      )}
    </Modal>
  );
}
