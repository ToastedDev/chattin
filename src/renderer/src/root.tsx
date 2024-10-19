import { useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  content: string;
  author: {
    name: string;
  };
}

// eslint-disable-next-line ts/no-redeclare
function Message({ message }: { message: Message }): JSX.Element {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    ref.current!.scrollIntoView();
  }, [ref]);

  return (
    <div ref={ref}>
      <p className="inline font-bold">
        {message.author.name}
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
      if (data.event === "messages") {
        setMessages(prev => [...prev, ...data.data]);
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
      if (chatElem.scrollTop < chatElem.scrollHeight - chatElem.clientHeight) {
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
    <div className="h-screen overflow-hidden flex flex-col">
      {showScrollIndicator && (
        <button
          type="button"
          className="absolute bottom-5 left-1/2 -translate-x-1/2 px-2 bg-gray-200"
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
