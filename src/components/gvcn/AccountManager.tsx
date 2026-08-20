"use client";

import { useCallback, useEffect, useState } from "react";

import { formatDateTime } from "@/lib/utils";

type Account = {
  id: string;
  username: string;
  fullName: string;
  role: string;
  roleLabel: string;
  teamNumber: number | null;
  active: boolean;
  updatedAt: string;
  weakHint: boolean;
};

type AuditEntry = {
  id: string;
  entityType: string;
  action: string;
  summary: string;
  actorName: string;
  actorRole: string;
  createdAt: string;
};

const MIN_PASSWORD = 6;

const ENTITY_LABELS: Record<string, string> = {
  report: "Báo cáo",
  student: "Học sinh",
  user: "Tài khoản",
  weekLock: "Khóa tuần",
  classConfig: "Cấu hình lớp",
  notice: "Thông báo",
  schoolYear: "Năm học",
  system: "Hệ thống",
};

export function AccountManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");

  const loadAccounts = useCallback(async () => {
    const response = await fetch("/api/gvcn/accounts");
    if (!response.ok) throw new Error("accounts");
    const data = await response.json();
    setAccounts(data.accounts ?? []);
  }, []);

  const loadAudit = useCallback(async (skip: number) => {
    const response = await fetch(`/api/gvcn/audit?skip=${skip}`);
    if (!response.ok) throw new Error("audit");
    return (await response.json()) as { entries: AuditEntry[]; hasMore: boolean };
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([loadAccounts(), loadAudit(0)])
      .then(([, audit]) => {
        if (!alive) return;
        setEntries(audit.entries);
        setHasMore(audit.hasMore);
        setError("");
      })
      .catch(() => alive && setError("Chưa tải được tài khoản hoặc nhật ký."));
    return () => {
      alive = false;
    };
  }, [loadAccounts, loadAudit]);

  const savePassword = useCallback(
    async (account: Account) => {
      if (draft.length < MIN_PASSWORD) {
        setNotice(`Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.`);
        return;
      }
      setPending(true);
      setNotice("");
      try {
        const response = await fetch("/api/gvcn/accounts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: account.id, password: draft }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setNotice(data?.error ?? "Không đổi được mật khẩu.");
          return;
        }
        setNotice(`Đã đổi mật khẩu cho ${account.username}. Nhớ nhắn lại cho em ấy.`);
        setEditingId("");
        setDraft("");
        await loadAccounts();
        const audit = await loadAudit(0);
        setEntries(audit.entries);
        setHasMore(audit.hasMore);
      } catch {
        setNotice("Lỗi mạng. Thử lại.");
      } finally {
        setPending(false);
      }
    },
    [draft, loadAccounts, loadAudit],
  );

  const toggleActive = useCallback(
    async (account: Account) => {
      setPending(true);
      setNotice("");
      try {
        const response = await fetch("/api/gvcn/accounts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: account.id, active: !account.active }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setNotice(data?.error ?? "Không đổi được trạng thái.");
          return;
        }
        await loadAccounts();
      } finally {
        setPending(false);
      }
    },
    [loadAccounts],
  );

  const loadMoreAudit = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const audit = await loadAudit(entries.length);
      setEntries((current) => [...current, ...audit.entries]);
      setHasMore(audit.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [entries.length, hasMore, loadAudit, loadingMore]);

  return (
    <div className="gvcn-stack">
      <section className="card p-5">
        <h2 className="text-lg font-semibold text-slate-900">Mật khẩu ban cán sự</h2>
        <p className="mt-1 text-sm text-slate-500">
          Đặt mật khẩu mới cho từng chức vụ. Mật khẩu không được trùng tên tài khoản và cần ít nhất {MIN_PASSWORD} ký tự.
        </p>

        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
        {notice ? (
          <p className="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm text-indigo-900">
            {notice}
          </p>
        ) : null}

        <div className="acc-grid mt-4">
          {accounts.map((account) => (
            <article className={`acc-card${account.active ? "" : " is-off"}`} key={account.id}>
              <header>
                <div>
                  <strong>{account.roleLabel}</strong>
                  <span className="acc-user">
                    @{account.username}
                    {account.teamNumber ? ` · tổ ${account.teamNumber}` : ""}
                  </span>
                </div>
                {account.weakHint ? <span className="acc-weak">mật khẩu dễ đoán</span> : null}
              </header>

              {editingId === account.id ? (
                <div className="acc-edit">
                  <input
                    autoFocus
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={`Mật khẩu mới (≥ ${MIN_PASSWORD} ký tự)`}
                    type="text"
                    value={draft}
                  />
                  <div className="acc-edit-actions">
                    <button
                      className="button-primary"
                      disabled={pending}
                      onClick={() => void savePassword(account)}
                      type="button"
                    >
                      {pending ? "Đang lưu…" : "Lưu"}
                    </button>
                    <button
                      className="button-secondary"
                      onClick={() => {
                        setEditingId("");
                        setDraft("");
                      }}
                      type="button"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                <div className="acc-actions">
                  <button
                    className="button-secondary"
                    onClick={() => {
                      setEditingId(account.id);
                      setDraft("");
                      setNotice("");
                    }}
                    type="button"
                  >
                    Đổi mật khẩu
                  </button>
                  <button
                    className="button-secondary"
                    disabled={pending}
                    onClick={() => void toggleActive(account)}
                    type="button"
                  >
                    {account.active ? "Tạm dừng" : "Mở lại"}
                  </button>
                </div>
              )}
              {account.updatedAt ? <p className="acc-stamp">Sửa lần cuối {formatDateTime(account.updatedAt)}</p> : null}
            </article>
          ))}
          {!accounts.length && !error ? <p className="text-sm text-slate-500">Đang tải tài khoản…</p> : null}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold text-slate-900">Nhật ký thao tác</h2>
        <p className="mt-1 text-sm text-slate-500">Ai đã sửa gì, lúc nào — mới nhất trước.</p>

        <ol className="audit-list mt-4">
          {entries.map((entry) => (
            <li className="audit-row" key={entry.id}>
              <span className={`audit-tag tag-${entry.entityType}`}>
                {ENTITY_LABELS[entry.entityType] ?? entry.entityType}
              </span>
              <div className="audit-main">
                <p className="audit-summary">{entry.summary}</p>
                <p className="audit-meta">
                  {entry.actorName} · {entry.actorRole} · {formatDateTime(entry.createdAt)}
                </p>
              </div>
            </li>
          ))}
          {!entries.length ? <li className="text-sm text-slate-500">Chưa có thao tác nào được ghi.</li> : null}
        </ol>

        {hasMore ? (
          <button
            className="button-secondary mt-4"
            disabled={loadingMore}
            onClick={() => void loadMoreAudit()}
            type="button"
          >
            {loadingMore ? "Đang tải…" : "Xem thêm"}
          </button>
        ) : null}
      </section>
    </div>
  );
}
