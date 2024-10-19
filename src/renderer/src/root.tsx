import { useEffect } from "react";

function App(): JSX.Element {
  useEffect(() => {
    const { port1, port2 } = new MessageChannel();
    window.electron.ipcRenderer.postMessage("start-chat-stream", {}, [port2]);
    port1.onmessage = (event) => {
      console.log(event.data);
    };
    return () => {
      port1.close();
      port2.close();
    };
  }, []);

  return (
    <h1 className="text-4xl">
      Hello world!
    </h1>
  );
}

export default App;
