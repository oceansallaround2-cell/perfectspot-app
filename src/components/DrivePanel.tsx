import { useCallback, useEffect, useState } from "react";
import { HardDrive, Loader2, RefreshCw, Search, Share2, Unlink, FileText, Film, ImageIcon, Presentation } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { disconnectDrive, driveStatus, listDriveFiles, startDriveConnect, type DriveFile } from "@/lib/drive.functions";

/** Drive preview URLs work for video, PDF, images and slides alike. */
export function drivePreviewUrl(fileId: string) {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function parseDriveFileId(url: string): string | null {
  const m = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/) ?? url.match(/[?&]id=([^&]+)/);
  return m?.[1] ?? null;
}

function kindIcon(mimeType: string) {
  if (mimeType.startsWith("video/")) return Film;
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType.includes("presentation")) return Presentation;
  return FileText;
}

function waitForOAuth(popup: Window) {
  return new Promise<void>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.connectorId !== "google_drive" ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      )
        return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") return resolve();
      popup.close();
      reject(new Error("Google Drive connection failed."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("The Google window closed before finishing."));
    }, 500);
  });
}

/**
 * Drive Sync — each partner links their own Google Drive, browses it privately,
 * and shares a file into the room so both watch the exact same thing.
 */
export function DrivePanel({ onShare }: { onShare: (url: string, name: string) => void | Promise<void> }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [term, setTerm] = useState("");

  const refresh = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      const { files: list } = await listDriveFiles({ data: { query: query ?? "" } });
      setFiles(list);
    } catch {
      toast.error("Couldn't read your Drive");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    driveStatus()
      .then(({ connected: c }) => {
        setConnected(c);
        if (c) refresh();
      })
      .catch(() => setConnected(false));
  }, [refresh]);

  async function connect() {
    const popup = window.open("", "perfect-spot-drive", "width=600,height=720");
    if (!popup) {
      toast.error("Allow popups to connect Google Drive");
      return;
    }
    setConnecting(true);
    try {
      const { authorizationUrl } = await startDriveConnect();
      const done = waitForOAuth(popup);
      popup.location.href = authorizationUrl;
      await done;
      setConnected(true);
      await refresh();
      toast.success("Google Drive connected");
    } catch (err) {
      popup.close();
      toast.error(err instanceof Error ? err.message : "Couldn't connect Drive");
    }
    setConnecting(false);
  }

  async function unlink() {
    await disconnectDrive().catch(() => {});
    setConnected(false);
    setFiles([]);
    toast.success("Google Drive disconnected");
  }

  if (connected === null) {
    return (
      <div className="glass-card flex items-center gap-2 p-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking Drive…
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="glass-card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-primary" />
          <h3 className="font-serif text-lg">Drive Sync</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Connect your own Google Drive to browse and share videos, PDFs, photos and slides straight into the room.
        </p>
        <Button className="rounded-full" onClick={connect} disabled={connecting}>
          {connecting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <HardDrive className="mr-1.5 h-3.5 w-3.5" />}
          Connect Google Drive
        </Button>
      </div>
    );
  }

  return (
    <div className="glass-card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-primary" />
          <h3 className="font-serif text-lg">Drive Sync</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => refresh(term)} aria-label="Refresh">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-destructive" onClick={unlink} aria-label="Disconnect Drive">
            <Unlink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          refresh(term);
        }}
      >
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search your Drive" className="rounded-full" />
        <Button size="icon" type="submit" className="rounded-full" aria-label="Search">
          <Search className="h-3.5 w-3.5" />
        </Button>
      </form>

      <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
        {loading && files.length === 0 && (
          <p className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your files…
          </p>
        )}
        {!loading && files.length === 0 && <p className="py-4 text-xs text-muted-foreground">Nothing playable found in this Drive.</p>}
        {files.map((f) => {
          const Icon = kindIcon(f.mimeType);
          return (
            <div key={f.id} className="flex items-center gap-2 rounded-2xl border border-border/40 px-3 py-2">
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-xs">{f.name}</span>
              <Button
                size="sm"
                className="h-7 rounded-full px-3 text-[11px]"
                onClick={() => onShare(drivePreviewUrl(f.id), f.name)}
              >
                <Share2 className="mr-1 h-3 w-3" /> Share
              </Button>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Shared files open for both of you in sync. Your partner needs view access to the file in Google Drive.
      </p>
    </div>
  );
}
