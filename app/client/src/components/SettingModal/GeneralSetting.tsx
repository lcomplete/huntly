
import { useSnackbar } from "notistack";
import { useQuery } from "@tanstack/react-query";
import { SettingControllerApiFactory } from "../../api";
import { useFormik } from "formik";
import * as yup from "yup";
import {
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  TextField,
  Tooltip
} from "@mui/material";
import React from "react";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SettingSectionTitle from "./SettingSectionTitle";

export default function GeneralSetting() {
  const { enqueueSnackbar } = useSnackbar();
  const api = SettingControllerApiFactory();
  const [needChangeOpenApiKey, setNeedChangeOpenApiKey] = React.useState(false);

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
      proxyPort: yup.number().nullable().min(1, 'Proxy port can\'t less than 1'),
      coldDataKeepDays: yup.number().min(1, 'Cold data retention days can\'t less than 1'),
      enableProxy: yup.boolean().nullable(),
      openApiKey: yup.string().nullable(),
      openApiBaseUrl: yup.string().nullable(),
      openApiModel: yup.string().nullable(),
      autoSaveSiteBlacklists: yup.string().nullable()
    }),
    onSubmit: async (values) => {
      // 只有当 API 密钥真正改变时才设置 changedOpenApiKey 为 true
      // 考虑两个都为空/null 的情况，以及从有值变为空值的情况
      const initialKey = formikGeneral.initialValues.openApiKey || "";
      const currentKey = values.openApiKey || "";
      values.changedOpenApiKey = initialKey !== currentKey;
      api.saveGlobalSettingUsingPOST(values).then((res) => {
        enqueueSnackbar('General setting save success.', {
          variant: "success",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      }).catch((err) => {
        enqueueSnackbar('General setting save failed. Error: ' + err, {
          variant: "error",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      })
    }
  })

  return <div>
    <form onSubmit={formikGeneral.handleSubmit} className={''}>
      <SettingSectionTitle first>AI Service Provider</SettingSectionTitle>

      <div className={'mt-2 flex items-center'}>
        <TextField
          margin="dense"
          size={"small"}
          fullWidth={true}
          className={''}
          id="openApiKey"
          label="API Key"
          value={formikGeneral.values.openApiKey || ""}
          onChange={formikGeneral.handleChange}
          error={formikGeneral.touched.openApiKey && Boolean(formikGeneral.errors.openApiKey)}
          helperText={formikGeneral.touched.openApiKey && formikGeneral.errors.openApiKey}
          type="text"
          variant="outlined"
          disabled={(formikGeneral.initialValues.openApiKey && formikGeneral.initialValues.openApiKey.length > 0) && !needChangeOpenApiKey}
        />
        {
          formikGeneral.initialValues.openApiKey && formikGeneral.initialValues.openApiKey.length > 0 &&
          <div>
            <Button onClick={() => { setNeedChangeOpenApiKey(true) }}>Change</Button>
          </div>
        }
      </div>

      <div className={'mt-2 flex items-center'}>
        <TextField
          margin="dense"
          size={"small"}
          className={'w-[400px]'}
          id="openApiBaseUrl"
          label="API URL"
          value={formikGeneral.values.openApiBaseUrl || ""}
          onChange={formikGeneral.handleChange}
          error={formikGeneral.touched.openApiBaseUrl && Boolean(formikGeneral.errors.openApiBaseUrl)}
          helperText={formikGeneral.touched.openApiBaseUrl && formikGeneral.errors.openApiBaseUrl}
          type="text"
          variant="outlined"
        />
        <TextField
          margin="dense"
          size={"small"}
          className={'w-[200px] ml-2'}
          id="openApiModel"
          label="API Model"
          value={formikGeneral.values.openApiModel || ""}
          onChange={formikGeneral.handleChange}
          error={formikGeneral.touched.openApiModel && Boolean(formikGeneral.errors.openApiModel)}
          helperText={formikGeneral.touched.openApiModel && formikGeneral.errors.openApiModel}
          type="text"
          variant="outlined"
        />
        <Tooltip title="Optional settings for custom OpenAI-compatible APIs" placement="right">
          <IconButton size="small" className={'ml-2'}>
            <HelpOutlineIcon className={'text-gray-400'} />
          </IconButton>
        </Tooltip>
      </div>

      <SettingSectionTitle>Http Proxy</SettingSectionTitle>
      <div className={'mt-3 flex items-center'}>
        <TextField
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
            checked={!!formikGeneral.values.enableProxy} />
          }
          label="Enable" />
      </div>



      <SettingSectionTitle>Automation</SettingSectionTitle>
      <div className={'mt-2 flex items-center'}>
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
        <Tooltip title="Cold data: Unsaved browser history articles." placement="right">
          <IconButton size="small" className={'ml-2'}>
            <HelpOutlineIcon className={'text-gray-400'} />
          </IconButton>
        </Tooltip>
      </div>

      <SettingSectionTitle>Website Blacklist</SettingSectionTitle>

      <div className={'mt-2 flex items-center'}>
        <TextField
          margin="dense"
          size={"small"}
          fullWidth={true}
          className={''}
          id="autoSaveSiteBlacklists"
          label="Blacklist, Prevent automatic saving, One per line, supports regular expressions."
          value={formikGeneral.values.autoSaveSiteBlacklists || ""}
          onChange={formikGeneral.handleChange}
          error={formikGeneral.touched.autoSaveSiteBlacklists && Boolean(formikGeneral.errors.autoSaveSiteBlacklists)}
          helperText={formikGeneral.touched.autoSaveSiteBlacklists && formikGeneral.errors.autoSaveSiteBlacklists}
          type="text"
          multiline={true}
          rows={6}
          variant="outlined"
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
    </form >
  </div >
}