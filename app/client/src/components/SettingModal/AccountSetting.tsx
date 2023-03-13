import Typography from "@mui/material/Typography";
import {Button, Divider, TextField} from "@mui/material";
import React from "react";
import {useFormik} from "formik";
import * as yup from "yup";
import {useSnackbar} from "notistack";
import {useQuery} from "@tanstack/react-query";
import {AuthControllerApiFactory, SettingControllerApiFactory} from "../../api";
import LogoutIcon from '@mui/icons-material/Logout';
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";

export default function AccountSetting() {
  const {enqueueSnackbar} = useSnackbar();
  const api = SettingControllerApiFactory();

  const {
    data: currentUser
  } = useQuery(["login-info"], async () => (await AuthControllerApiFactory().loginUserInfoUsingGET()).data);

  const formikUpdateLogin = useFormik({
    enableReinitialize: true,
    initialValues: {
      username: currentUser ? currentUser.username : '',
      password: ''
    },
    validationSchema: yup.object({
      username: yup.string().required('Username is required.'),
      password: yup.string().required('Password is required'),
    }),
    onSubmit: async (values) => {
      api.updateLoginUserUsingPOST("", values).then((res) => {
        if (values.username !== currentUser.username) {
          enqueueSnackbar('Username has been changed, please sign in again.', {
            variant: "success",
            anchorOrigin: {vertical: "bottom", horizontal: "center"}
          });
          setTimeout(function () {
            window.location.href = '/signin';
          }, 3000);
        } else {
          enqueueSnackbar('Update admin user success.', {
            variant: "success",
            anchorOrigin: {vertical: "bottom", horizontal: "center"}
          });
        }
      }).catch((err) => {
        enqueueSnackbar('Update admin user success failed. Error: ' + err, {
          variant: "error",
          anchorOrigin: {vertical: "bottom", horizontal: "center"}
        });
      })
    }
  })

  function signOut() {
    AuthControllerApiFactory().singOutUsingPOST().then((res) => {
      window.location.href = '/signin';
    });
  }

  return <div>
    <Typography variant={'h6'} className={'flex justify-between items-center pb-2'}>Account
      <Button variant={'outlined'} startIcon={<LogoutIcon/>} onClick={signOut} size={"small"}>
        Sign out
      </Button>
    </Typography>
    <Divider/>
    <form onSubmit={formikUpdateLogin.handleSubmit} className={''}>
      <div className={'mt-4'}>
        <TextField
          autoFocus
          margin="dense"
          size={"small"}
          className={'w-[300px]'}
          id="username"
          label="Username"
          value={formikUpdateLogin.values.username}
          onChange={formikUpdateLogin.handleChange}
          error={formikUpdateLogin.touched.username && Boolean(formikUpdateLogin.errors.username)}
          helperText={formikUpdateLogin.touched.username && formikUpdateLogin.errors.username}
          type="text"
          variant="outlined"
        />
      </div>
      <div className={'mt-2'}>
        <TextField
          margin="dense"
          size={"small"}
          className={'w-[300px]'}
          id="password"
          label="Password"
          value={formikUpdateLogin.values.password}
          onChange={formikUpdateLogin.handleChange}
          error={formikUpdateLogin.touched.password && Boolean(formikUpdateLogin.errors.password)}
          helperText={formikUpdateLogin.touched.password && formikUpdateLogin.errors.password}
          type="password"
          variant="outlined"
        />
      </div>
      <div className={'mt-2'}>
        <Button
          type="submit"
          color="secondary"
          variant="contained"
        >
          update admin user
        </Button>
      </div>
    </form>
  </div>
}