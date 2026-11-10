import { useCallback, useEffect, useRef, useState } from "react";
import {
  adoptExistingGoogleDrive,
  cancelDriveUpload,
  connectGoogleDrive,
  disconnectGoogleDrive,
  fetchDriveStatus,
  fetchUploadProgress,
  readCachedDriveVerified,
  startLibraryUpload,
  writeCachedDriveVerified,
  type DriveStatus,
  type DriveUploadProgress,
} from "../lib/driveClient";
import { clearDriveUploadUi, readDriveUi, writeDriveUi, type DriveCheckVisual } from "../lib/driveSession";
import { readFavoriteIds } from "../lib/favorites";
import { useStore } from "../state/store";

type PendingAction = "connect" | "check" | "adopt" | "disconnect" | null;

const saved = readDriveUi();

function statusLabel(status: string): string {
  if (status === "active") return "Uploading";
  if (status === "queued") return "Queued";
  if (status === "done") return "Done";
  if (status === "cancelled") return "Cancelled";
  if (status === "error") return "Failed";
  return status;
}

export function DriveSyncPanel() {
  const store = useStore();
  const [status, setStatus] = useState<DriveStatus | null>(saved.status);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [note, setNote] = useState(saved.note);
  const [checkVisual, setCheckVisual] = useState<DriveCheckVisual>(saved.checkVisual);
  const [uploadProgress, setUploadProgress] = useState<DriveUploadProgress | null>(null);
  const pollRef = useRef<number | null>(null);
  const uploadPollRef = useRef<number | null>(null);

  const persist = useCallback((patch: Parameters<typeof writeDriveUi>[0]) => {
    writeDriveUi(patch);
  }, []);

  const applyStatus = useCallback(
    (next: DriveStatus) => {
      setStatus(next);
      writeCachedDriveVerified(next.verified);
      persist({ status: next });
      if (next.verified) setCheckVisual("ok");
      else setCheckVisual((current) => (current === "checking" ? "fail" : current));
    },
    [persist],
  );

  const applyUploadProgress = useCallback(
    (progress: DriveUploadProgress) => {
      setUploadProgress(progress);
      const line =
        progress.current?.detail ??
        (progress.queued.length ? `${progress.queued.length} upload(s) queued…` : progress.detail);
      setNote(line);
      persist({
        uploadProgress: progress.percent,
        uploadPhase: line,
        note: line,
        pending: progress.active || progress.queued.length ? "upload" : null,
      });
    },
    [persist],
  );

  const refresh = useCallback(
    async (fromCheck = false) => {
      if (fromCheck) setCheckVisual("checking");
      try {
        const next = await fetchDriveStatus();
        applyStatus(next);
        if (fromCheck) {
          const visual = next.verified ? "ok" : "fail";
          setCheckVisual(visual);
          const noteText = next.verified
            ? `${next.accountLabel ?? "Google Drive"} is reachable.`
            : next.linkError ?? next.detail;
          setNote(noteText);
          persist({ checkVisual: visual, note: noteText });
        }
        return next;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sync service unavailable.";
        if (!status) {
          setStatus({
            rclone: false,
            connected: false,
            verified: false,
            linking: false,
            remote: "izer_gdrive",
            detail: message,
            checkedAt: new Date().toISOString(),
          });
        }
        writeCachedDriveVerified(false);
        if (fromCheck) {
          setCheckVisual("fail");
          setNote(message);
          persist({ checkVisual: "fail", note: message });
        }
        return null;
      }
    },
    [applyStatus, persist, status],
  );

  const pollUploads = useCallback(async () => {
    try {
      const progress = await fetchUploadProgress();
      applyUploadProgress(progress);
    } catch {
      /* server unavailable */
    }
  }, [applyUploadProgress]);

  useEffect(() => {
    if (!saved.status || Date.now() - saved.updatedAt > 60_000) {
      void refresh();
    }
    void pollUploads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onFocus = () => {
      void refresh();
      void pollUploads();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh, pollUploads]);

  useEffect(() => {
    persist({ status, note, checkVisual, pending });
  }, [status, note, checkVisual, pending, persist]);

  useEffect(() => {
    if (!status?.linking) {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    pollRef.current = window.setInterval(() => void refresh(), 2500);
    return () => {
      if (pollRef.current != null) window.clearInterval(pollRef.current);
    };
  }, [status?.linking, refresh]);

  useEffect(() => {
    void pollUploads();
    uploadPollRef.current = window.setInterval(() => void pollUploads(), 700);
    return () => {
      if (uploadPollRef.current != null) window.clearInterval(uploadPollRef.current);
    };
  }, [pollUploads]);

  async function onConnect() {
    setPending("connect");
    setNote("Opening Google sign-in…");
    try {
      const result = await connectGoogleDrive();
      setNote(result.detail);
      await refresh();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Connect failed.");
    } finally {
      setPending(null);
    }
  }

  async function onCheck() {
    setPending("check");
    try {
      await refresh(true);
    } finally {
      setPending(null);
    }
  }

  async function onAdopt() {
    const from = status?.adoptFrom;
    if (!from) return;
    setPending("adopt");
    try {
      const result = await adoptExistingGoogleDrive();
      setNote(result.detail);
      if (result.ok) {
        setCheckVisual("ok");
        await refresh(true);
      } else setCheckVisual("fail");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not reuse the existing Drive link.");
      setCheckVisual("fail");
    } finally {
      setPending(null);
    }
  }

  async function onDisconnect() {
    setPending("disconnect");
    try {
      const result = await disconnectGoogleDrive();
      setNote(result.detail);
      writeCachedDriveVerified(false);
      setCheckVisual("idle");
      clearDriveUploadUi();
      await refresh();
      void pollUploads();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not remove link.");
    } finally {
      setPending(null);
    }
  }

  async function onUpload() {
    try {
      const favorites = [...readFavoriteIds()];
      const result = await startLibraryUpload(store.userPresets, favorites);
      setNote(result.detail);
      await pollUploads();
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  async function onCancelUpload(id?: string) {
    const result = await cancelDriveUpload(id);
    setNote(result.detail);
    await pollUploads();
  }

  const verified = status?.verified ?? false;
  const linking = status?.linking ?? false;
  const rclone = status?.rclone ?? false;
  const adoptFrom = status?.adoptFrom;
  const showOptimisticOk = !status && readCachedDriveVerified();
  const uploadActive = uploadProgress?.active ?? false;
  const percent = uploadProgress?.percent ?? 0;

  let badgeLabel = "Not checked";
  let badgeClass = "drive-badge";
  if (checkVisual === "checking" || linking || pending === "check") {
    badgeLabel = "Checking…";
    badgeClass = "drive-badge checking";
  } else if (checkVisual === "ok" || verified) {
    badgeLabel = "Connected";
    badgeClass = "drive-badge ok";
  } else if (checkVisual === "fail") {
    badgeLabel = "Not connected";
    badgeClass = "drive-badge fail";
  } else if (showOptimisticOk) {
    badgeLabel = "Previously linked";
    badgeClass = "drive-badge hint";
  }

  const showLinkError = status?.linkError && status.linkError !== status.detail && status.linkError !== note;
  const statusLine = status?.detail ?? saved.status?.detail ?? "Loading sync status…";

  const queueRows = [
    ...(uploadProgress?.current ? [uploadProgress.current] : []),
    ...(uploadProgress?.queued.map((item) => ({
      id: item.id,
      label: item.label,
      status: "queued" as const,
      percent: 0,
      phase: "queued",
      detail: item.detail,
      fileCount: item.fileCount,
    })) ?? []),
  ];

  return (
    <div className="drive-sync">
      <div className="drive-status-row">
        <span className={badgeClass} role="status" aria-live="polite">
          <span className="drive-badge-mark" aria-hidden="true">
            {checkVisual === "checking" || linking || pending === "check"
              ? "…"
              : verified || checkVisual === "ok"
                ? "✓"
                : checkVisual === "fail"
                  ? "×"
                  : "○"}
          </span>
          {badgeLabel}
        </span>
        <p className="drive-status">{statusLine}</p>
      </div>
      {status?.accountLabel && verified ? <p className="drive-account">{status.accountLabel}</p> : null}

      {(uploadActive || queueRows.length > 0) && (
        <div className="drive-progress" aria-live="polite">
          <div className="drive-progress-track">
            <span className="drive-progress-bar" style={{ width: `${Math.max(4, percent)}%` }} />
          </div>
          <span className="drive-progress-label">
            {uploadActive ? `${Math.round(percent)}% · ` : ""}
            {uploadProgress?.current?.detail ?? uploadProgress?.detail ?? "Uploading…"}
          </span>
        </div>
      )}

      {queueRows.length > 0 || (uploadProgress?.history.length ?? 0) > 0 ? (
        <div className="drive-upload-queue">
          <div className="drive-queue-head">
            <strong>Upload queue</strong>
            {uploadActive || (uploadProgress?.queued.length ?? 0) > 0 ? (
              <button type="button" className="text-link-inline" onClick={() => void onCancelUpload()}>
                Cancel all
              </button>
            ) : null}
          </div>
          <ul className="drive-queue-list">
            {queueRows.map((row) => (
              <li key={row.id} className={`drive-queue-item status-${row.status}`}>
                <div className="drive-queue-copy">
                  <span className="drive-queue-label">{row.label}</span>
                  <span className="drive-queue-meta">
                    {statusLabel(row.status)}
                    {row.status === "active" ? ` · ${Math.round(row.percent)}%` : ""}
                    {row.fileCount ? ` · ${row.fileCount} files` : ""}
                  </span>
                  <span className="drive-queue-detail">{row.detail}</span>
                </div>
                {row.status === "active" || row.status === "queued" ? (
                  <button type="button" className="btn btn-ghost btn-delete queue-cancel" onClick={() => void onCancelUpload(row.id)}>
                    Cancel
                  </button>
                ) : null}
              </li>
            ))}
            {uploadProgress?.history.slice(0, 4).map((row) => (
              <li key={`${row.id}-hist`} className={`drive-queue-item status-${row.status} history`}>
                <p className="drive-queue-copy">
                  <span className="drive-queue-label">{row.label}</span>
                  <span className="drive-queue-meta">
                    {statusLabel(row.status)} · {row.finishedAt ? new Date(row.finishedAt).toLocaleTimeString() : ""}
                  </span>
                  <span className="drive-queue-detail">{row.detail}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {note ? <p className="drive-note">{note}</p> : null}
      {showLinkError ? <p className="drive-note warn">{status.linkError}</p> : null}
      <div className="drive-actions">
        {adoptFrom && !verified ? (
          <button type="button" className="btn btn-primary" disabled={!rclone || pending === "adopt"} onClick={() => void onAdopt()}>
            {pending === "adopt" ? "Linking…" : `Use ${adoptFrom} account`}
          </button>
        ) : null}
        <button
          type="button"
          className={adoptFrom && !verified ? "btn btn-ghost" : "btn btn-primary"}
          disabled={!rclone || verified || pending === "connect"}
          onClick={() => void onConnect()}
        >
          {pending === "connect" ? "Opening sign-in…" : "Connect Google Drive"}
        </button>
        <button type="button" className="btn btn-ghost drive-btn-strong" disabled={!rclone || pending === "check"} onClick={() => void onCheck()}>
          {pending === "check" ? "Checking…" : "Check connection"}
        </button>
        <button
          type="button"
          className="btn btn-ghost drive-btn-strong"
          disabled={!verified}
          title="Upload or queue a library backup to Google Drive."
          onClick={() => void onUpload()}
        >
          {uploadActive ? "Queue another upload" : "Upload library"}
        </button>
        <button type="button" className="btn btn-ghost btn-delete drive-btn-strong" disabled={!rclone || pending === "disconnect"} onClick={() => void onDisconnect()}>
          {pending === "disconnect" ? "Removing…" : "Remove link"}
        </button>
      </div>
      <p className="drive-hint">
        Uses rclone on this PC. Uploads run in the background — switch tabs freely. Files go to{" "}
        <strong>izer_gdrive:izer/Presets/</strong>.
      </p>
    </div>
  );
}
