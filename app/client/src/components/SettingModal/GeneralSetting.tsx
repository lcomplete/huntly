
import { useSnackbar } from "notistack";
import { useQuery } from "@tanstack/react-query";
import { SettingControllerApiFactory } from "../../api";
import { useFormik } from "formik";
import * as yup from "yup";
import {
  Button,
  Checkbox,
  FormControlLabel,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip
} from "@mui/material";
import React from "react";
import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '../../i18n';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import RouterIcon from '@mui/icons-material/Router';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import BlockIcon from '@mui/icons-material/Block';
import TranslateIcon from '@mui/icons-material/Translate';
import SettingSectionTitle from "./SettingSectionTitle";

export default function GeneralSetting() {
  const { t, i18n } = useTranslation('settings');
  const { t: tCommon } = useTranslation('common');
  const { enqueueSnackbar } = useSnackbar();
  const api = SettingControllerApiFactory();
  const [needChangeOpenApiKey, setNeedChangeOpenApiKey] = React.useState(false);
  const apiKeyInputRef = React.useRef<HTMLInputElement>(null);

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
      proxyPort: yup.number().nullable().min(1, t('proxyPortMin')),
      coldDataKeepDays: yup.number().min(1, t('coldDataRetentionMin')),
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
        enqueueSnackbar(t('saveSuccess'), {
          variant: "success",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      }).catch((err) => {
        enqueueSnackbar(t('saveFailed', { error: err }), {
          variant: "error",
          anchorOrigin: { vertical: "bottom", horizontal: "center" }
        });
      })
    }
  })

  const handleLanguageChange = (event: any) => {
    const newLang = event.target.value;
    i18n.changeLanguage(newLang);
  };

  return <div className="settings-form-group">
    <form onSubmit={formikGeneral.handleSubmit}>
      <SettingSectionTitle first icon={TranslateIcon}>{t('language')}</SettingSectionTitle>
      <div className="mt-2 mb-2">
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="language-select-label">{t('language')}</InputLabel>
          <Select
            labelId="language-select-label"
            id="language-select"
            value={i18n.language?.startsWith('zh') ? 'zh-CN' : i18n.language || 'en'}
            label={t('language')}
            onChange={handleLanguageChange}
          >
            {supportedLanguages.map((lang) => (
              <MenuItem key={lang.code} value={lang.code}>
                {lang.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </div>

      <SettingSectionTitle icon={SmartToyIcon}>{t('aiServiceProvider')}</SettingSectionTitle>

      <div className="flex items-center gap-2 mt-1">
        <TextField
          margin="dense"
          size="small"
          fullWidth={true}
          id="openApiKey"
          label={t('apiKey')}
          value={formikGeneral.values.openApiKey || ""}
          onChange={formikGeneral.handleChange}
          error={formikGeneral.touched.openApiKey && Boolean(formikGeneral.errors.openApiKey)}
          helperText={formikGeneral.touched.openApiKey && formikGeneral.errors.openApiKey}
          type="text"
          variant="outlined"
          disabled={(formikGeneral.initialValues.openApiKey && formikGeneral.initialValues.openApiKey.length > 0) && !needChangeOpenApiKey}
          inputRef={apiKeyInputRef}
        />
        {
          formikGeneral.initialValues.openApiKey && formikGeneral.initialValues.openApiKey.length > 0 &&
          <Button
            onClick={() => {
              setNeedChangeOpenApiKey(true);
              formikGeneral.setFieldValue('openApiKey', '');
              setTimeout(() => {
                apiKeyInputRef.current?.focus();
              }, 0);
            }}
            size="small"
            sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
          >{tCommon('change')}</Button>
        }
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-1">
        <TextField
          margin="dense"
          size="small"
          className="w-full sm:w-[320px]"
          id="openApiBaseUrl"
          label={t('apiUrl')}
          value={formikGeneral.values.openApiBaseUrl || ""}
          onChange={formikGeneral.handleChange}
          error={formikGeneral.touched.openApiBaseUrl && Boolean(formikGeneral.errors.openApiBaseUrl)}
          helperText={formikGeneral.touched.openApiBaseUrl && formikGeneral.errors.openApiBaseUrl}
          type="text"
          variant="outlined"
        />
        <TextField
          margin="dense"
          size="small"
          className="w-full sm:w-[180px]"
          id="openApiModel"
          label={t('apiModel')}
          value={formikGeneral.values.openApiModel || ""}
          onChange={formikGeneral.handleChange}
          error={formikGeneral.touched.openApiModel && Boolean(formikGeneral.errors.openApiModel)}
          helperText={formikGeneral.touched.openApiModel && formikGeneral.errors.openApiModel}
          type="text"
          variant="outlined"
        />
        <Tooltip title={t('apiCustomHint')} placement="right">
          <IconButton size="small" sx={{ color: '#94a3b8' }}>
            <HelpOutlineIcon />
          </IconButton>
        </Tooltip>
      </div>

      <SettingSectionTitle icon={RouterIcon}>{t('httpProxy')}</SettingSectionTitle>
      <div className="flex flex-wrap items-center gap-3 mt-1">
        <TextField
          margin="dense"
          size={"small"}
          className={'w-[200px]'}
          id="proxyHost"
          label={t('proxyHost')}
          value={formikGeneral.values.proxyHost || ""}
          onChange={formikGeneral.handleChange}
          error={formikGeneral.touched.proxyHost && Boolean(formikGeneral.errors.proxyHost)}
          helperText={formikGeneral.touched.proxyHost && formikGeneral.errors.proxyHost}
          type="text"
          variant="outlined"
        />
        <TextField
          margin="dense"
          className={'w-[200px]'}
          id="proxyPort"
          label={t('proxyPort')}
          value={formikGeneral.values.proxyPort || ''}
          onChange={formikGeneral.handleChange}
          error={formikGeneral.touched.proxyPort && Boolean(formikGeneral.errors.proxyHost)}
          helperText={formikGeneral.touched.proxyPort && formikGeneral.errors.proxyPort}
          type="number"
          variant="outlined"
          size={"small"}
        />
        <FormControlLabel
          control={<Checkbox value={true} name={'enableProxy'} onChange={formikGeneral.handleChange}
            checked={!!formikGeneral.values.enableProxy} />
          }
          label={tCommon('enable')} />
      </div>



      <SettingSectionTitle icon={AutoModeIcon}>{t('automation')}</SettingSectionTitle>
      <div className="flex items-center gap-2 mt-1">
        <TextField
          margin="dense"
          size="small"
          className="w-full sm:w-[220px]"
          id="coldDataKeepDays"
          label={t('coldDataRetentionDays')}
          value={formikGeneral.values.coldDataKeepDays || 0}
          onChange={formikGeneral.handleChange}
          error={formikGeneral.touched.coldDataKeepDays && Boolean(formikGeneral.errors.coldDataKeepDays)}
          helperText={formikGeneral.touched.coldDataKeepDays && formikGeneral.errors.coldDataKeepDays}
          type="number"
          variant="outlined"
        />
        <Tooltip title={t('coldDataHint')} placement="right">
          <IconButton size="small" sx={{ color: '#94a3b8' }}>
            <HelpOutlineIcon />
          </IconButton>
        </Tooltip>
      </div>

      <SettingSectionTitle icon={BlockIcon}>{t('websiteBlacklist')}</SettingSectionTitle>

      <div className="mt-1">
        <TextField
          margin="dense"
          size="small"
          fullWidth={true}
          id="autoSaveSiteBlacklists"
          label={t('blacklistLabel')}
          value={formikGeneral.values.autoSaveSiteBlacklists || ""}
          onChange={formikGeneral.handleChange}
          error={formikGeneral.touched.autoSaveSiteBlacklists && Boolean(formikGeneral.errors.autoSaveSiteBlacklists)}
          helperText={formikGeneral.touched.autoSaveSiteBlacklists && formikGeneral.errors.autoSaveSiteBlacklists}
          type="text"
          multiline={true}
          rows={5}
          variant="outlined"
        />
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100">
        <Button
          type="submit"
          color="primary"
          variant="contained"
          sx={{
            borderRadius: '10px',
            textTransform: 'none',
            fontWeight: 600,
            px: 4,
            py: 1.25,
            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
            '&:hover': {
              boxShadow: '0 4px 8px rgba(59, 130, 246, 0.3)',
              transform: 'translateY(-1px)',
            },
            transition: 'all 0.2s ease',
          }}
        >
          {tCommon('saveChanges')}
        </Button>
      </div>
    </form >
  </div >
}