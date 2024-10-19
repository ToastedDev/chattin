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
  const [messages, setMessages] = useState<Message[]>([]);

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

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <div
        className="flex-grow p-4 overflow-y-auto"
      >
        {messages.map(message => <Message key={message.id + message.content} message={message} />)}
      </div>
    </div>
  );
}

export default App;
