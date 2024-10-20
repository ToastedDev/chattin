import type { Message } from "@shared/types";

import { useEffect, useRef, useState } from "react";

// eslint-disable-next-line ts/no-redeclare
function Message({ message }: { message: Message }): JSX.Element {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    ref.current!.scrollIntoView();
  }, [ref]);

  return (
    <div ref={ref}>
      <p className="inline font-bold" style={{ color: message.author.badges.moderator ? "#5e84f1" : "initial" }}>
        {message.author.name}
        {message.author.badges.moderator && <svg className="w-4 h-4 inline fill-current ml-1 mb-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" focusable="false" aria-hidden="true"><path d="M9.64589146,7.05569719 C9.83346524,6.562372 9.93617022,6.02722257 9.93617022,5.46808511 C9.93617022,3.00042984 7.93574038,1 5.46808511,1 C4.90894765,1 4.37379823,1.10270499 3.88047304,1.29027875 L6.95744681,4.36725249 L4.36725255,6.95744681 L1.29027875,3.88047305 C1.10270498,4.37379824 1,4.90894766 1,5.46808511 C1,7.93574038 3.00042984,9.93617022 5.46808511,9.93617022 C6.02722256,9.93617022 6.56237198,9.83346524 7.05569716,9.64589147 L12.4098057,15 L15,12.4098057 L9.64589146,7.05569719 Z"></path></svg>}
        :
        {" "}
      </p>
      {message.content}
    </div>
  );
}

function App(): JSX.Element {
  const chatElemRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

  useEffect(() => {
    const { port1, port2 } = new MessageChannel();
    window.electron.ipcRenderer.postMessage("start-chat-stream", {}, [port2]);
    port1.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "chats") {
        setMessages(prev => [...prev, ...data.data]);
        console.log(data.data);
      }
    };

    return () => {
      port1.close();
      port2.close();
    };
  }, []);

  useEffect(() => {
    const chatElem = chatElemRef.current!;

    function onScroll() {
      const { scrollTop, scrollHeight, clientHeight } = chatElem;
      const maxHeight = scrollHeight - clientHeight;
      const scrolledPercent = (scrollTop / maxHeight) * 100;
      if (scrolledPercent < 100) {
        setShowScrollIndicator(true);
      }
      else {
        setShowScrollIndicator(false);
      }
    }

    chatElem.addEventListener("scroll", onScroll);

    return () => {
      chatElem.removeEventListener("scroll", onScroll);
    };
  }, [chatElemRef]);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-neutral-900 text-white">
      {showScrollIndicator && (
        <button
          type="button"
          className="absolute bottom-5 left-1/2 -translate-x-1/2 px-2 bg-neutral-800 rounded-full"
          onClick={() => {
            chatElemRef.current!.scrollTo({ top: chatElemRef.current!.scrollHeight, behavior: "smooth" });
          }}
        >
          <p>Scroll to bottom</p>
        </button>
      )}
      <div
        className="flex-grow p-4 overflow-y-auto"
        ref={chatElemRef}
      >
        {messages.map(message => <Message key={message.id + message.content} message={message} />)}
      </div>
    </div>
  );
}

export default App;
