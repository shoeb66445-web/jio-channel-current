export type PlaylistChannel = {
  attributes: Record<string, string>;
  name: string;
  properties: string[];
  url: string | null;
};

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