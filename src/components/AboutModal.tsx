import React, { useState } from "react";
import { t } from "@/libs/l10n";
import { CHANGELOG } from "../changelog";
import { SPONSOR_QR_BASE64 } from "../assets/sponsor-qr";
import pkg from "../../package.json";

interface AboutModalProps {
  visible: boolean;
  onClose: () => void;
}

type TabType = "about" | "changelog";

export function AboutModal({ visible, onClose }: AboutModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("about");

  if (!visible) return null;

  return (
    <orca.components.ModalOverlay
      visible={visible}
      onClose={onClose}
      blurred={true}
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--orca-color-bg-1)",
          color: "var(--orca-text-color)",
          borderRadius: "12px",
          width: "480px",
          maxHeight: "70vh",
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.25)",
          border: "1px solid var(--orca-color-border-2)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* 顶部：插件信息 */}
        <div
          style={{
            padding: "24px 24px 16px",
            textAlign: "center",
            borderBottom: "1px solid var(--orca-color-border)",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "8px" }}>🦕</div>
          <h2
            style={{
              margin: "0 0 4px 0",
              fontSize: "18px",
              fontWeight: 600,
            }}
          >
            {t("Dinosaur Toolbox")}
          </h2>
          <div
            style={{
              fontSize: "12px",
              opacity: 0.5,
            }}
          >
            v{pkg.version}
          </div>
        </div>

        {/* Tab 切换 */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--orca-color-border)",
          }}
        >
          <TabButton
            active={activeTab === "about"}
            onClick={() => setActiveTab("about")}
          >
            {t("About")}
          </TabButton>
          <TabButton
            active={activeTab === "changelog"}
            onClick={() => setActiveTab("changelog")}
          >
            {t("What's New")}
          </TabButton>
        </div>

        {/* 内容区 */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px",
          }}
        >
          {activeTab === "about" ? <AboutContent /> : <ChangelogContent />}
        </div>

        {/* 底部按钮 */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "16px 24px",
            borderTop: "1px solid var(--orca-color-border)",
          }}
        >
          <orca.components.Button variant="solid" onClick={onClose}>
            {t("close")}
          </orca.components.Button>
        </div>
      </div>
    </orca.components.ModalOverlay>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "12px 16px",
        background: "none",
        border: "none",
        borderBottom: active
          ? "2px solid var(--orca-color-primary-5)"
          : "2px solid transparent",
        color: active
          ? "var(--orca-color-primary-5)"
          : "var(--orca-text-color)",
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        fontSize: "13px",
        transition: "all 0.2s",
      }}
    >
      {children}
    </button>
  );
}

function AboutContent() {
  const [showQR, setShowQR] = useState(false);

  return (
    <div>
      {/* 描述 */}
      <p
        style={{
          margin: "0 0 20px 0",
          fontSize: "14px",
          lineHeight: "1.6",
          opacity: 0.8,
        }}
      >
        {t(
          "A powerful plugin collection for Orca Note, providing various tools to enhance your note-taking experience.",
        )}
      </p>

      {/* 相关链接 */}
      <div style={{ marginBottom: "20px" }}>
        <SectionTitle>{t("Links")}</SectionTitle>
        <LinkList>
          <LinkItem
            icon="ti ti-home"
            label={t("Homepage")}
            url="https://leay.net"
          />
          <LinkItem
            icon="ti ti-brand-github"
            label="GitHub"
            url="https://github.com/hqweay/orca-hqweay-go"
          />
          <LinkItem
            icon="ti ti-message-circle"
            label={t("Feedback")}
            url="https://github.com/hqweay/orca-hqweay-go/issues"
          />
          <LinkItem
            icon="ti ti-heart"
            label={t("Sponsor")}
            onClick={() => setShowQR(true)}
          />
        </LinkList>

        {/* 收款码弹窗 */}
        {showQR && SPONSOR_QR_BASE64 && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowQR(false)}
          >
            <div
              style={{
                background: "var(--orca-color-bg-1)",
                borderRadius: "12px",
                padding: "24px",
                textAlign: "center",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={SPONSOR_QR_BASE64}
                alt="Sponsor QR Code"
                style={{
                  width: "480px",
                  borderRadius: "8px",
                }}
              />
              <div
                style={{
                  marginTop: "12px",
                  fontSize: "13px",
                  opacity: 0.7,
                }}
              >
                {t("Scan to sponsor")}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 作者信息 */}
      <div>
        <SectionTitle>{t("Author")}</SectionTitle>
        <div
          style={{
            fontSize: "13px",
            opacity: 0.7,
            lineHeight: "1.6",
          }}
        >
          <div>hqweay</div>
          <div>GitHub: @hqweay</div>
        </div>
      </div>
    </div>
  );
}

function ChangelogContent() {
  return (
    <div>
      {CHANGELOG.map((entry) => (
        <div key={entry.version} style={{ marginBottom: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "10px",
            }}
          >
            <span
              style={{
                background: "var(--orca-color-primary-5)",
                color: "white",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              v{entry.version}
            </span>
            <span style={{ fontSize: "12px", opacity: 0.5 }}>{entry.date}</span>
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: "20px",
              fontSize: "13px",
              lineHeight: "1.6",
            }}
          >
            {entry.changes.map((change, idx) => (
              <li key={idx} style={{ marginBottom: "4px" }}>
                {change}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "12px",
        fontWeight: 600,
        textTransform: "uppercase",
        opacity: 0.5,
        marginBottom: "10px",
      }}
    >
      {children}
    </div>
  );
}

function LinkList({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {children}
    </div>
  );
}

function LinkItem({
  icon,
  label,
  url,
  onClick,
}: {
  icon: string;
  label: string;
  url?: string;
  onClick?: () => void;
}) {
  const style = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    borderRadius: "6px",
    textDecoration: "none",
    color: "var(--orca-text-color)",
    fontSize: "13px",
    transition: "background 0.2s",
    cursor: "pointer",
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = "var(--orca-color-bg-2)";
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = "none";
  };

  if (onClick) {
    return (
      <div
        style={style}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <i className={icon} style={{ fontSize: "16px", opacity: 0.7 }} />
        <span>{label}</span>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <i className={icon} style={{ fontSize: "16px", opacity: 0.7 }} />
      <span>{label}</span>
      <i
        className="ti ti-external-link"
        style={{ fontSize: "12px", opacity: 0.4, marginLeft: "auto" }}
      />
    </a>
  );
}
