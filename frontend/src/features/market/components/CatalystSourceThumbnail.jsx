import { useEffect, useState } from "react";

function publisherIconUrl(value) {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return null;
    if (hostname === "localhost" || [".localhost", ".local", ".internal"].some((suffix) => hostname.endsWith(suffix))) return null;
    if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) return null;
    return `${parsed.origin}/favicon.ico`;
  } catch {
    return null;
  }
}

export function CatalystSourceThumbnail({ source, className }) {
  const [usePublisherIcon, setUsePublisherIcon] = useState(!source.thumbnail_url);
  const fallbackUrl = publisherIconUrl(source.url);
  const imageUrl = usePublisherIcon ? fallbackUrl : source.thumbnail_url;

  useEffect(() => setUsePublisherIcon(!source.thumbnail_url), [source.id, source.thumbnail_url]);

  return (
    <span className={className} aria-hidden="true">
      <span>{source.kind === "video" ? "▶" : "↗"}</span>
      {imageUrl && (
        <img
          className={usePublisherIcon ? "is-publisher-icon" : ""}
          src={imageUrl}
          alt=""
          loading="lazy"
          onError={(event) => {
            if (!usePublisherIcon && fallbackUrl) setUsePublisherIcon(true);
            else event.currentTarget.remove();
          }}
        />
      )}
    </span>
  );
}
