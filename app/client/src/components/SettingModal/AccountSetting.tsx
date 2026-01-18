import { Button, TextField } from "@mui/material";
import React from "react";
import { useFormik } from "formik";
import * as yup from "yup";
import { useSnackbar } from "notistack";
import { useQuery } from "@tanstack/react-query";
import { AuthControllerApiFactory, SettingControllerApiFactory } from "../../api";
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import SettingSectionTitle from "./SettingSectionTitle";

export default function AccountSetting() {
  const { enqueueSnackbar } = useSnackbar();
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
            anchorOrigin: { vertical: "bottom", horizontal: "center" }
          });
          setTimeout(function () {
            window.location.href = '/signin';
          }, 3000);
        } else {
          enqueueSnackbar('Update admin user success.', {
            variant: "success",
            anchorOrigin: { vertical: "bottom", horizontal: "center" }
          });
        }
      }).catch((err) => {
        enqueueSnackbar('Update admin user success failed. Error: ' + err, {
          variant: "error",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      })
    }
  })

  function signOut() {
    AuthControllerApiFactory().singOutUsingPOST().then((res) => {
      window.location.href = '/signin';
    });
  }

  return <div className="settings-form-group">
    <div className="flex justify-between items-center gap-4 pb-3 mb-4 border-b-2 border-transparent"
      style={{ borderImage: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, transparent 100%) 1' }}>
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl"
          style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)' }}>
          <PersonIcon sx={{ fontSize: 20, color: '#fff' }} />
        </div>
        <span className="font-semibold text-[#1e293b] text-[1.0625rem]">Account Settings</span>
      </div>
      <Button
        variant="outlined"
        startIcon={<LogoutIcon />}
        onClick={signOut}
        size="small"
        sx={{
          borderRadius: '10px',
          textTransform: 'none',
          fontWeight: 500,
          px: 2.5,
          py: 0.875,
          borderColor: 'rgba(239, 68, 68, 0.5)',
          color: '#ef4444',
          '&:hover': {
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.04)',
          },
        }}
      >
        Sign out
      </Button>
    </div>
    <form onSubmit={formikUpdateLogin.handleSubmit}>
      <div className="flex flex-col gap-4">
        <TextField
          autoFocus
          margin="dense"
          size="small"
          className="w-full max-w-[320px]"
          id="username"
          label="Username"
          value={formikUpdateLogin.values.username}
          onChange={formikUpdateLogin.handleChange}
          error={formikUpdateLogin.touched.username && Boolean(formikUpdateLogin.errors.username)}
          helperText={formikUpdateLogin.touched.username && formikUpdateLogin.errors.username}
          type="text"
          variant="outlined"
        />
        <TextField
          margin="dense"
          size="small"
          className="w-full max-w-[320px]"
          id="password"
          label="New Password"
          value={formikUpdateLogin.values.password}
          onChange={formikUpdateLogin.handleChange}
          error={formikUpdateLogin.touched.password && Boolean(formikUpdateLogin.errors.password)}
          helperText={formikUpdateLogin.touched.password && formikUpdateLogin.errors.password}
          type="password"
          variant="outlined"
          InputLabelProps={{
            sx: { fontSize: '0.875rem' }
          }}
        />
      </div>
      <div className="mt-6 pt-4 border-t border-gray-100">
        <Button
          type="submit"
          color="warning"
          variant="contained"
          size="medium"
        >
          Update Account
        </Button>
      </div>
    </form>
  </div>
}