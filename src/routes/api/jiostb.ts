import { createFileRoute } from "@tanstack/react-router";

const PLAYLIST_URL = "https://premiumplugx.top/jiostb/gdryt.php?view=raw";
const MAX_PLAYLIST_BYTES = 2 * 1024 * 1024;

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
            return new Response(
              "#EXTM3U\n#EXTINF:-1,⚠️ Channel feed temporarily unavailable\nhttps://example.com/error\n",
              { status: 502, headers: { "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8" } },
            );
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
              return new Response("Playlist too large", { status: 502 });
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
            return new Response("Unexpected format", { status: 502 });
          }

          // Return raw M3U exactly as-is — with all KODIPROP, clearkeys, stream URLs
          return new Response(playlist, {
            status: 200,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Content-Disposition": 'inline; filename="jiostb.m3u"',
              "Cache-Control": "public, max-age=60",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch {
          return new Response("Feed unavailable", { status: 502 });
        }
      },
    },
  },
});
