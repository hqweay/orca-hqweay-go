import React, { useState, useEffect } from "react";
import { t } from "@/libs/l10n";

interface PluginInfo {
  repo: string;
  description: string;
}

interface BazaarModalProps {
  onClose: () => void;
  pluginName: string;
}

export function BazaarModal({ onClose, pluginName }: BazaarModalProps) {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    setLoading(true);
    // Try to load from cache first
    try {
      const cached = await orca.plugins.getData(pluginName, "cached_plugins");
      if (cached && typeof cached === "string") {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setPlugins(parsed);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn("Failed to parse cached plugins", e);
    }
    await fetchPlugins();
  };

  const fetchPlugins = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://raw.githubusercontent.com/hqweay/orca-bazaar/refs/heads/main/plugins.json?t=${Date.now()}`,
      );
      const text = await response.text();
      const parsed = parsePluginsJson(text);
      setPlugins(parsed);
      // Cache the result
      await orca.plugins.setData(
        pluginName,
        "cached_plugins",
        JSON.stringify(parsed),
      );
    } catch (e) {
      console.error("Failed to fetch plugins", e);
      orca.notify("error", t("Failed to fetch plugins list"));
    } finally {
      setLoading(false);
    }
  };

  const parsePluginsJson = (jsonText: string): PluginInfo[] => {
    try {
      const data = JSON.parse(jsonText);
      if (
        data.repos &&
        typeof data.repos === "object" &&
        !Array.isArray(data.repos)
      ) {
        return Object.entries(data.repos).map(([repo, description]) => ({
          repo,
          description: String(description),
        }));
      }
    } catch (e) {
      // Ignore JSON parse error, fallback to regex
      console.warn("JSON parse failed, falling back to regex", e);
    }

    const reposMatch = jsonText.match(/"repos"\s*:\s*\[([\s\S]*?)\]/);
    if (!reposMatch) return [];

    const innerContent = reposMatch[1];
    const pluginRegex = /"([^"]+)"\s*:\s*"([^"]+)"/g;
    const plugins: PluginInfo[] = [];

    let match;
    while ((match = pluginRegex.exec(innerContent)) !== null) {
      plugins.push({
        repo: match[1],
        description: match[2],
      });
    }
    return plugins;
  };

  const handleInstall = async (repo: string) => {
    if (installing) return;
    try {
      // IMPORTANT: showDirectoryPicker must be triggered by a user gesture.
      // If we call it after awaited network/download steps, Chromium may throw:
      // "SecurityError: Must be handling a user gesture..."
      orca.notify(
        "info",
        t("Please select your 'Orca Note/data/plugins' folder to install..."),
      );
      let pluginsDirHandle;
      try {
        // @ts-ignore
        pluginsDirHandle = await window.showDirectoryPicker({
          id: "orca-plugins-dir",
          mode: "readwrite",
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          throw new Error("Installation cancelled (folder selection aborted).");
        }
        throw err;
      }
      if (!pluginsDirHandle) throw new Error("No folder selected.");

      setInstalling(repo);
      setDownloadProgress(0);
      await installPlugin(repo, pluginsDirHandle);
      orca.notify("success", t(`Installed ${repo} successfully!`));
    } catch (e) {
      console.error(e);
      let msg = String(e);
      if (e instanceof Error) msg = e.message;
      orca.notify("error", t(`Installation failed: ${msg}`));
    } finally {
      setInstalling(null);
      setDownloadProgress(null);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const installPlugin = async (repo: string, pluginsDirHandle: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const JSZip = (window as any).JSZip || (await import("jszip")).default;

    // 1. Get Latest Release
    const [owner, repoName] = repo.split("/");
    const releaseUrl = `https://api.github.com/repos/${owner}/${repoName}/releases/latest`;
    const releaseRes = await fetch(releaseUrl);
    if (!releaseRes.ok) throw new Error("Failed to fetch release info");
    const releaseData = await releaseRes.json();

    const asset = releaseData.assets.find(
      (a: any) => a.name.includes(".zip"),
      // a.name === "package.zip" ||
      // a.name === "dist.zip" ||
      // a.name === `${repoName}.zip` ||
      // a.name.includes(`${repoName.replace("orca-", "")}`),
    );
    if (!asset) throw new Error("package not found in latest release");

    // 2. Download
    const downloadRes = await fetch(asset.browser_download_url);
    if (!downloadRes.ok) throw new Error("Failed to download package");

    const contentLength = downloadRes.headers.get("content-length");
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    const reader = downloadRes.body?.getReader();
    if (!reader) throw new Error("Failed to read response stream");

    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      loaded += value.length;

      if (total > 0) {
        setDownloadProgress(Math.min(99, Math.round((loaded / total) * 100)));
      }
    }

    // Combine chunks
    const arrayBuffer = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      arrayBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    setDownloadProgress(100);

    // 3. Unzip and Write
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Create plugin specific folder
    // Check if zip contains a root folder
    // Check if zip contains a root folder
    const files = Object.keys(zip.files);
    const rootFolders = new Set(
      files
        .map((f) => f.split("/")[0])
        .filter((p) => !p.startsWith(".") && p !== "__MACOSX"),
    );

    let targetDirHandle = pluginsDirHandle;
    let stripPrefix = "";

    if (rootFolders.size === 1) {
      const root = Array.from(rootFolders)[0];
      // If root is NOT 'dist', we treat it as a wrapper folder (e.g. 'random-walk') and strip it.
      // If root IS 'dist', we preserve it (so it becomes repoName/dist/...)
      if (root !== "dist") {
        if (zip.files[root + "/"] && zip.files[root + "/"].dir) {
          stripPrefix = root + "/";
        }
      }
    }

    // Create the destination folder (repoName)
    try {
      targetDirHandle = await pluginsDirHandle.getDirectoryHandle(repoName, {
        create: true,
      });
    } catch (e) {
      throw new Error(
        `Failed to create plugin folder '${repoName}': ` + (e as Error).message,
      );
    }

    orca.notify("info", t(`Installing into ${repoName}...`));

    // Check if content (after potential stripping) actually has 'dist' at the root
    let contentHasDist = false;
    for (const filename of files) {
      if (filename.startsWith("__MACOSX")) continue;
      if (zip.files[filename].dir) continue;

      let relativePath = filename;
      if (stripPrefix && filename.startsWith(stripPrefix)) {
        relativePath = filename.substring(stripPrefix.length);
      } else if (stripPrefix && !filename.startsWith(stripPrefix)) {
        continue;
      }

      if (relativePath.startsWith("dist/")) {
        contentHasDist = true;
        break;
      }
    }

    for (const filename of files) {
      if (filename.startsWith("__MACOSX")) continue;
      // We can skip explicit directory entries as we create parents on demand for files
      if (zip.files[filename].dir) continue;

      let relativePath = filename;
      if (stripPrefix && filename.startsWith(stripPrefix)) {
        relativePath = filename.substring(stripPrefix.length);
      } else if (stripPrefix && !filename.startsWith(stripPrefix)) {
        continue;
      }

      if (!relativePath) continue;

      // Filter out system files that might cause "Name is not allowed" errors
      if (
        relativePath.includes(".DS_Store") ||
        relativePath.includes("__MACOSX")
      )
        continue;

      // If the root content doesn't have a 'dist' folder, wrap everything in 'dist'
      if (!contentHasDist) {
        relativePath = "dist/" + relativePath;
      }

      // Handle nested folders
      const parts = relativePath.split("/");
      const fileName = parts.pop();

      // Skip if filename is empty or invalid (e.g. trailing slash on dir)
      if (!fileName || fileName.trim() === "") continue;

      let currentDirHandle = targetDirHandle;

      try {
        for (const part of parts) {
          if (!part || part.trim() === "") continue; // Skip empty parts
          currentDirHandle = await currentDirHandle.getDirectoryHandle(part, {
            create: true,
          });
        }

        if (fileName) {
          const content = await zip.files[filename].async("arraybuffer");
          const fileHandle = await currentDirHandle.getFileHandle(fileName, {
            create: true,
          });
          const writable = await fileHandle.createWritable();
          await writable.write(content);
          await writable.close();
        }
      } catch (err) {
        console.warn(`Failed to write file ${relativePath}:`, err);
        // Don't fail the entire installation for one file
      }
    }

    // 4. Register and Enable
    try {
      await orca.plugins.register(repoName);
      await orca.plugins.enable(repoName);
    } catch (e) {
      console.warn("Auto-register failed, user may need to reload window.", e);
      orca.notify(
        "info",
        t(
          "Plugin installed. Please reload window (`Cmd+R`) if it does not appear.",
        ),
      );
    }
  };

  const Button = orca.components.Button;
  const CompositionInput = orca.components.CompositionInput;

  const filteredPlugins = plugins.filter((p) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      p.repo.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query)
    );
  });

  return (
    <orca.components.ModalOverlay
      visible={true}
      onClose={onClose}
      blurred={true}
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.9)", // slightly opaque
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--b3-theme-background)",
          color: "var(--b3-theme-on-background)",
          padding: "20px",
          borderRadius: "8px",
          width: "600px",
          height: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <h2 style={{ margin: 0 }}>{t("Orca Bazaar")}</h2>
            <a
              href="https://github.com/hqweay/orca-bazaar"
              target="_blank"
              rel="noopener noreferrer"
              title={t("Contribute to Bazaar")}
              style={{
                color: "var(--b3-theme-text)",
                opacity: 0.6,
                display: "flex",
                alignItems: "center",
              }}
            >
              <i
                className="ti ti-brand-github"
                style={{ fontSize: "18px" }}
              ></i>
            </a>
            <Button
              variant="plain"
              onClick={fetchPlugins}
              title={t("Refresh")}
              style={{ marginLeft: "8px", padding: "4px", minWidth: "auto" }}
              disabled={loading}
            >
              <i
                className={`ti ti-refresh ${loading ? "fa-spin" : ""}`}
                style={{ fontSize: "18px" }}
              ></i>
            </Button>
          </div>
          <Button
            variant="plain"
            onClick={onClose}
            style={{ minWidth: "auto", padding: "4px" }}
          >
            <i className="ti ti-x" style={{ fontSize: "20px" }}></i>
          </Button>
        </div>

        <div
          style={{
            marginBottom: "12px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div>
            <CompositionInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("Search plugins...")}
              pre={<i className="ti ti-search" />}
            />
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {loading ? (
            <div style={{ padding: "20px", textAlign: "center" }}>
              {t("Loading...")}
            </div>
          ) : plugins.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center" }}>
              {t("No plugins found.")}
            </div>
          ) : filteredPlugins.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center" }}>
              {t("No plugins match your search.")}
            </div>
          ) : (
            filteredPlugins.map((p) => (
              <div
                key={p.repo}
                style={{
                  border: "1px solid var(--b3-theme-surface-lighter)",
                  padding: "16px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  background: "var(--b3-theme-surface)",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: "bold",
                      marginBottom: "4px",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <span>{p.repo}</span>
                    <a
                      href={`https://github.com/${p.repo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        marginLeft: "8px",
                        color: "var(--b3-theme-primary)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        textDecoration: "none",
                      }}
                      title={t("Open Repository")}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <i
                        className="ti ti-external-link"
                        style={{ fontSize: "14px" }}
                      ></i>
                    </a>
                  </div>
                  <div style={{ fontSize: "0.9em", opacity: 0.8 }}>
                    {p.description}
                  </div>
                </div>
                {/* @ts-ignore */}
                <Button
                  variant="outline"
                  onClick={() => handleInstall(p.repo)}
                  disabled={!!installing}
                >
                  {installing === p.repo
                    ? downloadProgress !== null && downloadProgress < 100
                      ? `${t("Downloading")} ${downloadProgress}%`
                      : t("Installing...")
                    : t("Install")}
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </orca.components.ModalOverlay>
  );
}
