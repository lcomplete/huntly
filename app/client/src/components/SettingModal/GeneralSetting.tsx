import { useSnackbar } from "notistack";
import { useQuery } from "@tanstack/react-query";
import { SettingControllerApiFactory } from "../../api";
import { useFormik } from "formik";
import * as yup from "yup";
import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormControl,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography
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
import BackupIcon from '@mui/icons-material/Backup';
import DownloadIcon from '@mui/icons-material/Download';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SettingSectionTitle from "./SettingSectionTitle";
import { DatabaseBackupInfo, fetchDatabaseBackups, getDatabaseBackupDownloadUrl } from "../../api/databaseBackup";

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleString();
}

export default function GeneralSetting() {
  const { t, i18n } = useTranslation('settings');
  const { t: tCommon } = useTranslation('common');
  const { enqueueSnackbar } = useSnackbar();
  const api = SettingControllerApiFactory();
  const [needChangeOpenApiKey, setNeedChangeOpenApiKey] = React.useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = React.useState(false);
  const [backupFiles, setBackupFiles] = React.useState<DatabaseBackupInfo[]>([]);
  const [backupFilesLoading, setBackupFilesLoading] = React.useState(false);
  const [backupFilesError, setBackupFilesError] = React.useState<string | null>(null);
  const apiKeyInputRef = React.useRef<HTMLInputElement>(null);

  const {
    data: globalSetting
  } = useQuery(["global-setting"], async () => (await api.getGlobalSettingUsingGET()).data);

  const formikGeneral = useFormik({
    enableReinitialize: true,
    initialValues: {
      ...(globalSetting || {}),
      enableDatabaseBackup: globalSetting?.enableDatabaseBackup || false,
      backupKeepCount: globalSetting?.backupKeepCount || 3,
      backupTime: globalSetting?.backupTime || "02:00"
    },
    validationSchema: yup.object({
      proxyHost: yup.string().nullable(),
      proxyPort: yup.number().nullable().min(1, t('proxyPortMin')),
      coldDataKeepDays: yup.number().min(1, t('coldDataRetentionMin')),
      enableProxy: yup.boolean().nullable(),
      openApiKey: yup.string().nullable(),
      openApiBaseUrl: yup.string().nullable(),
      openApiModel: yup.string().nullable(),
      autoSaveSiteBlacklists: yup.string().nullable(),
      enableDatabaseBackup: yup.boolean().nullable(),
      backupPath: yup.string().nullable().when('enableDatabaseBackup', {
        is: true,
        then: yup.string().nullable().required(t('backupPathRequired')),
      }),
      backupKeepCount: yup.number().nullable().min(1, t('backupKeepCountMin')),
      backupTime: yup.string().nullable().matches(/^([01]\d|2[0-3]):[0-5]\d$/, t('backupTimeInvalid'))
    }),
    onSubmit: async (values) => {
      // 只有当 API 密钥真正改变时才设置 changedOpenApiKey 为 true
      // 考虑两个都为空/null 的情况，以及从有值变为空值的情况
      const initialKey = formikGeneral.initialValues.openApiKey || "";
      const currentKey = values.openApiKey || "";
      const savedValues = {
        ...values,
        changedOpenApiKey: initialKey !== currentKey,
        enableDatabaseBackup: !!values.enableDatabaseBackup,
        backupKeepCount: values.backupKeepCount || 3,
        backupTime: values.backupTime || "02:00"
      };
      api.saveGlobalSettingUsingPOST(savedValues).then((res) => {
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

  const loadBackupFiles = React.useCallback(async () => {
    try {
      setBackupFilesLoading(true);
      setBackupFilesError(null);
      setBackupFiles(await fetchDatabaseBackups());
    } catch (error) {
      console.error('Failed to load database backups', error);
      setBackupFilesError(t('backupListLoadFailed'));
    } finally {
      setBackupFilesLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    if (backupDialogOpen) {
      loadBackupFiles();
    }
  }, [backupDialogOpen, loadBackupFiles]);

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

      <SettingSectionTitle icon={BackupIcon}>{t('databaseBackup')}</SettingSectionTitle>
      <div className="flex flex-wrap items-center gap-3 mt-1">
        <FormControlLabel
          control={<Checkbox value={true} name={'enableDatabaseBackup'} onChange={formikGeneral.handleChange}
            checked={!!formikGeneral.values.enableDatabaseBackup} />
          }
          label={t('enableDatabaseBackup')} />
        <Link
          component="button"
          type="button"
          onClick={() => setBackupDialogOpen(true)}
          underline="hover"
          color="primary"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          <FolderOpenIcon sx={{ fontSize: 18 }} />
          {t('viewBackups')}
        </Link>
      </div>
      {formikGeneral.values.enableDatabaseBackup && (
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <TextField
            margin="dense"
            size="small"
            className="w-full sm:w-[320px]"
            id="backupPath"
            label={t('backupPath')}
            value={formikGeneral.values.backupPath || ""}
            onChange={formikGeneral.handleChange}
            error={formikGeneral.touched.backupPath && Boolean(formikGeneral.errors.backupPath)}
            helperText={formikGeneral.touched.backupPath && formikGeneral.errors.backupPath}
            type="text"
            variant="outlined"
          />
          <TextField
            margin="dense"
            size="small"
            className="w-full sm:w-[160px]"
            id="backupTime"
            label={t('backupTime')}
            value={formikGeneral.values.backupTime || "02:00"}
            onChange={formikGeneral.handleChange}
            error={formikGeneral.touched.backupTime && Boolean(formikGeneral.errors.backupTime)}
            helperText={formikGeneral.touched.backupTime && formikGeneral.errors.backupTime}
            type="time"
            variant="outlined"
            InputLabelProps={{ shrink: true }}
            inputProps={{ step: 60 }}
          />
          <TextField
            margin="dense"
            size="small"
            className="w-full sm:w-[180px]"
            id="backupKeepCount"
            label={t('backupKeepCount')}
            placeholder={t('backupKeepCountPlaceholder') || "3"}
            value={formikGeneral.values.backupKeepCount === undefined || formikGeneral.values.backupKeepCount === null ? "" : formikGeneral.values.backupKeepCount}
            onChange={formikGeneral.handleChange}
            error={formikGeneral.touched.backupKeepCount && Boolean(formikGeneral.errors.backupKeepCount)}
            helperText={formikGeneral.touched.backupKeepCount && formikGeneral.errors.backupKeepCount}
            type="number"
            variant="outlined"
          />
          <Tooltip title={t('backupPathHint')} placement="right">
            <IconButton size="small" sx={{ color: '#94a3b8' }}>
              <HelpOutlineIcon />
            </IconButton>
          </Tooltip>
        </div>
      )}

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
    <Dialog open={backupDialogOpen} onClose={() => setBackupDialogOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>{t('backupListTitle')}</DialogTitle>
      <DialogContent dividers>
        {backupFilesLoading && (
          <div className="flex items-center gap-3 py-4">
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">{tCommon('loading')}</Typography>
          </div>
        )}
        {!backupFilesLoading && backupFilesError && (
          <Alert severity="error">{backupFilesError}</Alert>
        )}
        {!backupFilesLoading && !backupFilesError && backupFiles.length === 0 && (
          <Alert severity="info">{t('noBackups')}</Alert>
        )}
        {!backupFilesLoading && !backupFilesError && backupFiles.length > 0 && (
          <div className="divide-y divide-gray-100">
            {backupFiles.map((backupFile) => (
              <div key={backupFile.fileName} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {backupFile.fileName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatBytes(backupFile.sizeBytes)}{backupFile.createdAt ? ` · ${formatDateTime(backupFile.createdAt)}` : ""}
                  </Typography>
                </div>
                {backupFile.fileName && (
                  <Button
                    component="a"
                    href={getDatabaseBackupDownloadUrl(backupFile.fileName)}
                    target="_blank"
                    rel="noreferrer"
                    size="small"
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    sx={{ flexShrink: 0, textTransform: 'none' }}
                  >
                    {t('downloadBackup')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setBackupDialogOpen(false)}>{tCommon('close')}</Button>
      </DialogActions>
    </Dialog>
  </div >
}