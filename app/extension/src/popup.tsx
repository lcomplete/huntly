import React, {useEffect, useState} from "react";
import ReactDOM from "react-dom";
import './popup.css';
import EnergySavingsLeafIcon from "@mui/icons-material/EnergySavingsLeaf";
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import {Alert, Button, CircularProgress, IconButton, Tooltip} from "@mui/material";
import {readSyncStorageSettings, StorageSettings} from "./storage";
import {Options} from "./options";
import {combineUrl, getData} from "./utils";
import PersonPinIcon from '@mui/icons-material/PersonPin';

const Popup = () => {
  const [storageSettings, setStorageSettings] = useState<StorageSettings>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [username, setUsername] = useState<string>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    readSyncStorageSettings().then((settings) => {
      setSettingsState(settings);
    });
  }, []);

  function setSettingsState(settings: StorageSettings) {
    setStorageSettings(settings);
    if (!settings.serverUrl) {
      setShowOptions(true);
    } else {
      setLoadingUser(true);
      getData(settings.serverUrl, "api/auth/loginUserInfo").then((data) => {
        const result = JSON.parse(data);
        setUsername(result.username);
      }).catch(() => {
        setUsername(null);
      }).finally(() => {
        setLoadingUser(false);
      });
    }
  }

  function toggleShowOptions() {
    setShowOptions(!showOptions);
    // chrome.runtime.openOptionsPage();
  }

  function getDomain(serverUrl: string) {
    const url = new URL(serverUrl);
    return url.hostname;
  }

  function handleOptionsChange(settings: StorageSettings) {
    setShowOptions(false);
    setSettingsState(settings);
  }

  function openSignIn() {
    chrome.tabs.create({url: combineUrl(storageSettings.serverUrl, "/signin")});
  }

  function openHuntly() {
    chrome.tabs.create({url: storageSettings.serverUrl});
  }

  return (
    <div style={{minWidth: "450px", minHeight: '200px'}}>
      <div className={'commonPadding header'}>
        <div className="flex items-center text-sky-600 font-bold">
          <EnergySavingsLeafIcon className="h-4 w-4 mr-1"/>
          Huntly
          {
            storageSettings && storageSettings.serverUrl && <div>
              <a className={'ml-1 text-sm text-sky-500 no-underline hover:underline'} href={storageSettings.serverUrl}
                 target={"_blank"}>{getDomain(storageSettings.serverUrl)} &gt;</a>
            </div>
          }
        </div>
        <div className={'flex items-center'}>
          {
            !loadingUser && username && <Tooltip title={'You are signed in.'} placement={'bottom'}>
              <IconButton onClick={openHuntly}>
                <PersonPinIcon className={'text-sky-600'}/>
              </IconButton>
            </Tooltip>
          }
          <IconButton onClick={toggleShowOptions}>
            <SettingsOutlinedIcon className={'text-sky-600'}/>
          </IconButton>
        </div>
      </div>

      <div className={'commonPadding'}>
        {
          !storageSettings || !storageSettings.serverUrl && <div className={'mb-2'}>
            <Alert severity={'info'}>Please set the huntly server url first.</Alert>
          </div>
        }
        {
          showOptions && <div>
            <Options onOptionsChange={handleOptionsChange}></Options>
          </div>
        }
        {
          !showOptions && <div>
            {
              loadingUser && <div className={'flex justify-center items-center h-[120px]'}>
                <CircularProgress/>
              </div>
            }
            {
              !loadingUser && !username && <div>
                <div className={'mt-5'}>
                  <Alert severity={'info'}>Please sign in to start.</Alert>
                </div>
                <div className={'mt-5 mb-10'}>
                  <Button fullWidth={true} color={"primary"} variant={'contained'} onClick={openSignIn}>Sign In</Button>
                </div>
              </div>
            }
            {
              !loadingUser && username && <div>

              </div>
            }
          </div>
        }
      </div>
    </div>
  );
};

ReactDOM.render(
  <Popup/>,
  document.getElementById("root")
);
