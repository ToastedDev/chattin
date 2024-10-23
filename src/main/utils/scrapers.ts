export async function getChannel(urlOrId: string) {
  let url = urlOrId;

  if (urlOrId.startsWith("UC")) {
    url = `https://youtube.com/channel/${urlOrId}`;
  }

  const res = await fetch(url);
  const data = await res.text();

  // eslint-disable-next-line regexp/prefer-w
  const id = data.match(/<link itemprop="url" href="https:\/\/www\.youtube\.com\/channel\/([A-Za-z0-9\-_]+)"/)?.[1];

  if (!id) {
    throw new Error("Invalid channel URL");
  }

  return {
    id,
    name: data.match(/<meta itemprop="name" content="([^"]+)"/)?.[1],
    handle: data.match(/"canonicalBaseUrl": "\/@ToastedTheDev"/)?.[1],
    avatar: data.match(/<meta property="og:image" content="([^"]+)"/)?.[1],
  };
}

export async function getVideo(urlOrId: string) {
  let url = urlOrId;

  if (!urlOrId.includes("youtube.com") && !urlOrId.includes("youtu.be")) {
    url = `https://youtube.com/watch?v=${urlOrId}`;
  }

  const res = await fetch(url);
  const data = await res.text();

  return {
    id: urlOrId.includes("youtu.be") ? urlOrId.split("/").pop() : urlOrId.split("v=").pop()?.split("&").shift(),
    title: data.match(/<meta itemprop="name" content="([^"]+)"/)?.[1],
  };
}

export async function getLatestStream(channelId: string) {
  const res = await fetch(`https://youtube.com/channel/${channelId}/streams`);
  const html = await res.text();
  const initialData = JSON.parse(
    `{${html.split("var ytInitialData = {")[1].split("};")[0]}}`,
  );
  const streams = initialData.contents.twoColumnBrowseResultsRenderer.tabs
    .find((tab: any) => tab.tabRenderer.title === "Live")
    ?.tabRenderer
    .content
    .richGridRenderer
    .contents
    .filter(
      (stream: any) =>
        !stream.richItemRenderer.content.videoRenderer.lengthText,
    )
    .map(
      (stream: any) => stream.richItemRenderer.content.videoRenderer.videoId,
    );

  return streams[0];
}
