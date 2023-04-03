import {createRoot} from "react-dom/client";
import {useEffect, useState} from "react";

export default function App() {
  const {utilsBridge} = window.electron;
  const [loadingServer, setLoadingServer] = useState(true);

  useEffect(() => {
    utilsBridge.startServer();
    location.href = "http://localhost:" + utilsBridge.getServerPort();
  }, []);

  return <div>
    {loadingServer && <div>loading server...</div>}
  </div>;
}

const root = createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <App/>
);