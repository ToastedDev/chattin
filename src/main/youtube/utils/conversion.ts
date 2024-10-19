function stripYtRedirection(url: string): string {
  if (!url.startsWith("https://www.youtube.com/redirect?")) {
    return url;
  }

  const target = new URL(url);
  const q = target.searchParams.get("q");

  return q || target.href;
}

function endpointToUrl(
  navigationEndpoint: NonNullable<any>,
): string | undefined {
  if ("urlEndpoint" in navigationEndpoint) {
    return stripYtRedirection(navigationEndpoint.urlEndpoint.url);
  }

  if ("watchEndpoint" in navigationEndpoint) {
    const { watchEndpoint } = navigationEndpoint;

    let url = `https://www.youtube.com/watch?v=${watchEndpoint.videoId}`;

    if (watchEndpoint.playlistId)
      url += `&list=${watchEndpoint.playlistId}`;
    if (watchEndpoint.index)
      url += `&index=${watchEndpoint.index}`;
    if (watchEndpoint.startTimeSeconds)
      url += `&t=${watchEndpoint.startTimeSeconds}`;

    return url;
  }

  if ("browseEndpoint" in navigationEndpoint) {
    const { browseEndpoint } = navigationEndpoint;
    const { browseId } = browseEndpoint;

    if ("canonicalBaseUrl" in browseEndpoint) {
      return stripYtRedirection(
        browseEndpoint.canonicalBaseUrl,
      );
    }
    else if (browseId) {
      const prefix = browseId.substr(0, 2);

      let url = "https://www.youtube.com";
      if (prefix === "FE") {
        if (browseId === "FEwhat_to_watch")
          url = "/";
        else if (browseId === "FEmy_videos")
          url = "/my_videos";
        else url = `/feed/${browseId.substr(2)}`;
      }
      else if (prefix === "VL") {
        url = `/playlist?list=${browseId.substr(2)}`;
      }
      else {
        url = `/channel/${browseId}`;
      }
      return url;
    }
  }

  return undefined;
}

export function textRunToPlainText(run: any): string {
  const { text, navigationEndpoint } = run;
  if (navigationEndpoint) {
    if ("urlEndpoint" in navigationEndpoint) {
      return endpointToUrl(navigationEndpoint) ?? text;
    }
    if ("watchEndpoint" in navigationEndpoint && text.startsWith("https://")) {
      return endpointToUrl(navigationEndpoint) ?? text;
    }
  }
  return text;
}

export function emojiRunToPlainText(run: any): string {
  const { emoji } = run;
  /**
   * Anomalous emoji pattern
   * 1. Missing `isCustomEmoji` and `emojiId`
   * {
      emoji: {
        emojiId: "",
        shortcuts: [":smilisageReng_face_with_tear:"],
        searchTerms: ["smiling", "face", "with", "tear"],
        image: {
          thumbnails: [
            {
              url: "https://www.youtube.com/s/gaming/emoji/828cb648/emoji_u1f972.svg",
            },
          ],
          accessibility: { accessibilityData: { label: "" } },
        },
      },
    },
   */
  const term
    = emoji.isCustomEmoji || emoji.emojiId === ""
      ? emoji.shortcuts[emoji.shortcuts.length - 1]
      : emoji.emojiId;
  return term;
}

function runsToString(
  runs: any[],
  {
    spaces = false,
    textHandler = textRunToPlainText,
    emojiHandler = emojiRunToPlainText,
  }: any = {},
): string {
  return runs
    .map((run) => {
      if ("text" in run)
        return textHandler(run);
      if ("emoji" in run)
        return emojiHandler(run);
      throw new Error(`Unrecognized run token: ${JSON.stringify(run)}`);
    })
    .join(spaces ? " " : "");
}

function simpleTextToString(
  payload: any,
  expand: boolean = false,
) {
  if (payload.accessibility && expand) {
    return payload.accessibility.accessibilityData.label;
  }
  return payload.simpleText;
}

/**
 * Convert any yt text container into string
 * `[...] | {runs: [...]} | {simpleText: "..."} -> string`
 */

export function stringify(
  payload: any,
): string | undefined {
  // undefined
  if (payload === undefined)
    return undefined;

  // string
  if (typeof payload === "string")
    return payload;

  // Run[]
  if (Array.isArray(payload))
    return runsToString(payload);

  // YTRunContainer
  if ("runs" in payload)
    return runsToString(payload.runs);

  // YTSimpleTextContainer
  // TODO: add option for expanding accessibility label
  if ("simpleText" in payload)
    return simpleTextToString(payload, false);

  throw new Error(`Invalid payload format: ${payload}`);
}
