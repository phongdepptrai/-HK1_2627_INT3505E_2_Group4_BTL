import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { identityApi } from '../api/services';
import { Button, Field, ErrorBox, EmptyState } from '../components/ui';
export default function Account() {
  const { user, openLogin, setUser } = useAuth();
  return (
    <div className="container page">
      <div className="page-heading">
        <div className="eyebrow muted">THÔNG TIN CỦA BẠN</div>
        <h1>
          Hồ sơ thành viên<span>.</span>
        </h1>
        <p>Thông tin liên hệ giúp chủ sân kết nối với bạn khi cần.</p>
      </div>
      {user ? (
        <ProfileForm key={user.id} user={user} onSaved={setUser} />
      ) : (
        <EmptyState
          icon={UserRound}
          title="Đăng nhập để xem hồ sơ"
          action={<Button onClick={openLogin}>Đăng nhập</Button>}
        />
      )}
    </div>
  );
}
function ProfileForm({ user, onSaved }) {
  const [fullName, setFullName] = useState(user.fullName),
    [phone, setPhone] = useState(user.phone),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      onSaved((await identityApi.update({ fullName, phone })).data);
      setSuccess(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="account-layout">
      <aside className="profile-card">
        <div className="profile-avatar">{user.fullName.charAt(0)}</div>
        <h2>{user.fullName}</h2>
        <p>{user.email}</p>
        <span className="tiny-badge">
          {{ CUSTOMER: 'Người chơi', OWNER: 'Chủ sân', ADMIN: 'Quản trị viên' }[user.role]}
        </span>
      </aside>
      <form className="surface form-stack" onSubmit={submit}>
        <h2>Thông tin cá nhân</h2>
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
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field label="Email đăng nhập">
          <input type="email" value={user.email} readOnly />
        </Field>
        <ErrorBox error={error} />
        {success && (
          <p className="success-notice" role="status">
            Đã lưu thông tin cá nhân.
          </p>
        )}
        <Button type="submit" loading={busy}>
          Lưu thay đổi
        </Button>
      </form>
    </div>
  );
}
