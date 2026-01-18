import {
  Button, Checkbox,
  Dialog,
  DialogActions,
  DialogTitle,
  FormControlLabel,
  TextField
} from "@mui/material";
import { useState } from "react";
import { SettingControllerApiFactory } from "../../api";
import { useSnackbar } from "notistack";
import { useFormik } from 'formik';
import * as yup from 'yup';
import { useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import GitHubIcon from '@mui/icons-material/GitHub';
import SettingSectionTitle from "./SettingSectionTitle";

export const GithubSetting = () => {
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const api = SettingControllerApiFactory();

  const {
    data: githubSetting,
    refetch: refetchTokenResult,
  } = useQuery(["github_setting"], async () => (await api.getGitHubSettingUsingGET()).data);

  const formikGithub = useFormik({
    initialValues: {
      ...(githubSetting || {})
    },
    validationSchema: yup.object({
      name: yup.string().required('Name is required.'),
      apiToken: yup.string().nullable(),
      enabled: yup.boolean().nullable(),
      fetchIntervalMinutes: yup.number().min(1, "Fetch interval can't less than 1.").required('Fetch interval is required.'),
      fetchPageSize: yup.number().min(1, "Fetch page size can't less than 1.").required('Fetch page size is required.')
    }),
    onSubmit: (values) => {
      saveGithubSetting(values)
    },
    enableReinitialize: true
  })

  function deleteToken() {
    saveToken("");
  }

  function saveGithubSetting(setting) {
    api.saveGitHubSettingUsingPOST(setting).then(() => {
      enqueueSnackbar(`GitHub connector setting save success.`, {
        variant: "success",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    }).catch((err) => {
      enqueueSnackbar('Github connector setting save failed. Error: ' + err, {
        variant: "error",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    }).finally(() => {
      refetchTokenResult();
    });
  }

  function saveToken(token) {
    api.saveGithubPersonalTokenUsingPOST(token).then(() => {
      enqueueSnackbar(`Github token ${token ? "save" : "delete"} success.`, {
        variant: "success",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    }).catch((err) => {
      enqueueSnackbar('Github token save failed. Error: ' + err, {
        variant: "error",
        anchorOrigin: { vertical: "bottom", horizontal: "center" }
      });
    }).finally(() => {
      handleCloseDeleteDialog();
      refetchTokenResult();
    });
  }

  function handleCloseDeleteDialog() {
    setOpenDeleteDialog(false);
  }

  function showDeleteDialog() {
    setOpenDeleteDialog(true);
  }

  return (
    <div>
      <SettingSectionTitle first icon={GitHubIcon}>GitHub Integration</SettingSectionTitle>
      <form onSubmit={formikGithub.handleSubmit}>
        {
          githubSetting && githubSetting.tokenSet && <div className={'mt-4'}>
            <Alert severity={'info'}>Token has been set.</Alert>
          </div>
        }
        <TextField fullWidth={true} size={'small'} margin={'dense'}
          label={'Fine-grained personal access tokens'}
          id={'apiToken'} name={'apiToken'}
          value={formikGithub.values.apiToken || ''}
          onChange={formikGithub.handleChange}
          error={formikGithub.touched.apiToken && Boolean(formikGithub.errors.apiToken)}
          helperText={formikGithub.touched.apiToken && formikGithub.errors.apiToken}
        />
        <div className={'flex flex-wrap items-center gap-2 mb-2 mt-1'}>
          <TextField size={'small'} margin={'dense'}
            className={'w-full sm:w-[200px]'}
            label={'Display name'}
            id={'name'} name={'name'}
            value={formikGithub.values.name || ''}
            onChange={formikGithub.handleChange}
            error={formikGithub.touched.name && Boolean(formikGithub.errors.name)}
            helperText={formikGithub.touched.name && formikGithub.errors.name}
          />
          <TextField
            margin="dense"
            className={'w-[calc(50%-4px)] sm:w-[180px]'}
            id="fetchIntervalMinutes"
            label="Fetch interval minutes"
            value={formikGithub.values.fetchIntervalMinutes || 0}
            onChange={formikGithub.handleChange}
            error={formikGithub.touched.fetchIntervalMinutes && Boolean(formikGithub.errors.fetchIntervalMinutes)}
            helperText={formikGithub.touched.fetchIntervalMinutes && formikGithub.errors.fetchIntervalMinutes}
            type="number"
            variant="outlined"
            size={"small"}
          />
          <TextField
            margin="dense"
            className={'w-[calc(50%-4px)] sm:w-[180px]'}
            id="fetchPageSize"
            label="Fetch page size"
            value={formikGithub.values.fetchPageSize || 0}
            onChange={formikGithub.handleChange}
            error={formikGithub.touched.fetchPageSize && Boolean(formikGithub.errors.fetchPageSize)}
            helperText={formikGithub.touched.fetchPageSize && formikGithub.errors.fetchPageSize}
            type="number"
            variant="outlined"
            size={"small"}
          />
          <FormControlLabel
            control={<Checkbox value={true} name={'enabled'} onChange={formikGithub.handleChange}
              checked={!!formikGithub.values.enabled} />
            }
            label="Enable" />
        </div>

        <Button color={'primary'} variant={'contained'} size={'medium'} type={'submit'}>Save</Button>
        {
          githubSetting && githubSetting.tokenSet &&
          <Button color={'warning'} variant={'contained'} size={'medium'} type={'button'} sx={{ ml: 2 }}
            onClick={showDeleteDialog}>Delete Token</Button>
        }
        <Dialog
          open={openDeleteDialog}
          onClose={handleCloseDeleteDialog}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">
            {"Are you sure you want to delete token?"}
          </DialogTitle>
          <DialogActions>
            <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
            <Button onClick={deleteToken} autoFocus color={'warning'}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </form>
    </div>
  );
}

