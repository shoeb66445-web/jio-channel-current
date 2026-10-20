export type PlaylistChannel = {
  attributes: Record<string, string>;
  name: string;
  properties: string[];
  url: string | null;
};

export type FullChannel = {
  id: string | null;
  name: string;
  logo: string | null;
  category: string | null;
  type: "mpd" | "hls";
  mpd_url: string;
  user_agent: string;
  headers: { cookie: string | null };
  clearkey: string;
  expires_in: number | null;
};

// Keep the old type for backward compat
export type PublicChannelMetadata = {
  id: string | null;
  name: string;
  logo: string | null;
  category: string | null;
};

function findAttributeSeparator(value: string) {
  let insideQuotes = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"') insideQuotes = !insideQuotes;
    if (character === "," && !insideQuotes) return index;
  }

  return -1;
}

function parseAttributes(value: string) {
  const attributes: Record<string, string> = {};
  const pattern = /([\w-]+)="([^"]*)"/g;

  for (const match of value.matchAll(pattern)) {
    const [, key, attributeValue] = match;
    if (key !== undefined && attributeValue !== undefined) {
      attributes[key] = attributeValue;
    }
  }

  return attributes;
}

export function parseM3uPlaylist(playlist: string): PlaylistChannel[] {
  const channels: PlaylistChannel[] = [];
  let current: PlaylistChannel | null = null;

  for (const rawLine of playlist.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line.startsWith("#EXTINF:")) {
      if (current) channels.push(current);

      const details = line.slice("#EXTINF:".length);
      const separator = findAttributeSeparator(details);
      const attributeText = separator < 0 ? details : details.slice(0, separator);
      const name = separator < 0 ? "" : details.slice(separator + 1).trim();

      current = {
        attributes: parseAttributes(attributeText),
        name,
        properties: [],
        url: null,
      };
      continue;
    }

    if (!current || !line) continue;

    if (line.startsWith("#")) {
      current.properties.push(line);
    } else {
      current.url = line;
      channels.push(current);
      current = null;
    }
  }

  if (current) channels.push(current);
  return channels;
}

// ─────────────────────────────────────────────────────────────
// Extract __hdnea__ token from a stream URL
// ─────────────────────────────────────────────────────────────
function extractToken(url: string): string | null {
  const m = url.match(/__hdnea__=([^&\s]+)/);
  return m ? m[1] : null;
}

// ─────────────────────────────────────────────────────────────
// Extract token expiry from __hdnea__ (exp=<epoch>)
// ─────────────────────────────────────────────────────────────
function extractExpiry(url: string): number | null {
  const m = url.match(/exp=(\d+)/);
  if (!m) return null;
  const exp = Number(m[1]);
  const now = Math.floor(Date.now() / 1000);
  const remaining = exp - now;
  return remaining > 0 ? remaining : null;
}

// ─────────────────────────────────────────────────────────────
// FULL channel data — stream URL, cookies, clearkeys, type
//
// Extracts from KODIPROP lines:
//   • manifest_type → "mpd" | "hls"
//   • license_key   → "kid1:key1,kid2:key2,..."
//
// Extracts from stream URL:
//   • __hdnea__ token → headers.cookie
//   • exp= → expires_in (seconds remaining)
// ─────────────────────────────────────────────────────────────
export function toFullChannels(channels: PlaylistChannel[]): FullChannel[] {
  return channels
    .filter((ch) => ch.url && ch.url.startsWith("http"))
    .map((ch) => {
      const { attributes, name, properties, url } = ch;
      const streamUrl = url!;

      // Parse KODIPROP lines for manifest_type and license_key
      let manifestType: "mpd" | "hls" = "mpd";
      const clearkeys: string[] = [];

      for (const prop of properties) {
        if (!prop.startsWith("#KODIPROP:")) continue;
        const val = prop.slice("#KODIPROP:".length);

        // manifest_type
        const mtMatch = val.match(/inputstream\.adaptive\.manifest_type=(\S+)/i);
        if (mtMatch) {
          manifestType = mtMatch[1].toLowerCase().trim() === "hls" ? "hls" : "mpd";
        }

        // license_key (clearkey pairs: kid1:key1,kid2:key2,...)
        const lkMatch = val.match(/inputstream\.adaptive\.license_key=([^\s#]+)/i);
        if (lkMatch && !lkMatch[1].startsWith("http")) {
          for (const pair of lkMatch[1].split(",")) {
            const p = pair.trim();
            if (p.includes(":")) clearkeys.push(p);
          }
        }
      }

      // Also detect HLS from URL if KODIPROP is missing
      if (streamUrl.includes(".m3u8")) manifestType = "hls";

      // Extract token for cookie header
      const token = extractToken(streamUrl);

      const logo = attributes["tvg-logo"];
      const safeLogo = logo?.startsWith("https://") ? logo : null;

      return {
        id: attributes["tvg-id"] ?? null,
        name: attributes["tvg-name"] ?? name,
        logo: safeLogo,
        category: attributes["group-title"] ?? null,
        type: manifestType,
        mpd_url: streamUrl,
        user_agent: "Premium Plugx",
        headers: {
          cookie: token ? `__hdnea__=${token}` : null,
        },
        clearkey: clearkeys.join(","),
        expires_in: extractExpiry(streamUrl),
      };
    });
}

export function toPublicChannelMetadata(
  channels: PlaylistChannel[],
): PublicChannelMetadata[] {
  return channels.map(({ attributes, name }) => {
    const logo = attributes["tvg-logo"];
    const safeLogo = logo?.startsWith("https://") ? logo : null;

    return {
      id: attributes["tvg-id"] ?? null,
      name: attributes["tvg-name"] ?? name,
      logo: safeLogo,
      category: attributes["group-title"] ?? null,
    };
  });
}
