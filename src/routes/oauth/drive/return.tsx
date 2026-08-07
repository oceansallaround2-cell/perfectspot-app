import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { completeDriveConnect } from "@/lib/drive.functions";

export const Route = createFileRoute("/oauth/drive/return")({
  ssr: false,
  component: DriveOAuthReturn,
  head: () => ({
    meta: [
      { title: "Connecting Google Drive · Perfect Spot" },
      { name: "description", content: "Finishing your private Google Drive connection for Perfect Spot." },
      { property: "og:title", content: "Connecting Google Drive · Perfect Spot" },
      { property: "og:description", content: "Finishing your private Google Drive connection for Perfect Spot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function DriveOAuthReturn() {
  const [message, setMessage] = useState("Finishing the connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notify = (type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed") => {
      window.opener?.postMessage({ type, connectorId: "google_drive" }, window.location.origin);
      window.close();
    };

    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "Google didn't complete the connection.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        notify("appUserConnectorOAuthComplete");
        return;
      }
      setMessage("The connection finished without a code.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    void completeDriveConnect({ data: { code } })
      .then(() => notify("appUserConnectorOAuthComplete"))
      .catch(() => {
        setMessage("Couldn't finish the connection.");
        notify("appUserConnectorOAuthFailed");
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
