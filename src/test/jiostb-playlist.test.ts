import { describe, expect, it } from "vitest";

import { parseM3uPlaylist, toPublicChannelMetadata } from "@/lib/jiostb-playlist";

describe("parseM3uPlaylist", () => {
  it("converts channel metadata, properties, and URLs into JSON-ready records", () => {
    const playlist = [
      "#EXTM3U",
      '#EXTINF:-1 tvg-id="167" tvg-name="Zee TV HD" tvg-logo="https://example.test/logo.jpg" group-title="Entertainment",Zee TV HD',
      "#KODIPROP:inputstream.adaptive.manifest_type=mpd",
      "https://example.test/live/zee.mpd",
    ].join("\n");

    expect(parseM3uPlaylist(playlist)).toEqual([
      {
        attributes: {
          "tvg-id": "167",
          "tvg-name": "Zee TV HD",
          "tvg-logo": "https://example.test/logo.jpg",
          "group-title": "Entertainment",
        },
        name: "Zee TV HD",
        properties: ["#KODIPROP:inputstream.adaptive.manifest_type=mpd"],
        url: "https://example.test/live/zee.mpd",
      },
    ]);
  });

  it("publishes channel details without stream URLs or DRM properties", () => {
    const channels = parseM3uPlaylist(
      [
        '#EXTINF:-1 tvg-id="167" tvg-name="Zee TV HD" tvg-logo="https://example.test/logo.jpg" group-title="Entertainment",Zee TV HD',
        "#KODIPROP:inputstream.adaptive.license_key=private-value",
        "https://example.test/live/zee.mpd?token=private-value",
      ].join("\n"),
    );

    expect(toPublicChannelMetadata(channels)).toEqual([
      {
        id: "167",
        name: "Zee TV HD",
        logo: "https://example.test/logo.jpg",
        category: "Entertainment",
      },
    ]);
  });
});