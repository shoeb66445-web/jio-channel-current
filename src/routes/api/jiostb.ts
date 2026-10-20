import { createFileRoute } from "@tanstack/react-router";

import { parseM3uPlaylist, toFullChannels } from "@/lib/jiostb-playlist";

const PLAYLIST_URL = "https://premiumplugx.top/jiostb/gdryt.php?view=raw";
const MAX_PLAYLIST_BYTES = 2 * 1024 * 1024;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export const Route = createFileRoute("/api/jiostb")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const upstream = await fetch(PLAYLIST_URL, {
            headers: {
              Accept: "text/plain",
              "User-Agent": "Mozilla/5.0 (compatible; JioSTBFeed/1.0)",
            },
            signal: AbortSignal.timeout(12_000),
          });

          if (!upstream.ok || !upstream.body) {
            return jsonError("The channel feed is temporarily unavailable.", 502);
          }

          const reader = upstream.body.getReader();
          const chunks: Uint8Array[] = [];
          let totalBytes = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;

            totalBytes += value.byteLength;
            if (totalBytes > MAX_PLAYLIST_BYTES) {
              await reader.cancel();
              return jsonError("The channel feed is too large to process.", 502);
            }
            chunks.push(value);
          }

          const bytes = new Uint8Array(totalBytes);
          let offset = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
          }

          const playlist = new TextDecoder().decode(bytes);
          if (!playlist.trimStart().startsWith("#EXTM3U")) {
            return jsonError("The channel feed returned an unexpected format.", 502);
          }

          const channels = toFullChannels(parseM3uPlaylist(playlist));
          return Response.json(
            { count: channels.length, channels },
            {
              headers: {
                "Cache-Control": "public, max-age=60",
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        } catch {
          return jsonError("The channel feed is temporarily unavailable.", 502);
        }
      },
    },
  },
});
