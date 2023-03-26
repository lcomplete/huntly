import React, {useEffect, useState} from "react";
import './options.css';
import {Alert, Button, Divider, FormControlLabel, IconButton, Slider, Snackbar, Switch, TextField} from "@mui/material";
import * as yup from 'yup';
import {FieldArray, Form, Formik, getIn} from "formik";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from '@mui/icons-material/Add';
import {readSyncStorageSettings, ServerUrlItem, StorageSettings} from "./storage";

export type SettingsProps = {
  onOptionsChange?: (settings:StorageSettings) => void
}

export const Settings = ({onOptionsChange}: SettingsProps) => {
  const [serverUrlList, setServerUrlList] = useState<ServerUrlItem[]>([{url: ""}]);
  const [enabledServerIndex, setEnabledServerIndex] = useState<number>(0);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(true);
  const [autoSaveTweet, setAutoSaveTweet] = useState<boolean>(true);
  const [autoSaveMinScore, setAutoSaveMinScore] = useState<number>(20);
  const [autoSaveMinContentLength, setAutoSaveMinContentLength] = useState<number>(40);
  const [showSavedTip, setShowSavedTip] = useState<boolean>(false);

  useEffect(() => {
    readSyncStorageSettings().then((settings) => {
      setAutoSaveEnabled(settings.autoSaveEnabled);
      setAutoSaveMinScore(settings.autoSaveMinScore);
      setAutoSaveMinContentLength(settings.autoSaveMinContentLength);
      setAutoSaveTweet(settings.autoSaveTweet);
      if (settings.serverUrlList.length > 0) {
        setServerUrlList(settings.serverUrlList);
        settings.serverUrlList.forEach((item, index) => {
          if (item.url === settings.serverUrl) {
            setEnabledServerIndex(index);
          }
        });
      }
    });
  }, []);

  const urlValidation = yup.object().shape({
    settings: yup.array().of(yup.object().shape({
      url: yup.string().matches(
        /^(?:([a-z0-9+.-]+):\/\/)(?:\S+(?::\S*)?@)?(?:(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*\.?)(?::\d{2,5})?(?:[/?#]\S*)?$/,
        'Enter correct url!'
      ).required('Url is required.')
    })),
    autoSaveMinScore: yup.number().min(0).max(200).required('Min score is required.'),
    autoSaveMinContentLength: yup.number().min(10).max(200).required('Min content length is required.'),
    autoSaveEnabled: yup.boolean().required('Auto save enabled is required.'),
    autoSaveTweet: yup.boolean().required('Auto save tweet is required.')
  });

  return (
    <div className={'pl-6 pr-6 w-[420px] pb-6'}>
      <Snackbar open={showSavedTip} autoHideDuration={3000} anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
                onClose={() => {
                  setShowSavedTip(false)
                }}>
        <Alert severity={'success'} onClose={() => {
          setShowSavedTip(false)
        }}>Settings saved.</Alert>
      </Snackbar>
      <div>
        <div>
          <div className={'formHeader'}>Configure server <a href={'https://github.com/lcomplete/huntly'} target={'_blank'} className={'text-sm'}>How to run the server-side &gt;</a></div>
        </div>
        {<Formik
          enableReinitialize={true}
          initialValues={{
            settings: serverUrlList,
            autoSaveEnabled: autoSaveEnabled,
            autoSaveMinScore: autoSaveMinScore,
            autoSaveMinContentLength: autoSaveMinContentLength,
            autoSaveTweet: autoSaveTweet
          }}
          validationSchema={urlValidation}
          onSubmit={(values, formikHelpers) => {
            const serverUrl = values.settings[enabledServerIndex].url;
            const storageSettings: StorageSettings = {
              "serverUrl": serverUrl,
              "serverUrlList": values.settings,
              ...values
            };
            chrome.storage.sync.set(
              storageSettings,
              () => {
                setShowSavedTip(true);
                if (onOptionsChange) {
                  onOptionsChange(storageSettings);
                }
              }
            );
          }}>
          {({values, touched, errors, handleChange, handleBlur, isValid}) => (
            <Form noValidate autoComplete="off">
              <FieldArray name="settings">
                {({push, remove}) => (
                  <div>
                    {values.settings.map((setting, index) => {
                      const url = `settings[${index}].url`;
                      const touchedUrl = getIn(touched, url);
                      const errorUrl = getIn(errors, url);

                      return (
                        <div key={index} className={`${index % 2 == 1 ? "" : ""}`}>
                          <div className={'flex items-center'}>
                            <TextField
                              margin="normal"
                              size={'small'}
                              variant="outlined"
                              label="Server url"
                              name={url}
                              fullWidth={true}
                              value={setting.url}
                              className={''}
                              required
                              // helperText={
                              //   touchedUrl && errorUrl
                              //     ? errorUrl
                              //     : ""
                              // }
                              // error={Boolean(touchedUrl && errorUrl)}
                              onChange={handleChange}
                              onBlur={handleBlur}
                            />
                            <div className={'mt-2'}>
                              <Switch
                                value={true}
                                checked={index === enabledServerIndex}
                                onChange={() => {
                                  setEnabledServerIndex(index)
                                }}
                              />
                            </div>
                            <div className={'mt-2'}>
                              {
                                index == 0 ?
                                  <IconButton onClick={() => push({url: ""})} size={"small"} color={"primary"}>
                                    <AddIcon></AddIcon>
                                  </IconButton> :
                                  <IconButton onClick={() => {
                                    remove(index);
                                    if (index === enabledServerIndex) {
                                      setEnabledServerIndex(0)
                                    }
                                  }} size={"small"} color={"warning"}>
                                    <DeleteIcon></DeleteIcon>
                                  </IconButton>
                              }
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </FieldArray>
              <div>
                {
                  errors.settings && errors.settings.length > 0 ? (
                    <Alert severity="error">Url format error!</Alert>
                  ) : null
                }
              </div>

              <div>
                <div className={'formHeader mt-4'}>Auto save article</div>
              </div>
              <div>
                <FormControlLabel
                  control={<Switch value={true} checked={values.autoSaveEnabled} name={'autoSaveEnabled'}
                                   onChange={handleChange}/>} label="Enabled"/>
                <div>
                  <div className={'text-sm'}>Probably readerable min score (the default is 20)</div>
                  <Slider value={values.autoSaveMinScore} aria-label="Probably readerable min score" max={200}
                          valueLabelDisplay={"auto"} name={'autoSaveMinScore'} onChange={handleChange}/>
                </div>
                <div>
                  <div className={'text-sm'}>The minimum length of a paragraph (the default is 40)</div>
                  <Slider value={values.autoSaveMinContentLength} aria-label="The minimum length of a paragraph"
                          max={200} min={10}
                          valueLabelDisplay={"auto"} name={'autoSaveMinContentLength'} onChange={handleChange}/>
                </div>
              </div>

              <div>
                <div className={'formHeader mt-4'}>Auto save tweet</div>
              </div>
              <div>
                <FormControlLabel
                  control={<Switch value={true} checked={values.autoSaveTweet} name={'autoSaveTweet'}
                                   onChange={handleChange}/>} label="Enabled"/>
              </div>

              <Divider style={{marginTop: 5, marginBottom: 15}}/>
              <Button
                type="submit"
                color="primary"
                variant="contained"
              >
                save
              </Button>
            </Form>
          )}
        </Formik>}

      </div>
    </div>
  );
};