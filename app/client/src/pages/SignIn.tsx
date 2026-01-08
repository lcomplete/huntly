import {
  Button,
  Paper,
  TextField
} from "@mui/material";
import React, {useEffect, useState} from "react";
import {useFormik} from "formik";
import * as yup from "yup";

import {setDocTitle} from "../common/docUtils";
import {AuthControllerApiFactory} from "../api";
import {useSearchParams} from "react-router-dom";
import {useSnackbar} from "notistack";

export default function SignIn() {
  setDocTitle("Sign in");
  const [isUserSet, setIsUserSet] = useState(true);
  const {enqueueSnackbar} = useSnackbar();
  const api = AuthControllerApiFactory();
  const [params,setParams] = useSearchParams();

  useEffect(() => {
    api.isUserSetUsingGET().then(res => {
      setIsUserSet(res.data.data);
    });
  }, []);


  const formikLogin = useFormik({
    enableReinitialize: true,
    initialValues: {
      username: '',
      password: ''
    },
    validationSchema: yup.object({
      username: yup.string().required('Username is required.'),
      password: yup.string().required('Password is required'),
    }),
    onSubmit: async (values) => {
      let canLogin = true;
      if (!isUserSet) {
        canLogin = false;
        const signupRes = await api.signupUsingPOST(values);
        if (signupRes.data.code === 0) {
          canLogin = true;
          setIsUserSet(true);
          enqueueSnackbar('Create user success.', {
            variant: "success",
            anchorOrigin: {vertical: "bottom", horizontal: "center"}
          });
        }
      }
      if (canLogin) {
        api.signinUsingPOST(values).then((loginRes) => {
          if (loginRes.data.code === 0) {
            if(params.get("from")!=null){
              window.location.href = params.get("from");
            }
            else {
              window.location.href = '/';
            }
          }
        }).catch((err)=>{
          enqueueSnackbar('Login failed. Error: ' + err, {
            variant: "error",
            anchorOrigin: {vertical: "bottom", horizontal: "center"}
          });
        })
      }
    }
  })

  return <div className={'flex items-center justify-center h-full bg-[#fafafa]'}>
    <Paper className={'w-[530px] flex justify-center'} elevation={4}>
      <div className={'w-9/12'}>
        <form onSubmit={formikLogin.handleSubmit} className={''}>
          <div className="mt-8 flex justify-center">
            <img src="/android-chrome-192x192.png" alt="Huntly" className="h-[50px] w-[50px]" />
          </div>
          <div className={'flex justify-center'}>
            <h1>Sign In</h1>
          </div>

          <div>
            <TextField
              autoFocus
              margin="dense"
              id="username"
              label="Username"
              value={formikLogin.values.username}
              onChange={formikLogin.handleChange}
              error={formikLogin.touched.username && Boolean(formikLogin.errors.username)}
              helperText={formikLogin.touched.username && formikLogin.errors.username}
              type="text"
              fullWidth
              variant="outlined"
            />
          </div>
          <div className={'mt-2'}>
            <TextField
              margin="dense"
              id="password"
              label="Password"
              value={formikLogin.values.password}
              onChange={formikLogin.handleChange}
              error={formikLogin.touched.password && Boolean(formikLogin.errors.password)}
              helperText={formikLogin.touched.password && formikLogin.errors.password}
              type="password"
              fullWidth={true}
              variant="outlined"
            />
          </div>
          <div className={'mt-8'}>
            {isUserSet &&
                <Button
                    type="submit"
                    color="primary"
                    variant="contained"
                    fullWidth={true}
                >
                    sign in
                </Button>
            }
            {
              !isUserSet && <Button
                    type="submit"
                    color="secondary"
                    variant="contained"
                    fullWidth={true}
                >
                    create admin user
                </Button>
            }
          </div>
        </form>

        <div className={'text-center mt-20 mb-6 text-gray-400'}>Copyright © <a
          href={'https://twitter.com/lcomplete_wild'} target={'_blank'}
          className={'text-sky-600 hover:underline'}>lcomplete</a> 2023.
        </div>
      </div>
    </Paper>
  </div>
}