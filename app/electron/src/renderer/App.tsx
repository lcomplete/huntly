import {createRoot} from "react-dom/client";

export default function App() {
  //todo add basic setting modal
  return <div>hello</div>
}

const root = createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <App/>
);