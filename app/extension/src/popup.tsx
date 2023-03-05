import React, {useEffect, useState} from "react";
import ReactDOM from "react-dom";

const Popup = () => {
  const [serverUrl, setServerUrl] = useState<string>("");

  useEffect(() => {
    // Restores select box and checkbox state using the preferences
    // stored in chrome.storage.
    chrome.storage.sync.get(
      {
        serverUrl: "",
      },
      (items) => {
        setServerUrl(items.serverUrl);
      }
    );
  }, []);

  function goToOptions() {
    chrome.runtime.openOptionsPage();
  }

  function openHuntly() {
    chrome.tabs.create({'url': serverUrl})
  }

  return (
    <div style={{minWidth: "300px", minHeight: '100px', paddingTop: '10px', textAlign: "center"}}>
      {
        serverUrl && <div>
              <div>
                  Server URL: {serverUrl}
              </div>
              <div style={{marginTop: '10px'}}>
                  <button
                      onClick={openHuntly}
                      style={{marginRight: "5px"}}
                  >
                      Open Huntly
                  </button>
              </div>
          </div>
      }

      {
        !serverUrl && <div>
              <div>Huntly server url is not set yet.</div>
              <div style={{marginTop: '10px'}}>
                  <button onClick={goToOptions}>Set server url</button>
              </div>
          </div>
      }
    </div>
  );
};

ReactDOM.render(
  <React.StrictMode>
    <Popup/>
  </React.StrictMode>,
  document.getElementById("root")
);
