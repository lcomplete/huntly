import {useSnackbar} from "notistack";
import {useQuery} from "@tanstack/react-query";
import {SettingControllerApiFactory} from "../../api";
import {useFormik} from "formik";
import * as yup from "yup";
import Typography from "@mui/material/Typography";
import {Button, Checkbox, Divider, FormControlLabel, TextField} from "@mui/material";
import React from "react";
import Alert from "@mui/material/Alert";

export default function GeneralSetting() {
  const {enqueueSnackbar} = useSnackbar();
  const api = SettingControllerApiFactory();

  const {
    data: globalSetting
  } = useQuery(["global-setting"], async () => (await api.getGlobalSettingUsingGET()).data);

  const formikGeneral = useFormik({
    enableReinitialize: true,
    initialValues: {
      ...(globalSetting || {})
    },
    validationSchema: yup.object({
      proxyHost: yup.string().nullable(),
      proxyPort: yup.number().nullable().min(1,'Proxy port can\'t less than 1'),
      coldDataKeepDays: yup.number().min(1, 'Cold data retention days can\'t less than 1'),
      enableProxy: yup.boolean().nullable(),
    }),
    onSubmit: async (values) => {
      api.saveGlobalSettingUsingPOST(values).then((res) => {
        enqueueSnackbar('General setting save success.', {
          variant: "success",
          anchorOrigin: {vertical: "bottom", horizontal: "center"}
        });
      }).catch((err) => {
        enqueueSnackbar('General setting save failed. Error: ' + err, {
          variant: "error",
          anchorOrigin: {vertical: "bottom", horizontal: "center"}
        });
      })
    }
  })

  return <div>
    <form onSubmit={formikGeneral.handleSubmit} className={''}>
      <Typography variant={'h6'} className={''}>
        Http Proxy
      </Typography>
      <Divider/>
      <div className={'mt-3 flex items-center'}>
        <TextField
          autoFocus
          margin="dense"
          size={"small"}
          className={'w-[200px]'}
          id="proxyHost"
          label="Proxy host"
          value={formikGeneral.values.proxyHost || ""}
          onChange={formikGeneral.handleChange}
          error={formikGeneral.touched.proxyHost && Boolean(formikGeneral.errors.proxyHost)}
          helperText={formikGeneral.touched.proxyHost && formikGeneral.errors.proxyHost}
          type="text"
          variant="outlined"
        />
        <TextField
          margin="dense"
          className={'w-[200px] ml-2'}
          id="proxyPort"
          label="Proxy port"
          value={formikGeneral.values.proxyPort || ''}
          onChange={formikGeneral.handleChange}
          error={formikGeneral.touched.proxyPort && Boolean(formikGeneral.errors.proxyHost)}
          helperText={formikGeneral.touched.proxyPort && formikGeneral.errors.proxyPort}
          type="number"
          variant="outlined"
          size={"small"}
        />
        <FormControlLabel className={'ml-2'}
                          control={<Checkbox value={true} name={'enableProxy'} onChange={formikGeneral.handleChange}
                                             checked={!!formikGeneral.values.enableProxy}/>
                          }
                          label="Enable"/>
      </div>
      <Typography variant={'h6'} className={'mt-4'}>
        Automation
      </Typography>
      <Divider/>
      <div className={'mt-2 mb-2'}>
        <Alert severity={"info"}>Browser history articles not saved to the library</Alert>
      </div>
      <div className={'mt-2'}>
        <TextField
          margin="dense"
          className={'w-[200px]'}
          id="coldDataKeepDays"
          label="Cold data retention days"
          value={formikGeneral.values.coldDataKeepDays || 0}
          onChange={formikGeneral.handleChange}
          error={formikGeneral.touched.coldDataKeepDays && Boolean(formikGeneral.errors.coldDataKeepDays)}
          helperText={formikGeneral.touched.coldDataKeepDays && formikGeneral.errors.coldDataKeepDays}
          type="number"
          variant="outlined"
          size={"small"}
        />
      </div>
      <div className={'mt-2'}>
        <Button
          type="submit"
          color="primary"
          variant="contained"
        >
          Save
        </Button>
      </div>
    </form>
  </div>
}