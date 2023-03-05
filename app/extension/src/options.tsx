import React, {useEffect, useState} from "react";
import ReactDOM from "react-dom";
import styles from './options.css';

const Options = () => {
  const [serverUrl, setServerUrl] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    // Restores select box and checkbox state using the preferences
    // stored in chrome.storage.
    chrome.storage.sync.get(
      {
        "serverUrl": "",
      },
      (items) => {
        setServerUrl(items.serverUrl);
      }
    );
  }, []);

  const saveOptions = () => {
    // Saves options to chrome.storage.sync.
    chrome.storage.sync.set(
      {
        "serverUrl": serverUrl,
      },
      () => {
        // Update status to let user know options were saved.
        setStatus("Options saved.");
        const id = setTimeout(() => {
          setStatus("");
        }, 5000);
        return () => clearTimeout(id);
      }
    );
  };

  return (
    <div className={styles.formWrapper}>
      <div>
        <label htmlFor={'serverUrl'}>
          Server url:
        </label>
        <input
          id={'serverUrl'}
          type={'text'}
          value={serverUrl}
          onChange={(event) => setServerUrl(event.target.value)}
        >
        </input>
      </div>
      <div>
        <label></label>
        <button onClick={saveOptions}>Save</button>
      </div>
      <div style={{marginTop:'12px',height:'20px',textAlign:'center',color:"rgb(59 130 246 / 0.5)"}}>{status}</div>
    </div>
  );
};

ReactDOM.render(
  <React.StrictMode>
    <Options/>
  </React.StrictMode>,
  document.getElementById("root")
);
