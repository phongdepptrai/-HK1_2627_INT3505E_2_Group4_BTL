import { useState } from 'react';
import { sportApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { useResource } from '../hooks/useResource';
import { Button, Field, Modal, Loading, ErrorBox, EmptyState } from '../components/ui';
export default function SportsAdmin() {
  const { user, openLogin } = useAuth();
  return (
    <div className="container page">
      <div className="page-heading">
        <div className="eyebrow muted">DANH MỤC DÙNG CHUNG</div>
        <h1>
          Môn thể thao<span>.</span>
        </h1>
        <p>Quản lý các môn được sử dụng khi tạo sân trong cơ sở.</p>
      </div>
      {user?.role === 'ADMIN' ? (
        <Sports />
      ) : (
        <EmptyState
          title="Dành cho quản trị viên"
          action={!user && <Button onClick={openLogin}>Đăng nhập</Button>}
        />
      )}
    </div>
  );
}
function Sports() {
  const resource = useResource((signal) => sportApi.list(signal), []);
  const [editing, setEditing] = useState(null),
    [deleting, setDeleting] = useState(null),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await sportApi.remove(deleting.id);
      setDeleting(null);
      resource.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="owner-toolbar">
        <span>{resource.data?.data.length || 0} môn thể thao</span>
        <Button onClick={() => setEditing({})}>Thêm môn thể thao</Button>
      </div>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorBox error={resource.error} retry={resource.reload} />
      ) : (
        <div className="review-grid">
          {resource.data.data.map((s) => (
            <article className="surface" key={s.id}>
              <h2>{s.name}</h2>
              <div className="button-row">
                <Button variant="outline" onClick={() => setEditing(s)}>
                  Sửa {s.name}
                </Button>
                <button
                  className="text-button danger-text"
                  onClick={() => {
                    setError(null);
                    setDeleting(s);
                  }}
                >
                  Xóa {s.name}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <SportForm
          sport={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            resource.reload();
          }}
        />
      )}
      {deleting && (
        <Modal title="Xóa môn thể thao?" onClose={() => setDeleting(null)}>
          <p>{deleting.name}. Môn đang được sân sử dụng không thể xóa.</p>
          <ErrorBox error={error} />
          <Button variant="danger" loading={busy} onClick={remove}>
            Xác nhận xóa
          </Button>
        </Modal>
      )}
    </>
  );
}
function SportForm({ sport, onClose, onSaved }) {
  const [name, setName] = useState(sport.name || ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (sport.id) await sportApi.update(sport.id, { name });
      else await sportApi.create({ name });
      onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={sport.id ? 'Sửa môn thể thao' : 'Thêm môn thể thao'} onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <Field label="Tên môn thể thao">
          <input
            required
            minLength={2}
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <ErrorBox error={error} />
        <Button type="submit" loading={busy}>
          Lưu môn thể thao
        </Button>
      </form>
    </Modal>
  );
}
