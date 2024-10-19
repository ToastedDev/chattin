export function withContext(input: any = {}) {
  return JSON.stringify({
    ...input,
    context: {
      ...input?.context,
      client: { clientName: "WEB", clientVersion: "2.20211014.05.00" },
    },
  });
}

export { stringify } from "./conversion";
export { getLiveChatContinuation } from "./protobuf";
