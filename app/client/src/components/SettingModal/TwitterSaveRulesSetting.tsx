import {
  Button, Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  InputAdornment, InputLabel, MenuItem,
  Select,
  TextField
} from "@mui/material";
import React from "react";
import {SettingControllerApiFactory} from "../../api";
import {useSnackbar} from "notistack";
import {Formik, Form, FieldArray, getIn} from 'formik';
import * as yup from 'yup';
import {useQuery} from "@tanstack/react-query";
import DeleteIcon from "@mui/icons-material/Delete";
import SettingSectionTitle from "./SettingSectionTitle";

export const TwitterSaveRulesSetting = () => {
  const {enqueueSnackbar} = useSnackbar();
  const api = SettingControllerApiFactory();

  const {
    data: twitterSettings,
    refetch: refetchTwitterSettings,
  } = useQuery(["twitter_settings"], async () => (await api.getTwitterUserSettingsUsingGET()).data);

  const twitterSettingsValidation = yup.object().shape({
    settings: yup.array().of(yup.object().shape({
      name: yup.string().required('Name is required.'),
      screenName: yup.string().required('Screen name is required.'),
      myself: yup.boolean().nullable(),
      tweetToLibraryType: yup.number().nullable(),
      bookmarkToLibraryType: yup.number().nullable(),
      likeToLibraryType: yup.number().nullable(),
    }))
  });

  return (
    <div>
      <SettingSectionTitle first>Twitter Save Rules</SettingSectionTitle>

      {
        twitterSettings && <Formik
          initialValues={{
            settings: !twitterSettings || twitterSettings.length == 0 ? [{
              id: null,
              name: "",
              screenName: ""
            }] : twitterSettings
          }}
          validationSchema={twitterSettingsValidation}
          onSubmit={values => {
            api.saveTwitterUserSettingsUsingPOST(values.settings).then(() => {
              enqueueSnackbar(`Twitter settings save success.`, {
                variant: "success",
                anchorOrigin: {vertical: "bottom", horizontal: "center"}
              });
            }).catch((err) => {
              enqueueSnackbar('Twitter settings save failed. Error: ' + err, {
                variant: "error",
                anchorOrigin: {vertical: "bottom", horizontal: "center"}
              });
            }).finally(() => {
              refetchTwitterSettings();
            });
          }}>
          {({values, touched, errors, handleChange, handleBlur, isValid}) => (
            <Form noValidate autoComplete="off">
              <FieldArray name="settings">
                {({push, remove}) => (
                  <div>
                    {values.settings.map((setting, index) => {
                      const name = `settings[${index}].name`;
                      const touchedName = getIn(touched, name);
                      const errorName = getIn(errors, name);

                      const screenName = `settings[${index}].screenName`;
                      const touchedScreenName = getIn(touched, screenName);
                      const errorScreenName = getIn(errors, screenName);

                      const tweetToLibraryType = `settings[${index}].tweetToLibraryType`;
                      const bookmarkToLibraryType = `settings[${index}].bookmarkToLibraryType`;
                      const likeToLibraryType = `settings[${index}].likeToLibraryType`;
                      const myself = `settings[${index}].myself`;

                      return (
                        <div key={index} className={`${index % 2 == 1 ? "bg-amber-50" : ""} p-2 sm:p-0`}>
                          <div className={'flex flex-wrap items-start gap-2'}>
                            <TextField
                              margin="normal"
                              size={'small'}
                              variant="outlined"
                              label="Name"
                              name={name}
                              value={setting.name}
                              className={'w-full sm:w-[200px]'}
                              required
                              helperText={touchedName && errorName ? errorName : ""}
                              error={Boolean(touchedName && errorName)}
                              onChange={handleChange}
                              onBlur={handleBlur}
                            />
                            <TextField
                              margin="normal"
                              className={'w-full sm:w-[200px]'}
                              size={'small'}
                              variant="outlined"
                              label="Screen name"
                              name={screenName}
                              value={setting.screenName}
                              InputProps={{
                                startAdornment: <InputAdornment position="start">@</InputAdornment>,
                              }}
                              required
                              helperText={touchedScreenName && errorScreenName ? errorScreenName : ""}
                              error={Boolean(touchedScreenName && errorScreenName)}
                              onChange={handleChange}
                              onBlur={handleBlur}
                            />
                            <div className={'flex items-center gap-2 mt-2 sm:mt-4'}>
                              <FormControlLabel
                                control={<Checkbox value={true} name={myself} onChange={handleChange}
                                                   checked={!!(setting.myself)}/>} label="Me"/>
                              <Button
                                type="button"
                                color="secondary"
                                variant="outlined"
                                size="small"
                                startIcon={<DeleteIcon/>}
                                onClick={() => remove(index)}
                              >
                                DELETE
                              </Button>
                            </div>
                          </div>
                          <div className={'flex flex-wrap gap-2 mt-2'}>
                            <FormControl className={'w-full sm:w-[200px]'} size="small">
                              <InputLabel size={'small'}>Tweets hunt</InputLabel>
                              <Select
                                name={tweetToLibraryType}
                                value={setting.tweetToLibraryType || 0}
                                label="Tweets hunt"
                                onChange={handleChange}
                                size={'small'}
                              >
                                <MenuItem value={0}>Not set</MenuItem>
                                <MenuItem value={1}>Save to my list</MenuItem>
                                <MenuItem value={2}>Save to starred</MenuItem>
                                <MenuItem value={3}>Save to read later</MenuItem>
                                <MenuItem value={4}>Save to archive</MenuItem>
                              </Select>
                            </FormControl>
                            <FormControl className={'w-full sm:w-[200px]'} size="small">
                              <InputLabel size={'small'}>Bookmarks hunt</InputLabel>
                              <Select
                                name={bookmarkToLibraryType}
                                value={setting.bookmarkToLibraryType || 0}
                                label="Bookmarks hunt"
                                onChange={handleChange}
                                size={'small'}
                              >
                                <MenuItem value={0}>Not set</MenuItem>
                                <MenuItem value={1}>Save to my list</MenuItem>
                                <MenuItem value={2}>Save to starred</MenuItem>
                                <MenuItem value={3}>Save to read later</MenuItem>
                                <MenuItem value={4}>Save to archive</MenuItem>
                              </Select>
                            </FormControl>
                            <FormControl className={'w-full sm:w-[200px]'} size="small">
                              <InputLabel size={'small'}>Likes hunt</InputLabel>
                              <Select
                                name={likeToLibraryType}
                                value={setting.likeToLibraryType || 0}
                                label="Likes hunt"
                                onChange={handleChange}
                                size={'small'}
                              >
                                <MenuItem value={0}>Not set</MenuItem>
                                <MenuItem value={1}>Save to my list</MenuItem>
                                <MenuItem value={2}>Save to starred</MenuItem>
                                <MenuItem value={3}>Save to read later</MenuItem>
                                <MenuItem value={4}>Save to archive</MenuItem>
                              </Select>
                            </FormControl>
                          </div>
                          <Divider className={'mt-3'}/>
                        </div>
                      );
                    })}
                    <Button
                      className={'mt-2'}
                      type="button"
                      variant="outlined"
                      onClick={() =>
                        push({id: null, name: "", screenName: ""})
                      }
                    >
                      Add
                    </Button>
                  </div>
                )}
              </FieldArray>
              <Divider style={{marginTop: 20, marginBottom: 20}}/>
              <Button
                type="submit"
                color="primary"
                variant="contained"
              >
                save
              </Button>
            </Form>
          )}
        </Formik>
      }
    </div>
  );
}

